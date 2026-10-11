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

/** Crunch time is the last two minutes of the fourth quarter or overtime with the game within this many points. */
export const CRUNCH_SECONDS = 120, CRUNCH_MARGIN = 8;
/** Your ball in crunch time: the moments where "play it yourself" hands you the play call. */
export function crunchMoment(log: PossessionLogEntry[], at: number, teamId: string, regulationPeriods: number): boolean {
  const e = log[at];
  if (!e || e.offenseTeamId !== teamId || e.quarter < regulationPeriods || e.clockSeconds > CRUNCH_SECONDS) return false;
  const prev = log[at - 1];
  const home = prev?.homeScoreAfter ?? 0, away = prev?.awayScoreAfter ?? 0;
  return Math.abs(home - away) <= CRUNCH_MARGIN;
}
/** The first possession of crunch time in this game's log, or -1 if the game never got close late. */
export function crunchStart(log: PossessionLogEntry[], regulationPeriods: number): number {
  return log.findIndex((e, i) => {
    if (e.quarter < regulationPeriods || e.clockSeconds > CRUNCH_SECONDS) return false;
    const prev = log[i - 1];
    return Math.abs((prev?.homeScoreAfter ?? 0) - (prev?.awayScoreAfter ?? 0)) <= CRUNCH_MARGIN;
  });
}

/**
 * Momentum from -100 (all away) to 100 (all home): the net points of the last dozen possessions, the most recent counting
 * most. A timeout wipes what came before it, the way a good timeout cools a run.
 */
export const MOMENTUM_WINDOW = 12;
export function momentum(log: PossessionLogEntry[], upto: number): number {
  let net = 0, weight = 0;
  const end = Math.min(upto, log.length);
  for (let i = end - 1, k = 0; i >= 0 && k < MOMENTUM_WINDOW; i--, k++) {
    const e = log[i], prev = log[i - 1], w = 1 - k / (MOMENTUM_WINDOW + 4);
    net += w * ((e.homeScoreAfter - (prev?.homeScoreAfter ?? 0)) - (e.awayScoreAfter - (prev?.awayScoreAfter ?? 0)));
    weight += w;
    if (e.events.some(ev => ev.endsWith(' timeout'))) break;
  }
  // About 1.2 points a possession either way is a full swing.
  return weight ? Math.max(-100, Math.min(100, Math.round(net / weight / 1.2 * 100))) : 0;
}

/**
 * Foul trouble, the way coaches count it: two in the first quarter, three in the second, four in the third, five in the
 * fourth (one short of fouling out from the fourth on, overtime included). Scales to other period counts and foul limits.
 */
export function foulTroubleAt(quarter: number, regulationPeriods: number, foulLimit = 6): number {
  return Math.max(2, Math.min(foulLimit - 1, foulLimit - 1 - (regulationPeriods - quarter)));
}
