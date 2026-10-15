import type { League } from '../simulation/league';
import { computeStandings, computeConferenceStandings, allStarBreakRound, teamGamesPlayed, type ScheduledGame } from '../simulation/league';
import type { GMLeagueExtras, DraftProspect } from '../simulation/gm';
import { signFreeAgent, computeAskingSalary } from '../simulation/gm';
import { maxFor, supermaxEligible } from '../simulation/maxContracts';
import { autoGeneratePlayoffBracket, currentMatchup, type PlayoffBracket } from '../simulation/playoffs';
import type { StretchStop } from '../simulation/autoPlay';
import type { GameResult } from '../simulation/boxscore';
import type { PlayerSeason } from '../simulation/types';
import { calculateOverall } from '../simulation/engine/overall';
import { RNG } from '../simulation/engine/rng';
import { generatePlayer } from '../simulation/leagueGenerator';
import { formatSeasonYear } from '../simulation/calendar';
import { findPlayer, replacePlayer, uniqueName, seasonRecord, freeAgentOffers, signOffer, requestTrade, careerResume, hallOfFame, retiredJerseys, type CareerYear, type Offer } from '../career/career';
import { legacyScore } from '../career/legacy';
import { tendenciesFor } from '../career/create';
import type { CategoryId } from '../career/categories';
import { applyEffects, heroForGame, trainHero, gradeOf, gameScore, draftPick, ordinal, classicEnding, TRAIN_STEP, TRAINABLE, STYLES, type StoryState, type StoryGame, type Ending } from './story';
import type { StoryWorld } from './storyStorage';
import { NBA_CARDS, NBA_GAMES, type NbaCard } from './storyNbaCards';
import { NBA_EVENTS } from './storyNbaEvents';
import { RETIRE_CARDS, finalCardId } from './storyNbaRetire';

/*
 * Story Mode, the NBA years: fifteen seasons in the real league. Your player is drafted into today's NBA (the same
 * league Career Mode plays in) and every season is played by the main game's engine around him. The story stops at
 * its moments (training camp, opening night, Christmas, the deadline, All-Star Weekend, the stretch run, every playoff
 * series, the awards, the summer) and the games between them are simulated. Key games are his team's real games.
 *
 * The story owns his ratings (they grow with his age, his training and his choices); the league owns everything else
 * about him (team, contract, stats, awards). Everything stays seeded: the same story and the same choices play the same.
 */

export const NBA_SEASONS = 15;
export type NbaStop = 'camp' | 'opener' | 'early' | 'christmas' | 'deadline' | 'allStar' | 'stretch' | 'finale' | 'playoffs' | 'awards' | 'summer';
export const SEASON_STOPS: NbaStop[] = ['camp', 'opener', 'early', 'christmas', 'deadline', 'allStar', 'stretch', 'finale', 'playoffs', 'awards', 'summer'];
export const STOP_LABEL: Record<NbaStop, string> = {
  camp: 'Training camp', opener: 'Opening night', early: 'November', christmas: 'Christmas', deadline: 'Trade deadline', allStar: 'All-Star Weekend',
  stretch: 'The stretch run', finale: 'The last week', playoffs: 'The playoffs', awards: 'Awards night', summer: 'The summer',
};

/** What waits for you at a stop, one at a time. */
export type NbaMoment =
  | { kind: 'card'; id: string }
  | { kind: 'game'; id: string; vs?: string }
  | { kind: 'allStar' } | { kind: 'standings' } | { kind: 'series'; decider?: boolean } | { kind: 'season' }
  | { kind: 'offers' } | { kind: 'train'; points: number }
  /** The last summer: the last game, then the retirement cards, then the end of the story. */
  | { kind: 'lastGame' } | { kind: 'farewell' };

/** One playoff matchup of his: a play-in game or a series. */
export interface SeriesNote { label: string; opp: string; won: boolean; w: number; l: number; games: number; pts: number; reb: number; ast: number }

export interface StoryNba {
  /** The league's key in the story database. */
  world: string;
  /** His player id in the league (a unique name), and Ice's. */
  playerId: string;
  iceId: string | null;
  /** Finished seasons, as Career Mode records them. */
  years: CareerYear[];
  /** The stop the story is at; its moments wait in `queue`. With the queue empty, the next stop's games are next. */
  stop: NbaStop;
  queue: NbaMoment[];
  /** Cards seen (no repeats; story chains read it). */
  seen: string[];
  /** His team at the last stop (a trade or a release since then gets its own moment). */
  teamId: string | null;
  /** This season's playoff run, matchup by matchup. */
  run: SeriesNote[];
  /** The career is over. */
  over?: boolean;
}

export interface NbaRun { s: StoryState; world: StoryWorld }
/** The league's background work (engine workers in the game, the same functions in-process in tests). */
export interface StorySim {
  /** Regular-season game days up to `stop` (see autoPlayStretch). */
  stretch(w: StoryWorld, stop: StretchStop, seed: number): Promise<StoryWorld>;
  /** Postseason game days until `teamId`'s matchup is decided (to the champion for null), or until its deciding game. */
  playoffs(w: StoryWorld, teamId: string | null, seed: number, stopAtDecider?: boolean): Promise<StoryWorld>;
  /** The rest of the playoffs, the awards and the rollover: the league stops at the draft. */
  toDraft(w: StoryWorld, seed: number): Promise<StoryWorld>;
  /** The draft, free agency and the next season's schedule. */
  fromDraft(w: StoryWorld, seed: number): Promise<{ world: StoryWorld; picks: { playerId: string; teamId: string }[] }>;
}

/** The season he is in (1-15); at the awards and in the summer, the season just played. */
export const nbaYear = (n: Pick<StoryNba, 'stop' | 'years'>) => (n.stop === 'awards' || n.stop === 'summer' ? n.years.length : n.years.length + 1);
export const nextStop = (n: Pick<StoryNba, 'stop'>): NbaStop => SEASON_STOPS[(SEASON_STOPS.indexOf(n.stop) + 1) % SEASON_STOPS.length];
export const currentMoment = (s: StoryState): NbaMoment | null => s.nba?.queue[0] ?? null;

// ---------------------------------------------------------------- reading the league

