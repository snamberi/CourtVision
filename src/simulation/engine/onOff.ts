import type { PossessionLogEntry } from '../boxscore';

export interface OnOffSplit {
  possessionsOn: number;
  possessionsOff: number;
  netPointsPerPossessionOn: number; // (team points - opponent points) per possession while player on court
  netPointsPerPossessionOff: number;
}

/**
 * Computes a simple on/off split for `playerId`, whose team occupies `side`
 * ('home' | 'away') for this possession log. Pass one game's log at a time;
 * to aggregate across a batch, use `mergeOnOffSplits`.
 */
export function computeOnOffSplit(log: PossessionLogEntry[], side: 'home' | 'away', playerId: string): OnOffSplit {
  let onPoss = 0, offPoss = 0, onDiff = 0, offDiff = 0;
  let prevHome = 0, prevAway = 0;

  for (const entry of log) {
    const onCourt = side === 'home' ? entry.onCourtHome.includes(playerId) : entry.onCourtAway.includes(playerId);
    const homeDelta = entry.homeScoreAfter - prevHome;
    const awayDelta = entry.awayScoreAfter - prevAway;
    prevHome = entry.homeScoreAfter;
    prevAway = entry.awayScoreAfter;

    const netForTeam = side === 'home' ? homeDelta - awayDelta : awayDelta - homeDelta;

    if (onCourt) { onPoss += 1; onDiff += netForTeam; }
    else { offPoss += 1; offDiff += netForTeam; }
  }

  return {
    possessionsOn: onPoss,
    possessionsOff: offPoss,
    netPointsPerPossessionOn: onPoss > 0 ? onDiff / onPoss : 0,
    netPointsPerPossessionOff: offPoss > 0 ? offDiff / offPoss : 0,
  };
}

export function mergeOnOffSplits(splits: OnOffSplit[]): OnOffSplit {
  let onPoss = 0, offPoss = 0, onDiff = 0, offDiff = 0;
  for (const s of splits) {
    onPoss += s.possessionsOn;
    offPoss += s.possessionsOff;
    onDiff += s.netPointsPerPossessionOn * s.possessionsOn;
    offDiff += s.netPointsPerPossessionOff * s.possessionsOff;
  }
  return {
    possessionsOn: onPoss,
    possessionsOff: offPoss,
    netPointsPerPossessionOn: onPoss > 0 ? onDiff / onPoss : 0,
    netPointsPerPossessionOff: offPoss > 0 ? offDiff / offPoss : 0,
  };
}
