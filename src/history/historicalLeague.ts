import type { NbaHistory, HistSeasonRow, HistPlayer } from './nbaHistoryData';
import { NBA_HISTORY_DATASET } from './datasetInfo';
import { buildRealPlayer, type RealPlayerSeed, type RealProfile, type RatingFrame } from './realPlayers';
import type { League, LeagueTeam, FranchiseHistoryRecord, TeamSeasonSummary, PlayoffFinish, RetiredPlayerRecord } from '../simulation/league';
import { generateSeasonSchedule, defaultCoachTendencies } from '../simulation/league';
import type { CareerSeasonRecord, HistoricalAward, PlayerSeason, SeasonStatTotals, SeasonStint } from '../simulation/types';
import { DEFAULT_GAME_SETTINGS, emptySeasonMilestones, emptySeasonStatTotals } from '../simulation/types';
import type { GMLeagueExtras, Contract, TradeDifficulty } from '../simulation/gm';
import { prospectsFromSeeds } from './realRollover';
import { assignRosterNumbers, realJerseyNumber, plausibleJerseyNumber } from './jerseyNumbers';
export { prospectsFromSeeds };
import { DEFAULT_CAP_SETTINGS, DEFAULT_GM_FLAGS, computeAskingSalary, generateFutureDraftPicks } from '../simulation/gm';
import { assignGMPersonalities } from '../simulation/aiGM';
import { generateCoachIdentity } from '../simulation/coaching';
import { seasonStartDate } from '../simulation/calendar';
import { calculateOverall } from '../simulation/engine/overall';
import { RNG } from '../simulation/engine/rng';
import type { PlayerAdvanced } from '../simulation/advancedStats';
import type { AwardWinner, SeasonAwards } from '../simulation/awards';

/* Historical NBA leagues.
 * Year convention: startYear 2016 = the opening of 2016-17. History imported = every completed season before it
 * (1946-47 … 2015-16). The data file labels seasons by END year, so the start season is END year startYear + 1.
 * From the start onward the simulation owns history: nothing after the cutoff is imported as a result. */

export const FIRST_START_YEAR = 1946;
export interface HistoricalLeagueMeta {
  source: 'nba-history'; dataset: string; startYear: number;
  /** Real Player Development: real players follow their reference rating trajectory each rollover (see realDevelopment.ts). */
  realDevelopment: boolean;
  /** Real draft classes not yet held, keyed by draft year (June at the end of the season that starts year-1). Hidden reference data. */
  futureClasses: Record<string, RealPlayerSeed[]>;
  /** Drafted players who debut in a later season, keyed by that season's start year, with the team holding their rights. */
  futureDebuts: Record<string, (RealPlayerSeed & { teamAbbr: string | null })[]>;
  /** Last draft year loaded into futureClasses (the app tops this up from the dataset as seasons pass). */
  classesLoadedThrough: number;
  lastDataStartYear: number;
  notes: string[];
  /** Each team's city name at creation, so player-typed team names can be reset. */
  cityNames?: Record<string, string>;
  /** Historical rosters: AI teams are reset to their real rosters at the start of every season the data covers. */
  forceRosters?: boolean;
  /** Real opening rosters by season start year → team → the abbreviation that season and real player ids (top 15 by minutes). */
  realRosters?: Record<string, Record<string, { abbr: string; ids: string[] }>>;
  /** Real mid-season moves by season start year: where each traded player finished that season (applied after the deadline). */
  realMoves?: Record<string, { id: string; to: string }[]>;
  /** Seasons whose real mid-season moves have been applied. */
  movesApplied?: string[];
}

export function supportedStartYears(h: NbaHistory): number[] {
  const last = h.manifest.coverage.seasons[1]; // END year of the last season in the data (2026 = 2025-26)
  const out: number[] = [];
  for (let y = last - 1; y >= FIRST_START_YEAR; y--) out.push(y);
  return out;
}

const NBA = new Set(['BAA', 'NBA']);
const label = (startYear: number) => String(startYear);
const endToStart = (end: number) => end - 1;

