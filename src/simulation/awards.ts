import { isRookieEligible } from './rookieEligibility';
import type { League, LeagueTeam } from './league';
import type { PlayoffSeries } from './playoffs';
import type { PlayerSeason } from './types';
import { perGameAverages } from './careerStats';
import { calculateOverall } from './engine/overall';
import { computeStandings } from './league';
import { primaryPosition } from './teamStatus';
import type { GameResult } from './boxscore';
import { currentSeasonAdvanced } from './advancedStats';
import { panelVote, selectionVote, type AwardVote, type Position3, type StatSnapshot, type VoteCandidate, type VoteLine } from './awardVoting';
import type { PeriodHonor } from './awardRace';

export type { AwardVote, VoteLine, StatSnapshot, Position3 } from './awardVoting';

export interface AwardWinner {
  playerId: string;
  teamId: string | null;
  teamName: string;
  score: number;
  /** Share of a unanimous result (0–1) and first-place votes: the league's own panel, or the real vote for imported seasons. */
  voteShare?: number;
  firstVotes?: number;
  /** Ballot points from the voting panel. */
  points?: number;
  /** Guard, forward or center: the slot on an All-League or All-Defense team. */
  position?: Position3;
  /** All-Stars: the conference he represents and whether he was voted a starter. */
  conference?: 'east' | 'west';
  starter?: boolean;
}

export interface TeamAwardDetail {
  wins: number; losses: number;
  prevWins?: number; prevLosses?: number;
  /** Coach of the Year: wins the roster's talent projected. */
  expectedWins?: number;
  /** Executive of the Year: the season's additions and what they produced (Win Shares). */
  acquisitions?: { playerId: string; how: 'trade' | 'signing' | 'draft'; ws: number }[];
}

export interface TeamAwardWinner {
  teamId: string;
  teamName: string;
  score: number;
  coachName?: string | null; // populated for Coach of the Year — the actual person, not just the team
  voteShare?: number;
  firstVotes?: number;
  points?: number;
  /** Executive of the Year: the controlling (human) front office won it. */
  userTeam?: boolean;
  detail?: TeamAwardDetail;
}

/** A block of 5 (or fewer, if not enough qualifying candidates) players making up one "team" of an All-NBA/Defense/Rookie selection. */
export type AwardTeamSelection = AwardWinner[];

export interface MVPFormulaWeights {
  ppg: number;
  apg: number;
  rpg: number;
  spg: number;
  bpg: number;
  tov: number; // usually negative
  teamWinPct: number; // multiplier applied to the player's team winPct (0-1), rewarding star players on winning teams
  efficiency: number;
  /** Per Win Share, projected to an 82-game pace so mid-season races stay comparable. */
  winShares?: number;
}

export interface DPOYFormulaWeights {
  spg: number;
  bpg: number;
  rpg: number;
  defensiveIQ: number;
  /** Per Defensive Win Share, projected to an 82-game pace. */
  defensiveWinShares?: number;
}

export const DEFAULT_MVP_WEIGHTS: MVPFormulaWeights = {
  ppg: 1, apg: 1.5, rpg: 1.2, spg: 1.5, bpg: 1.5, tov: -0.5, teamWinPct: 10, efficiency: 0, winShares: 1.2,
};

export const DEFAULT_DPOY_WEIGHTS: DPOYFormulaWeights = {
  spg: 3, bpg: 3, rpg: 0.3, defensiveIQ: 0.1, defensiveWinShares: 1.8,
};

/** Share of the season a player must play for the major awards and All-League teams (65 of 82 games). */
export const AWARD_GAMES_SHARE = 65 / 82;
/** Statistical titles need 58 of 82 games; Rookie of the Year and All-Rookie need half the season. */
export const STAT_TITLE_SHARE = 58 / 82;
export const ROOKIE_GAMES_SHARE = 0.5;

/** League award settings, saved with the league. */
export interface AwardSettings {
  /** Share of the season's games needed to qualify for the major awards (stat titles and rookie awards scale from it). */
  minGamesShare: number;
  allStarCount: number;
  mvpWeights: MVPFormulaWeights;
  dpoyWeights: DPOYFormulaWeights;
}

export const DEFAULT_AWARD_SETTINGS: AwardSettings = {
  minGamesShare: AWARD_GAMES_SHARE,
  allStarCount: 24,
  mvpWeights: { ...DEFAULT_MVP_WEIGHTS },
  dpoyWeights: { ...DEFAULT_DPOY_WEIGHTS },
};

const finite = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Fills anything missing or malformed with the defaults (older leagues never saved award settings). */
export function normalizeAwardSettings(raw: Partial<AwardSettings> | undefined | null): AwardSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_AWARD_SETTINGS;
  const mvp = { ...DEFAULT_MVP_WEIGHTS }, dpoy = { ...DEFAULT_DPOY_WEIGHTS };
  for (const k of Object.keys(mvp) as (keyof MVPFormulaWeights)[]) mvp[k] = finite(raw.mvpWeights?.[k], mvp[k]!);
  for (const k of Object.keys(dpoy) as (keyof DPOYFormulaWeights)[]) dpoy[k] = finite(raw.dpoyWeights?.[k], dpoy[k]!);
  return {
    minGamesShare: Math.max(0, Math.min(1, finite(raw.minGamesShare, AWARD_GAMES_SHARE))),
    allStarCount: Math.max(4, Math.min(40, Math.round(finite(raw.allStarCount, 24)))),
    mvpWeights: mvp, dpoyWeights: dpoy,
  };
}

export function awardOptions(settings: AwardSettings | undefined): SeasonAwardsOptions {
  const s = normalizeAwardSettings(settings);
  return { minGamesShare: s.minGamesShare, mvpWeights: s.mvpWeights, dpoyWeights: s.dpoyWeights, allStarCount: s.allStarCount };
}

export interface SeasonAwardsOptions {
  /** A fixed games minimum for every award (overrides the season-length shares). */
  minGames?: number;
  /** Share of the games played so far (the whole season, once it's over) needed for the major awards. */
  minGamesShare?: number;
  mvpWeights?: MVPFormulaWeights;
  dpoyWeights?: DPOYFormulaWeights;
  allStarCount?: number; // total All-Stars selected league-wide (first ten tagged as "starters")
}

