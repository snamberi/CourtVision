import { seasonStintsFor } from './stints';
import type { PlayerSeason, SeasonStatTotals, SeasonMilestones, CareerSeasonRecord, MissingStat } from './types';
import { emptySeasonStatTotals, emptySeasonMilestones } from './types';
import type { GameResult, PlayerStatLine } from './boxscore';
import type { League } from './league';
import { recordGame, rookieCheck } from './records';
import type { PlayerAdvanced } from './advancedStats';

function addLine(totals: SeasonStatTotals, line: PlayerStatLine): SeasonStatTotals {
  return {
    gamesPlayed: totals.gamesPlayed + (line.minutes > 0 ? 1 : 0),
    minutes: totals.minutes + line.minutes,
    points: totals.points + line.points,
    fgm: totals.fgm + line.fgm, fga: totals.fga + line.fga,
    tpm: totals.tpm + line.tpm, tpa: totals.tpa + line.tpa,
    ftm: totals.ftm + line.ftm, fta: totals.fta + line.fta,
    oreb: totals.oreb + line.oreb, dreb: totals.dreb + line.dreb,
    ast: totals.ast + line.ast, stl: totals.stl + line.stl, blk: totals.blk + line.blk, tov: totals.tov + line.tov,
    pf: totals.pf + line.pf,
    ba: totals.ba + line.ba,
    blkAtt: totals.blkAtt + line.blkAtt,
    clutchPoints: totals.clutchPoints + line.clutchPoints,
  };
}

/** How many of {points, rebounds, assists, steals, blocks} this single game hit double figures in. */
function doubleFigureCategoryCount(line: PlayerStatLine): number {
  const reb = line.oreb + line.dreb;
  return [line.points, reb, line.ast, line.stl, line.blk].filter((v) => v >= 10).length;
}

/** Rolls one game's box-score line into a season's milestone counters (double-doubles, game highs, etc).
 * Follows standard convention: a triple-double game also counts as a double-double, a 5x5 game also
 * counts as a quad/triple/double-double — these thresholds are cumulative, not mutually exclusive. */
function addMilestones(m: SeasonMilestones, line: PlayerStatLine): SeasonMilestones {
  if (line.minutes <= 0) return m;
  const reb = line.oreb + line.dreb;
  const categoryCount = doubleFigureCategoryCount(line);
  return {
    doubleDoubles: m.doubleDoubles + (categoryCount >= 2 ? 1 : 0),
    tripleDoubles: m.tripleDoubles + (categoryCount >= 3 ? 1 : 0),
    quadrupleDoubles: m.quadrupleDoubles + (categoryCount >= 4 ? 1 : 0),
    quintupleDoubles: m.quintupleDoubles + (categoryCount >= 5 ? 1 : 0),
    gameHighPoints: Math.max(m.gameHighPoints, line.points),
    gameHighRebounds: Math.max(m.gameHighRebounds, reb),
    gameHighAssists: Math.max(m.gameHighAssists, line.ast),
    gameHighSteals: Math.max(m.gameHighSteals, line.stl),
    gameHighBlocks: Math.max(m.gameHighBlocks, line.blk),
  };
}

function applyToSeason(season: PlayerSeason, line: PlayerStatLine | undefined): PlayerSeason {
  if (!line) return season;
  return {
    ...season,
    seasonStats: addLine(season.seasonStats ?? emptySeasonStatTotals(), line),
    seasonMilestones: addMilestones(season.seasonMilestones ?? emptySeasonMilestones(), line),
  };
}

/** Applies one game's box score to every participating player — regular-season games to `seasonStats`,
 * playoff games to `playoffStats` — and adds the game to the league record book. Returns a new League. */
export function applyGameResultToLeague(league: League, result: GameResult, opts: { playoffs?: boolean } = {}): League {
  const playoffs = !!opts.playoffs;
  const recordBook = recordGame(league.recordBook, result, { season: league.season ?? '', date: league.calendarDate, playoffs, isRookie: rookieCheck(league) });
  const teams = league.teams.map((t) => {
    const box = t.teamId === result.homeTeamId ? result.homeBox : t.teamId === result.awayTeamId ? result.awayBox : null;
    if (!box) return t;
    return { ...t, seasons: t.seasons.map((s) => playoffs ? applyToPlayoffs(s, box.players[s.playerId]) : applyToSeason(s, box.players[s.playerId])) };
  });
  return { ...league, teams, recordBook };
}
function applyToPlayoffs(season: PlayerSeason, line: PlayerStatLine | undefined): PlayerSeason {
  if (!line) return season;
  return { ...season, playoffStats: addLine(season.playoffStats ?? emptySeasonStatTotals(), line) };
}

