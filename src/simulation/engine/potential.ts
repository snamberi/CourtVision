import type { PlayerSeason } from '../types';
import type { LeagueRulesSettings } from '../leagueRules';
import { calculateOverall } from './overall';

/** Default prime length for players saved without one (years). */
export const DEFAULT_PRIME_YEARS = 4;
export type CareerPhase = 'growth' | 'prime' | 'decline';

/**
 * The years a player is at their best. Growth happens before `start`; decline begins after `end`.
 * League Rules can shift the window ("peak age shift"), lengthen it ("peak duration", 3 = neutral)
 * and delay the first decline year ("decline starting age").
 */
export function primeWindow(p: Pick<PlayerSeason, 'development'>, rules?: LeagueRulesSettings): { start: number; end: number } {
  const start = p.development.peakAge + (rules?.peakAgeShiftYears ?? 0);
  const own = Math.max(2, Math.min(6, p.development.primeLengthYears ?? DEFAULT_PRIME_YEARS));
  const length = Math.max(1, Math.min(10, own + (rules?.peakDurationYears ?? 3) - 3));
  return { start, end: start + length + (rules?.declineStartingAgeShiftYears ?? 0) };
}
export function careerPhase(p: Pick<PlayerSeason, 'development' | 'age'>, rules?: LeagueRulesSettings, age = p.age): CareerPhase {
  const w = primeWindow(p, rules);
  return age < w.start ? 'growth' : age <= w.end ? 'prime' : 'decline';
}

/**
 * Potential is the best Overall a player can still reach, so it is never below Overall. Once a player
 * reaches their prime they are what they are (potential = overall), and as they decline it falls with them.
 * Returns the same object when nothing changes.
 */
export function syncPotential<T extends PlayerSeason>(p: T, rules?: LeagueRulesSettings): T {
  const overall = calculateOverall(p);
  const phase = careerPhase(p, rules);
  const next = phase === 'growth' ? Math.max(p.development.potential, overall) : overall;
  return next === p.development.potential ? p : { ...p, development: { ...p.development, potential: next } };
}

/**
 * How much of a player's remaining ceiling they can still add through practice (0-1).
 * Prime players only maintain; declining players can slow the slide but not climb.
 */
export function practiceHeadroom(p: PlayerSeason, rules?: LeagueRulesSettings): number {
  const phase = careerPhase(p, rules);
  if (phase !== 'growth') return phase === 'prime' ? 0.08 : 0;
  return Math.max(0, Math.min(1, (p.development.potential - calculateOverall(p)) / 6));
}

/** Soft ceiling on rare talent: every point of potential above 85 is progressively harder to earn. */
export function compressElitePotential(potential: number): number {
  if (potential <= 85) return potential;
  const over = potential - 85;
  return 85 + over * 0.62 - Math.max(0, over - 8) * 0.12;
}
