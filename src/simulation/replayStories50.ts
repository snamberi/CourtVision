import type { GameResult } from './boxscore';
import type { League } from './league';
import type { LiveTeam } from './liveBox';
import { gameLog } from './logPacking';
export interface TurningPoint50 { start: number; end: number; teamId: string; points: number; opponent: number; turnovers: number; secondChances: number; quarter: number; clock: number; lineup: string[] }
export function turningPoints50(game: GameResult): TurningPoint50[] {
  const log = gameLog(game), candidates: TurningPoint50[] = [];
  for (let end = 3; end < log.length; end++) {
    const start = Math.max(0, end - 9), before = log[start - 1], last = log[end], home = last.homeScoreAfter - (before?.homeScoreAfter ?? 0), away = last.awayScoreAfter - (before?.awayScoreAfter ?? 0);
    if (Math.abs(home - away) < 6) continue;
    const winningHome = home > away, teamId = winningHome ? game.homeTeamId : game.awayTeamId, stretch = log.slice(start, end + 1);
    candidates.push({ start, end, teamId, points: Math.max(home, away), opponent: Math.min(home, away), turnovers: stretch.filter(e => e.offenseTeamId !== teamId && e.result === 'TURNOVER').length,
      secondChances: stretch.filter(e => e.offenseTeamId === teamId && e.secondChance).length, quarter: log[start].quarter, clock: log[start].clockSeconds, lineup: winningHome ? log[start].onCourtHome : log[start].onCourtAway });
  }
  const selected: TurningPoint50[] = [];
  for (const c of candidates.sort((a, b) => (b.points - b.opponent) - (a.points - a.opponent) || b.end - a.end)) {
    if (!selected.some(s => c.start <= s.end + 4 && c.end >= s.start - 4)) selected.push(c);
    if (selected.length === 3) break;
  }
  return selected.sort((a, b) => a.start - b.start);
}
export interface RecordTarget50 { stat: 'pts' | 'tpm' | 'ast' | 'reb' | 'stl' | 'blk'; value: number; holder: string; scope: 'league' | 'franchise'; teamId?: string }
export function recordTargets50(league: League, teamIds: string[], playoffs = false): RecordTarget50[] {
  const book = league.recordBook?.game ?? {}, scope = playoffs ? 'po' : 'rs';
  const out: RecordTarget50[] = [];
  for (const stat of ['pts', 'tpm', 'ast', 'reb', 'stl', 'blk'] as const) {
    const top = book[`p:${scope}:${stat}`]?.[0]; if (top) out.push({ stat, value: top.value, holder: top.playerId ?? '', scope: 'league' });
    for (const teamId of teamIds) { const top = book[`franchise:${teamId}:${scope}:${stat}`]?.[0]; if (top) out.push({ stat, value: top.value, holder: top.playerId ?? '', scope: 'franchise', teamId }); }
  }
  return out;
}
const LABELS = { pts: 'points', tpm: 'threes', ast: 'assists', reb: 'rebounds', stl: 'steals', blk: 'blocks' };
export function liveRecordChases50(teams: LiveTeam[], targets: RecordTarget50[]) {
  const output: { key: string; text: string; broken: boolean }[] = [];
  for (const team of teams) for (const line of team.lines) for (const target of targets) {
    if (target.teamId && target.teamId !== team.teamId) continue;
    const value = target.stat === 'reb' ? line.oreb + line.dreb : line[target.stat];
    const minimum = target.stat === 'pts' ? 20 : target.stat === 'tpm' ? 4 : 5;
    if (target.value < minimum || value < Math.max(minimum, target.value - (target.stat === 'pts' ? 5 : 2))) continue;
    const remaining = target.value + 1 - value;
    output.push({ key: `${team.teamId}:${line.playerId}:${target.scope}:${target.stat}`, broken: remaining <= 0,
      text: `${line.playerId}: ${value} ${LABELS[target.stat]} · ${remaining <= 0 ? `new ${target.scope} record!` : `${remaining} from a new ${target.scope} record (${target.value}, ${target.holder})`}` });
  }
  return output.sort((a, b) => Number(b.broken) - Number(a.broken)).slice(0, 4);
}
