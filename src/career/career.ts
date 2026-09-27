import type { League } from '../simulation/league';
import type { GMLeagueExtras, DraftProspect } from '../simulation/gm';
import { capSpaceRemaining, hasRosterRoom, movePlayerToTeam, signFreeAgent, computeAskingSalary } from '../simulation/gm';
import type { PlayerSeason, SeasonStatTotals, SeasonMilestones } from '../simulation/types';
import { calculateOverall } from '../simulation/engine/overall';
import { RNG } from '../simulation/engine/rng';
import { getPlayerAwardsHistory } from '../simulation/leagueAnalytics';
import type { TrophyKey } from '../simulation/trophies';
import { signingDecision } from '../simulation/freeAgentDecision';
import { primaryPosition } from '../simulation/teamStatus';
import { CATEGORIES, categoryScore, withCategory, type CategoryId } from './categories';
import { buildPlayer, tendenciesFor, valuesAt, primeOverall, MAX_PROGRESS, START_AGE, type Identity, type Prime, type Progress, type Readiness } from './create';
import { emptyResume, legacyScore, top100, top100Rank, type LegacyResume } from './legacy';
import type { NbaHistory } from '../history/nbaHistoryData';

/*
 * Career Mode: one player's whole career in a real league. The league plays every season with the main game's engine
 * (see autoPlayToDraft / autoPlayFromDraft); between the two halves of each season, at the draft, the career steps in:
 * the player joins the draft class (year one), develops by his training focus, picks his next team as a free agent,
 * may ask for a trade, and eventually retires.
 */

export type CareerMode = 'wheel' | 'myplayer';
export interface CareerAward { key: TrophyKey; label: string }
export interface CareerYear {
  season: string; age: number; teamId: string | null; teamName: string; overall: number;
  stats: SeasonStatTotals; playoffs?: SeasonStatTotals;
  record?: { w: number; l: number }; finish?: string;
  awards: CareerAward[]; training: CategoryId[]; note?: string;
  /** Single-game highs and double/triple-double counts that season. */
  highs?: SeasonMilestones;
}
export interface CareerMeta {
  version: 1; id: string; createdAt: number; updatedAt: number; seed: number;
  mode: CareerMode; identity: Identity; prime: Prime; readiness: Readiness; progress: Progress;
  playerId: string; startSeason: string;
  /** A past draft he entered (the league is NBA history from that year); absent for today's league. */
  draftYear?: number;
  status: 'active' | 'retired';
  draft?: { pick: number | null; teamId: string | null; teamName: string; season: string };
  years: CareerYear[];
  /** Two categories the player works on this offseason. */
  training: CategoryId[];
  autopilot: boolean;
  /** Things that happened this offseason (signings, trades), shown with the next season. */
  notes: string[];
  retired?: { age: number; season: string; legacy: number; rank: number | null; hallOfFame: 'first-ballot' | 'yes' | 'no'; jerseys?: string[] };
}

export const newCareerMeta = (id: string, seed: number, mode: CareerMode, identity: Identity, prime: Prime, readiness: Readiness, playerId: string, startSeason: string, progress: Progress): CareerMeta => ({
  version: 1, id, createdAt: Date.now(), updatedAt: Date.now(), seed, mode, identity, prime, readiness, progress, playerId, startSeason,
  status: 'active', years: [], training: defaultTraining(prime, progress), autopilot: false, notes: [],
});

// ---------------------------------------------------------------- finding the player

export function findPlayer(league: League, extras: GMLeagueExtras, playerId: string): { player: PlayerSeason; teamId: string | null } | null {
  for (const t of league.teams) { const p = t.seasons.find(s => s.playerId === playerId); if (p) return { player: p, teamId: t.teamId }; }
  const fa = extras.freeAgents.find(s => s.playerId === playerId);
  return fa ? { player: fa, teamId: null } : null;
}

function replacePlayer(league: League, extras: GMLeagueExtras, next: PlayerSeason): { league: League; extras: GMLeagueExtras } {
  return {
    league: { ...league, teams: league.teams.map(t => (t.seasons.some(s => s.playerId === next.playerId) ? { ...t, seasons: t.seasons.map(s => (s.playerId === next.playerId ? next : s)) } : t)) },
    extras: { ...extras, freeAgents: extras.freeAgents.map(s => (s.playerId === next.playerId ? next : s)), draftClass: extras.draftClass.map(d => (d.playerId === next.playerId ? { ...d, trueSeason: next } : d)) },
  };
}