function aggregateRow(rows: HistSeasonRow[]): HistSeasonRow {
  return rows.find(r => r.isAggregate) ?? rows[0];
}
function statTotals(r: HistSeasonRow): { totals: SeasonStatTotals; missing: CareerSeasonRecord['missing'] } {
  const s = r.stats, missing: NonNullable<CareerSeasonRecord['missing']> = [];
  const v = (x: number | null, field: keyof SeasonStatTotals) => { if (x == null) { missing.push(field); return 0; } return x; };
  const t = emptySeasonStatTotals();
  t.gamesPlayed = s.g ?? 0; t.minutes = v(s.mp, 'minutes'); t.points = v(s.pts, 'points');
  t.fgm = v(s.fg, 'fgm'); t.fga = v(s.fga, 'fga'); t.tpm = v(s.x3p, 'tpm'); t.tpa = v(s.x3pa, 'tpa'); t.ftm = v(s.ft, 'ftm'); t.fta = v(s.fta, 'fta');
  if (s.orb == null || s.drb == null) {
    if (s.trb != null) { t.oreb = 0; t.dreb = s.trb; missing.push('rebSplit'); } else { missing.push('oreb', 'dreb'); }
  } else { t.oreb = s.orb; t.dreb = s.drb; }
  t.ast = v(s.ast, 'ast'); t.stl = v(s.stl, 'stl'); t.blk = v(s.blk, 'blk'); t.tov = v(s.tov, 'tov'); t.pf = v(s.pf, 'pf');
  if (s.gs == null) missing.push('gs');
  missing.push('ba', 'blkAtt', 'clutchPoints'); // Court Vision-only tracking, never recorded historically
  return { totals: t, missing };
}
const nanIfNull = (x: number | null | undefined) => (x == null ? Number.NaN : x);
function advancedFrom(r: HistSeasonRow): PlayerAdvanced | undefined {
  const a = r.adv;
  if (!a) return undefined;
  const s = r.stats;
  const efg = s.fga ? ((s.fg ?? 0) + 0.5 * (s.x3p ?? 0)) / s.fga : Number.NaN;
  return {
    per: nanIfNull(a.per), tsPct: nanIfNull(a.ts_percent), efgPct: s.x3p == null ? Number.NaN : efg, tpar: nanIfNull(a.x3p_ar), ftr: nanIfNull(a.f_tr),
    orbPct: nanIfNull(a.orb_percent), drbPct: nanIfNull(a.drb_percent), trbPct: nanIfNull(a.trb_percent), astPct: nanIfNull(a.ast_percent),
    stlPct: nanIfNull(a.stl_percent), blkPct: nanIfNull(a.blk_percent), tovPct: nanIfNull(a.tov_percent), usgPct: nanIfNull(a.usg_percent),
    ortg: Number.NaN, drtg: Number.NaN, ows: nanIfNull(a.ows), dws: nanIfNull(a.dws), ws: nanIfNull(a.ws), ws48: nanIfNull(a.ws_48),
  };
}

/** Skill-shaping rates from one or more seasons (minutes-weighted). */
export function profileFrom(rows: HistSeasonRow[]): RealProfile | null {
  const use = rows.filter(r => (r.stats.g ?? 0) > 0);
  if (!use.length) return null;
  const sum = (f: (r: HistSeasonRow) => number | null) => { let n = 0, seen = false; for (const r of use) { const v = f(r); if (v != null) { n += v; seen = true; } } return seen ? n : null; };
  const wavg = (f: (r: HistSeasonRow) => number | null) => {
    let n = 0, w = 0;
    for (const r of use) { const v = f(r); const wt = r.stats.mp ?? r.stats.g ?? 0; if (v != null && wt > 0) { n += v * wt; w += wt; } }
    return w > 0 ? n / w : null;
  };
  const g = sum(r => r.stats.g), mp = sum(r => r.stats.mp), fg = sum(r => r.stats.fg), fga = sum(r => r.stats.fga), x3 = sum(r => r.stats.x3p), x3a = sum(r => r.stats.x3pa);
  const ft = sum(r => r.stats.ft), fta = sum(r => r.stats.fta), pts = sum(r => r.stats.pts);
  return {
    mpg: mp != null && g ? mp / g : null, ptsPer36: pts != null && mp ? pts / mp * 36 : null,
    fgPct: fg != null && fga ? fg / fga : null, twoPct: fg != null && fga && x3 != null && x3a != null && fga - x3a > 0 ? (fg - x3) / (fga - x3a) : null,
    threePct: x3 != null && x3a ? x3 / x3a : null, threeRate: x3a != null && fga ? x3a / fga : null, ftPct: ft != null && fta ? ft / fta : null, ftRate: fta != null && fga ? fta / fga : null,
    astPct: wavg(r => r.adv?.ast_percent ?? null), trbPct: wavg(r => r.adv?.trb_percent ?? null), orbPct: wavg(r => r.adv?.orb_percent ?? null),
    stlPct: wavg(r => r.adv?.stl_percent ?? null), blkPct: wavg(r => r.adv?.blk_percent ?? null), tovPct: wavg(r => r.adv?.tov_percent ?? null),
    usgPct: wavg(r => r.adv?.usg_percent ?? null), dbpm: wavg(r => r.adv?.dbpm ?? null), obpm: wavg(r => r.adv?.obpm ?? null),
  };
}

function ageAt(p: HistPlayer, startYear: number, fallback: number | null): number {
  if (p.birthDate) {
    const [y, m, d] = p.birthDate.split('-').map(Number);
    let age = startYear - y;
    if (m > 10 || (m === 10 && d > 1)) age -= 1; // age on Oct 1 of the start year
    return age;
  }
  return fallback ?? 25;
}

/** Maps any historical team abbreviation to the league's team id for a league whose start season ends in `E`. */
export function franchiseMapper(h: NbaHistory, E: number): { mapTeam: (abbr: string) => string; teamName: (abbr: string, end: number) => string } {
  const franchiseToTeam = new Map<string, string>();
  for (const t of h.teams) if (t.season === E && NBA.has(t.league) && t.franchise) franchiseToTeam.set(t.franchise, t.abbr);
  const abbrToFranchise = new Map<string, string>();
  for (const t of h.teams) if (NBA.has(t.league) && t.franchise) abbrToFranchise.set(t.abbr, t.franchise);
  const names = new Map(h.teams.map(t => [`${t.abbr}|${t.season}`, t.name]));
  return {
    mapTeam: (abbr: string) => { const fr = abbrToFranchise.get(abbr); return (fr && franchiseToTeam.get(fr)) ?? abbr; },
    teamName: (abbr: string, end: number) => names.get(`${abbr}|${end}`) ?? abbr,
  };
}

interface CareerContext { h: NbaHistory; E: number; mapTeam: (abbr: string) => string; teamName: (abbr: string, end: number) => string }