// ---------------------------------------------------------------------------
// Per-game averages (basic + full counting-stat averages)
// ---------------------------------------------------------------------------

export interface PerGameAverages {
  gamesPlayed: number;
  mpg: number; ppg: number; rpg: number; orpg: number; drpg: number; apg: number; spg: number; bpg: number; tovPg: number; pfPg: number;
  fgmPg: number; fgaPg: number; tpmPg: number; tpaPg: number; ftmPg: number; ftaPg: number; baPg: number; blkAttPg: number;
  fgPct: number; tpPct: number; ftPct: number; tsPct: number;
  efficiency: number; // simplified "EFF"-style efficiency rating (PTS+REB+AST+STL+BLK-Missed FG-Missed FT-TOV per game)
}

export function perGameAverages(totals: SeasonStatTotals | undefined): PerGameAverages {
  const t = totals ?? emptySeasonStatTotals();
  const gp = Math.max(1, t.gamesPlayed);
  const tsDenom = 2 * (t.fga + 0.44 * t.fta);
  const missedFg = t.fga - t.fgm;
  const missedFt = t.fta - t.ftm;
  const efficiencyTotal = t.points + t.oreb + t.dreb + t.ast + t.stl + t.blk - missedFg - missedFt - t.tov;
  return {
    gamesPlayed: t.gamesPlayed,
    mpg: t.minutes / gp,
    ppg: t.points / gp,
    rpg: (t.oreb + t.dreb) / gp,
    orpg: t.oreb / gp,
    drpg: t.dreb / gp,
    apg: t.ast / gp,
    spg: t.stl / gp,
    bpg: t.blk / gp,
    tovPg: t.tov / gp,
    pfPg: t.pf / gp,
    fgmPg: t.fgm / gp, fgaPg: t.fga / gp,
    tpmPg: t.tpm / gp, tpaPg: t.tpa / gp,
    ftmPg: t.ftm / gp, ftaPg: t.fta / gp,
    baPg: t.ba / gp, blkAttPg: t.blkAtt / gp,
    fgPct: t.fga > 0 ? t.fgm / t.fga : 0,
    tpPct: t.tpa > 0 ? t.tpm / t.tpa : 0,
    ftPct: t.fta > 0 ? t.ftm / t.fta : 0,
    tsPct: tsDenom > 0 ? t.points / tsDenom : 0,
    efficiency: t.gamesPlayed > 0 ? efficiencyTotal / gp : 0,
  };
}

// ---------------------------------------------------------------------------
// Advanced stats (rate/efficiency stats derived from totals — never averaged season-of-averages)
// ---------------------------------------------------------------------------

export interface AdvancedStats {
  efgPct: number; // effective FG% — credits the extra value of a made three
  tsPct: number; // true shooting% — accounts for free throws too
  astToRatio: number; // assists per turnover
  stlToRatio: number; // steals per turnover
  ftRate: number; // FTA per FGA — how often a player gets to the line relative to shot volume
  threePointRate: number; // 3PA as a share of all FGA
  blockSuccessPct: number; // blk / blkAtt — how often a contested shot actually gets blocked
  reboundPct: number; // oreb+dreb share that were offensive (0-1)
  pointsPerShot: number; // points / FGA — captures FT and three-point value in one efficiency number
  turnoverPct: number; // turnovers as a share of total plays used (FGA + 0.44*FTA + TOV)
}

export function computeAdvancedStats(totals: SeasonStatTotals | undefined): AdvancedStats {
  const t = totals ?? emptySeasonStatTotals();
  const tsDenom = 2 * (t.fga + 0.44 * t.fta);
  const playsUsed = t.fga + 0.44 * t.fta + t.tov;
  return {
    efgPct: t.fga > 0 ? (t.fgm + 0.5 * t.tpm) / t.fga : 0,
    tsPct: tsDenom > 0 ? t.points / tsDenom : 0,
    astToRatio: t.tov > 0 ? t.ast / t.tov : t.ast,
    stlToRatio: t.tov > 0 ? t.stl / t.tov : t.stl,
    ftRate: t.fga > 0 ? t.fta / t.fga : 0,
    threePointRate: t.fga > 0 ? t.tpa / t.fga : 0,
    blockSuccessPct: t.blkAtt > 0 ? t.blk / t.blkAtt : 0,
    reboundPct: (t.oreb + t.dreb) > 0 ? t.oreb / (t.oreb + t.dreb) : 0,
    pointsPerShot: t.fga > 0 ? t.points / t.fga : 0,
    turnoverPct: playsUsed > 0 ? t.tov / playsUsed : 0,
  };
}