/** A name nobody in the league has (player ids are names). */
export function uniqueName(league: League, extras: GMLeagueExtras, name: string): string {
  const taken = new Set([...league.teams.flatMap(t => t.seasons.map(s => s.playerId)), ...extras.freeAgents.map(s => s.playerId), ...extras.draftClass.map(d => d.playerId), ...(league.retiredPlayers ?? []).map(r => r.playerId)]);
  if (!taken.has(name)) return name;
  for (const suffix of [' Jr.', ' II', ' III', ' IV']) if (!taken.has(name + suffix)) return name + suffix;
  let i = 2; while (taken.has(`${name} ${i}`)) i++;
  return `${name} ${i}`;
}

// ---------------------------------------------------------------- the draft

/** Year one: the player joins the draft class (the league must be stopped at the draft). */
export function joinDraft(league: League, extras: GMLeagueExtras, meta: CareerMeta): { league: League; extras: GMLeagueExtras } {
  const rookie = { ...buildPlayer({ ...meta.identity, name: meta.playerId }, meta.prime, meta.progress, meta.readiness, league.season ?? meta.startSeason, START_AGE, meta.seed), careerPlayer: true };
  const prospect: DraftProspect = { playerId: meta.playerId, trueSeason: rookie, scoutedPotential: rookie.development.potential, scoutingAccuracy: 0.95 };
  return { league, extras: { ...extras, draftClass: [prospect, ...extras.draftClass.filter(d => d.playerId !== meta.playerId)] } };
}

/** Where he went in the draft (null pick = undrafted). */
export function draftResult(league: League, meta: CareerMeta, picks: { playerId: string; teamId: string }[]): CareerMeta['draft'] {
  const i = picks.findIndex(p => p.playerId === meta.playerId);
  const teamId = i >= 0 ? picks[i].teamId : null;
  return { pick: i >= 0 ? i + 1 : null, teamId, teamName: teamId ? league.teams.find(t => t.teamId === teamId)?.name ?? teamId : 'Undrafted', season: league.season ?? '' };
}

// ---------------------------------------------------------------- development

const PHYSICAL: CategoryId[] = ['athleticism', 'body'];
/** One offseason of growth for a category: fast when young, slower toward the prime, then decline. */
export function growth(cat: CategoryId, age: number, trained: boolean, rng: RNG): number {
  if (cat === 'size') return 0;
  const physical = PHYSICAL.includes(cat), mind = cat === 'iq';
  let g = age <= 20 ? 0.22 : age <= 22 ? 0.19 : age <= 24 ? 0.14 : age <= 26 ? 0.08 : age <= 28 ? 0.02 : 0;
  const declineFrom = physical ? 29 : mind ? 34 : 31;
  if (age >= declineFrom) g = -(physical ? 0.07 : 0.05) * (1 + (age - declineFrom) * 0.35);
  if (trained) g = g > 0 ? g + 0.12 : g * 0.5 + 0.02;
  return g + (rng.next() * 2 - 1) * 0.04;
}

/** The player's summer: every category moves by age, training and luck (training can carry him past his prime). */
export function developSummer(meta: CareerMeta, age: number): Progress {
  const rng = new RNG(meta.seed * 31 + age * 977);
  const next = { ...meta.progress };
  for (const c of CATEGORIES) {
    const trained = meta.training.includes(c.id);
    const cap = trained ? MAX_PROGRESS : Math.max(1, meta.progress[c.id]);
    next[c.id] = Math.max(-1.5, Math.min(cap, meta.progress[c.id] + growth(c.id, age, trained, rng)));
  }
  return next;
}

/** Writes his ratings at `progress` into the player in the league (everything else about him stays). */
export function applyProgress(league: League, extras: GMLeagueExtras, meta: CareerMeta): { league: League; extras: GMLeagueExtras } {
  const found = findPlayer(league, extras, meta.playerId);
  if (!found) return { league, extras };
  const vals = valuesAt(meta.prime, meta.progress, meta.readiness);
  let p = found.player;
  for (const c of CATEGORIES) p = withCategory(p, vals[c.id]);
  p = { ...p, tendencies: tendenciesFor(p), careerPlayer: true };
  const overall = calculateOverall(p);
  const prime = primeOverall(meta.prime, meta.readiness, meta.identity.pos);
  p = { ...p, development: { ...p.development, potential: p.age < 27 ? Math.max(overall, prime) : overall } };
  return replacePlayer(league, extras, p);
}

