import type { PossessionLogEntry } from './boxscore';

/** The current run: unanswered points by one team through the first `upto` possessions. */
export function currentRun(log: PossessionLogEntry[], upto: number): { teamId: string | null; points: number } {
  let teamId: string | null = null, points = 0;
  for (let i = 0; i < Math.min(upto, log.length); i++) {
    const e = log[i], prev = log[i - 1];
    const scored = (e.homeScoreAfter - (prev?.homeScoreAfter ?? 0)) + (e.awayScoreAfter - (prev?.awayScoreAfter ?? 0));
    if (e.events.some(ev => ev.endsWith(' timeout')) && teamId && teamId !== e.offenseTeamId) points = 0;
    if (scored <= 0) continue;
    if (teamId === e.offenseTeamId) points += scored; else { teamId = e.offenseTeamId; points = scored; }
  }
  return { teamId, points };
}

/** Your team has the ball in the final 24 seconds of regulation or overtime, tied or down by three or fewer. */
export function lastShotMoment(log: PossessionLogEntry[], at: number, teamId: string, homeId: string, regulationPeriods: number): boolean {
  const e = log[at];
  if (!e || e.offenseTeamId !== teamId || e.quarter < regulationPeriods || e.clockSeconds > 24) return false;
  const prev = log[at - 1];
  const home = prev?.homeScoreAfter ?? 0, away = prev?.awayScoreAfter ?? 0;
  const margin = teamId === homeId ? home - away : away - home;
  return margin <= 0 && margin >= -3;
}