const teamName = (league: League, id: string | null | undefined) => (id ? league.teams.find(t => t.teamId === id)?.name ?? id : 'free agency');
const teamTotal = (league: League, teamId: string) => league.schedule.reduce((n, g) => n + (g.homeTeamId === teamId || g.awayTeamId === teamId ? 1 : 0), 0);
const weekendDone = (league: League) => league.allStarWeekend?.season === (league.season ?? '') && !!league.allStarWeekend?.completed;
const perGame = (v: number, gp: number) => (gp ? Math.round((v / gp) * 10) / 10 : 0);

/** Everything a moment's words read: his team, its record, his numbers, Ice. */
export interface NbaCtx {
  s: StoryState; n: StoryNba; league: League; extras: GMLeagueExtras;
  year: number; age: number; ovr: number; season: string;
  hero: PlayerSeason | null; teamId: string | null; teamName: string;
  w: number; l: number; rank: number | null;
  gp: number; ppg: number; rpg: number; apg: number;
  ice: { name: string; teamId: string | null; teamName: string; ovr: number; ppg: number } | null;
  /** His team's next opponent. */
  next: { teamId: string; name: string } | null;
  first: string;
  /** His deal: what he earns, years left (this season included), an extension already agreed, and what his team would offer to extend. */
  contract: { salary: number; years: number; extended: boolean; offer: number; supermax: boolean } | null;
  /** His team's record last season (the summer reads it). */
  lastRecord: { w: number; l: number } | null;
  /** Ice has retired. */
  iceRetired: boolean;
}

export function nbaCtx(s: StoryState, world: StoryWorld): NbaCtx {
  const n = s.nba!;
  const { league, extras } = world;
  const found = findPlayer(league, extras, n.playerId);
  const teamId = found?.teamId ?? null;
  const st = teamId ? computeStandings(league).find(r => r.teamId === teamId) : undefined;
  const conf = teamId ? league.teams.find(t => t.teamId === teamId)?.conferenceId : undefined;
  const confRows = conf ? computeConferenceStandings(league)[conf] : [];
  const rank = conf ? confRows.findIndex(r => r.teamId === teamId) + 1 || null : null;
  const stats = found?.player.seasonStats;
  const gp = stats?.gamesPlayed ?? 0;
  const iceFound = n.iceId ? findPlayer(league, extras, n.iceId) : null;
  const ig = iceFound?.player.seasonStats?.gamesPlayed ?? 0;
  const nextGame = teamId ? league.schedule.find(g => !g.played && (g.homeTeamId === teamId || g.awayTeamId === teamId)) : undefined;
  const nextId = nextGame ? (nextGame.homeTeamId === teamId ? nextGame.awayTeamId : nextGame.homeTeamId) : null;
  return {
    s, n, league, extras, year: nbaYear(n), age: found?.player.age ?? s.hero.age, ovr: calculateOverall(s.hero), season: formatSeasonYear(league.season),
    hero: found?.player ?? null, teamId, teamName: teamName(league, teamId),
    w: st?.wins ?? 0, l: st?.losses ?? 0, rank,
    gp, ppg: perGame(stats?.points ?? 0, gp), rpg: perGame((stats?.oreb ?? 0) + (stats?.dreb ?? 0), gp), apg: perGame(stats?.ast ?? 0, gp),
    ice: iceFound ? { name: n.iceId!, teamId: iceFound.teamId, teamName: teamName(league, iceFound.teamId), ovr: calculateOverall(iceFound.player), ppg: perGame(iceFound.player.seasonStats?.points ?? 0, ig) } : null,
    next: nextId ? { teamId: nextId, name: teamName(league, nextId) } : null,
    first: s.name.split(' ')[0],
    contract: contractOf(world, found?.player ?? null, teamId),
    lastRecord: n.years.at(-1)?.record ?? null,
    iceRetired: !!n.iceId && !!league.retiredPlayers?.some(r => r.playerId === n.iceId),
  };
}

function contractOf(world: StoryWorld, p: PlayerSeason | null, teamId: string | null): NbaCtx['contract'] {
  const c = p && teamId ? world.extras.contracts[p.playerId] : undefined;
  if (!p || !c || !teamId) return null;
  const team = world.league.teams.find(t => t.teamId === teamId);
  const cap = world.extras.capSettings;
  const ovr = calculateOverall(p);
  const supermax = supermaxEligible(p, team, true);
  const offer = Math.max(c.annualSalary, Math.min(maxFor(p, team, true, cap), ovr >= 80 ? maxFor(p, team, true, cap) : computeAskingSalary(ovr, cap)));
  return { salary: c.annualSalary, years: c.yearsRemaining, extended: !!c.extension, offer, supermax };
}

// ---------------------------------------------------------------- his ratings in the league

/** His player in the league: the story's ratings (grit and hype on the mental side); everything else the league's. */
function asLeaguePlayer(s: StoryState, base: PlayerSeason): PlayerSeason {
  let p: PlayerSeason = { ...base, attributes: heroForGame(s).attributes, careerPlayer: true };
  p = { ...p, tendencies: tendenciesFor(p) };
  const ovr = calculateOverall(p);
  return { ...p, development: { ...p.development, potential: Math.max(ovr, Math.min(99, ovr + Math.max(0, 27 - p.age) * 2)) } };
}
/** Writes his current ratings into the league (before every stretch of games). */
export function syncHero(s: StoryState, world: StoryWorld): StoryWorld {
  const n = s.nba;
  const found = n ? findPlayer(world.league, world.extras, n.playerId) : null;
  if (!n || !found) return world;
  const r = replacePlayer(world.league, world.extras, asLeaguePlayer(s, found.player));
  return { ...world, league: r.league, extras: r.extras };
}

/** One NBA summer: young players grow fast, the prime holds, then age takes the legs first and the skills later. */
export function developNba(hero: PlayerSeason, age: number): PlayerSeason {
  const skill = age <= 21 ? 3.5 : age <= 22 ? 3 : age <= 23 ? 2.5 : age <= 24 ? 2 : age <= 25 ? 1.5 : age <= 26 ? 1 : age <= 29 ? 0 : -(age - 29) * 0.8;
  const legs = age <= 25 ? skill : age <= 27 ? 0 : -(age - 27) * 1.1;
  const mind = age <= 32 ? Math.max(1, skill) : -0.6;
  let next = hero;
  for (const cat of TRAINABLE) next = trainHero(next, cat, cat === 'athleticism' || cat === 'body' ? legs : cat === 'iq' ? mind : skill);
  return { ...next, age };
}

