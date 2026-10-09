import type { Attributes } from '../types';

/*
 * Ratings past 99 (a Career Mode player, or a "high ratings" player; everyone else is clamped at 99). Each Career
 * category has its own payoff once it goes past 99, reaching the full effect at 110:
 *
 *  - Athleticism: he never needs a rest. At 110 he plays the whole game (48 minutes).
 *  - Body: he owns the paint. Stronger at the rim, and more of his shots come there.
 *  - Height (not a rating): rebounds and blocks, handled in rebound.ts and possession.ts (works for any player).
 *  - IQ & Clutch: he runs the team. More assists, better shots, and teammates play better with him (wins and titles).
 *
 * At 99 or below every factor is 0, so ordinary players and leagues play exactly as before.
 */

export const SUPER_FROM = 99;
export const SUPER_FULL = 110;

/** 0 at 99 or below, 1 at 110, up to 1.5 past that (the career cap is 120). */
export const superFactor = (rating: number) => Math.max(0, Math.min(1.5, (rating - SUPER_FROM) / (SUPER_FULL - SUPER_FROM)));

const avg = (...v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

export const athleticismOf = (a: Attributes) => avg(a.physical.speed, a.physical.acceleration, a.physical.vertical, a.physical.agility);
export const bodyOf = (a: Attributes) => avg(a.physical.strength, a.physical.balance, a.physical.stamina, a.physical.durability);
export const iqOf = (a: Attributes) => avg(a.mental.basketballIQ, a.mental.clutch, a.mental.composure, a.mental.pressurePerformance, a.offense.offensiveIQ, a.offense.shotIQ);

/** How much each category is past 99 (0 = an ordinary player). */
export function superFactors(a: Attributes): { athleticism: number; body: number; iq: number } {
  return { athleticism: superFactor(athleticismOf(a)), body: superFactor(bodyOf(a)), iq: superFactor(iqOf(a)) };
}