// ---------------------------------------------------------------------------
// Career-level rollups — always summed from raw totals first, then averaged/derived,
// never computed by averaging each season's own average (per-season averages can hide
// wildly different sample sizes, e.g. a 5-game cameo season vs an 82-game season).
// ---------------------------------------------------------------------------

function sumTotals(a: SeasonStatTotals, b: SeasonStatTotals): SeasonStatTotals {
  return {
    gamesPlayed: a.gamesPlayed + b.gamesPlayed, minutes: a.minutes + b.minutes, points: a.points + b.points,
    fgm: a.fgm + b.fgm, fga: a.fga + b.fga, tpm: a.tpm + b.tpm, tpa: a.tpa + b.tpa,
    ftm: a.ftm + b.ftm, fta: a.fta + b.fta, oreb: a.oreb + b.oreb, dreb: a.dreb + b.dreb,
    ast: a.ast + b.ast, stl: a.stl + b.stl, blk: a.blk + b.blk, tov: a.tov + b.tov,
    pf: a.pf + b.pf, ba: a.ba + b.ba, blkAtt: a.blkAtt + b.blkAtt, clutchPoints: a.clutchPoints + b.clutchPoints,
  };
}

function sumMilestones(a: SeasonMilestones, b: SeasonMilestones): SeasonMilestones {
  return {
    doubleDoubles: a.doubleDoubles + b.doubleDoubles,
    tripleDoubles: a.tripleDoubles + b.tripleDoubles,
    quadrupleDoubles: a.quadrupleDoubles + b.quadrupleDoubles,
    quintupleDoubles: a.quintupleDoubles + b.quintupleDoubles,
    gameHighPoints: Math.max(a.gameHighPoints, b.gameHighPoints),
    gameHighRebounds: Math.max(a.gameHighRebounds, b.gameHighRebounds),
    gameHighAssists: Math.max(a.gameHighAssists, b.gameHighAssists),
    gameHighSteals: Math.max(a.gameHighSteals, b.gameHighSteals),
    gameHighBlocks: Math.max(a.gameHighBlocks, b.gameHighBlocks),
  };
}

/** One row of "every year" totals + advanced stats, for the season-by-season career table. Includes the
 * in-progress current season (if any games have been played) alongside every archived prior season. */
export interface CareerYearRow {
  season: string;
  teamId: string | null;
  age: number;
  overall: number;
  isCurrent: boolean;
  totals: SeasonStatTotals;
  milestones: SeasonMilestones;
  perGame: PerGameAverages;
  advanced: AdvancedStats;
  /** PER, win shares, usage…: archived with the season, or computed live for the current one. */
  adv?: PlayerAdvanced;
  playoffs?: SeasonStatTotals;
  /** Per-team split when he played for more than one team that season; the row itself is the combined ("TOT") line. */
  splits?: { teamId: string; teamLabel?: string; totals: SeasonStatTotals; perGame: PerGameAverages; adv?: PlayerAdvanced }[];
  /** Imported real NBA season (not simulated) and the stats its era did not record. */
  imported?: boolean;
  missing?: MissingStat[];
  teamLabel?: string;
  rating?: CareerSeasonRecord['rating'];
}

export function careerYearRows(season: PlayerSeason, currentAdvanced?: PlayerAdvanced): CareerYearRow[] {
  const rows: CareerYearRow[] = (season.careerHistory ?? []).map((h) => ({
    season: h.season, teamId: h.teamId, age: h.age, overall: h.overall, isCurrent: false,
    totals: h.stats, milestones: h.milestones ?? emptySeasonMilestones(),
    perGame: perGameAverages(h.stats), advanced: computeAdvancedStats(h.stats), adv: h.advanced, playoffs: h.playoffStats,
    ...(h.stints && h.stints.length > 1 ? { splits: h.stints.map(st => ({ teamId: st.teamId, teamLabel: st.teamLabel, totals: st.stats, perGame: perGameAverages(st.stats), adv: st.advanced })) } : {}),
    ...(h.imported ? { imported: true, missing: h.missing ?? [], teamLabel: h.teamLabel, rating: h.rating } : {}),
  }));
  if ((season.seasonStats?.gamesPlayed ?? 0) > 0) {
    rows.push({
      season: season.season, teamId: season.teamId, age: season.age, overall: season.overall?.overall ?? 0, isCurrent: true,
      totals: season.seasonStats!, milestones: season.seasonMilestones ?? emptySeasonMilestones(),
      perGame: perGameAverages(season.seasonStats), advanced: computeAdvancedStats(season.seasonStats), adv: currentAdvanced, playoffs: season.playoffStats,
    });
    const current = season.seasonStints?.length ? seasonStintsFor(season, season.teamId ?? null) : [];
    if (current.length > 1) rows[rows.length - 1].splits = current.map(st => ({ teamId: st.teamId, totals: st.stats, perGame: perGameAverages(st.stats) }));
  }
  return rows;
}