/** Autopilot's training: his two best categories that still have room to grow. */
export function defaultTraining(prime: Prime, progress: Progress): CategoryId[] {
  return CATEGORIES.filter(c => c.id !== 'size' && (progress[c.id] ?? 0) < MAX_PROGRESS)
    .sort((a, b) => categoryScore(prime[b.id]) - categoryScore(prime[a.id])).slice(0, 2).map(c => c.id);
}

// ---------------------------------------------------------------- a season's record

const AWARD_KEYS = new Set<TrophyKey>(['champion', 'fmvp', 'mvp', 'dpoy', 'roy', 'mip', 'smoy', 'allLeague1', 'allLeague2', 'allLeague3', 'allDefense1', 'allDefense2', 'allRookie1', 'allRookie2', 'allStar', 'allStarMvp', 'scoringChamp', 'reboundingChamp', 'assistsChamp', 'stealsChamp', 'blocksChamp']);

/** His line for the season that just ended (the league has rolled over into the next one). */
export function seasonRecord(league: League, extras: GMLeagueExtras, meta: CareerMeta, season: string): CareerYear | null {
  const found = findPlayer(league, extras, meta.playerId);
  const rec = found?.player.careerHistory?.findLast(r => r.season === season);
  if (!found || !rec) return null;
  const hist = league.franchiseHistory?.findLast(r => r.season === season);
  const teamId = rec.teamId;
  const ts = hist?.teamSeasons?.find(t => t.teamId === teamId);
  const awards = getPlayerAwardsHistory(league, meta.playerId).filter(a => a.season === season && AWARD_KEYS.has(a.key)).map(a => ({ key: a.key, label: a.label }));
  return {
    season, age: rec.age, teamId, teamName: teamId ? league.teams.find(t => t.teamId === teamId)?.name ?? teamId : 'Free agent', overall: rec.overall,
    stats: rec.stats, ...(rec.playoffStats?.gamesPlayed ? { playoffs: rec.playoffStats } : {}), ...(rec.milestones ? { highs: rec.milestones } : {}),
    ...(ts ? { record: { w: ts.wins, l: ts.losses }, finish: ts.playoffFinish } : {}),
    awards, training: meta.training,
  };
}

// ---------------------------------------------------------------- free agency and trades

export type OfferKind = 'money' | 'contender' | 'role' | 'home';
export interface Offer { kind: OfferKind; teamId: string; teamName: string; salary: number; years: number; wins: number; depth: number }
export const OFFER_LABEL: Record<OfferKind, string> = { money: 'Biggest contract', contender: 'Title contender', role: 'Biggest role', home: 'Re-sign' };

/** Offers for a free agent: the best money, the best team and the biggest role (and his old team). */
export function freeAgentOffers(league: League, extras: GMLeagueExtras, meta: CareerMeta): Offer[] {
  const found = findPlayer(league, extras, meta.playerId);
  if (!found || found.teamId) return [];
  const p = found.player, pos = primaryPosition(p), ovr = calculateOverall(p);
  const last = league.franchiseHistory?.at(-1)?.teamSeasons ?? [];
  const winsOf = (id: string) => last.find(t => t.teamId === id)?.wins ?? 41;
  const ask = computeAskingSalary(ovr, extras.capSettings);
  const priorTeam = meta.years.at(-1)?.teamId ?? null;
  const candidates = league.teams.filter(t => hasRosterRoom(t, extras.capSettings)).map(t => {
    const space = capSpaceRemaining(extras.contracts, t, extras.capSettings);
    const quote = signingDecision(league, extras, p, t.teamId);
    const salary = Math.max(extras.capSettings.minSalary, Math.min(Math.max(ask, quote.required), Math.max(space, extras.capSettings.minSalary)));
    const depth = t.seasons.filter(s => primaryPosition(s) === pos && calculateOverall(s) >= ovr - 2).length;
    return { teamId: t.teamId, teamName: t.name, salary, years: ovr >= 70 ? 4 : ovr >= 60 ? 3 : 2, wins: winsOf(t.teamId), depth };
  });
  if (!candidates.length) return [];
  const out: Offer[] = [];
  const add = (kind: OfferKind, pick: (typeof candidates)[number] | undefined) => { if (pick && !out.some(o => o.teamId === pick.teamId)) out.push({ kind, ...pick }); };
  add('home', candidates.find(c => c.teamId === priorTeam));
  add('money', [...candidates].sort((a, b) => b.salary - a.salary)[0]);
  add('contender', [...candidates].sort((a, b) => b.wins - a.wins).find(c => !out.some(o => o.teamId === c.teamId)));
  add('role', [...candidates].sort((a, b) => a.depth - b.depth || a.wins - b.wins).find(c => !out.some(o => o.teamId === c.teamId)));
  return out;
}