const AWARD_LABELS: Record<string, string> = { mvp: 'MVP', dpoy: 'Defensive Player of the Year', roy: 'Rookie of the Year', smoy: 'Sixth Man of the Year', mip: 'Most Improved Player', clutch: 'Clutch Player of the Year', 'aba-mvp': 'ABA MVP', 'aba-roy': 'ABA Rookie of the Year' };
const teamAwardLabel = (a: string, rank: number | null, lg: string) => {
  const nth = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : '';
  const base = a === 'allLeague' ? (lg === 'BAA' ? 'All-BAA' : 'All-NBA') : a === 'allDefense' ? 'All-Defensive' : a === 'allRookie' ? 'All-Rookie' : 'All-ABA';
  return `${base}${nth ? ` ${nth} Team` : ''}`;
};

/** Every honour a player won in the seasons before the start, keyed by player (built once per dataset). */
type AwardRow = { end: number; award: HistoricalAward; championTeam?: string };
const awardIndex = new WeakMap<NbaHistory, Map<number, AwardRow[]>>();
function honoursByPlayer(h: NbaHistory): Map<number, AwardRow[]> {
  const cached = awardIndex.get(h);
  if (cached) return cached;
  const m = new Map<number, AwardRow[]>();
  const add = (idx: number, row: AwardRow) => (m.get(idx) ?? m.set(idx, []).get(idx)!).push(row);
  const s = (end: number) => label(endToStart(end));
  for (const a of h.awards) if (a.winner) add(a.player, { end: a.season, award: { season: s(a.season), label: AWARD_LABELS[a.award] ?? a.award, detail: a.share != null ? `${(a.share * 100).toFixed(1)}% vote share` : undefined } });
  for (const a of h.teamAwards) add(a.player, { end: a.season, award: { season: s(a.season), label: teamAwardLabel(a.award, a.rank, a.league) } });
  for (const a of h.allStars) add(a.player, { end: a.season, award: { season: s(a.season), label: a.league === 'ABA' ? 'ABA All-Star' : 'All-Star', detail: a.replaced ? 'injury replacement' : undefined } });
  for (const a of h.allStarMvp) add(a.player, { end: a.season, award: { season: s(a.season), label: 'All-Star Game MVP' } });
  for (const c of h.champions) {
    if (c.finalsMvp != null) add(c.finalsMvp, { end: c.season, award: { season: s(c.season), label: 'Finals MVP' } });
    for (const idx of c.rosterCredit) add(idx, { end: c.season, award: { season: s(c.season), label: 'NBA Champion' }, championTeam: c.champion });
  }
  awardIndex.set(h, m);
  return m;
}

function realAwards(ctx: CareerContext, idx: number): HistoricalAward[] {
  return (honoursByPlayer(ctx.h).get(idx) ?? []).filter(r => r.end < ctx.E)
    .map(r => r.championTeam ? { ...r.award, detail: `${ctx.teamName(r.championTeam, r.end)} (credit: last regular-season team)` } : r.award)
    .sort((a, b) => a.season.localeCompare(b.season));
}

function realCareer(ctx: CareerContext, p: HistPlayer): CareerSeasonRecord[] {
  const { h, E, mapTeam } = ctx;
  const rows = (h.seasonsByPlayer.get(p.idx) ?? []).filter(r => NBA.has(r.league) && r.season < E);
  const ends = [...new Set(rows.map(r => r.season))].sort((a, b) => a - b);
  return ends.map(end => {
    const rs = rows.filter(r => r.season === end);
    const agg = aggregateRow(rs), stints = rs.filter(r => !r.isAggregate);
    const { totals, missing } = statTotals(agg);
    const lastTeam = stints[stints.length - 1]?.team ?? agg.team;
    const rating = h.ratingsByPlayer.get(p.idx)?.get(end);
    const splits: SeasonStint[] | undefined = stints.length > 1 ? stints.map(st => ({ teamId: mapTeam(st.team), teamLabel: st.team !== mapTeam(st.team) ? st.team : undefined, stats: statTotals(st).totals, advanced: advancedFrom(st) })) : undefined;
    const milestones = emptySeasonMilestones();
    if (agg.stats.trp_dbl != null) milestones.tripleDoubles = agg.stats.trp_dbl;
    return {
      season: label(endToStart(end)), teamId: mapTeam(lastTeam), ...(lastTeam !== mapTeam(lastTeam) ? { teamLabel: lastTeam } : {}), age: agg.age ?? 0,
      overall: rating ? rating.ovr : 0, stats: totals, milestones, advanced: advancedFrom(agg), ...(splits ? { stints: splits } : {}),
      imported: true, missing: [...(missing ?? []), 'doubleDoubles', 'gameHighs', ...(agg.stats.trp_dbl == null ? ['tripleDoubles' as const] : [])],
      ...(rating ? { rating: { ovr: rating.ovr, source: rating.source } } : {}),
    } as CareerSeasonRecord;
  });
}

/**
 * Every real player whose NBA/BAA career ended before the league's start, as retired players: his real career
 * statistics and honours, and ratings from his final season. Players already in the league (by real id) are skipped.
 */