// ---------------------------------------------------------------- into the league

const ICE_NAME = 'Marcus Vance';
const newNba = (world: string, playerId: string, iceId: string | null): StoryNba => ({ world, playerId, iceId, years: [], stop: 'summer', queue: [], seen: [], teamId: null, run: [] });

/**
 * Draft night, part one: he (and Ice) join the real draft class. How high he goes comes from the story (his rating,
 * his hype, his big games): his upside is set so the league's front offices rank him about there.
 */
export function enterDraft(s: StoryState, world: StoryWorld): NbaRun {
  const { league, extras } = world;
  const season = league.season ?? '';
  const playerId = uniqueName(league, extras, s.name);
  const taken = { ...extras, draftClass: [...extras.draftClass, { playerId } as DraftProspect] };
  const iceId = uniqueName(league, taken, ICE_NAME);
  const score = (p: PlayerSeason) => p.development.potential * 0.8 + calculateOverall(p) * 0.2;
  const ranked = extras.draftClass.map(d => score(d.trueSeason)).sort((a, b) => b - a);
  const slot = (pick: number) => (pick <= 1 ? (ranked[0] ?? 80) + 3 : ((ranked[pick - 2] ?? 50) + (ranked[Math.min(pick - 1, ranked.length - 1)] ?? 50)) / 2);
  const withUpside = (p: PlayerSeason, pick: number | null): PlayerSeason => {
    const ovr = calculateOverall(p);
    const potential = pick == null ? ovr : Math.max(ovr, Math.min(99, Math.round((slot(pick) - ovr * 0.2) / 0.8)));
    return { ...p, development: { ...p.development, potential } };
  };
  const target = draftPick(s);
  const hero = withUpside(asLeaguePlayer(s, { ...s.hero, playerId, teamId: null, season, careerHistory: [], seasonStats: undefined }), target);
  const rng = new RNG(s.seed * 17 + 3);
  const icePick = target === 1 ? 2 : target && target <= 3 ? 1 : 1 + rng.nextInt(3);
  const ice = withUpside(generatePlayer(iceId, season, null, s.hero.age, s.seed % 997, rng, { caliber: 64, prospect: true, archetype: STYLES[s.style === 'scorer' ? 'wing' : 'scorer'].archetype }), icePick);
  const prospect = (p: PlayerSeason): DraftProspect => ({ playerId: p.playerId, trueSeason: p, scoutedPotential: p.development.potential, scoutingAccuracy: 0.95 });
  return {
    s: { ...s, nba: newNba(world.id, playerId, iceId) },
    world: { ...world, extras: { ...extras, draftClass: [prospect(hero), prospect(ice), ...extras.draftClass] } },
  };
}

/** Signs a free agent to the first team that will take him (a preferred team first; a minimum deal). */
function signAnywhere(w: StoryWorld, playerId: string, preferName?: string | null): StoryWorld {
  const { league, extras } = w;
  const teams = [...league.teams].sort((a, b) => Number(b.name === preferName) - Number(a.name === preferName) || a.seasons.length - b.seasons.length);
  for (const t of teams) {
    const r = signFreeAgent(league, { ...extras, freeAgencyOpen: true }, playerId, t.teamId, { annualSalary: extras.capSettings.minSalary, yearsRemaining: 2, playerOption: false, teamOption: false });
    if (r.league !== league) return { ...w, league: r.league, extras: { ...r.extras, freeAgencyOpen: extras.freeAgencyOpen } };
  }
  return w;
}

/** Draft night, part two (after the league's draft and free agency): where he went, where Ice went, and his first camp. */
export function afterDraft(run: NbaRun, picks: { playerId: string; teamId: string }[]): NbaRun {
  let { s, world } = run;
  const n = s.nba!;
  const at = (id: string | null) => (id ? picks.findIndex(p => p.playerId === id) : -1);
  const i = at(n.playerId), j = at(n.iceId);
  if (!findPlayer(world.league, world.extras, n.playerId)?.teamId) world = signAnywhere(world, n.playerId);
  if (n.iceId && !findPlayer(world.league, world.extras, n.iceId)?.teamId) world = signAnywhere(world, n.iceId);
  const pick = i >= 0 ? i + 1 : null;
  const team = pick ? teamName(world.league, picks[i].teamId) : 'Undrafted (summer league invite)';
  const signedWith = teamName(world.league, findPlayer(world.league, world.extras, n.playerId)?.teamId);
  const draft = { pick, team, icePick: j >= 0 ? j + 1 : null, iceTeam: j >= 0 ? teamName(world.league, picks[j].teamId) : teamName(world.league, findPlayer(world.league, world.extras, n.iceId ?? '')?.teamId) };
  const last = pick ? `With the ${ordinal(pick)} pick in the ${(world.league.season ?? '').slice(0, 4)} NBA Draft, ${team} select... ${s.name}.${draft.icePick ? ` Ice went ${ordinal(draft.icePick)} to ${draft.iceTeam}.` : ''}`
    : `Sixty names are called. Yours isn't. At midnight your phone rings: ${signedWith} want you on a two-year minimum deal. You take it.`;
  s = { ...s, beat: 'nba', draft, hype: s.hype + (pick && pick <= 10 ? 2 : 0), last };
  return arrive({ s, world }, 'camp');
}

/** An older story that reached the NBA before there was a league: he signs with the team that drafted him. */
export function joinLeague(run: NbaRun): NbaRun {
  let { s, world } = run;
  const { league, extras } = world;
  const playerId = uniqueName(league, extras, s.name);
  const hero = asLeaguePlayer(s, { ...s.hero, playerId, teamId: null, season: league.season ?? '', careerHistory: [], seasonStats: undefined });
  world = { ...world, extras: { ...extras, freeAgents: [...extras.freeAgents, hero] } };
  s = { ...s, nba: newNba(world.id, playerId, null) };
  world = signAnywhere(world, playerId, s.draft?.team);
  return arrive({ s: { ...s, beat: 'nba', last: `${teamName(world.league, findPlayer(world.league, world.extras, playerId)?.teamId)}. A real NBA league this time: fifteen seasons, every game played.` }, world }, 'camp');
}

// ---------------------------------------------------------------- the season, stop by stop

