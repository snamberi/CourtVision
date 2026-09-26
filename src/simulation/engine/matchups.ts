import type { PositionSuitability } from '../types';

export interface MatchupCandidate {
  playerId: string;
  positions: PositionSuitability;
}

function positionDistance(a: PositionSuitability, b: PositionSuitability): number {
  const keys: (keyof PositionSuitability)[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  let sum = 0;
  for (const k of keys) {
    const diff = a[k] - b[k];
    sum += diff * diff;
  }
  return sum;
}

/**
 * Greedily assigns each offensive player a primary defender from the opposing
 * lineup, minimizing positional mismatch (a small forward with PF/C-heavy
 * suitability won't get assigned to guard a ball-dominant PG just because
 * they share a lineup slot index). Returns, for each offense index, the
 * index into `defense` assigned as primary defender. O(n^2) — fine for 5v5.
 */
export function computeMatchups(offense: MatchupCandidate[], defense: MatchupCandidate[]): number[] {
  const available = defense.map((_, i) => i);
  const result: number[] = new Array(offense.length).fill(-1);

  for (let i = 0; i < offense.length; i++) {
    let bestIdx = -1;
    let bestCost = Infinity;
    for (const j of available) {
      const cost = positionDistance(offense[i].positions, defense[j].positions);
      if (cost < bestCost) { bestCost = cost; bestIdx = j; }
    }
    if (bestIdx === -1) break;
    result[i] = bestIdx;
    available.splice(available.indexOf(bestIdx), 1);
  }
  return result;
}