export function signOffer(league: League, extras: GMLeagueExtras, meta: CareerMeta, offer: Offer): { league: League; extras: GMLeagueExtras; note: string } {
  const r = signFreeAgent(league, extras, meta.playerId, offer.teamId, { annualSalary: offer.salary, yearsRemaining: offer.years, playerOption: false, teamOption: false });
  if (r.league === league) {
    // The cap got in the way: he signs for the minimum instead.
    const min = extras.capSettings.minSalary;
    const m = signFreeAgent(league, extras, meta.playerId, offer.teamId, { annualSalary: min, yearsRemaining: offer.years, playerOption: false, teamOption: false });
    return { ...m, note: `Signed with ${offer.teamName}: ${offer.years} years at the minimum.` };
  }
  return { ...r, note: `Signed with ${offer.teamName}: ${offer.years} years, $${(offer.salary / 1_000_000).toFixed(1)}M a year.` };
}

export type TradeWish = 'contender' | 'role' | 'anywhere';
/** He asks out: the chosen kind of team gets him for its player closest to his level. */
export function requestTrade(league: League, extras: GMLeagueExtras, meta: CareerMeta, wish: TradeWish): { league: League; extras: GMLeagueExtras; note: string } {
  const found = findPlayer(league, extras, meta.playerId);
  if (!found?.teamId) return { league, extras, note: 'He is a free agent: nothing to trade.' };
  const p = found.player, pos = primaryPosition(p), ovr = calculateOverall(p);
  const last = league.franchiseHistory?.at(-1)?.teamSeasons ?? [];
  const winsOf = (id: string) => last.find(t => t.teamId === id)?.wins ?? 41;
  const others = league.teams.filter(t => t.teamId !== found.teamId && t.seasons.some(s => !s.careerPlayer));
  const rng = new RNG(meta.seed + meta.years.length * 131);
  const target = wish === 'contender' ? [...others].sort((a, b) => winsOf(b.teamId) - winsOf(a.teamId))[0]
    : wish === 'role' ? [...others].sort((a, b) => a.seasons.filter(s => primaryPosition(s) === pos && calculateOverall(s) >= ovr - 2).length - b.seasons.filter(s => primaryPosition(s) === pos && calculateOverall(s) >= ovr - 2).length)[0]
    : others[rng.nextInt(others.length)];
  if (!target) return { league, extras, note: 'Nobody was interested.' };
  const back = [...target.seasons].filter(s => !s.careerPlayer).sort((a, b) => Math.abs(calculateOverall(a) - ovr) - Math.abs(calculateOverall(b) - ovr))[0];
  const fromTeam = league.teams.find(t => t.teamId === found.teamId)!;
  let r = movePlayerToTeam(league, extras, meta.playerId, target.teamId);
  if (back) r = movePlayerToTeam(r.league, r.extras, back.playerId, fromTeam.teamId);
  return { ...r, note: `Traded to ${target.name}${back ? ` for ${back.playerId}` : ''}.` };
}

// ---------------------------------------------------------------- retirement and legacy

/** Autopilot retires him when he is old and no longer good enough, or at 40. */
export function autopilotRetires(age: number, overall: number): boolean {
  return age >= 40 || (age >= 36 && overall < 64) || (age >= 33 && overall < 55) || (age >= 30 && overall < 48);
}

