import type { League } from './league';
import type { GMLeagueExtras } from './gm';
import type { SeasonStatTotals } from './types';
import { seasonRows, type CareerRow, type RecordFormat } from './records';
import { zoneSplits } from './gameFeats';
import { SHOT_BANDS } from './shotDistance';

/*
 * All-time leaders: every player who has ever played in this league (active, free agents, retired, and the imported
 * real careers of a historical league) ranked by one stat. The record book keeps the top five; this is the full list.
 */

export type LeaderGroup = 'Totals' | 'Averages' | 'Shooting' | 'Feats' | 'Advanced';
export interface LeaderStat {
  id: string; group: LeaderGroup; label: string; short: string; format: RecordFormat;
  value: (c: CareerRow) => number;
  /** Who counts (averages and percentages need enough games or attempts). */
  qualify?: (c: CareerRow) => boolean;
  qualifier?: string;
}

const per = (n: number, d: number) => (d > 0 ? n / d : 0);
const T = (f: (s: SeasonStatTotals) => number) => (c: CareerRow) => f(c.totals);
const AVG_GAMES = 100;
const avg = (id: string, label: string, short: string, f: (s: SeasonStatTotals) => number): LeaderStat =>
  ({ id, group: 'Averages', label, short, format: 'dec1', value: c => per(f(c.totals), c.totals.gamesPlayed), qualify: c => c.totals.gamesPlayed >= AVG_GAMES, qualifier: `${AVG_GAMES}+ games` });

export const LEADER_STATS: LeaderStat[] = [
  { id: 'pts', group: 'Totals', label: 'Points', short: 'PTS', format: 'int', value: T(s => s.points) },
  { id: 'reb', group: 'Totals', label: 'Rebounds', short: 'REB', format: 'int', value: T(s => s.oreb + s.dreb) },
  { id: 'ast', group: 'Totals', label: 'Assists', short: 'AST', format: 'int', value: T(s => s.ast) },
  { id: 'stl', group: 'Totals', label: 'Steals', short: 'STL', format: 'int', value: T(s => s.stl) },
  { id: 'blk', group: 'Totals', label: 'Blocks', short: 'BLK', format: 'int', value: T(s => s.blk) },
  { id: 'tpm', group: 'Totals', label: 'Three-pointers made', short: '3PM', format: 'int', value: T(s => s.tpm) },
  { id: 'ftm', group: 'Totals', label: 'Free throws made', short: 'FTM', format: 'int', value: T(s => s.ftm) },
  { id: 'gp', group: 'Totals', label: 'Games played', short: 'GP', format: 'int', value: T(s => s.gamesPlayed) },
  { id: 'min', group: 'Totals', label: 'Minutes played', short: 'MIN', format: 'int', value: T(s => s.minutes) },
  { id: 'clutch', group: 'Totals', label: 'Clutch points', short: 'CLU', format: 'int', value: T(s => s.clutchPoints), qualifier: 'last period, final 5 minutes, within 10' },
  { id: 'dd', group: 'Totals', label: 'Double-doubles', short: 'DD', format: 'int', value: c => c.dd },
  { id: 'td', group: 'Totals', label: 'Triple-doubles', short: 'TD', format: 'int', value: c => c.td },
  avg('ppg', 'Points per game', 'PPG', s => s.points), avg('rpg', 'Rebounds per game', 'RPG', s => s.oreb + s.dreb), avg('apg', 'Assists per game', 'APG', s => s.ast),
  avg('spg', 'Steals per game', 'SPG', s => s.stl), avg('bpg', 'Blocks per game', 'BPG', s => s.blk), avg('mpg', 'Minutes per game', 'MPG', s => s.minutes),
  { id: 'fg', group: 'Shooting', label: 'Field-goal %', short: 'FG%', format: 'pct', value: T(s => per(s.fgm, s.fga)), qualify: c => c.totals.fga >= 1000, qualifier: '1,000+ FGA' },
  { id: 'tp', group: 'Shooting', label: 'Three-point %', short: '3P%', format: 'pct', value: T(s => per(s.tpm, s.tpa)), qualify: c => c.totals.tpa >= 300, qualifier: '300+ 3PA' },
  { id: 'ft', group: 'Shooting', label: 'Free-throw %', short: 'FT%', format: 'pct', value: T(s => per(s.ftm, s.fta)), qualify: c => c.totals.fta >= 300, qualifier: '300+ FTA' },
  { id: 'ts', group: 'Shooting', label: 'True shooting %', short: 'TS%', format: 'pct', value: T(s => per(s.points, 2 * (s.fga + 0.44 * s.fta))), qualify: c => c.totals.fga >= 1000, qualifier: '1,000+ FGA' },
  ...SHOT_BANDS.map((b, i): LeaderStat => ({
    id: `zone:${b.id}`, group: 'Shooting', label: `FG% ${b.short}`, short: b.short, format: 'pct',
    value: c => zoneSplits(c.feats.zones)[i].pct ?? 0, qualify: c => (c.feats.zones?.[i * 2] ?? 0) >= (i === 5 ? 50 : 200), qualifier: `${i === 5 ? 50 : 200}+ attempts from ${b.short}`,
  })),
  { id: 'g20', group: 'Feats', label: '20-point games', short: '20+', format: 'int', value: c => c.feats.games20 },
  { id: 'streak20', group: 'Feats', label: 'Longest run of 20-point games', short: 'STREAK', format: 'int', value: c => c.feats.best20Streak },
  { id: '2020', group: 'Feats', label: '20-20 games', short: '20-20', format: 'int', value: c => c.feats.twentyTwenty, qualifier: '20+ in two of PTS, REB, AST' },
  { id: '202020', group: 'Feats', label: '20-20-20 games', short: '20-20-20', format: 'int', value: c => c.feats.triple20 },
  { id: '50', group: 'Feats', label: '50-point games', short: '50+', format: 'int', value: c => c.feats.fifties },
  { id: 'buzzer', group: 'Feats', label: 'Buzzer-beaters', short: 'BZR', format: 'int', value: c => c.feats.buzzerBeaters, qualifier: 'made with the period\'s last 2 seconds' },
  { id: 'winners', group: 'Feats', label: 'Game-winning shots', short: 'GW', format: 'int', value: c => c.feats.gameWinners, qualifier: 'go-ahead for good, final 24 seconds' },
  { id: 'club', group: 'Feats', label: '50-40-90 seasons', short: '50-40-90', format: 'int', value: c => c.feats.club, qualifier: '50% FG, 40% 3P, 90% FT with the minimums' },
  { id: 'ws', group: 'Advanced', label: 'Win Shares', short: 'WS', format: 'dec1', value: c => c.ws },
  { id: 'per', group: 'Advanced', label: 'Player Efficiency Rating', short: 'PER', format: 'dec1', value: c => per(c.perMin, c.perMinutes), qualify: c => c.perMinutes >= 3000, qualifier: '3,000+ minutes' },
  { id: 'seasons', group: 'Advanced', label: 'Seasons played', short: 'YRS', format: 'int', value: c => c.seasons },
];

