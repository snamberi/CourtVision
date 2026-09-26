import type { League, FranchiseHistoryRecord } from './league';
import type { PlayoffBracket } from './playoffs';

/* Rivalries and dynasties.
 * A rivalry's heat comes from playoff meetings (eliminations sting most), close games and trades of good players
 * between the two teams. Past seasons are folded into league.rivalries at each rollover with a decay, so old feuds
 * cool unless they're renewed; the current season is added live on top.
 * A dynasty is three or more titles within five seasons. Both are derived from saved history. */

export interface RivalryRecord {
  a: string; b: string;           // team ids, sorted
  heat: number;                   // stored heat from past seasons (already decayed)
  games: number; winsA: number; winsB: number; closeGames: number;
  series: number; seriesWinsA: number; seriesWinsB: number; gameSevens: number;
  trades: number;
  eliminations: { season: string; winner: string; round: number }[];
}
export const rivalryKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
const empty = (x: string, y: string): RivalryRecord => { const [a, b] = x < y ? [x, y] : [y, x]; return { a, b, heat: 0, games: 0, winsA: 0, winsB: 0, closeGames: 0, series: 0, seriesWinsA: 0, seriesWinsB: 0, gameSevens: 0, trades: 0, eliminations: [] }; };
const SEASON_DECAY = 0.7;

function heatOf(r: Pick<RivalryRecord, 'closeGames' | 'series' | 'gameSevens' | 'trades'> & { eliminationsCount: number; finals: number; games: number }) {
  return r.closeGames * 1.5 + r.games * 0.2 + r.series * 8 + r.eliminationsCount * 4 + r.gameSevens * 5 + r.finals * 6 + r.trades * 3;
}

/** The current season's contribution, computed live from the schedule and bracket. */
function liveSeason(league: League): Map<string, RivalryRecord & { seasonHeat: number }> {
  const out = new Map<string, RivalryRecord & { seasonHeat: number; finals: number }>();
  const get = (x: string, y: string) => { const k = rivalryKey(x, y); let r = out.get(k); if (!r) { r = { ...empty(x, y), seasonHeat: 0, finals: 0 }; out.set(k, r); } return r; };
  const phaseIsOffseason = ['draft', 'resign_waive', 'free_agency', 'preseason'].includes(league.seasonPhase ?? 'regular_season');
  if (!phaseIsOffseason) {
    for (const g of league.schedule) {
      if (!g.played || !g.result) continue;
      const r = get(g.homeTeamId, g.awayTeamId), winner = g.result.homeScore > g.result.awayScore ? g.homeTeamId : g.awayTeamId;
      r.games++; if (winner === r.a) r.winsA++; else r.winsB++;
      if (Math.abs(g.result.homeScore - g.result.awayScore) <= 5) r.closeGames++;
    }
    addBracket(league.playoffBracket, league.season ?? '', get);
  }
  for (const r of out.values()) r.seasonHeat = heatOf({ ...r, eliminationsCount: r.eliminations.length, finals: r.finals });
  return out;
}

function addBracket(bracket: PlayoffBracket | undefined | null, season: string, get: (x: string, y: string) => RivalryRecord & { finals?: number }) {
  if (!bracket) return;
  const last = bracket.rounds.length - 1;
  bracket.rounds.forEach((round, i) => round.forEach(s => {
    if (!s.teamAId || !s.teamBId || (!s.winnerTeamId && s.teamAWins + s.teamBWins === 0)) return;
    const r = get(s.teamAId, s.teamBId);
    r.series++;
    if (s.teamAWins + s.teamBWins === s.gamesToWin * 2 - 1 && s.gamesToWin >= 4) r.gameSevens++;
    if (i === last) r.finals = (r.finals ?? 0) + 1;
    if (s.winnerTeamId) {
      if (s.winnerTeamId === r.a) r.seriesWinsA++; else r.seriesWinsB++;
      r.eliminations.push({ season, winner: s.winnerTeamId, round: i });
    }
  }));
}

/** Folds the finished season into the stored rivalries (call at the season rollover, before the schedule resets). */
export function archiveRivalries(league: League): Record<string, RivalryRecord> {
  const stored = league.rivalries ?? {};
  const live = liveSeason(league);
  const next: Record<string, RivalryRecord> = {};
  for (const [k, r] of Object.entries(stored)) next[k] = { ...r, heat: Math.round(r.heat * SEASON_DECAY * 10) / 10 };
  for (const [k, l] of live) {
    const r = next[k] ?? empty(l.a, l.b);
    next[k] = { ...r, heat: Math.round((r.heat + l.seasonHeat) * 10) / 10, games: r.games + l.games, winsA: r.winsA + l.winsA, winsB: r.winsB + l.winsB,
      closeGames: r.closeGames + l.closeGames, series: r.series + l.series, seriesWinsA: r.seriesWinsA + l.seriesWinsA, seriesWinsB: r.seriesWinsB + l.seriesWinsB,
      gameSevens: r.gameSevens + l.gameSevens, eliminations: [...r.eliminations, ...l.eliminations].slice(-12) };
  }
  // Drop cold, trivial pairs so saves stay small.
  for (const [k, r] of Object.entries(next)) if (r.heat < 1 && r.series === 0 && r.trades === 0 && r.games < 40) delete next[k];
  return next;
}

