import type { RNG } from './rng';
import type { Attributes } from '../types';
import type { AggregatedFlags } from './effective';
import type { ShotType } from './shot';
import { RIM_TYPES } from './shot';

export interface BallHandlerCandidate {
  playerId: string;
  priority: number; // 0-100, from PlayerSeason.ballHandlerPriority (user-overridable)
  fatigueLevel: number;
  onCourt: boolean;
}

/** Explicitly determines which on-court player has the ball this possession.
 * Weighted steeply by priority (not linearly) so a true go-to star pulls significantly more of the
 * team's touches than a role player, mirroring how usage rate concentrates on top options in real ball. */
export function chooseBallHandler(candidates: BallHandlerCandidate[], rng: RNG): string {
  const onCourt = candidates.filter((c) => c.onCourt);
  const weights = onCourt.map((c) => Math.max(0.3, Math.pow(c.priority / 100, 1.7) * 100) * (1 - c.fatigueLevel * 0.15));
  const idx = rng.weightedPick(weights);
  return onCourt[idx].playerId;
}

export function computeBlockProbability(
  defense: Attributes,
  shotType: ShotType,
  shooterFinishing: number,
  flags: AggregatedFlags,
  blockFrequencyMult = 1, // League Rules: Simulation Engine "Block Frequency" x Defense "Block Success" (both scale the same lever)
  rimProtectionMult = 1, // League Rules: Defense "Rim Protection" - scales specifically the rimProtection attribute's contribution
): number {
  if (flags.unblockableShot) return 0;
  if (!RIM_TYPES.includes(shotType) && shotType !== 'postShot' && shotType !== 'hook') return 0.01;

  if (flags.perfectBlocker) return 1;

  const block = defense.defense.block;
  const blockIQ = defense.defense.blockIQ;
  const timing = defense.defense.blockTiming;
  const rimProtection = defense.defense.rimProtection;
  const vertical = defense.physical.vertical * (flags.verticalMultiplier ?? 1);

  let p = 0.02 + (block * 0.0025 + blockIQ * 0.0012 + timing * 0.0012 + rimProtection * 0.0015 * rimProtectionMult + vertical * 0.0008);
  p -= shooterFinishing * 0.0012;
  p *= blockFrequencyMult;

  return Math.max(0, Math.min(0.5, p));
}
