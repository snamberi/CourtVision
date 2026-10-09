import type { RNG } from './rng';
import type { AggregatedFlags } from './effective';

export type InjurySeverity = 'minor' | 'moderate' | 'severe';

export interface InjuryOutcome {
  occurred: boolean;
  severity?: InjurySeverity;
  recoveryGamesEstimate?: number;
}

/**
 * Rolls for an injury on a single possession for one on-court player. Kept
 * deliberately rare (this fires up to ~10 times per possession across a full
 * game) — tuned so a full 82-game season produces a plausible handful of
 * injuries per team, not one every game.
 */
export function rollInjury(
  fatigueLevel: number,
  durability: number,
  injuryRisk: number,
  frequencyMultiplier: number,
  flags: AggregatedFlags,
  rng: RNG,
): InjuryOutcome {
  if (flags.noInjury) return { occurred: false };

  let probability = 0.00012 * frequencyMultiplier;
  probability *= 1 + fatigueLevel * 1.5;
  probability *= 1 + Math.max(0, 60 - durability) * 0.01;
  probability *= 1 + injuryRisk * 0.01;
  // A body past 99 (Career Mode) rarely breaks down: half the risk at 110.
  probability *= 1 - 0.5 * Math.min(1, Math.max(0, (durability - 99) / 11));

  if (!rng.chance(probability)) return { occurred: false };

  const roll = rng.next();
  const severity: InjurySeverity = roll < 0.6 ? 'minor' : roll < 0.9 ? 'moderate' : 'severe';
  const recoveryGamesEstimate = severity === 'minor' ? 1 + rng.nextInt(3) : severity === 'moderate' ? 5 + rng.nextInt(6) : 15 + rng.nextInt(16);

  return { occurred: true, severity, recoveryGamesEstimate };
}