/** A trade between two teams involving a good player adds a little bad blood. */
export function recordRivalryTrade(league: League, teamAId: string, teamBId: string, notable: boolean): League {
  if (!notable) return league;
  const k = rivalryKey(teamAId, teamBId), r = league.rivalries?.[k] ?? empty(teamAId, teamBId);
  return { ...league, rivalries: { ...league.rivalries, [k]: { ...r, trades: r.trades + 1, heat: r.heat + 3 } } };
}

export type RivalryLevel = 'Bitter rivals' | 'Rivals' | 'Heated' | null;
export const rivalryLevel = (heat: number): RivalryLevel => heat >= 32 ? 'Bitter rivals' : heat >= 18 ? 'Rivals' : heat >= 10 ? 'Heated' : null;
export interface RivalryView extends RivalryRecord { total: number; level: RivalryLevel }

/** Every pair with stored history or games this season, heat = stored + this season. Sorted hottest first. */
export function rivalryTable(league: League): RivalryView[] {
  const live = liveSeason(league);
  const keys = new Set([...Object.keys(league.rivalries ?? {}), ...live.keys()]);
  const out: RivalryView[] = [];
  for (const k of keys) {
    const s = league.rivalries?.[k], l = live.get(k);
    const base = s ?? empty(l!.a, l!.b);
    const merged: RivalryRecord = l ? { ...base, games: base.games + l.games, winsA: base.winsA + l.winsA, winsB: base.winsB + l.winsB, closeGames: base.closeGames + l.closeGames,
      series: base.series + l.series, seriesWinsA: base.seriesWinsA + l.seriesWinsA, seriesWinsB: base.seriesWinsB + l.seriesWinsB, gameSevens: base.gameSevens + l.gameSevens,
      eliminations: [...base.eliminations, ...l.eliminations] } : base;
    const total = Math.round((base.heat + (l?.seasonHeat ?? 0)) * 10) / 10;
    out.push({ ...merged, total, level: rivalryLevel(total) });
  }
  return out.sort((x, y) => y.total - x.total);
}
export function rivalryBetween(league: League, x: string, y: string): RivalryView | null {
  return rivalryTable(league).find(r => r.a === (x < y ? x : y) && r.b === (x < y ? y : x)) ?? null;
}
export function teamRivals(league: League, teamId: string, limit = 5): RivalryView[] {
  // Named rivalries and playoff foes first, then the matchups that keep going down to the wire (rivalries in the making).
  return rivalryTable(league).filter(r => (r.a === teamId || r.b === teamId) && (r.level || r.series > 0 || r.closeGames >= 2)).slice(0, limit);
}

/** What the watch screen needs: the level and the all-time series, or null when there's no rivalry. */
export function rivalryBadge(league: League, x: string, y: string): { level: string; seriesText: string } | null {
  const r = rivalryBetween(league, x, y);
  if (!r?.level) return null;
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  return { level: r.level, seriesText: `All-time: ${name(r.a)} ${r.winsA}–${r.winsB} ${name(r.b)}${r.series ? ` · playoff series ${r.seriesWinsA}–${r.seriesWinsB}` : ''}` };
}

export interface Dynasty { teamId: string; teamName: string; from: string; to: string; titles: string[] }
/** Three or more championships within any five-season window, merged into one run per streak. */
export function dynasties(history: FranchiseHistoryRecord[]): Dynasty[] {
  const seasons = history.map(h => h.season);
  const byTeam = new Map<string, { name: string; idx: number[] }>();
  history.forEach((h, i) => { if (!h.championTeamId) return; const e = byTeam.get(h.championTeamId) ?? { name: h.championTeamName ?? h.championTeamId, idx: [] }; e.idx.push(i); byTeam.set(h.championTeamId, e); });
  const out: Dynasty[] = [];
  for (const [teamId, { name, idx }] of byTeam) {
    let run: number[] | null = null;
    for (let i = 0; i < idx.length; i++) {
      const window = idx.filter(j => j >= idx[i] && j - idx[i] <= 4);
      if (window.length >= 3) {
        if (run && window[0] <= run[run.length - 1]) run = [...new Set([...run, ...window])].sort((a, b) => a - b);
        else { if (run) out.push(toDynasty(teamId, name, run)); run = window; }
      }
    }
    if (run) out.push(toDynasty(teamId, name, run));
  }
  function toDynasty(teamId: string, name: string, run: number[]): Dynasty {
    return { teamId, teamName: name, from: seasons[run[0]], to: seasons[run[run.length - 1]], titles: run.map(i => seasons[i]) };
  }
  return out.sort((a, b) => a.from.localeCompare(b.from));
}