export function retiredBeforeStart(h: NbaHistory, startYear: number, skipIds: Set<string>, only?: Set<string>): RetiredPlayerRecord[] {
  const E = startYear + 1;
  const { mapTeam, teamName } = franchiseMapper(h, E);
  const ctx: CareerContext = { h, E, mapTeam, teamName };
  const out: RetiredPlayerRecord[] = [];
  for (const p of h.players) {
    if (skipIds.has(p.id) || (only && !only.has(p.id))) continue;
    const rows = (h.seasonsByPlayer.get(p.idx) ?? []).filter(r => NBA.has(r.league));
    if (!rows.length || rows.some(r => r.season >= E)) continue; // still to come: free agent, debut or draft class
    const last = rows[rows.length - 1].season;
    const lastRows = rows.filter(r => r.season === last);
    const lastTeam = lastRows.filter(r => !r.isAggregate).at(-1)?.team ?? lastRows[0].team;
    const seed = seedFor(h, p, last, [last, last - 1, last - 2]);
    const age = ageAt(p, endToStart(last), aggregateRow(lastRows).age);
    const finalSeason = label(endToStart(last));
    const pl = buildRealPlayer(seed, finalSeason, mapTeam(lastTeam), age, seed.rating.ovr, NBA_HISTORY_DATASET);
    const data = { ...pl, seasonStats: undefined, careerHistory: realCareer(ctx, p), historicalAwards: realAwards(ctx, p.idx), birthDate: p.birthDate ?? undefined, jerseyNumber: realJerseyNumber(p.id, null, last) ?? pl.jerseyNumber } as PlayerSeason;
    out.push({ playerId: data.playerId, finalTeamId: mapTeam(lastTeam), finalTeamName: teamName(lastTeam, last), finalSeason, finalAge: age, finalOverall: calculateOverall(data), finalSeasonData: data, preStart: true, realId: p.id });
  }
  return out;
}

/** Rebuilds the saved-without-data pre-start retirees from the NBA history data (keeps each record's own name). */
export function hydrateRetirees(h: NbaHistory, league: League): League {
  const meta = league.historical;
  const missing = (league.retiredPlayers ?? []).filter(r => r.preStart && r.realId && !r.finalSeasonData);
  if (!meta || !missing.length) return league;
  const built = new Map(retiredBeforeStart(h, meta.startYear, new Set(), new Set(missing.map(r => r.realId!))).map(r => [r.realId!, r.finalSeasonData!]));
  return { ...league, retiredPlayers: league.retiredPlayers!.map(r => {
    const data = r.preStart && r.realId && !r.finalSeasonData ? built.get(r.realId) : undefined;
    return data ? { ...r, finalSeasonData: { ...data, playerId: r.playerId } } : r;
  }) };
}

/** Everything the builder needs for one real player at a given season END year. */
export function seedFor(h: NbaHistory, p: HistPlayer, end: number, profileEnds: number[]): RealPlayerSeed {
  const rows = (h.seasonsByPlayer.get(p.idx) ?? []).filter(r => NBA.has(r.league));
  const pick = (e: number) => { const rs = rows.filter(r => r.season === e); return rs.length ? [aggregateRow(rs)] : []; };
  let profileRows: HistSeasonRow[] = [];
  for (const e of profileEnds) { profileRows = profileRows.concat(pick(e)); if (profileRows.reduce((n, r) => n + (r.stats.mp ?? (r.stats.g ?? 0) * 20), 0) >= 1200) break; }
  const ratings = h.ratingsByPlayer.get(p.idx);
  const at = ratings?.get(end) ?? [...(ratings?.values() ?? [])].find(r => r.season >= end) ?? null;
  const frames: RatingFrame[] = [...(ratings?.values() ?? [])].filter(r => r.season > end).sort((a, b) => a.season - b.season).map(r => [endToStart(r.season), r.ovr, r.source]);
  // Position: the most recent listing up to this season (career listings are often just "G"/"F").
  const listed = [...rows].filter(r => r.season <= end && r.pos).sort((a, b) => b.season - a.season)[0]?.pos ?? rows.find(r => r.pos)?.pos ?? p.pos;
  return {
    id: p.id, name: p.displayName, birthDate: p.birthDate, heightIn: p.heightIn, weightLb: p.weightLb, pos: listed, college: p.college, draft: p.draft,
    profile: profileFrom(profileRows),
    rating: at ? { ovr: at.ovr, source: at.source, startYear: endToStart(end) } : { ovr: 35, source: 'default', startYear: endToStart(end) },
    frames,
  };
}

/**
 * Each later season's real opening rosters (a player's first team that season, the top 15 by minutes), keyed by the
 * league's team ids (franchises that moved keep their id), for Historical rosters.
 */
export function historicalRosterPlan(h: NbaHistory, fromEnd: number, toEnd: number, teamIds: Set<string>, mapTeam: (abbr: string) => string): Record<string, Record<string, { abbr: string; ids: string[] }>> {
  const plan: Record<string, Record<string, { abbr: string; ids: string[] }>> = {};
  for (let end = fromEnd; end <= toEnd; end++) {
    const first = new Map<number, HistSeasonRow>();
    for (const r of h.seasons) {
      if (r.season !== end || r.isAggregate || !NBA.has(r.league)) continue;
      const cur = first.get(r.player);
      if (!cur || r.stintIndex < cur.stintIndex) first.set(r.player, r);
    }
    const byTeam = new Map<string, HistSeasonRow[]>();
    for (const r of first.values()) { const id = mapTeam(r.team); if (!teamIds.has(id)) continue; (byTeam.get(id) ?? byTeam.set(id, []).get(id)!).push(r); }
    const season: Record<string, { abbr: string; ids: string[] }> = {};
    for (const [id, rows] of byTeam) {
      rows.sort((a, b) => (b.stats.mp ?? (b.stats.g ?? 0) * 20) - (a.stats.mp ?? (a.stats.g ?? 0) * 20));
      season[id] = { abbr: rows[0].team, ids: rows.slice(0, 15).map(r => h.players[r.player].id) };
    }
    if (Object.keys(season).length) plan[String(endToStart(end))] = season;
  }
  return plan;
}

