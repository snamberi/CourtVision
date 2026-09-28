import type { Attributes } from '../types';
import type { AggregatedFlags } from './effective';
import type { RNG } from './rng';

export interface RebounderCandidate {
  playerId: string;
  attributes: Attributes;
  flags: AggregatedFlags;
  isOffense: boolean;
}

/** Calibrated so league-wide offensive rebound rate lands near the NBA's ~25% (it sat at ~47% without it). */
export const DEFENSIVE_POSITION_EDGE = 2.7;
const HEIGHT_PIVOT = 79, HEIGHT_POWER = 7;

/** Returns the playerId who secures the rebound. Missed-shot location subtly shifts weights. */
export function resolveRebound(
  candidates: RebounderCandidate[],
  missWasThree: boolean,
  rng: RNG,
  offenseFrequencyMult = 1,
  defenseFrequencyMult = 1,
): string {
  const weights = candidates.map((c) => {
    const reb = c.isOffense ? c.attributes.offense.offensiveRebounding : c.attributes.defense.defensiveRebounding;
    // Size wins rebounds: weight scales with height to the 7th power around 6'7" (a 7-footer ~1.5x, a 6'2" guard ~0.64x).
    const height = Math.pow(Math.max(66, Math.min(92, c.attributes.physical.heightInches || HEIGHT_PIVOT)) / HEIGHT_PIVOT, HEIGHT_POWER);
    const vertical = c.attributes.physical.vertical * 0.05;
    const threeBonus = missWasThree && !c.isOffense ? 2 : 0; // long rebounds skew slightly toward defense
    // Superlinear so strong rebounders (usually bigs) clearly out-rebound guards, but not so steep that one big takes
    // every board: calibrated so the league leader lands near 13-14 per game and nobody averages 15+ (NBA 2023-24: 13.7).
    let w = (1 + Math.pow(Math.max(0, reb), 1.7) / 30 + vertical + threeBonus) * height;
    w *= c.flags.reboundMultiplier;
    // Defenders start between their man and the rim (box-out position): real offenses win only ~1 in 4 misses.
    if (!c.isOffense) w *= DEFENSIVE_POSITION_EDGE;
    w *= c.isOffense ? offenseFrequencyMult : defenseFrequencyMult;
    return Math.max(0.01, w);
  });
  const idx = rng.weightedPick(weights);
  return candidates[idx].playerId;
}