export type SimRequest = { kind: 'stretch'; stop: StretchStop } | { kind: 'toDraft' } | { kind: 'fromDraft' };
const FRACTION: Partial<Record<NbaStop, number>> = { early: 0.25, christmas: 0.36, deadline: 0.52, stretch: 0.85 };

/** The team whose games mark the stops (his; his last one while he is unsigned). */
function markerTeam(s: StoryState, world: StoryWorld): string {
  const n = s.nba!;
  return findPlayer(world.league, world.extras, n.playerId)?.teamId ?? n.teamId ?? world.league.teams[0].teamId;
}

/** What has to be played to reach a stop. */
export function simFor(stop: NbaStop, s: StoryState, world: StoryWorld): SimRequest | null {
  const { league } = world;
  const teamId = markerTeam(s, world);
  const total = teamTotal(league, teamId);
  if (stop === 'camp') return world.phase === 'atDraft' ? { kind: 'fromDraft' } : null;
  if (FRACTION[stop] != null) return { kind: 'stretch', stop: { teamId, games: Math.max(1, Math.round(total * FRACTION[stop]!)) } };
  if (stop === 'allStar') return allStarBreakRound(league) == null || weekendDone(league) ? null : { kind: 'stretch', stop: { teamId, games: Math.round(total * 0.7), allStar: true } };
  if (stop === 'finale') return { kind: 'stretch', stop: { teamId, games: 1e9 } };
  if (stop === 'awards') return { kind: 'toDraft' };
  return null;
}

const seedFor = (s: StoryState, salt: number) => s.seed * 31 + (s.nba?.years.length ?? 0) * 7919 + SEASON_STOPS.indexOf(s.nba?.stop ?? 'camp') * 131 + salt;

/** Plays what the next stop needs and arrives there (its moments wait in the queue; some stops have none). */
export async function toNextStop(run: NbaRun, sim: StorySim): Promise<NbaRun> {
  const n = run.s.nba;
  if (!n || n.over || n.queue.length) return run;
  const stop = nextStop(n);
  let world = syncHero(run.s, run.world);
  const req = simFor(stop, run.s, world);
  const seed = seedFor(run.s, 1);
  if (req?.kind === 'stretch') world = await sim.stretch(world, req.stop, seed);
  else if (req?.kind === 'toDraft') world = await sim.toDraft(world, seed);
  else if (req?.kind === 'fromDraft') world = (await sim.fromDraft(world, seed)).world;
  return arrive({ s: run.s, world }, stop);
}

/** On to the next moment (through stops that have none), or the end of the career. */
export async function toNextMoment(run: NbaRun, sim: StorySim): Promise<NbaRun> {
  let r = run;
  for (let guard = 0; guard < SEASON_STOPS.length * 2 && r.s.nba && !r.s.nba.over && !r.s.nba.queue.length && !r.s.done; guard++) r = await toNextStop(r, sim);
  return r;
}

/** Arriving at a stop: what happened since the last one, and the moments that wait here. */
export function arrive(run: NbaRun, stop: NbaStop): NbaRun {
  let { s, world } = run;
  const before = s.nba!;
  let n: StoryNba = { ...before, stop, queue: [] };
  s = { ...s, nba: n };
  const found = findPlayer(world.league, world.extras, n.playerId);
  const teamId = found?.teamId ?? null;
  const queue: NbaMoment[] = [];
  const inSeason = stop !== 'awards' && stop !== 'summer';
  if (stop !== 'camp' && inSeason && before.teamId && teamId && teamId !== before.teamId) queue.push({ kind: 'card', id: 'sys-traded' });
  if (inSeason && !teamId) queue.push({ kind: 'offers' });

  if (stop === 'awards') {
    // The season is in the books (the league has rolled over): his line goes on record, then a summer older.
    const year = world.partial ? seasonRecord(world.league, world.extras, { playerId: n.playerId }, world.partial.season) : null;
    n = { ...n, years: year ? [...n.years, year] : n.years };
    s = { ...s, nba: n, hero: found ? developNba(s.hero, found.player.age) : s.hero };
    queue.push({ kind: 'season' });
  }
  if (stop === 'playoffs' && !world.league.schedule.some(g => !g.played)) {
    const bracket = world.league.playoffBracket ?? autoGeneratePlayoffBracket(world.league);
    world = { ...world, league: { ...world.league, playoffBracket: bracket } };
    n = { ...n, run: [] };
    if (teamId && currentMatchup(bracket, teamId)) queue.push({ kind: 'series' });
  }
  s = { ...s, nba: n };
  const ctx = nbaCtx(s, world);
  const card = (at: NbaStop) => { const c = pickCard(s, ctx, at); if (c) { queue.push({ kind: 'card', id: c.id }); n = { ...n, seen: [...n.seen, c.id] }; } };
  const iceGame = (): NbaMoment | null => {
    const iceTeam = ctx.ice?.teamId;
    if (!iceTeam || !teamId || iceTeam === teamId || n.seen.includes(`ice-${ctx.year}`)) return null;
    const left = upcoming(world.league, teamId).slice(0, 12);
    if (!left.some(g => g.homeTeamId === iceTeam || g.awayTeamId === iceTeam)) return null;
    n = { ...n, seen: [...n.seen, `ice-${ctx.year}`] };
    return { kind: 'game', id: 'ice', vs: iceTeam };
  };
  switch (stop) {
    case 'camp': card('camp'); break;
    case 'opener': if (teamId) queue.push({ kind: 'game', id: ctx.year === 1 ? 'debut' : ctx.year >= NBA_SEASONS ? 'last-opener' : 'opener' }); break;
    case 'early': case 'stretch': {
      // A story beat that applies comes first; then Ice, if his team is on the schedule soon; then the deck.
      const g = hasFirstCard(s, ctx, stop) ? null : iceGame();
      if (g) queue.push(g); else card(stop);
      break;
    }
    case 'christmas': if (teamId && (ctx.w >= ctx.l + 4 || ctx.ovr >= 72)) queue.push({ kind: 'game', id: 'christmas' }); else card('christmas'); break;
    case 'deadline': card('deadline'); break;
    case 'allStar': if (weekendDone(world.league)) queue.push({ kind: 'allStar' }); break;
    case 'finale': queue.push({ kind: 'standings' }); break;
    case 'summer': {
      if (n.years.length >= NBA_SEASONS) {
        queue.push({ kind: 'lastGame' }, { kind: 'card', id: 'retire-day' }, { kind: 'card', id: 'retire-next' }, { kind: 'card', id: finalCardId(n.years) }, { kind: 'farewell' });
        break;
      }
      if (!teamId) queue.push({ kind: 'offers' });
      queue.push({ kind: 'train', points: summerPoints(s) });
      card('summer');
      break;
    }
    default: break;
  }
  return { s: { ...s, nba: { ...n, queue: [...queue], teamId: teamId ?? n.teamId } }, world };
}