export type VotedAwardKey = 'mvp' | 'dpoy' | 'roy' | 'mip' | 'smoy' | 'cpoy' | 'coy' | 'eoy' | 'allNBA' | 'allDefense' | 'allRookie';

export interface SeasonAwards {
  mvp: AwardWinner | null;
  dpoy: AwardWinner | null;
  roy: AwardWinner | null;
  mip: AwardWinner | null;
  smoy: AwardWinner | null;
  coy: TeamAwardWinner | null;
  allNBA: AwardTeamSelection[]; // 3 teams: 2 guards, 2 forwards, 1 center each (older seasons: positionless)
  allDefense: AwardTeamSelection[]; // 2 teams, by position
  allRookie: AwardTeamSelection[]; // 2 teams of 5, positionless
  allStars: AwardWinner[]; // flat list; first ten are "starters", rest are "reserves"
  // --- Additional award slate ---
  cpoy: AwardWinner | null;          // Clutch Player of the Year, from real clutch-situation scoring
  hustle: AwardWinner | null;        // Hustle Award: steals + blocks + offensive boards
  teammate: AwardWinner | null;      // Teammate of the Year: assists with low turnovers
  scoringChamp: AwardWinner | null;  // highest PPG
  reboundingChamp: AwardWinner | null;
  assistsChamp: AwardWinner | null;
  stealsChamp: AwardWinner | null;
  blocksChamp: AwardWinner | null;
  /** The player with the most Player of the Month honors (older seasons: best producer by formula). */
  playerOfTheMonth: AwardWinner | null;
  sharpshooter?: AwardWinner | null;
  floorGeneral?: AwardWinner | null;
  paintScorer?: AwardWinner | null;
  ironMan?: AwardWinner | null;
  rookieDefender?: AwardWinner | null;
  /** Executive of the Year, voted by the league's front offices. */
  eoy?: TeamAwardWinner | null;
  /** Top-10 ballots for every individual award, so a player profile can show "MVP-3" style placements. */
  ballots: Partial<Record<AwardBallotKey, AwardWinner[]>>;
  minGamesRequired: number;
  statMinGames?: number;
  rookieMinGames?: number;
  /** Additional winners of a shared award: exact ties in the vote or a stat title, or real shared awards in imported seasons. */
  coWinners?: Partial<Record<AwardBallotKey, AwardWinner[]>>;
  /** The panel's full vote for every voted award. Absent on seasons played before voting was saved. */
  votes?: Partial<Record<VotedAwardKey, AwardVote>>;
  /** Players of the Week and Month, per conference. */
  honors?: PeriodHonor[];
}

/** Every award that produces a ranked top-10 ballot (used for placement display on player profiles). */
export type AwardBallotKey =
  | 'mvp' | 'dpoy' | 'roy' | 'mip' | 'smoy' | 'cpoy' | 'hustle' | 'teammate'
  | 'scoringChamp' | 'reboundingChamp' | 'assistsChamp' | 'stealsChamp' | 'blocksChamp' | 'playerOfTheMonth' | 'sharpshooter' | 'floorGeneral' | 'paintScorer' | 'ironMan' | 'rookieDefender';

export const AWARD_BALLOT_LABELS: Record<AwardBallotKey, string> = {
  sharpshooter: 'Sharpshooter', floorGeneral: 'Floor General', paintScorer: 'Paint Scorer', ironMan: 'Iron Man', rookieDefender: 'Rookie Defender',
  mvp: 'MVP', dpoy: 'DPOY', roy: 'ROY', mip: 'MIP', smoy: '6MOY', cpoy: 'CPOY',
  hustle: 'Hustle', teammate: 'Teammate', scoringChamp: 'Scoring', reboundingChamp: 'Rebounding',
  assistsChamp: 'Assists', stealsChamp: 'Steals', blocksChamp: 'Blocks', playerOfTheMonth: 'POTM',
};

/** Awards decided by the voting panel rather than straight from the numbers. */
export const VOTED_BALLOTS: AwardBallotKey[] = ['mvp', 'dpoy', 'roy', 'mip', 'smoy', 'cpoy'];

/** One "MVP-3" style placement for a single player. */
export interface AwardPlacement {
  award: AwardBallotKey;
  label: string;
  place: number; // 1-indexed
}

/** Every top-10 award placement this player earned, for display on their profile/stat row. */
export function placementsForPlayer(awards: SeasonAwards, playerId: string): AwardPlacement[] {
  const out: AwardPlacement[] = [];
  for (const key of Object.keys(awards.ballots ?? {}) as AwardBallotKey[]) {
    const idx = (awards.ballots[key] ?? []).findIndex((w) => w.playerId === playerId);
    if (idx >= 0) out.push({ award: key, label: AWARD_BALLOT_LABELS[key], place: idx + 1 });
  }
  return out.sort((a, b) => a.place - b.place);
}

interface Candidate {
  season: PlayerSeason;
  teamId: string;
  teamName: string;
  conference?: 'east' | 'west';
}

/** Games needed for a share of the season so far: rounds up, never below one. */
export function gamesNeeded(teamGames: number, share: number): number {
  return Math.max(1, Math.ceil(teamGames * share - 1e-9));
}

