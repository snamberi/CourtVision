import type { FranchiseHistoryRecord, ScheduledGame } from './league';

/* Ring night: the defending champions open the season at home against the team they beat in the Finals.
 * The whole first game day is swapped with the day holding that meeting, so every team still plays once a day. */

/** Last season's champion and Finals loser, from the newest history record that has them. */
export function lastFinalists(history: FranchiseHistoryRecord[] | undefined): { champion: string; runnerUp: string } | null {
  const rec = [...(history ?? [])].reverse().find(r => r.championTeamId);
  if (!rec?.championTeamId) return null;
  const runnerUp = rec.teamSeasons?.find(t => t.playoffFinish === 'Finals' && t.teamId !== rec.championTeamId)?.teamId;
  return runnerUp ? { champion: rec.championTeamId, runnerUp } : null;
}

export function withRingNight(schedule: ScheduledGame[], history: FranchiseHistoryRecord[] | undefined): ScheduledGame[] {
  const f = lastFinalists(history);
  if (!f || !schedule.length) return schedule;
  const meeting = schedule.find(g => !g.played && g.homeTeamId === f.champion && g.awayTeamId === f.runnerUp);
  if (!meeting) return schedule;
  const first = Math.min(...schedule.map(g => g.round));
  const from = meeting.round;
  const marked = (g: ScheduledGame): ScheduledGame => (g === meeting ? { ...g, round: first, ringNight: true } : g);
  if (from === first) return schedule.map(marked);
  return schedule.map(g => (g === meeting ? marked(g) : g.round === from ? { ...g, round: first } : g.round === first ? { ...g, round: from } : g));
}