const upcoming = (league: League, teamId: string): ScheduledGame[] => league.schedule.filter(g => !g.played && (g.homeTeamId === teamId || g.awayTeamId === teamId));
export const summerPoints = (s: StoryState) => 2 + (s.grit >= 10 ? 1 : 0);

/** Every card: the season's (camp, contracts, the business) and the deck of what happens around it. */
export const NBA_DECK: NbaCard[] = [...NBA_CARDS, ...NBA_EVENTS, ...RETIRE_CARDS];
const cardsFor = (s: StoryState, ctx: NbaCtx, stop: NbaStop) => NBA_DECK.filter(c => c.stops.includes(stop) && (c.repeat || !s.nba!.seen.includes(c.id)) && (!c.when || c.when(ctx)));
const hasFirstCard = (s: StoryState, ctx: NbaCtx, stop: NbaStop) => cardsFor(s, ctx, stop).some(c => c.first);

function pickCard(s: StoryState, ctx: NbaCtx, stop: NbaStop): NbaCard | null {
  const n = s.nba!;
  const pool = cardsFor(s, ctx, stop);
  if (!pool.length) return null;
  const first = pool.filter(c => c.first);
  const from = first.length ? first : pool;
  const rng = new RNG(s.seed * 7 + ctx.year * 101 + SEASON_STOPS.indexOf(stop) * 13 + n.seen.length);
  // A card that comes back is less likely each time it has (fresh cards first).
  const weight = (c: NbaCard) => (c.weight ?? 1) / (1 + 2 * n.seen.filter(id => id === c.id).length);
  const total = from.reduce((t, c) => t + weight(c), 0);
  let roll = rng.next() * total;
  for (const c of from) { roll -= weight(c); if (roll <= 0) return c; }
  return from[from.length - 1];
}

// ---------------------------------------------------------------- moments

const CARD_BY_ID = new Map(NBA_DECK.map(c => [c.id, c]));
const GAME_BY_ID = new Map(NBA_GAMES.map(g => [g.id, g]));
export const nbaCard = (id: string) => CARD_BY_ID.get(id);
export const nbaGame = (id: string) => GAME_BY_ID.get(id);
const dequeue = (s: StoryState): StoryState => ({ ...s, nba: { ...s.nba!, queue: s.nba!.queue.slice(1) } });

export function chooseNba(run: NbaRun, choiceId: string): NbaRun {
  const m = currentMoment(run.s);
  const card = m?.kind === 'card' ? CARD_BY_ID.get(m.id) : undefined;
  if (!card) return run;
  const ctx = nbaCtx(run.s, run.world);
  const c = card.choices(ctx).find(x => x.id === choiceId);
  if (!c) return run;
  let s = applyEffects(run.s, c.effects);
  let world = run.world;
  let note = '';
  if (c.contract === 'extend' && ctx.contract && ctx.teamId) {
    const id = s.nba!.playerId, cur = world.extras.contracts[id];
    const extension = { annualSalary: ctx.contract.offer, years: ctx.contract.supermax ? 5 : 4, agreedSeason: world.league.season ?? '' };
    world = { ...world, extras: { ...world.extras, contracts: { ...world.extras.contracts, [id]: { ...cur, extension } } } };
  }
  if (c.trade && ctx.teamId) {
    const r = requestTrade(world.league, world.extras, { playerId: s.nba!.playerId, seed: s.seed, years: s.nba!.years }, c.trade);
    world = { ...world, league: r.league, extras: r.extras };
    note = ` ${r.note}`;
    s = { ...s, nba: { ...s.nba!, teamId: findPlayer(world.league, world.extras, s.nba!.playerId)?.teamId ?? null } };
  }
  return { s: { ...dequeue(s), last: (typeof c.result === 'function' ? c.result(ctx) : c.result) + note }, world };
}

interface Line { pts: number; reb: number; ast: number; stl: number; blk: number; fgm: number; fga: number; min: number }
const lineIn = (r: GameResult, playerId: string): Line => {
  const l = r.homeBox.players[playerId] ?? r.awayBox.players[playerId];
  return l ? { pts: l.points, reb: l.oreb + l.dreb, ast: l.ast, stl: l.stl, blk: l.blk, fgm: l.fgm, fga: l.fga, min: Math.round(l.minutes) } : { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, min: 0 };
};
const sideOf = (r: GameResult, teamId: string) => (r.homeTeamId === teamId ? { us: r.homeScore, them: r.awayScore, opp: r.awayTeamId } : { us: r.awayScore, them: r.homeScore, opp: r.homeTeamId });

/** A key game: his team's next real game (or its next one against Ice), played by the engine. */
export async function playNbaGame(run: NbaRun, sim: StorySim): Promise<NbaRun> {
  const m = currentMoment(run.s);
  const def = m?.kind === 'game' ? GAME_BY_ID.get(m.id) : undefined;
  if (!m || m.kind !== 'game' || !def) return run;
  const ctx = nbaCtx(run.s, run.world);
  const teamId = ctx.teamId;
  if (!teamId) return { ...run, s: dequeue(run.s) };
  let world = syncHero(run.s, run.world);
  let played = teamGamesPlayed(world.league, teamId);
  if (m.vs) {
    // Up to the night before the game against Ice's team.
    const k = upcoming(world.league, teamId).findIndex(g => g.homeTeamId === m.vs || g.awayTeamId === m.vs);
    if (k > 0) { world = await sim.stretch(world, { teamId, games: played + k }, seedFor(run.s, 7)); played = teamGamesPlayed(world.league, teamId); }
  }
  world = await sim.stretch(syncHero(run.s, world), { teamId, games: played + 1 }, seedFor(run.s, 11));
  const g = world.league.schedule.filter(x => x.played && (x.homeTeamId === teamId || x.awayTeamId === teamId))[played];
  if (!g?.result) return { s: { ...dequeue(run.s), last: 'The game was called off. The season goes on.' }, world };
  const line = lineIn(g.result, run.s.nba!.playerId);
  const side = sideOf(g.result, teamId);
  const won = side.us > side.them;
  const game: StoryGame = { beat: `nba${ctx.year}-${def.id}`, title: def.title(ctx), opp: teamName(world.league, side.opp), us: side.us, them: side.them, won, line, grade: gradeOf(line) };
  let s = applyEffects({ ...run.s, games: [...run.s.games, game] }, won ? def.reward?.win : def.reward?.loss);
  if (game.grade.startsWith('A')) s = applyEffects(s, { hype: 1 });
  const after = nbaCtx(s, world);
  const text = line.min ? (won ? def.win(after, game) : def.loss(after, game))
    : `You watched this one from the bench in street clothes. ${won ? `${after.teamName} won it anyway, ${side.us}-${side.them}.` : `${after.teamName} lost ${side.them}-${side.us}.`}`;
  return { s: { ...dequeue(s), last: text }, world };
}