export function positionGroup(season: PlayerSeason): Position3 {
  const p = primaryPosition(season);
  return p === 'PG' || p === 'SG' ? 'G' : p === 'C' ? 'C' : 'F';
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Everything the award formulas need, computed once. */
function awardContext(league: League, opts: SeasonAwardsOptions) {
  const standings = computeStandings(league);
  const teamGames = Math.max(0, ...standings.map((r) => r.wins + r.losses));
  const share = Math.max(0, Math.min(1, opts.minGamesShare ?? AWARD_GAMES_SHARE));
  const minGames = opts.minGames ?? gamesNeeded(teamGames, share);
  const statMinGames = opts.minGames ?? gamesNeeded(teamGames, Math.min(share, STAT_TITLE_SHARE));
  const rookieMinGames = opts.minGames ?? gamesNeeded(teamGames, Math.min(share, ROOKIE_GAMES_SHARE));
  const mvpWeights = opts.mvpWeights ?? DEFAULT_MVP_WEIGHTS;
  const dpoyWeights = opts.dpoyWeights ?? DEFAULT_DPOY_WEIGHTS;

  const everyone: Candidate[] = [];
  for (const t of league.teams) for (const s of t.seasons) {
    if ((s.seasonStats?.gamesPlayed ?? 0) >= 1) everyone.push({ season: s, teamId: t.teamId, teamName: t.name, conference: t.conferenceId });
  }
  const gp = (c: Candidate) => c.season.seasonStats?.gamesPlayed ?? 0;
  const winPctByTeam = new Map(standings.map((r) => [r.teamId, r.winPct]));
  const rowByTeam = new Map(standings.map((r) => [r.teamId, r]));
  const rankByTeam = new Map([...standings].sort((a, b) => b.winPct - a.winPct || b.pointDiff - a.pointDiff).map((r, i) => [r.teamId, i + 1]));
  const advanced = currentSeasonAdvanced(league);
  const avgCache = new Map<string, ReturnType<typeof perGameAverages>>();
  const perGame = (c: Candidate) => {
    let a = avgCache.get(c.season.playerId);
    if (!a) { a = perGameAverages(c.season.seasonStats); avgCache.set(c.season.playerId, a); }
    return a;
  };
  const pace82 = (c: Candidate, v: number) => v * 82 / Math.max(1, gp(c));
  const wsWeight = mvpWeights.winShares ?? DEFAULT_MVP_WEIGHTS.winShares!;
  const dwsWeight = dpoyWeights.defensiveWinShares ?? DEFAULT_DPOY_WEIGHTS.defensiveWinShares!;

  const mvpScore = (c: Candidate) => {
    const avg = perGame(c);
    const winPct = winPctByTeam.get(c.teamId) ?? 0;
    return mvpWeights.ppg * avg.ppg + mvpWeights.apg * avg.apg + mvpWeights.rpg * avg.rpg
      + mvpWeights.spg * avg.spg + mvpWeights.bpg * avg.bpg + mvpWeights.tov * avg.tovPg
      + mvpWeights.teamWinPct * winPct + mvpWeights.efficiency * avg.efficiency
      + wsWeight * pace82(c, advanced.get(c.season.playerId)?.ws ?? 0);
  };
  const dpoyScore = (c: Candidate) => {
    const avg = perGame(c);
    return dpoyWeights.spg * avg.spg + dpoyWeights.bpg * avg.bpg + dpoyWeights.rpg * avg.rpg
      + dpoyWeights.defensiveIQ * c.season.attributes.defense.defensiveIQ
      + dwsWeight * pace82(c, advanced.get(c.season.playerId)?.dws ?? 0);
  };
  // Rookies: raw production plus how much it helped win (Win Shares at an 82-game pace), so a winning rookie isn't buried by empty stats.
  const royScore = (c: Candidate) => { const avg = perGame(c); return avg.ppg + avg.apg + avg.rpg + 0.8 * pace82(c, advanced.get(c.season.playerId)?.ws ?? 0); };

  // Most Improved: needs an archived prior season to compare against.
  const mipScore = (c: Candidate) => {
    const prev = c.season.careerHistory![c.season.careerHistory!.length - 1];
    const prevAvg = perGameAverages(prev.stats);
    const nowAvg = perGame(c);
    // An imported season that did not record rebounds (before 1950-51) compares points and assists only.
    const statImprovement = (nowAvg.ppg - prevAvg.ppg) + (nowAvg.apg - prevAvg.apg) + (prev.missing?.includes('dreb') ? 0 : nowAvg.rpg - prevAvg.rpg);
    return statImprovement + 0.5 * (calculateOverall(c.season) - prev.overall);
  };

  const eligible = everyone.filter((c) => gp(c) >= minGames);
  const statEligible = everyone.filter((c) => gp(c) >= statMinGames);
  const rookies = everyone.filter((c) => gp(c) >= rookieMinGames && isRookieEligible(c.season));

  // Sixth Man: each team's players outside its top five in minutes per game.
  const byTeam = new Map<string, Candidate[]>();
  for (const c of everyone) { const list = byTeam.get(c.teamId) ?? []; list.push(c); byTeam.set(c.teamId, list); }
  const benchIds = new Set<string>();
  for (const list of byTeam.values()) {
    [...list].sort((a, b) => perGame(b).mpg - perGame(a).mpg).slice(5).forEach((c) => benchIds.add(c.season.playerId));
  }

  const stats = (c: Candidate): StatSnapshot => {
    const a = perGame(c), row = rowByTeam.get(c.teamId), adv = advanced.get(c.season.playerId);
    return { gp: a.gamesPlayed, pts: round1(a.ppg), reb: round1(a.rpg), ast: round1(a.apg), stl: round1(a.spg), blk: round1(a.bpg),
      ...(adv ? { ws: round1(adv.ws), dws: round1(adv.dws) } : {}), w: row?.wins ?? 0, l: row?.losses ?? 0 };
  };

  return { standings, teamGames, minGames, statMinGames, rookieMinGames, everyone, eligible, statEligible, rookies, benchIds,
    winPctByTeam, rowByTeam, rankByTeam, advanced, perGame, mvpScore, dpoyScore, royScore, mipScore, stats };
}
type AwardContext = ReturnType<typeof awardContext>;

interface Scored { c: Candidate; s: number }

function rank(pool: Candidate[], score: (c: Candidate) => number): Scored[] {
  return pool.map((c) => ({ c, s: score(c) })).filter((x) => Number.isFinite(x.s))
    .sort((a, b) => b.s - a.s || a.c.season.playerId.localeCompare(b.c.season.playerId));
}

function toWinner(c: Candidate, score: number): AwardWinner {
  return { playerId: c.season.playerId, teamId: c.teamId, teamName: c.teamName, score: round1(score) };
}

export type RaceKey = 'mvp' | 'dpoy' | 'roy' | 'smoy' | 'mip';
export const RACE_LABELS: Record<RaceKey, string> = { mvp: 'MVP', dpoy: 'Defensive Player', roy: 'Rookie of the Year', smoy: 'Sixth Man', mip: 'Most Improved' };

function racePools(ctx: AwardContext): Record<RaceKey, Scored[]> {
  const mipPool = ctx.eligible.filter((c) => (c.season.careerHistory?.length ?? 0) > 0);
  return {
    mvp: rank(ctx.eligible, ctx.mvpScore),
    dpoy: rank(ctx.eligible, ctx.dpoyScore),
    roy: rank(ctx.rookies, ctx.royScore),
    smoy: rank(ctx.eligible.filter((c) => ctx.benchIds.has(c.season.playerId)), ctx.mvpScore),
    mip: rank(mipPool, ctx.mipScore).filter((x) => x.s > 0),
  };
}

/** The current top ten in each headline race, straight from the formulas (the weekly ladder). Cheaper than a full vote. */
export function awardRaceStandings(league: League, opts: SeasonAwardsOptions = {}): Record<RaceKey, AwardWinner[]> {
  const pools = racePools(awardContext(league, opts));
  const out = {} as Record<RaceKey, AwardWinner[]>;
  for (const k of Object.keys(pools) as RaceKey[]) out[k] = pools[k].slice(0, 10).map((x) => toWinner(x.c, x.s));
  return out;
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** Why the winner won: the margin, his numbers, his team, and the storyline — all from saved facts. */
function voteNotes(key: VotedAwardKey, vote: AwardVote, stats: StatSnapshot | undefined, extra: { rank?: number; teams: number; lastWinner?: string | null; improvement?: string }): string[] {
  const [first, second] = vote.lines;
  if (!first) return [];
  const team = key === 'coy' || key === 'eoy';
  const name = (id: string) => team ? vote.lines.find((l) => l.id === id)?.teamName ?? id : id;
  const notes: string[] = [];
  if (vote.winners.length > 1) notes.push(`Dead heat: ${vote.winners.map(name).join(' and ')} tied at ${first.points} points — co-winners`);
  else if (first.firstVotes === vote.voters) notes.push(`Unanimous: all ${vote.voters} first-place votes`);
  else notes.push(`${first.firstVotes} of ${vote.voters} first-place votes${second ? `, ${first.points - second.points} points clear of ${name(second.id)}` : ''}`);
  if (stats) {
    if (key === 'dpoy') notes.push(`${stats.stl.toFixed(1)} steals and ${stats.blk.toFixed(1)} blocks a game${stats.dws != null ? `, ${stats.dws.toFixed(1)} Defensive Win Shares` : ''}`);
    else notes.push(`${stats.pts.toFixed(1)} points, ${stats.reb.toFixed(1)} rebounds and ${stats.ast.toFixed(1)} assists in ${stats.gp} games`);
    if (extra.rank) notes.push(extra.rank === 1 ? `${key === 'mvp' ? 'Led' : 'Played for'} the league's best team (${stats.w}–${stats.l})` : `His team went ${stats.w}–${stats.l}, ${ordinal(extra.rank)} of ${extra.teams}`);
  }
  if (extra.improvement) notes.push(extra.improvement);
  if (extra.lastWinner) {
    if (extra.lastWinner === first.id) notes.push('Won it again: back-to-back');
    else { const place = vote.lines.findIndex((l) => l.id === extra.lastWinner); if (place > 0) notes.push(`Last year's winner ${extra.lastWinner} finished ${ordinal(place + 1)} — some voters wanted a new name`); }
  }
  return notes;
}

const clampStory = (v: number) => Math.max(-1, Math.min(1, v));

/** What each roster's talent projects: its top eight players against the league, spread like real standings (~.150 per SD). */
function expectedWinPcts(league: League): Map<string, number> {
  const talent = league.teams.map((t) => {
    const top = t.seasons.map((s) => calculateOverall(s)).sort((a, b) => b - a).slice(0, 8);
    return { id: t.teamId, v: top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0 };
  });
  const mean = talent.reduce((s, x) => s + x.v, 0) / Math.max(1, talent.length);
  const sd = Math.sqrt(talent.reduce((s, x) => s + (x.v - mean) ** 2, 0) / Math.max(1, talent.length)) || 1;
  return new Map(talent.map((x) => [x.id, Math.max(0.12, Math.min(0.88, 0.5 + 0.15 * (x.v - mean) / sd))]));
}

/** Last season's winner of an award, for the voter-fatigue storyline. */
function lastWinner(league: League, key: 'mvp' | 'dpoy'): string | null {
  const last = league.franchiseHistory?.at(-1);
  if (!last || last.season === league.season) return null;
  return key === 'mvp' ? last.mvpPlayerId : last.dpoyPlayerId;
}

function previousRecord(league: League, teamId: string): { wins: number; losses: number } | null {
  const last = league.franchiseHistory?.at(-1);
  if (!last || last.season === league.season) return null;
  const row = last.teamSeasons?.find((t) => t.teamId === teamId);
  return row ? { wins: row.wins, losses: row.losses } : null;
}

/** Players a front office brought in this season (trades, signings, the draft) and what they produced for it. */
function acquisitions(league: League, team: LeagueTeam, ctx: AwardContext): TeamAwardDetail['acquisitions'] {
  const season = league.season;
  const out: NonNullable<TeamAwardDetail['acquisitions']> = [];
  for (const p of team.seasons) {
    const event = [...(p.history ?? [])].reverse().find((e) => e.season === season && e.teamId === team.teamId && (e.type === 'traded' || e.type === 'signed' || e.type === 'drafted'));
    if (!event) continue;
    out.push({ playerId: p.playerId, how: event.type === 'traded' ? 'trade' : event.type === 'drafted' ? 'draft' : 'signing', ws: round1(ctx.advanced.get(p.playerId)?.ws ?? 0) });
  }
  return out.sort((a, b) => b.ws - a.ws);
}

function lineToWinner(line: VoteLine): AwardWinner {
  return { playerId: line.id, teamId: line.teamId, teamName: line.teamName, score: line.score, points: line.points,
    voteShare: line.share, firstVotes: line.places[0] ?? 0, ...(line.position ? { position: line.position } : {}) };
}

/**
 * The full slate of season awards from real accumulated seasonStats (not ratings). The panel awards
 * (MVP, DPOY, ROY, MIP, Sixth Man, Clutch, Coach and Executive of the Year, and the All-League,
 * All-Defense and All-Rookie teams) are decided by a seeded 100-member media vote on the formula
 * scores; stat titles and the minor awards go straight to the numbers. Exact ties produce co-winners.
 */
export function computeSeasonAwards(league: League, opts: SeasonAwardsOptions = {}): SeasonAwards & { ballots: Record<AwardBallotKey, AwardWinner[]> } {
  const allStarCount = opts.allStarCount ?? 24;
  const ctx = awardContext(league, opts);
  const season = league.season ?? '';
  const pools = racePools(ctx);
  const teams = league.teams.length;
  const coWinners: Partial<Record<AwardBallotKey, AwardWinner[]>> = {};
  const votes: Partial<Record<VotedAwardKey, AwardVote>> = {};
  const byId = new Map(ctx.everyone.map((c) => [c.season.playerId, c]));
  const teamStory = (c: Candidate, scale: number) => clampStory(((ctx.winPctByTeam.get(c.teamId) ?? 0.5) - 0.5) * scale);

  const snapshotTop = (vote: AwardVote) => {
    vote.lines.slice(0, 3).forEach((l) => { const c = byId.get(l.id); if (c) l.stats = ctx.stats(c); });
  };

  /** One panel award: vote, save the vote, and hand back the winner, co-winners and a ballot of vote-getters. */
  const voted = (key: VotedAwardKey & AwardBallotKey, pool: Scored[], cfg: { points: number[]; story?: (c: Candidate) => number; storyWeight?: number; noise?: number; fatigueId?: string | null; improvement?: (c: Candidate) => string | undefined }) => {
    const candidates: VoteCandidate[] = pool.slice(0, 15).map(({ c, s }) => ({
      id: c.season.playerId, teamId: c.teamId, teamName: c.teamName, score: s,
      story: cfg.story?.(c) ?? 0, fatigue: cfg.fatigueId && cfg.fatigueId === c.season.playerId ? 1 : 0,
    }));
    const vote = panelVote(`${season}|${key}`, candidates, { voters: 100, points: cfg.points, storyWeight: cfg.storyWeight ?? 0, noise: cfg.noise ?? 0.4 });
    // Keep every vote-getter: the saved ballot must add up to all the points the panel cast.
    snapshotTop(vote);
    const winner = vote.lines[0];
    const wc = winner ? byId.get(winner.id) : undefined;
    vote.notes = voteNotes(key, vote, winner?.stats, { rank: wc ? ctx.rankByTeam.get(wc.teamId) : undefined, teams, lastWinner: cfg.fatigueId ?? null, improvement: wc ? cfg.improvement?.(wc) : undefined });
    votes[key] = vote;
    const ballot = vote.lines.slice(0, 10).map((l) => lineToWinner(l));
    if (vote.winners.length > 1) coWinners[key] = ballot.filter((w) => w.playerId !== ballot[0].playerId && vote.winners.includes(w.playerId));
    return { winner: ballot[0] ?? null, ballot };
  };

  // The formula already counts team success; the storyline adds the voters' extra love for the very best teams.
  const mvp = voted('mvp', pools.mvp, { points: [10, 7, 5, 3, 1], story: (c) => teamStory(c, 2.5) + (ctx.rankByTeam.get(c.teamId) === 1 ? 0.15 : 0), storyWeight: 0.35, noise: 0.35, fatigueId: lastWinner(league, 'mvp') });
  const dpoy = voted('dpoy', pools.dpoy, { points: [5, 3, 1], story: (c) => teamStory(c, 1.5), storyWeight: 0.2, fatigueId: lastWinner(league, 'dpoy') });
  const roy = voted('roy', pools.roy, { points: [5, 3, 1], story: (c) => teamStory(c, 1), storyWeight: 0.15 });
  const mip = voted('mip', pools.mip, { points: [5, 3, 1], noise: 0.45, improvement: (c) => {
    const prev = c.season.careerHistory?.at(-1);
    if (!prev) return undefined;
    const before = perGameAverages(prev.stats).ppg, now = ctx.perGame(c).ppg;
    return `Scoring jumped from ${before.toFixed(1)} to ${now.toFixed(1)} a game`;
  } });
  const smoy = voted('smoy', pools.smoy, { points: [5, 3, 1], story: (c) => teamStory(c, 1.5), storyWeight: 0.2 });

  const perGame = ctx.perGame;
  // Clutch Player: real clutch-situation points, per game, with a nod to overall shot-making.
  const cpoyScore = (c: Candidate) => {
    const st = c.season.seasonStats;
    if (!st || st.gamesPlayed === 0) return 0;
    return (st.clutchPoints / st.gamesPlayed) * 10 + perGame(c).tsPct * 5;
  };
  const cpoy = voted('cpoy', rank(ctx.eligible, cpoyScore), { points: [5, 3, 1], story: (c) => teamStory(c, 2), storyWeight: 0.35 });

  // --- Coach of the Year: most wins above what the roster's talent projected, plus the jump from last season. ---
  const expected = expectedWinPcts(league);
  const coyPool = league.teams.map((t) => {
    const row = ctx.rowByTeam.get(t.teamId);
    if (!row || row.wins + row.losses < 10) return null;
    const games = row.wins + row.losses;
    const expectedWinPct = expected.get(t.teamId) ?? 0.5;
    const prev = previousRecord(league, t.teamId);
    const jump = prev && prev.wins + prev.losses > 0 ? row.winPct - prev.wins / (prev.wins + prev.losses) : 0;
    return { team: t, row, score: row.winPct - expectedWinPct + 0.35 * jump, detail: { wins: row.wins, losses: row.losses, expectedWins: Math.round(expectedWinPct * games), ...(prev ? { prevWins: prev.wins, prevLosses: prev.losses } : {}) } };
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  const coyVote = panelVote(`${season}|coy`, coyPool.map((x) => ({ id: x.team.teamId, teamId: x.team.teamId, teamName: x.team.name, score: x.score, story: clampStory((x.row.winPct - 0.5) * 2) })),
    { voters: 100, points: [5, 3, 1], storyWeight: 0.3, noise: 0.5 });
  const coyTop = coyVote.lines[0];
  const coyEntry = coyTop ? coyPool.find((x) => x.team.teamId === coyTop.id)! : null;
  if (coyEntry) {
    const d = coyEntry.detail;
    coyVote.notes = [
      ...voteNotes('coy', coyVote, undefined, { teams }),
      d.wins >= (d.expectedWins ?? d.wins)
        ? `${coyEntry.team.name} won ${d.wins} games, ${d.wins - (d.expectedWins ?? d.wins)} more than the roster's talent projected (${d.expectedWins})`
        : `${coyEntry.team.name} won ${d.wins} games with a roster projected for ${d.expectedWins}`,
      ...(d.prevWins != null ? [`${d.wins - d.prevWins >= 0 ? '+' : ''}${d.wins - d.prevWins} wins on last season (${d.prevWins}–${d.prevLosses})`] : []),
    ];
  }
  votes.coy = coyVote;
  const coy: TeamAwardWinner | null = coyEntry && coyTop ? {
    teamId: coyEntry.team.teamId, teamName: coyEntry.team.name, coachName: coyEntry.team.coachIdentity?.coachId ?? null,
    score: Math.round(coyEntry.score * 1000) / 1000, points: coyTop.points, voteShare: coyTop.share, firstVotes: coyTop.firstVotes, detail: coyEntry.detail,
  } : null;

  // --- Executive of the Year: each front office votes (never for itself). Improvement, additions that produced, and winning. ---
  const userTeamId = league.coachingUserTeamId ?? null;
  const eoyPool = league.teams.map((t) => {
    const row = ctx.rowByTeam.get(t.teamId);
    if (!row || row.wins + row.losses < 10) return null;
    const prev = previousRecord(league, t.teamId);
    const prevPct = prev && prev.wins + prev.losses > 0 ? prev.wins / (prev.wins + prev.losses) : expected.get(t.teamId) ?? 0.5;
    const adds = acquisitions(league, t, ctx) ?? [];
    const addedWS = adds.reduce((s, a) => s + Math.max(0, a.ws), 0);
    const score = 10 * (row.winPct - prevPct) + 0.3 * addedWS * 82 / Math.max(1, row.wins + row.losses) + 3 * Math.max(0, row.winPct - 0.5);
    const detail: TeamAwardDetail & { acquisitions: NonNullable<TeamAwardDetail['acquisitions']> } = { wins: row.wins, losses: row.losses, acquisitions: adds.slice(0, 4) };
    if (prev) { detail.prevWins = prev.wins; detail.prevLosses = prev.losses; } else detail.expectedWins = Math.round(prevPct * (row.wins + row.losses));
    return { team: t, row, score, detail };
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  const voterTeams = league.teams.map((t) => t.teamId);
  const eoyVote = panelVote(`${season}|eoy`, eoyPool.map((x) => ({ id: x.team.teamId, teamId: x.team.teamId, teamName: x.team.name, score: x.score, story: clampStory((x.row.winPct - 0.5) * 2) })),
    { voters: Math.max(1, voterTeams.length), points: [5, 3, 1], storyWeight: 0.3, noise: 0.5, canVote: (v, c) => voterTeams[v] !== c.id });
  const eoyTop = eoyVote.lines[0];
  const eoyEntry = eoyTop ? eoyPool.find((x) => x.team.teamId === eoyTop.id)! : null;
  if (eoyEntry) {
    const d = eoyEntry.detail;
    const best = d.acquisitions.filter((a) => a.ws > 0).slice(0, 2);
    eoyVote.notes = [
      ...voteNotes('eoy', eoyVote, undefined, { teams }).map((n) => n.replace('first-place votes', 'first-place votes from rival front offices')),
      d.prevWins != null ? `${d.wins}–${d.losses}, ${d.wins >= d.prevWins ? 'up' : 'down'} from ${d.prevWins}–${d.prevLosses}` : `${d.wins}–${d.losses} with a roster projected for ${d.expectedWins} wins`,
      ...(best.length ? [`Added ${best.map((a) => `${a.playerId} (${a.how}, ${a.ws.toFixed(1)} WS)`).join(' and ')}`] : []),
    ];
  }
  votes.eoy = eoyVote;
  const eoy: TeamAwardWinner | null = eoyEntry && eoyTop ? {
    teamId: eoyEntry.team.teamId, teamName: eoyEntry.team.name, score: round1(eoyEntry.score), points: eoyTop.points, voteShare: eoyTop.share,
    firstVotes: eoyTop.firstVotes, userTeam: eoyEntry.team.teamId === userTeamId, detail: eoyEntry.detail,
  } : null;

  // --- Team selections: All-League and All-Defense by position (2 guards, 2 forwards, 1 center), All-Rookie positionless. ---
  const selection = (key: 'allNBA' | 'allDefense' | 'allRookie', pool: Scored[], cfg: { teams: number; points: number[]; slots: Parameters<typeof selectionVote>[2]['slots']; story?: (c: Candidate) => number; storyWeight?: number }) => {
    // Enough of each position that a thin one (centers) is still judged on merit.
    const byPos = (pos: Position3, n: number) => pool.filter((x) => positionGroup(x.c.season) === pos).slice(0, n);
    const field = cfg.slots.any ? pool.slice(0, 30) : [...byPos('G', 18), ...byPos('F', 18), ...byPos('C', 10)];
    const candidates: VoteCandidate[] = field.map(({ c, s }) => ({ id: c.season.playerId, teamId: c.teamId, teamName: c.teamName, score: s, position: positionGroup(c.season), story: cfg.story?.(c) ?? 0 }));
    const vote = selectionVote(`${season}|${key}`, candidates, { voters: 100, points: cfg.points, teams: cfg.teams, slots: cfg.slots, storyWeight: cfg.storyWeight ?? 0, noise: 0.4, field: candidates.length });
    const lines = new Map(vote.lines.map((l) => [l.id, l]));
    const teams = (vote.teams ?? []).map((team) => team.map((id) => lineToWinner(lines.get(id)!)));
    // Save the selected players and the closest misses.
    const chosen = new Set((vote.teams ?? []).flat());
    vote.lines = vote.lines.filter((l, i) => chosen.has(l.id) || i < chosen.size + 5);
    votes[key] = vote;
    return teams;
  };
  const allNBA = selection('allNBA', pools.mvp, { teams: 3, points: [5, 3, 1], slots: { G: 2, F: 2, C: 1 }, story: (c) => teamStory(c, 2), storyWeight: 0.3 });
  const allDefense = selection('allDefense', pools.dpoy, { teams: 2, points: [2, 1], slots: { G: 2, F: 2, C: 1 }, story: (c) => teamStory(c, 1), storyWeight: 0.1 });
  const allRookie = selection('allRookie', pools.roy, { teams: 2, points: [2, 1], slots: { any: 5 } });

  // --- All-Stars: this season's weekend selection once voting locks; otherwise the leaders (per conference when there are conferences). ---
  const locked = league.allStarWeekend?.season === season ? league.allStarWeekend.voting?.selected : undefined;
  const allStars = locked ?? projectedAllStars(ctx, pools.mvp, allStarCount);

  // --- Stat titles and the minor awards: straight from the numbers; exact ties share the award. ---
  const titled = (key: AwardBallotKey, pool: Scored[]) => {
    const ballot = pool.slice(0, 10).map((x) => toWinner(x.c, x.s));
    const top = pool[0];
    if (top) {
      const tied = pool.slice(1).filter((x) => x.s === top.s).map((x) => toWinner(x.c, x.s));
      if (tied.length) coWinners[key] = tied;
    }
    return ballot;
  };
  const shooters = ctx.statEligible.filter((c) => (c.season.seasonStats?.tpa ?? 0) >= Math.max(10, perGame(c).gamesPlayed));
  const sharpshooterScore = (c: Candidate) => { const s = c.season.seasonStats!; return (s.tpm / Math.max(1, s.gamesPlayed)) * (s.tpm / Math.max(1, s.tpa)); };
  const floorGeneralScore = (c: Candidate) => { const s = c.season.seasonStats!; return perGame(c).apg * 2 + Math.min(6, s.ast / Math.max(1, s.tov)); };
  const paintScore = (c: Candidate) => { const s = c.season.seasonStats!; return Math.max(0, s.points - s.tpm * 3 - s.ftm) / Math.max(1, s.gamesPlayed); };
  const ironScore = (c: Candidate) => { const s = c.season.seasonStats!; return s.minutes + s.gamesPlayed * 12; };
  const hustleScore = (c: Candidate) => { const a = perGame(c); return a.spg * 3 + a.bpg * 3 + a.orpg * 2.5; };
  const teammateScore = (c: Candidate) => { const a = perGame(c); return a.apg * 2 - a.tovPg * 1.5 + (c.season.attributes.mental.leadership ?? 50) / 25; };
  const potmScore = (c: Candidate) => { const a = perGame(c); return a.ppg * 1.2 + a.rpg + a.apg + a.spg + a.bpg; };

  // Player of the Month: whoever collected the most monthly honors (the formula stands in for seasons without them).
  const honors = league.awardRace?.season === season ? league.awardRace.honors : [];
  const months = honors.filter((h) => h.kind === 'month');
  const potmBallot = months.length ? potmFromHonors(months, byId) : titled('playerOfTheMonth', rank(ctx.statEligible, potmScore));

  const ballots: Record<AwardBallotKey, AwardWinner[]> = {
    mvp: mvp.ballot, dpoy: dpoy.ballot, roy: roy.ballot, mip: mip.ballot, smoy: smoy.ballot, cpoy: cpoy.ballot,
    hustle: titled('hustle', rank(ctx.statEligible, hustleScore)),
    teammate: titled('teammate', rank(ctx.statEligible, teammateScore)),
    scoringChamp: titled('scoringChamp', rank(ctx.statEligible, (c) => perGame(c).ppg)),
    reboundingChamp: titled('reboundingChamp', rank(ctx.statEligible, (c) => perGame(c).rpg)),
    assistsChamp: titled('assistsChamp', rank(ctx.statEligible, (c) => perGame(c).apg)),
    stealsChamp: titled('stealsChamp', rank(ctx.statEligible, (c) => perGame(c).spg)),
    blocksChamp: titled('blocksChamp', rank(ctx.statEligible, (c) => perGame(c).bpg)),
    playerOfTheMonth: potmBallot,
    sharpshooter: titled('sharpshooter', rank(shooters, sharpshooterScore)),
    floorGeneral: titled('floorGeneral', rank(ctx.statEligible, floorGeneralScore)),
    paintScorer: titled('paintScorer', rank(ctx.statEligible, paintScore)),
    ironMan: titled('ironMan', rank(ctx.statEligible, ironScore)),
    rookieDefender: titled('rookieDefender', rank(ctx.rookies, ctx.dpoyScore)),
  };

  return {
    mvp: mvp.winner, dpoy: dpoy.winner, roy: roy.winner, mip: mip.winner, smoy: smoy.winner, coy, eoy,
    allNBA, allDefense, allRookie, allStars,
    cpoy: cpoy.winner,
    hustle: ballots.hustle[0] ?? null,
    teammate: ballots.teammate[0] ?? null,
    scoringChamp: ballots.scoringChamp[0] ?? null,
    reboundingChamp: ballots.reboundingChamp[0] ?? null,
    assistsChamp: ballots.assistsChamp[0] ?? null,
    stealsChamp: ballots.stealsChamp[0] ?? null,
    blocksChamp: ballots.blocksChamp[0] ?? null,
    playerOfTheMonth: ballots.playerOfTheMonth[0] ?? null,
    sharpshooter: ballots.sharpshooter[0] ?? null,
    floorGeneral: ballots.floorGeneral[0] ?? null,
    paintScorer: ballots.paintScorer[0] ?? null,
    ironMan: ballots.ironMan[0] ?? null,
    rookieDefender: ballots.rookieDefender[0] ?? null,
    ballots,
    minGamesRequired: ctx.minGames,
    statMinGames: ctx.statMinGames,
    rookieMinGames: ctx.rookieMinGames,
    ...(Object.keys(coWinners).length ? { coWinners } : {}),
    votes,
    ...(honors.length ? { honors } : {}),
  };
}

function potmFromHonors(months: PeriodHonor[], byId: Map<string, Candidate>): AwardWinner[] {
  const count = new Map<string, { n: number; best: number; h: PeriodHonor }>();
  for (const h of months) {
    const e = count.get(h.playerId) ?? { n: 0, best: 0, h };
    e.n++; e.best = Math.max(e.best, h.score); count.set(h.playerId, e);
  }
  return [...count.values()].sort((a, b) => b.n - a.n || b.best - a.best || a.h.playerId.localeCompare(b.h.playerId)).slice(0, 10)
    .map((e) => { const c = byId.get(e.h.playerId); return { playerId: e.h.playerId, teamId: c?.teamId ?? e.h.teamId, teamName: c?.teamName ?? e.h.teamName, score: e.n }; });
}

/** Before the All-Star vote locks: the leaders by MVP score, half from each conference when the league has them. */
function projectedAllStars(ctx: AwardContext, mvpPool: Scored[], count: number): AwardWinner[] {
  const confs = ctx.everyone.every((c) => c.conference) && ctx.everyone.length ? (['east', 'west'] as const) : null;
  if (!confs) return mvpPool.slice(0, count).map((x, i) => ({ ...toWinner(x.c, x.s), starter: i < 10 }));
  const per = Math.floor(count / 2);
  const picks = confs.map((conf) => mvpPool.filter((x) => x.c.conference === conf).slice(0, per));
  const tag = (x: Scored, starter: boolean) => ({ ...toWinner(x.c, x.s), conference: x.c.conference, starter });
  // Starters first (five per conference), then reserves — "first ten are starters" holds for every reader.
  return [...picks.flatMap((p) => p.slice(0, 5).map((x) => tag(x, true))), ...picks.flatMap((p) => p.slice(5).map((x) => tag(x, false)))];
}

/**
 * Finals MVP: aggregates box-score production across every game of the
 * championship series for players on the winning team, and picks the best by
 * the same shape of formula as regular-season MVP. Returns null until the
 * finals series has actually been won.
 */
export function computeFinalsMVP(finalsSeries: PlayoffSeries | undefined, league: League): AwardWinner | null {
  const line = finalsMVPLine(finalsSeries, league);
  return line ? line.winner : null;
}

/** Finals MVP with his series averages, for the ceremony card. */
export function finalsMVPLine(finalsSeries: PlayoffSeries | undefined, league: League): { winner: AwardWinner; games: number; ppg: number; rpg: number; apg: number } | null {
  if (!finalsSeries || !finalsSeries.winnerTeamId || finalsSeries.games.length === 0) return null;
  const winnerTeamId = finalsSeries.winnerTeamId;
  const winnerTeam = league.teams.find((t) => t.teamId === winnerTeamId);
  if (!winnerTeam) return null;

  const totals = new Map<string, { points: number; ast: number; reb: number; stl: number; blk: number; tov: number; games: number }>();
  const addLine = (box: GameResult['homeBox'] | GameResult['awayBox']) => {
    if (box.teamId !== winnerTeamId) return;
    for (const line of Object.values(box.players)) {
      const entry = totals.get(line.playerId) ?? { points: 0, ast: 0, reb: 0, stl: 0, blk: 0, tov: 0, games: 0 };
      entry.points += line.points;
      entry.ast += line.ast;
      entry.reb += line.oreb + line.dreb;
      entry.stl += line.stl;
      entry.blk += line.blk;
      entry.tov += line.tov;
      entry.games += 1;
      totals.set(line.playerId, entry);
    }
  };
  for (const game of finalsSeries.games) {
    addLine(game.homeBox);
    addLine(game.awayBox);
  }
  if (totals.size === 0) return null;

  let bestId: string | null = null;
  let bestScore = -Infinity;
  for (const [playerId, t] of totals.entries()) {
    const gp = Math.max(1, t.games);
    const score = (t.points + t.ast * 1.5 + t.reb * 1.2 + t.stl * 1.5 + t.blk * 1.5 - t.tov * 0.5) / gp;
    if (score > bestScore) { bestScore = score; bestId = playerId; }
  }
  if (!bestId) return null;
  const t = totals.get(bestId)!;
  const gp = Math.max(1, t.games);
  return { winner: { playerId: bestId, teamId: winnerTeamId, teamName: winnerTeam.name, score: Math.round(bestScore * 10) / 10 },
    games: t.games, ppg: round1(t.points / gp), rpg: round1(t.reb / gp), apg: round1(t.ast / gp) };
}

/** A simple, transparent legacy score: production accumulation plus a bonus per award won. */
export function computeLegacyScore(season: PlayerSeason, awardsWon: number): number {
  const avg = perGameAverages(season.seasonStats);
  const productionScore = (avg.ppg + avg.apg * 1.3 + avg.rpg * 1.1) * (season.seasonStats?.gamesPlayed ?? 0) * 0.05;
  return Math.round(productionScore + awardsWon * 25);
}


/** Games each team plays this season (from the schedule), for showing what the eligibility shares mean. */
export function seasonGamesPerTeam(league: League): number {
  const first = league.teams[0]?.teamId;
  const scheduled = first ? league.schedule.filter((g) => g.homeTeamId === first || g.awayTeamId === first).length : 0;
  return scheduled || league.settings?.gamesPerSeason || 82;
}