/** Real mid-season moves: a player who played for more than one team finished the season with the last of them. */
export function historicalMidseasonMoves(h: NbaHistory, fromEnd: number, toEnd: number, teamIds: Set<string>, mapTeam: (abbr: string) => string): Record<string, { id: string; to: string }[]> {
  const out: Record<string, { id: string; to: string }[]> = {};
  const byKey = new Map<string, HistSeasonRow[]>();
  for (const r of h.seasons) {
    if (r.season < fromEnd || r.season > toEnd || r.isAggregate || !NBA.has(r.league)) continue;
    const k = `${r.season}|${r.player}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(r);
  }
  for (const [k, rows] of byKey) {
    if (rows.length < 2) continue;
    const last = [...rows].sort((a, b) => b.stintIndex - a.stintIndex)[0];
    const to = mapTeam(last.team);
    if (!teamIds.has(to) || mapTeam(rows.sort((a, b) => a.stintIndex - b.stintIndex)[0].team) === to) continue;
    const season = String(endToStart(Number(k.split('|')[0])));
    (out[season] ??= []).push({ id: h.players[last.player].id, to });
  }
  return out;
}

/** Seed for a draft prospect of draft year `draftYear` (debut rating from his first NBA season, or his draft slot if he never played). */
function prospectSeed(h: NbaHistory, p: HistPlayer | null, name: string, draft: { year: number; round: number | null; pick: number | null; team: string } | null): RealPlayerSeed {
  if (p && (h.seasonsByPlayer.get(p.idx) ?? []).some(r => NBA.has(r.league))) {
    const first = Math.min(...(h.seasonsByPlayer.get(p.idx) ?? []).filter(r => NBA.has(r.league)).map(r => r.season));
    return seedFor(h, p, first, [first, first + 1]);
  }
  const pick = draft?.pick ?? 60;
  const ovr = Math.round(47 - Math.min(60, pick) * 0.25); // Court Vision scale: fringe-roster level, lower for later picks
  return { id: p?.id ?? `draft:${draft?.year}:${pick}:${name}`, name: p?.displayName ?? name, birthDate: p?.birthDate ?? null, heightIn: p?.heightIn ?? null, weightLb: p?.weightLb ?? null,
    pos: p?.pos ?? null, college: p?.college ?? null, draft, profile: null,
    rating: { ovr, source: 'draft-slot', startYear: draft ? draft.year : 0 }, frames: [] };
}

/** Last draft year in the data. */
export const lastDraftYear = (h: NbaHistory) => h.drafts.reduce((m, d) => (NBA.has(d.league) && d.year > m ? d.year : m), 0);

/** Real draft classes for draft years [from, to]: drafted players plus undrafted players who debuted the following season. */
export function realDraftClasses(h: NbaHistory, from: number, to: number, usedIds: Set<string>): Record<string, RealPlayerSeed[]> {
  const out: Record<string, RealPlayerSeed[]> = {};
  for (let year = from; year <= Math.min(to, lastDraftYear(h)); year++) {
    const seeds: RealPlayerSeed[] = [];
    const picks = h.drafts.filter(d => d.year === year && NBA.has(d.league)).sort((a, b) => (a.pick ?? 999) - (b.pick ?? 999));
    // Early drafts ran 10+ rounds. Everyone who reached the NBA is kept; picks who never played only within two rounds.
    const twoRounds = 2 * Math.max(8, h.teams.filter(t => t.season === year && NBA.has(t.league)).length);
    for (const d of picks) {
      const p = d.player != null ? h.players[d.player] : null;
      if (p && usedIds.has(p.id)) continue;
      const played = !!p && (h.seasonsByPlayer.get(p.idx) ?? []).some(r => NBA.has(r.league));
      if (!played && (d.pick ?? 999) > twoRounds) continue;
      // A drafted player who debuts later than the next season stays in this class: the sim drafts him now (policy).
      seeds.push(prospectSeed(h, p, d.name, { year: d.year, round: d.round, pick: d.pick, team: d.team }));
      if (p) usedIds.add(p.id);
    }
    // Undrafted debutants: first NBA season = the one right after this draft.
    for (const p of h.players) {
      if (usedIds.has(p.id) || p.draft || p.firstSeason !== year + 1) continue;
      if (!(h.seasonsByPlayer.get(p.idx) ?? []).some(r => NBA.has(r.league) && r.season === year + 1)) continue;
      seeds.push(prospectSeed(h, p, p.displayName, null));
      usedIds.add(p.id);
    }
    out[String(year)] = seeds;
  }
  return out;
}

export interface HistoricalLeagueResult { league: League; extras: GMLeagueExtras; summary: { teams: number; rostered: number; freeAgents: number; importedSeasons: number; notes: string[] } }

/** Builds a playable league at the opening of `startYear`-(startYear+1). */
export function buildHistoricalLeague(h: NbaHistory, startYear: number, opts: { realDevelopment: boolean; difficulty: TradeDifficulty; seed?: number; forceRosters?: boolean; allPlayers?: boolean }): HistoricalLeagueResult {
  const E = startYear + 1; // END-year label of the start season in the data
  const lastEnd = h.manifest.coverage.seasons[1];
  if (startYear < FIRST_START_YEAR || E > lastEnd) throw new Error(`Start year ${startYear} is outside the supported range ${FIRST_START_YEAR}–${lastEnd - 1}.`);
  const rng = new RNG(opts.seed ?? startYear * 7919);
  const season = label(startYear);
  const notes: string[] = [
    `Rosters are reconstructed from ${startYear}–${String(E).slice(2)} season participation (each player's first team that season, top 15 by minutes); they are not verified opening-night rosters. Others start as free agents.`,
    'Contracts, coaches, budgets, schedules and game rules are generated by Court Vision, not historical.',
    'Player ratings are Court Vision\'s own, computed from statistics only: each season\'s players are ranked by production and given the Overall spread of a generated league. All skill attributes are estimated from statistics.',
    'Teams use city names (e.g. "Golden State"); official team names are not included. You can type your own in League Settings → League Rules → NBA history.',
    'Conference/division alignment uses today\'s NBA alignment (exact from 2004-05 on).',
    'Player playoff statistics before the start are not in the data; championship credit uses each player\'s last regular-season team (inferred).',
  ];

  // ---- teams of the start season
  const teamRows = h.teams.filter(t => t.season === E && NBA.has(t.league));
  const { mapTeam, teamName } = franchiseMapper(h, E);
  const gamesPerTeam = Math.max(...teamRows.map(t => (t.w ?? 0) + (t.l ?? 0)), 40);

  // ---- who is where at the start
  const startRows = h.seasons.filter(r => r.season === E && NBA.has(r.league) && !r.isAggregate);
  const firstTeam = new Map<number, HistSeasonRow>();
  for (const r of startRows) { const cur = firstTeam.get(r.player); if (!cur || r.stintIndex < cur.stintIndex) firstTeam.set(r.player, r); }
  const byTeam = new Map<string, HistSeasonRow[]>();
  for (const r of firstTeam.values()) { const list = byTeam.get(r.team) ?? []; list.push(r); byTeam.set(r.team, list); }
  const rosterIdx = new Map<number, string>(); // player idx -> team abbr
  const freeAgentIdx = new Set<number>();
  for (const [abbr, rows] of byTeam) {
    rows.sort((a, b) => (b.stats.mp ?? (b.stats.g ?? 0) * 20) - (a.stats.mp ?? (a.stats.g ?? 0) * 20) || (b.stats.pts ?? 0) - (a.stats.pts ?? 0));
    rows.forEach((r, i) => (i < 15 ? rosterIdx.set(r.player, abbr) : freeAgentIdx.add(r.player)));
  }
  // Established players absent this season but back later (injury / overseas) start as free agents.
  for (const p of h.players) {
    if (rosterIdx.has(p.idx) || freeAgentIdx.has(p.idx)) continue;
    const rows = (h.seasonsByPlayer.get(p.idx) ?? []).filter(r => NBA.has(r.league));
    if (rows.some(r => r.season < E) && rows.some(r => r.season > E)) freeAgentIdx.add(p.idx);
  }

  const importedFranchise = (abbr: string) => mapTeam(abbr);
  const ctx: CareerContext = { h, E, mapTeam, teamName };

  const makePlayer = (idx: number, teamId: string | null): PlayerSeason => {
    const p = h.players[idx];
    const seed = seedFor(h, p, E, [E - 1, E - 2, E]);
    const startRow = firstTeam.get(idx);
    const age = ageAt(p, startYear, startRow?.age ?? null);
    const pl = buildRealPlayer(seed, season, teamId, age, seed.rating.ovr, NBA_HISTORY_DATASET);
    return { ...pl, careerHistory: realCareer(ctx, p), historicalAwards: realAwards(ctx, idx), birthDate: p.birthDate ?? undefined } as PlayerSeason;
  };

  const usedIds = new Set<string>();
  const contracts: Record<string, Contract> = {};
  const usedCoachNames = new Set<string>();
  const teams: LeagueTeam[] = teamRows.map(t => {
    const seasons = assignRosterNumbers([...rosterIdx.entries()].filter(([, abbr]) => abbr === t.abbr).map(([idx]) => makePlayer(idx, t.abbr)), t.abbr, E);
    for (const s of seasons) {
      usedIds.add(s.real!.id);
      contracts[s.playerId] = { playerId: s.playerId, teamId: t.abbr, annualSalary: computeAskingSalary(calculateOverall(s), DEFAULT_CAP_SETTINGS), yearsRemaining: 1 + rng.nextInt(4), playerOption: false, teamOption: false };
    }
    return {
      teamId: t.abbr, name: t.name, seasons, identity: { abbreviation: t.abbr } as LeagueTeam['identity'],
      conferenceId: t.conference ?? undefined, divisionId: t.division ?? undefined, marketSize: 50,
      coach: defaultCoachTendencies(), chemistry: 65, coachIdentity: generateCoachIdentity(rng, season, usedCoachNames),
      expenseLevels: { scouting: 50, coaching: 50, health: 50, facilities: 50 },
    } as LeagueTeam;
  });
  const freeAgents = [...freeAgentIdx].map(idx => makePlayer(idx, null)).map(p => ({ ...p, jerseyNumber: realJerseyNumber(p.real!.id, null, E) ?? plausibleJerseyNumber(p.real!.id) }));
  for (const f of freeAgents) usedIds.add(f.real!.id);

  // ---- imported league history (every completed season before the start)
  const franchiseHistory: FranchiseHistoryRecord[] = [];
  const winnerOf = (end: number, key: string): AwardWinner | null => {
    const w = h.awards.find(a => a.season === end && a.award === key && a.winner);
    return w ? awardWinner(h, w.player, end, w.pointsWon ?? 0, mapTeam, w.share, w.firstVotes) : null;
  };
  const ballot = (end: number, key: string): AwardWinner[] => h.awards.filter(a => a.season === end && a.award === key).sort((a, b) => (b.pointsWon ?? 0) - (a.pointsWon ?? 0)).slice(0, 10)
    .map(a => awardWinner(h, a.player, end, a.pointsWon ?? 0, mapTeam, a.share, a.firstVotes));
  const selections = (end: number, key: string) => [1, 2, 3].map(rank => h.teamAwards.filter(a => a.season === end && a.award === key && a.rank === rank && NBA.has(a.league)).map(a => awardWinner(h, a.player, end, 0, mapTeam))).filter(t => t.length);
  for (let end = h.manifest.coverage.seasons[0]; end < E; end++) {
    const seasonTeams = h.teams.filter(t => t.season === end && NBA.has(t.league));
    if (!seasonTeams.length) continue;
    const champ = h.champions.find(c => c.season === end);
    const finish = (abbr: string, po: boolean): PlayoffFinish => champ?.champion === abbr ? 'Champion' : champ?.runnerUp === abbr ? 'Finals' : po ? 'Playoffs' : 'Missed Playoffs';
    const teamSeasons: TeamSeasonSummary[] = seasonTeams.map(t => ({
      teamId: importedFranchise(t.abbr), teamName: t.name, wins: t.w ?? 0, losses: t.l ?? 0,
      ppg: Number.NaN, oppPpg: Number.NaN, ortg: t.ortg ?? Number.NaN, drtg: t.drtg ?? Number.NaN, pace: t.pace ?? Number.NaN,
      tpmPg: Number.NaN, apg: Number.NaN, rpg: Number.NaN, spg: Number.NaN, bpg: Number.NaN,
      playoffFinish: finish(t.abbr, t.playoffs), playoffWins: 0, playoffLosses: 0, roster: [],
    }));
    const coy = h.coachOfYear.find(c => c.season === end);
    const asgMvp = h.allStarMvp.filter(a => a.season === end);
    const fullAwards: SeasonAwards = {
      mvp: winnerOf(end, 'mvp'), dpoy: winnerOf(end, 'dpoy'), roy: winnerOf(end, 'roy'), mip: winnerOf(end, 'mip'), smoy: winnerOf(end, 'smoy'),
      coy: coy ? { teamId: mapTeam(coy.team), teamName: teamName(coy.team, end), score: 0, coachName: coy.coach } : null,
      allNBA: selections(end, 'allLeague'), allDefense: selections(end, 'allDefense'), allRookie: selections(end, 'allRookie'),
      allStars: h.allStars.filter(a => a.season === end && NBA.has(a.league)).map(a => awardWinner(h, a.player, end, 0, mapTeam)),
      cpoy: winnerOf(end, 'clutch'), hustle: null, teammate: null, scoringChamp: null, reboundingChamp: null, assistsChamp: null, stealsChamp: null, blocksChamp: null, playerOfTheMonth: null,
      ballots: { mvp: ballot(end, 'mvp'), dpoy: ballot(end, 'dpoy'), roy: ballot(end, 'roy'), mip: ballot(end, 'mip'), smoy: ballot(end, 'smoy'), cpoy: ballot(end, 'clutch') },
      minGamesRequired: 0,
    };
    const shared = (key: string) => h.awards.filter(a => a.season === end && a.award === key && a.winner).slice(1).map(a => awardWinner(h, a.player, end, a.pointsWon ?? 0, mapTeam, a.share, a.firstVotes));
    const coWinners = Object.fromEntries((['mvp', 'dpoy', 'roy', 'mip', 'smoy'] as const).map(k => [k, shared(k)]).filter(([, v]) => (v as AwardWinner[]).length));
    if (Object.keys(coWinners).length) fullAwards.coWinners = coWinners;
    const mvp = fullAwards.mvp;
    franchiseHistory.push({
      season: label(endToStart(end)), imported: true,
      championTeamId: champ ? mapTeam(champ.champion) : null, championTeamName: champ ? teamName(champ.champion, end) : null,
      championPlayerIds: champ ? champ.rosterCredit.map(i => h.players[i].displayName) : [],
      mvpPlayerId: mvp?.playerId ?? null, mvpTeamName: mvp?.teamName ?? null, dpoyPlayerId: fullAwards.dpoy?.playerId ?? null, royPlayerId: fullAwards.roy?.playerId ?? null,
      fmvpPlayerId: champ?.finalsMvp != null ? h.players[champ.finalsMvp].displayName : null,
      allStarGameMVPPlayerId: asgMvp[0] ? h.players[asgMvp[0].player].displayName : null,
      fullAwards, teamSeasons,
    });
  }

  // ---- future draft classes (next 10 drafts) and delayed debuts
  const firstDraft = E; // the draft held in June at the end of the start season
  const futureClasses = realDraftClasses(h, firstDraft, firstDraft + 9, usedIds);
  const futureDebuts: HistoricalLeagueMeta['futureDebuts'] = {};
  for (const p of h.players) {
    if (usedIds.has(p.id) || !p.draft || p.draft.year >= firstDraft) continue;
    const rows = (h.seasonsByPlayer.get(p.idx) ?? []).filter(r => NBA.has(r.league));
    const first = rows.length ? Math.min(...rows.map(r => r.season)) : null;
    if (first == null || first <= E) continue; // already played (handled above) or never played
    const seed = seedFor(h, p, first, [first, first + 1]);
    (futureDebuts[String(endToStart(first))] ??= []).push({ ...seed, teamAbbr: mapTeam(p.draft.team) });
    usedIds.add(p.id);
  }

  // Every player whose career ended before the start: retired, with his real career and honours.
  const retiredPlayers = opts.allPlayers ? retiredBeforeStart(h, startYear, usedIds) : undefined;
  if (retiredPlayers) notes.push(`Every real player who retired before ${startYear} is loaded as a retired player (${retiredPlayers.length.toLocaleString()} players), with his real career statistics and honours.`);

  const teamIds = teams.map(t => t.teamId);
  const realRosters = opts.forceRosters ? historicalRosterPlan(h, E + 1, lastEnd, new Set(teamIds), mapTeam) : undefined;
  const realMoves = opts.forceRosters ? historicalMidseasonMoves(h, E, lastEnd, new Set(teamIds), mapTeam) : undefined;
  const league: League = {
    teams, schedule: generateSeasonSchedule(teamIds, gamesPerTeam), settings: { ...DEFAULT_GAME_SETTINGS, gamesPerSeason: gamesPerTeam } as League['settings'],
    season, calendarDate: seasonStartDate(season), calendarRound: -1, franchiseHistory, ...(retiredPlayers ? { retiredPlayers } : {}),
    historical: {
      source: 'nba-history', dataset: NBA_HISTORY_DATASET, startYear, realDevelopment: opts.realDevelopment,
      futureClasses, futureDebuts, classesLoadedThrough: Math.min(firstDraft + 9, lastDraftYear(h)), lastDataStartYear: lastEnd - 1, notes,
      cityNames: Object.fromEntries(teams.map(t => [t.teamId, t.name])),
      ...(opts.forceRosters ? { forceRosters: true, realRosters, realMoves } : {}),
    },
  };
  const firstClass = futureClasses[String(firstDraft)] ?? [];
  const extras: GMLeagueExtras = {
    contracts, freeAgents, capSettings: { ...DEFAULT_CAP_SETTINGS }, tradeSettings: { difficulty: opts.difficulty, showValues: false }, ...DEFAULT_GM_FLAGS,
    // Preview of the class drafted at the end of this season (the rollover rebuilds it from futureClasses, like random leagues).
    draftClass: prospectsFromSeeds(firstClass, String(firstDraft), firstDraft),
    freeAgencyOpen: true,
    teamPersonalities: assignGMPersonalities(teamIds, startYear),
    futurePicks: generateFutureDraftPicks(teamIds, firstDraft),
  };
  return { league, extras, summary: { teams: teams.length, rostered: teams.reduce((n, t) => n + t.seasons.length, 0), freeAgents: freeAgents.length, importedSeasons: franchiseHistory.length, notes } };
}

function awardWinner(h: NbaHistory, idx: number, end: number, score: number, mapTeam: (abbr: string) => string, share?: number | null, first?: number | null): AwardWinner {
  const rows = (h.seasonsByPlayer.get(idx) ?? []).filter(r => r.season === end && NBA.has(r.league) && !r.isAggregate);
  const team = rows[rows.length - 1]?.team ?? null;
  return { playerId: h.players[idx].displayName, teamId: team ? mapTeam(team) : null, teamName: team ? (h.teams.find(t => t.abbr === team && t.season === end)?.name ?? team) : '—', score,
    ...(share != null ? { voteShare: share } : {}), ...(first != null ? { firstVotes: first } : {}) };
}

/** Real player ids already present anywhere in a league (rosters, free agents, retired, classes, pending debuts). */
export function realIdsInLeague(league: League, extras: Pick<GMLeagueExtras, 'freeAgents' | 'draftClass'>): Set<string> {
  const ids = new Set<string>();
  const add = (p: PlayerSeason | undefined) => { if (p?.real) ids.add(p.real.id); };
  for (const t of league.teams) t.seasons.forEach(add);
  extras.freeAgents.forEach(add);
  for (const d of extras.draftClass) add(d.trueSeason);
  for (const r of league.retiredPlayers ?? []) { add(r.finalSeasonData); if (r.realId) ids.add(r.realId); }
  for (const seeds of Object.values(league.historical?.futureClasses ?? {})) for (const s of seeds) ids.add(s.id);
  for (const seeds of Object.values(league.historical?.futureDebuts ?? {})) for (const s of seeds) ids.add(s.id);
  return ids;
}

/**
 * Loads more real draft classes into a historical league so the next `aheadYears` offseasons have them.
 * Returns the updated meta, or null when nothing needed loading (or the data has no more drafts).
 */
export function topUpHistoricalClasses(h: NbaHistory, league: League, extras: Pick<GMLeagueExtras, 'freeAgents' | 'draftClass'>, throughDraftYear: number): HistoricalLeagueMeta | null {
  const meta = league.historical;
  if (!meta) return null;
  const target = Math.min(throughDraftYear, lastDraftYear(h));
  if (meta.classesLoadedThrough >= target) return null;
  const added = realDraftClasses(h, meta.classesLoadedThrough + 1, target, realIdsInLeague(league, extras));
  return { ...meta, futureClasses: { ...meta.futureClasses, ...added }, classesLoadedThrough: target };
}