export function careerResume(meta: CareerMeta): LegacyResume {
  const r = emptyResume();
  for (const y of meta.years) {
    r.games += y.stats.gamesPlayed; r.pts += y.stats.points; r.reb += y.stats.oreb + y.stats.dreb; r.ast += y.stats.ast; r.stl += y.stats.stl; r.blk += y.stats.blk;
    for (const a of y.awards) {
      if (a.key === 'champion') r.titles++; else if (a.key === 'fmvp') r.fmvp++; else if (a.key === 'mvp') r.mvp++;
      else if (a.key === 'allLeague1') r.allNba1++; else if (a.key === 'allLeague2') r.allNba2++; else if (a.key === 'allLeague3') r.allNba3++;
      else if (a.key === 'allStar') r.allStar++; else if (a.key === 'dpoy') r.dpoy++;
      else if (a.key === 'allDefense1') r.allDef1++; else if (a.key === 'allDefense2') r.allDef2++; else if (a.key === 'roy') r.roy++;
    }
  }
  return r;
}

/** Hall of Fame by Legacy Score (real Hall of Famers mostly score 45+; the inner circle 90+). */
export const hallOfFame = (legacy: number): 'first-ballot' | 'yes' | 'no' => (legacy >= 90 ? 'first-ballot' : legacy >= 45 ? 'yes' : 'no');

export function retire(meta: CareerMeta, h: NbaHistory, season: string, age: number): CareerMeta {
  const legacy = legacyScore(careerResume(meta));
  return { ...meta, status: 'retired', updatedAt: Date.now(), retired: { age, season, legacy, rank: top100Rank(top100(h), legacy), hallOfFame: hallOfFame(legacy), jerseys: retiredJerseys(meta) } };
}

/** Teams that retire his number: five seasons there, and three All-Star years, a title or an MVP with them. */
export function retiredJerseys(meta: CareerMeta): string[] {
  const byTeam = new Map<string, CareerYear[]>();
  for (const y of meta.years) if (y.teamId) (byTeam.get(y.teamName) ?? byTeam.set(y.teamName, []).get(y.teamName)!).push(y);
  const has = (ys: CareerYear[], k: TrophyKey) => ys.filter(y => y.awards.some(a => a.key === k)).length;
  return [...byTeam].filter(([, ys]) => ys.length >= 5 && (has(ys, 'allStar') >= 3 || has(ys, 'champion') >= 1 || has(ys, 'mvp') >= 1)).map(([name]) => name);
}

// ---------------------------------------------------------------- moments

export interface Moment { season: string; age: number; text: string; big: boolean }
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const AWARD_MOMENT: Partial<Record<TrophyKey, [string, boolean]>> = {
  champion: ['NBA champion', true], fmvp: ['Finals MVP', true], mvp: ['MVP', true], dpoy: ['Defensive Player of the Year', true], roy: ['Rookie of the Year', true],
  allStar: ['All-Star', false], allLeague1: ['All-NBA First Team', false], scoringChamp: ['scoring title', false],
};
const TOTAL_MARKS: [keyof Pick<SeasonStatTotals, 'points' | 'ast' | 'gamesPlayed'> | 'reb', number[], string][] = [
  ['points', [10_000, 20_000, 25_000, 30_000, 35_000, 40_000], 'career points'], ['reb', [10_000, 15_000], 'career rebounds'],
  ['ast', [5_000, 10_000], 'career assists'], ['gamesPlayed', [1_000, 1_500], 'career games'],
];