export interface CareerSummary {
  seasonsPlayed: number;
  totals: SeasonStatTotals;
  milestones: SeasonMilestones;
  perGame: PerGameAverages;
  advanced: AdvancedStats;
  /** Stats some seasons did not record (imported history): how many played seasons lack each one. Per-game values for
   * these use only the games of seasons that recorded them; a stat no season recorded is NaN ("—"). */
  partial: Partial<Record<MissingStat, number>>;
}

/** True when `field` was not recorded at all in any season behind `summary` (display "—"). */
export const careerStatUnavailable = (summary: CareerSummary, field: MissingStat) => (summary.partial[field] ?? 0) >= summary.seasonsPlayed && summary.seasonsPlayed > 0;

/** All-time career totals + milestones, summed across every archived season plus the current one in progress. */
export function careerSummary(season: PlayerSeason): CareerSummary {
  const history: CareerSeasonRecord[] = season.careerHistory ?? [];
  let totals = emptySeasonStatTotals();
  let milestones = emptySeasonMilestones();
  let seasonsPlayed = 0;
  const partial: Partial<Record<MissingStat, number>> = {};
  const missingGames: Partial<Record<MissingStat, number>> = {};
  for (const h of history) {
    totals = sumTotals(totals, h.stats);
    milestones = sumMilestones(milestones, h.milestones ?? emptySeasonMilestones());
    if (h.stats.gamesPlayed > 0) seasonsPlayed++;
    if (h.stats.gamesPlayed > 0) for (const f of h.missing ?? []) { partial[f] = (partial[f] ?? 0) + 1; missingGames[f] = (missingGames[f] ?? 0) + h.stats.gamesPlayed; }
  }
  if (season.seasonStats) {
    totals = sumTotals(totals, season.seasonStats);
    milestones = sumMilestones(milestones, season.seasonMilestones ?? emptySeasonMilestones());
    if (season.seasonStats.gamesPlayed > 0) seasonsPlayed++;
  }
  const perGame = perGameAverages(totals);
  if (Object.keys(partial).length) {
    // Per-game rates over the games that actually recorded the stat.
    const per = (value: number, ...fields: MissingStat[]) => {
      const games = totals.gamesPlayed - Math.max(0, ...fields.map(f => missingGames[f] ?? 0));
      return games > 0 ? value / games : Number.NaN;
    };
    perGame.mpg = per(totals.minutes, 'minutes'); perGame.ppg = per(totals.points, 'points'); perGame.apg = per(totals.ast, 'ast');
    perGame.spg = per(totals.stl, 'stl'); perGame.bpg = per(totals.blk, 'blk'); perGame.tovPg = per(totals.tov, 'tov'); perGame.pfPg = per(totals.pf, 'pf');
    perGame.rpg = per(totals.oreb + totals.dreb, 'dreb'); perGame.orpg = per(totals.oreb, 'oreb', 'rebSplit'); perGame.drpg = per(totals.dreb, 'dreb', 'rebSplit');
    perGame.tpmPg = per(totals.tpm, 'tpm'); perGame.tpaPg = per(totals.tpa, 'tpa'); perGame.fgmPg = per(totals.fgm, 'fgm'); perGame.fgaPg = per(totals.fga, 'fga');
    perGame.ftmPg = per(totals.ftm, 'ftm'); perGame.ftaPg = per(totals.fta, 'fta');
    if (careerStatUnavailableRaw(partial, seasonsPlayed, 'tpa')) perGame.tpPct = Number.NaN;
  }
  return { seasonsPlayed, totals, milestones, perGame, advanced: computeAdvancedStats(totals), partial };
}
const careerStatUnavailableRaw = (partial: Partial<Record<MissingStat, number>>, seasons: number, field: MissingStat) => seasons > 0 && (partial[field] ?? 0) >= seasons;
