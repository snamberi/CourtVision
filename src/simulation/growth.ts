import type { PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';

/**
 * How many Overall points a player can be expected to add over the next few seasons, out of the gap to his
 * potential. Measured over three full seasons of AI leagues: a 20-22-year-old rated in his 40s-50s who plays adds
 * about half of his gap; one in his 30s, buried on the bench, adds under a sixth; by 26-27 little is left to come.
 * Front offices value youth by this (not by the whole gap, which almost nobody reaches).
 */
export function expectedGrowth(p: PlayerSeason): number {
  const overall = calculateOverall(p);
  const gap = Math.max(0, (p.development?.potential ?? overall) - overall);
  const ageShare = p.age <= 21 ? 0.6 : p.age <= 23 ? 0.5 : p.age <= 25 ? 0.35 : p.age <= 27 ? 0.15 : 0;
  const playing = Math.max(0.25, Math.min(1, (overall - 30) / 25));
  return gap * ageShare * playing;
}
