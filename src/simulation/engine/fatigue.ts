import type { AggregatedFlags } from './effective';

export interface FatigueState {
  // 0 = fully fresh, 1 = maximally fatigued
  level: number;
}

export function freshFatigue(): FatigueState {
  return { level: 0 };
}

/**
 * Called once per possession a player is on court. `workload` is 0-1 (higher for
 * possessions with sprints/drives/defensive exertion). Stamina/durability slow
 * fatigue accumulation and speed recovery.
 */
export function updateFatigue(
  state: FatigueState,
  onCourt: boolean,
  workload: number,
  stamina: number, // 0-99 (or higher in sandbox)
  flags: AggregatedFlags,
  elapsedSeconds = 15,
  /** Athleticism past 99 (superstar.ts): at 1 he barely tires. */
  motor = 0,
): FatigueState {
  if (flags.infiniteStamina) return { level: 0 };

  const staminaFactor = Math.max(0.2, 1 - stamina / 130); // higher stamina => slower fatigue buildup
  if (onCourt) {
    const gain = workload * 0.02 * (1 + staminaFactor) * elapsedSeconds / 15 * (1 - 0.8 * Math.min(1, motor));
    return { level: Math.min(1, state.level + gain) };
  }
  // recovery while on the bench
  return { level: Math.max(0, state.level - 0.05 * elapsedSeconds / 15) };
}

/** Multiplier applied to relevant attributes; 1.0 = no penalty, drops as fatigue rises. */
export function fatiguePenaltyMultiplier(state: FatigueState, flags: AggregatedFlags): number {
  if (flags.infiniteStamina) return 1;
  // up to ~18% penalty at full fatigue
  return 1 - state.level * 0.18;
}
