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
    const heightBonus = Math.max(0, (c.attributes.physical.heightInches - 78)) * 0.4;
    const vertical = c.attributes.physical.vertical * 0.05;
    const threeBonus = missWasThree && !c.isOffense ? 2 : 0; // long rebounds skew slightly toward defense
    let w = 1 + reb * 0.6 + heightBonus + vertical + threeBonus;
    w *= c.flags.reboundMultiplier;
    // Defenders start between their man and the rim (box-out position): real offenses win only ~1 in 4 misses.
    if (!c.isOffense) w *= DEFENSIVE_POSITION_EDGE;
    w *= c.isOffense ? offenseFrequencyMult : defenseFrequencyMult;
    return Math.max(0.01, w);
  });
  const idx = rng.weightedPick(weights);
  return candidates[idx].playerId;
}
