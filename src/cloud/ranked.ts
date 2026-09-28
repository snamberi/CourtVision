/*
 * Ranked seasons: one a month (UTC). Scoring events earn rank points, the best result per event counting:
 *   Daily Legend      a win 40, otherwise 3 per series won (up to 27)
 *   Rebuild of Week   25 per star, 25 more for a title (up to 100)
 *   Career of Week    half the Legacy Score (up to 100)
 *   Daily goals       5 per goal, 5 more for all three (up to 20)
 * Points add up across the month into a tier; the tier you finish in is yours to keep.
 */

export const seasonOf = (isoDay: string) => isoDay.slice(0, 7);
export const currentSeason = (now = new Date()) => now.toISOString().slice(0, 7);

export const dailyLegendPoints = (won: boolean, stop: number) => (won ? 40 : Math.min(27, Math.max(0, stop) * 3));
export const weeklyRebuildPoints = (stars: number, title: boolean) => Math.min(100, Math.max(0, stars) * 25 + (title ? 25 : 0));
export const weeklyCareerPoints = (legacy: number) => Math.min(100, Math.max(0, Math.round(legacy / 2)));
export const dailyGoalPoints = (done: number) => Math.min(3, Math.max(0, done)) * 5 + (done >= 3 ? 5 : 0);

export interface Tier { id: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend'; name: string; min: number; color: string }
export const TIERS: Tier[] = [
  { id: 'bronze', name: 'Bronze', min: 0, color: '#c07a45' },
  { id: 'silver', name: 'Silver', min: 150, color: '#b9c4d0' },
  { id: 'gold', name: 'Gold', min: 400, color: '#ffd166' },
  { id: 'platinum', name: 'Platinum', min: 800, color: '#7fe0d0' },
  { id: 'diamond', name: 'Diamond', min: 1300, color: '#7fb7ff' },
  { id: 'legend', name: 'Legend', min: 1900, color: '#f47b20' },
];
export function tierFor(points: number): { tier: Tier; next: Tier | null; into: number } {
  let i = 0;
  while (i + 1 < TIERS.length && points >= TIERS[i + 1].min) i++;
  return { tier: TIERS[i], next: TIERS[i + 1] ?? null, into: points - TIERS[i].min };
}
export const seasonLabel = (season: string) => new Date(`${season}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