/** "The first round", "The NBA Finals", "The play-in". */
export const roundLabel = (b: PlayoffBracket, id: string): string => {
  if (id.startsWith('pi-')) return 'The play-in';
  const round = b.rounds.findIndex(r => r.some(x => x.id === id));
  const fromEnd = b.rounds.length - 1 - round;
  return fromEnd === 0 ? 'The NBA Finals' : fromEnd === 1 ? 'The Conference Finals' : fromEnd === 2 ? 'The second round' : 'The first round';
};

/** His next playoff matchup, played to the end. */
export async function playNbaSeries(run: NbaRun, sim: StorySim): Promise<NbaRun> {
  const m = currentMoment(run.s);
  const ctx = nbaCtx(run.s, run.world);
  const bracket = run.world.league.playoffBracket;
  const id = bracket && ctx.teamId ? currentMatchup(bracket, ctx.teamId) : null;
  if (m?.kind !== 'series' || !id || !ctx.teamId) return m?.kind === 'series' ? { ...run, s: dequeue(run.s) } : run;
  const teamId = ctx.teamId;
  const decider = !!m.decider;
  const world = await sim.playoffs(syncHero(run.s, run.world), teamId, seedFor(run.s, 13 + run.s.nba!.run.length), !decider);
  const b = world.league.playoffBracket!;
  const label0 = roundLabel(b, id);
  if (currentMatchup(b, teamId) === id) {
    // All square with one game to play: the deciding game is yours to play.
    const sr0 = b.rounds.flat().find(x => x.id === id);
    const opp0 = sr0 ? teamName(world.league, sr0.teamAId === teamId ? sr0.teamBId : sr0.teamAId) : 'them';
    const n0 = run.s.nba!;
    return { s: { ...run.s, nba: { ...n0, queue: [{ kind: 'series', decider: true }, ...n0.queue.slice(1)] }, last: `${label0} against ${opp0}: ${sr0?.teamAWins ?? 3}-${sr0?.teamBWins ?? 3}. It all comes down to one game.` }, world };
  }
  const pi = b.playIn?.find(x => x.id === id);
  const sr = b.rounds.flat().find(x => x.id === id);
  const games = pi?.result ? [pi.result] : sr?.games ?? [];
  const won = (pi?.winnerTeamId ?? sr?.winnerTeamId) === teamId;
  const oppId = pi ? (pi.teamAId === teamId ? pi.teamBId : pi.teamAId) : sr ? (sr.teamAId === teamId ? sr.teamBId : sr.teamAId) : null;
  const w = pi ? (won ? 1 : 0) : sr ? (sr.teamAId === teamId ? sr.teamAWins : sr.teamBWins) : 0;
  const l = pi ? (won ? 0 : 1) : sr ? (sr.teamAId === teamId ? sr.teamBWins : sr.teamAWins) : 0;
  const lines = games.map(r => lineIn(r, run.s.nba!.playerId));
  const sum = (k: keyof Line) => lines.reduce((t, x) => t + x[k], 0);
  const label = roundLabel(b, id);
  const note: SeriesNote = { label, opp: teamName(world.league, oppId), won, w, l, games: games.length, pts: sum('pts'), reb: sum('reb'), ast: sum('ast') };
  // The deciding game goes in his book of big games.
  const last = games.at(-1);
  let s = run.s;
  if (last) {
    const line = lineIn(last, s.nba!.playerId), side = sideOf(last, teamId);
    const title = pi ? 'Play-in' : decider ? `Game ${games.length}: ${label.replace(/^The /, '')}` : `${label.replace(/^The /, '')}, Game ${games.length}`;
    s = { ...s, games: [...s.games, { beat: `nba${ctx.year}-${id}`, title, opp: note.opp, us: side.us, them: side.them, won: side.us > side.them, line, grade: gradeOf(line) }] };
  }
  const champion = b.championTeamId === teamId;
  s = applyEffects(s, won ? { hype: champion ? 4 : label === 'The play-in' ? 0 : 1, ...(champion ? { flag: 'champion' } : {}) } : { grit: 1 });
  const alive = currentMatchup(b, teamId) != null;
  const n = s.nba!;
  const per = (v: number) => (note.games ? (v / note.games).toFixed(1) : '0');
  const text = pi ? (won ? `Play-in: you beat ${note.opp}${lines[0]?.pts ? `, ${lines[0].pts} points` : ''}. ${alive ? 'On to the playoffs.' : ''}` : `Play-in: ${note.opp} end your season.`)
    : `${decider ? `GAME ${games.length}. ${won ? 'You did it.' : 'So close.'} ` : ''}${label}${champion ? '' : ` against ${note.opp}`}: ${won ? 'won' : 'lost'} ${w}-${l}. You averaged ${per(note.pts)} points, ${per(note.reb)} rebounds and ${per(note.ast)} assists.${champion ? ' NBA CHAMPIONS. The confetti falls and you find your family in the crowd.' : won ? '' : ' The season is over.'}`;
  return { s: { ...s, nba: { ...n, run: [...n.run, note], queue: alive ? n.queue : n.queue.slice(1) }, last: text }, world };
}