/** The moments of his career, season by season: firsts, big nights, round-number milestones, trophies. */
export function careerMoments(meta: CareerMeta): Moment[] {
  const out: Moment[] = [];
  let bestPts = 0, triples = 0;
  const counts = new Map<TrophyKey, number>();
  const tot = { points: 0, reb: 0, ast: 0, gamesPlayed: 0 };
  for (const y of meta.years) {
    const add = (text: string, big = false) => out.push({ season: y.season, age: y.age, text, big });
    const hi = y.highs;
    if (hi) {
      for (const mark of [60, 50, 40, 30]) if (hi.gameHighPoints >= mark && bestPts < mark) { add(mark >= 50 ? `${hi.gameHighPoints}-point game!` : `First ${mark}-point game (${hi.gameHighPoints})`, mark >= 50); break; }
      if (hi.gameHighPoints > bestPts && bestPts >= 40) add(`New career high: ${hi.gameHighPoints} points`);
      bestPts = Math.max(bestPts, hi.gameHighPoints);
      if (hi.tripleDoubles > 0 && triples === 0) add('First triple-double');
      if (hi.tripleDoubles >= 10) add(`${hi.tripleDoubles} triple-doubles in a season`);
      triples += hi.tripleDoubles;
    }
    for (const a of y.awards) {
      const m = AWARD_MOMENT[a.key];
      if (!m) continue;
      const n = (counts.get(a.key) ?? 0) + 1;
      counts.set(a.key, n);
      add(n === 1 ? `First ${m[0]}` : `${ordinal(n)} ${m[0]}`, m[1]);
    }
    const before = { ...tot };
    tot.points += y.stats.points; tot.reb += y.stats.oreb + y.stats.dreb; tot.ast += y.stats.ast; tot.gamesPlayed += y.stats.gamesPlayed;
    for (const [k, marks, label] of TOTAL_MARKS) for (const m of marks) if (before[k] < m && tot[k] >= m) add(`${m.toLocaleString()} ${label}`, m >= 30_000);
  }
  return out;
}

/** Removes him from the league (so a later look at the league doesn't show a retired player still playing). */
export function removeFromLeague(league: League, extras: GMLeagueExtras, playerId: string): { league: League; extras: GMLeagueExtras } {
  const { [playerId]: _gone, ...contracts } = extras.contracts;
  return {
    league: { ...league, teams: league.teams.map(t => ({ ...t, seasons: t.seasons.filter(s => s.playerId !== playerId) })) },
    extras: { ...extras, contracts, freeAgents: extras.freeAgents.filter(s => s.playerId !== playerId) },
  };
}

// ---------------------------------------------------------------- one offseason, start to finish

/**
 * The league has just stopped at the draft after a season: record his year, then his summer of development.
 * Returns the updated career and league (the free-agency and trade choices come after, from the offseason screen).
 */
export function landSeason(meta: CareerMeta, league: League, extras: GMLeagueExtras, season: string): { meta: CareerMeta; league: League; extras: GMLeagueExtras; year: CareerYear | null } {
  const year = seasonRecord(league, extras, meta, season);
  const withYear: CareerMeta = { ...meta, years: year ? [...meta.years, { ...year, ...(meta.notes.length ? { note: meta.notes.join(' ') } : {}) }] : meta.years, notes: [] };
  const found = findPlayer(league, extras, meta.playerId);
  if (!found) return { meta: withYear, league, extras, year };
  const developed: CareerMeta = { ...withYear, progress: developSummer(withYear, found.player.age) };
  const applied = applyProgress(league, extras, developed);
  return { meta: developed, ...applied, year };
}

/** What autopilot does at the draft: trains his strengths, takes the best offer for his level, and knows when to stop. */
export function autopilotOffseason(meta: CareerMeta, league: League, extras: GMLeagueExtras, h: NbaHistory): { meta: CareerMeta; league: League; extras: GMLeagueExtras } {
  const found = findPlayer(league, extras, meta.playerId);
  if (!found) return { meta, league, extras };
  const ovr = calculateOverall(found.player);
  if (autopilotRetires(found.player.age, ovr)) {
    const gone = removeFromLeague(league, extras, meta.playerId);
    return { meta: retire(meta, h, league.season ?? '', found.player.age), ...gone };
  }
  let next = { ...meta, training: defaultTraining(meta.prime, meta.progress) };
  const offers = freeAgentOffers(league, extras, next);
  if (offers.length) {
    const pick = (ovr >= 72 ? offers.find(o => o.kind === 'contender') : undefined) ?? offers.find(o => o.kind === 'home') ?? offers.find(o => o.kind === 'money') ?? offers[0];
    const signed = signOffer(league, extras, next, pick);
    next = { ...next, notes: [...next.notes, signed.note] };
    return { meta: next, league: signed.league, extras: signed.extras };
  }
  return { meta: next, league, extras };
}

/** Every trophy of one career, for the pixel trophy shelf. */
export const careerShelf = (m: CareerMeta): { key: TrophyKey; season: string; who: string }[] => m.years.flatMap(y => y.awards.map(a => ({ key: a.key, season: y.season, who: m.playerId })));
