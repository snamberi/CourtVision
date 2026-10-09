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
  iq?: number; // superFactor of IQ past 99 (superstar.ts): a floor general gets the ball more
}

/** Explicitly determines which on-court player has the ball this possession.
 * Weighted steeply by priority (not linearly) so a true go-to star pulls significantly more of the
 * team's touches than a role player, mirroring how usage rate concentrates on top options in real ball. */
export function chooseBallHandler(candidates: BallHandlerCandidate[], rng: RNG): string {
  const onCourt = candidates.filter((c) => c.onCourt);
  const weights = onCourt.map((c) => {
    // A floor general runs the offense whatever his position: his priority climbs toward 100.
    const priority = c.priority + (100 - c.priority) * 0.8 * (c.iq ?? 0);
    return Math.max(0.3, Math.pow(priority / 100, 1.7) * 100) * (1 - c.fatigueLevel * 0.15) * (1 + (c.iq ?? 0));
  });
  const idx = rng.weightedPick(weights);
  return onCourt[idx].playerId;
}

/** Extra block reach from height past 7'0" (1 = no change). */
export const blockLength = (heightInches: number) => 1 + Math.max(0, Math.min(96, heightInches || 0) - 84) * 0.17;

export function computeBlockProbability(
  defense: Attributes,
  shotType: ShotType,
  shooterFinishing: number,
  flags: AggregatedFlags,
  blockFrequencyMult = 1, // League Rules: Simulation Engine "Block Frequency" x Defense "Block Success" (both scale the same lever)
  rimProtectionMult = 1, // League Rules: Defense "Rim Protection" - scales specifically the rimProtection attribute's contribution
): number {
  if (flags.unblockableShot) return 0;
  if (flags.perfectBlocker) return 1;

  const block = defense.defense.block;
  const blockIQ = defense.defense.blockIQ;
  const timing = defense.defense.blockTiming;
  const rimProtection = defense.defense.rimProtection * rimProtectionMult;
  const vertical = defense.physical.vertical * (flags.verticalMultiplier ?? 1);
  // 0-100 shot-blocking skill; the curve keeps ordinary defenders modest and lets true rim protectors stand out.
  const skill = Math.max(0, Math.min(100, block * 0.35 + rimProtection * 0.2 + blockIQ * 0.15 + timing * 0.15 + vertical * 0.15));
  const talent = Math.pow(skill / 100, 1.8);

  // Jump shots are rarely blocked (NBA: about 1-2% of jumpers).
  if (!RIM_TYPES.includes(shotType) && shotType !== 'postShot' && shotType !== 'hook') {
    return Math.max(0, Math.min(0.06, (0.004 + talent * 0.02) * blockFrequencyMult));
  }
  // Around the rim: about 8% for an average defender, 15-18% for an elite rim protector (NBA teams block about
  // 5 shots a game). Good finishers get their shot off more often.
  let p = 0.02 + talent * 0.215 - (shooterFinishing - 50) * 0.0007;
  // Length: past 7'0" every inch reaches more shots (a 7'8" giant blocks about two and a half times as many).
  p *= blockLength(defense.physical.heightInches);
  p *= blockFrequencyMult;
  // The usual ceiling, raised for giants: their reach gets to shots nobody else can.
  return Math.max(0.005, Math.min(0.35 * Math.min(1.15, blockLength(defense.physical.heightInches)), p));
}