/** The moments that only need reading: All-Star Weekend, the standings, the season's wrap, the last game, the farewell. */
export function continueNba(run: NbaRun): NbaRun {
  const m = currentMoment(run.s);
  if (!m) return run;
  let s = run.s;
  if (m.kind === 'allStar') {
    const ctx = nbaCtx(s, run.world);
    const wk = run.world.league.allStarWeekend;
    const me = s.nba!.playerId;
    const star = !!wk?.voting?.selected?.some(x => x.playerId === me) || !!wk?.gameResult && [...wk.gameResult.squadA.playerIds, ...wk.gameResult.squadB.playerIds].includes(me);
    s = applyEffects(s, star ? { hype: 2, flag: `allStar${ctx.year}` } : {});
    if (wk?.mvp?.playerId === me || wk?.risingStarsMvp?.playerId === me) s = applyEffects(s, { hype: 1 });
  }
  if (m.kind === 'farewell') return { ...run, s: { ...s, done: true, nba: { ...s.nba!, over: true, queue: [] }, last: undefined } };
  if (m.kind === 'season') {
    const y = s.nba!.years.at(-1);
    s = applyEffects(s, { hype: Math.min(4, (y?.awards.length ?? 0)) });
  }
  return { ...run, s: { ...dequeue(s), last: undefined } };
}

/** Free agency (or a release): the offers, best first. */
export const nbaOffers = (run: NbaRun): Offer[] => freeAgentOffers(run.world.league, run.world.extras, { playerId: run.s.nba!.playerId, years: run.s.nba!.years });

export function signNba(run: NbaRun, index: number | null): NbaRun {
  const m = currentMoment(run.s);
  if (m?.kind !== 'offers') return run;
  const { league, extras } = run.world;
  const offer = index == null ? undefined : nbaOffers(run)[index];
  let world = run.world, note: string;
  if (offer) {
    const r = signOffer(league, { ...extras, freeAgencyOpen: true }, { playerId: run.s.nba!.playerId }, offer);
    world = { ...world, league: r.league, extras: { ...r.extras, freeAgencyOpen: extras.freeAgencyOpen } };
    note = r.note;
  } else {
    world = signAnywhere(world, run.s.nba!.playerId);
    note = `Nobody had a big offer. You signed a minimum deal with ${teamName(world.league, findPlayer(world.league, world.extras, run.s.nba!.playerId)?.teamId)}.`;
  }
  const teamId = findPlayer(world.league, world.extras, run.s.nba!.playerId)?.teamId ?? null;
  return { s: { ...dequeue(run.s), nba: { ...dequeue(run.s).nba!, teamId }, last: note }, world };
}

export function trainNba(run: NbaRun, cat: CategoryId): NbaRun {
  const m = currentMoment(run.s);
  if (m?.kind !== 'train' || !TRAINABLE.includes(cat)) return run;
  const hero = trainHero(run.s.hero, cat, TRAIN_STEP);
  const n = run.s.nba!;
  const left = m.points - 1;
  const s: StoryState = { ...run.s, hero, nba: { ...n, queue: left > 0 ? [{ kind: 'train', points: left }, ...n.queue.slice(1)] : n.queue.slice(1) } };
  return { ...run, s: left > 0 ? s : { ...s, last: 'A summer of work. You feel it in your legs and see it in your shot.' } };
}

/** Awards night's headline: his biggest honour of the season, if any. */
export function seasonHeadline(y: CareerYear | undefined): string | null {
  const has = (k: string) => !!y?.awards.some(a => a.key === k);
  if (has('champion') && has('fmvp')) return 'NBA Champion and Finals MVP';
  if (has('mvp')) return 'Most Valuable Player';
  if (has('champion')) return 'NBA Champion';
  if (has('dpoy')) return 'Defensive Player of the Year';
  if (has('roy')) return 'Rookie of the Year';
  if (has('allLeague1')) return 'All-NBA First Team';
  if (has('mip')) return 'Most Improved Player';
  if (has('smoy')) return 'Sixth Man of the Year';
  if (has('allStar')) return 'All-Star';
  return null;
}

// ---------------------------------------------------------------- the end

export interface NbaCareerLine { seasons: number; games: number; ppg: number; rpg: number; apg: number; titles: number; mvps: number; allStars: number; legacy: number; hallOfFame: 'first-ballot' | 'yes' | 'no'; jerseys: string[] }
export function nbaCareerLine(n: StoryNba): NbaCareerLine {
  const r = careerResume({ years: n.years });
  const legacy = legacyScore(r);
  return {
    seasons: n.years.length, games: r.games, ppg: perGame(r.pts, r.games), rpg: perGame(r.reb, r.games), apg: perGame(r.ast, r.games),
    titles: r.titles, mvps: r.mvp, allStars: r.allStar, legacy, hallOfFame: hallOfFame(legacy), jerseys: retiredJerseys({ years: n.years }),
  };
}

/** The endings of the NBA years, most legendary first (see pickEnding). */
export const NBA_ENDINGS = ['goat', 'legend', 'champion', 'star', 'oneCity', 'journeyman', 'family', 'pro', 'grinder'] as const;
export type NbaEndingId = (typeof NBA_ENDINGS)[number];

/** Which ending a career earns: greatness first, then a ring, then the shape of the career, then the people. */
export function pickEnding(c: Pick<NbaCareerLine, 'legacy' | 'titles' | 'seasons'>, teams: number, bonds: Pick<StoryState['bonds'], 'dre' | 'ray' | 'maya'>): NbaEndingId {
  if (c.legacy >= 150) return 'goat';
  if (c.legacy >= 90) return 'legend';
  if (c.titles > 0) return 'champion';
  if (c.legacy >= 45) return 'star';
  if (teams === 1 && c.seasons >= 10) return 'oneCity';
  if (teams >= 5) return 'journeyman';
  if (bonds.dre + bonds.ray + (bonds.maya ?? 0) >= 12) return 'family';
  return c.legacy >= 15 ? 'pro' : 'grinder';
}