export interface LeaderRow { rank: number; playerId: string; value: number; seasons: number; games: number; lastTeam: string | null; active: boolean }

/** Every career, once per league state (the list is re-ranked per stat without recomputing it). */
export function careerTable(league: League, extras?: GMLeagueExtras): { careers: CareerRow[]; active: Set<string> } {
  return { careers: seasonRows(league, extras).careers, active: new Set(league.teams.flatMap(t => t.seasons.map(s => s.playerId))) };
}

/** Ranked list for one stat. Ties share a rank. Players with nothing in the stat are left out. */
export function rankLeaders(table: { careers: CareerRow[]; active: Set<string> }, stat: LeaderStat, filter: 'all' | 'active' | 'retired' = 'all'): LeaderRow[] {
  const rows = table.careers
    .filter(c => (filter === 'all' || (filter === 'active') === table.active.has(c.playerId)) && (!stat.qualify || stat.qualify(c)))
    .map(c => ({ c, v: stat.value(c) }))
    .filter(x => Number.isFinite(x.v) && x.v > 0)
    .sort((a, b) => b.v - a.v || a.c.playerId.localeCompare(b.c.playerId));
  let rank = 0, last = NaN;
  return rows.map((x, i) => {
    if (x.v !== last) { rank = i + 1; last = x.v; }
    return { rank, playerId: x.c.playerId, value: x.v, seasons: x.c.seasons, games: x.c.totals.gamesPlayed, lastTeam: x.c.lastTeam, active: table.active.has(x.c.playerId) };
  });
}