/** How the story ends: his whole NBA career (stories from before the NBA years keep their old endings). */
export function storyEnding(s: StoryState): Ending {
  if (!s.nba || s.classic) return classicEnding(s);
  const n = s.nba;
  const c = nbaCareerLine(n);
  const has = (f: string) => s.flags.includes(f);
  const tier: Ending['tier'] = c.legacy >= 90 ? 'legend' : c.legacy >= 45 ? 'star' : c.legacy >= 15 ? 'pro' : 'grinder';
  const teams = [...new Set(n.years.filter(y => y.teamId).map(y => y.teamName))];
  const id = pickEnding(c, teams.length, s.bonds);
  const name = s.name.split(' ')[0];
  const line = `${c.seasons} seasons, ${c.games} games: ${c.ppg} points, ${c.rpg} rebounds and ${c.apg} assists a game.`;
  const rings = c.titles ? ` ${c.titles} title${c.titles === 1 ? '' : 's'}.` : '';
  const hof = c.hallOfFame === 'first-ballot' ? ' A first-ballot Hall of Famer.' : c.hallOfFame === 'yes' ? ' A Hall of Famer.' : '';
  const base: Record<NbaEndingId, { title: string; text: string }> = {
    goat: { title: 'The Greatest', text: `${s.name} retires as the best player of a generation, and maybe of any other. ${line}${rings}${c.mvps ? ` ${c.mvps}× MVP.` : ''} The arguments at Carver Park are finally over.` },
    legend: { title: 'Immortal', text: `${s.name} goes into the Hall of Fame on the first ballot. ${line}${rings}${c.mvps ? ` ${c.mvps}× MVP.` : ''} Kids at Carver Park argue about whether anyone was ever better.` },
    champion: { title: 'Ring Night', text: `${name} won ${c.titles === 1 ? 'a championship' : `${c.titles} championships`}. ${line}${hof} Whatever else anyone says, the ring${c.titles === 1 ? ' is' : 's are'} real.` },
    star: { title: 'Hall of Famer', text: `${s.name}'s jacket is gold and the speech makes the whole room cry. ${line}${c.allStars ? ` ${c.allStars}× All-Star.` : ''}` },
    oneCity: { title: 'One City', text: `${c.seasons} seasons, one jersey. ${line} ${teams[0]} fans name a street after ${name}; it runs right past the arena.` },
    journeyman: { title: 'Have Bags, Will Travel', text: `${teams.length} teams, ${line} Every locker room ${name} ever walked into got a little better, and every one of them still texts.` },
    family: { title: 'Rich in Every Way', text: `${line} The trophies were never the point. At the end of it all, everyone who was there at Carver Park is still there.` },
    pro: { title: 'A Long Career', text: `${name} played fifteen years in the best league in the world. ${line} Most kids from Carver Park never get one.` },
    grinder: { title: 'Still Standing', text: `It was never easy. ${line} But ${name} was still there at the end, and the kids at Carver Park know the name.` },
  };
  const jerseys = c.jerseys.length ? `\nThe ${c.jerseys.join(' and the ')} retired your number.` : '';
  const after = has('afterTv') ? 'You became the loudest voice on the best basketball show on TV. Your catchphrase is on T-shirts.'
    : has('afterCoach') ? 'You are a head coach now. Your first timeout speech was word for word what Ray told you at Carver Park.'
      : has('afterGm') ? 'You run a front office now. Last June you drafted a skinny kid from a park with no nets.'
        : has('afterGym') ? 'The Carver Park Center has your name and Dre\'s over the door. Two hundred kids a day, and every light works.'
          : 'You never miss one of Maya\'s games or one of Mom\'s Sunday dinners. Turns out that was the dream too.';
  const dre = has('dreManager') && s.bonds.dre >= 1 ? 'Dre ran your business for fifteen years and never lost a dollar. He still wears the suit.'
    : s.bonds.dre >= 4 ? 'Dre sits in the front row at every one of your big nights, wearing the first jersey you ever gave him.'
      : s.bonds.dre >= 1 ? 'Dre still texts after every game you watch, mostly to say you should have passed.' : "You and Dre don't talk much anymore. Some nights you miss him more than you'll admit.";
  const ray = s.bonds.ray >= 4 ? 'The new gym at the rec center has Coach Ray\'s name over the door. You paid for it.' : s.bonds.ray >= 1 ? 'Coach Ray tells every kid at the rec center that he taught you the left hand.' : 'Coach Ray tells the kids about you. He leaves out the parts where you stopped calling.';
  const ice = s.bonds.ice >= 2 ? 'Ice gave a speech at your retirement party. Half of it was jokes about Carver Park.' : 'Ice never did say "good game". He did show up to your last one.';
  const maya = has('mayaPro') ? 'Maya retired a WNBA All-Star. The two of you still argue about who was the better shooter.'
    : (s.bonds.maya ?? 0) >= 3 ? 'Maya sits next to Mom at every big night. She has never once let you win at H-O-R-S-E.'
      : (s.bonds.maya ?? 0) >= 1 ? 'Maya calls every Sunday and still uses your middle-school nickname.' : 'Maya grew up while you were on the road. You are working on it.';
  const mom = has('momHouse') ? `Mom still lives in the house you bought her${has('momPromise') ? ', and the sticky note from your mirror is framed in her kitchen' : ''}. She still makes you carry the groceries.` : 'Mom still sits in the same seat at every Douglass High game.';
  return { id: `nba-${id}`, title: base[id].title, text: `${base[id].text}${jerseys}`, tier, epilogue: [after, mom, dre, ray, maya, ice] };
}

/** The story as text, for sharing. */
export function storyShareText(s: StoryState, site: string): string {
  const e = storyEnding(s);
  const best = [...s.games].sort((a, b) => gameScore(b.line) - gameScore(a.line))[0];
  const c = s.nba ? nbaCareerLine(s.nba) : null;
  const head = c ? `${c.seasons} NBA seasons · ${c.ppg} PPG${c.titles ? ` · ${c.titles}× champion` : ''}${c.mvps ? ` · ${c.mvps}× MVP` : ''} · Legacy ${c.legacy}`
    : `${s.draft ? (s.draft.pick ? `#${s.draft.pick} pick` : 'undrafted') : ''}`;
  return `Court Vision Story Mode: ${s.name}, from ${s.hometown} to the NBA\n${e.title}${head ? ` · ${head}` : ''}\n${s.games.slice(-15).map(g => (g.won ? '🟩' : '🟥')).join('')}${best ? `\nBest game: ${best.line.pts} PTS, ${best.line.reb} REB, ${best.line.ast} AST vs ${best.opp}` : ''}\n${site}/#/story`;
}
