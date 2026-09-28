import type { NbaHistory } from '../history/nbaHistoryData';
import { cardPool } from './cards';
import { huntTeams } from './teams';

/*
 * Team ratings on a 0-100 scale for League Hunt. A plain average of the roster hides what wins: one great player is
 * worth more than two good ones. So the best six are weighted from the top (the star counts most, the sixth man
 * least), and that weighted strength is mapped onto real results: every real team-season in the data is ranked by it
 * and lined up against the real distribution of win totals, then win totals become the rating:
 *
 *   60 = a bad team (about 25 wins) · 70 = about 40 wins · 80 = about 45 · 90 = 55-62 · 100 = 68 wins.
 *
 * No real team goes past 100, but a hunt squad can: every 1.5 wins past 68 is one more point.
 */

export const RATING_WEIGHTS = [0.25, 0.21, 0.18, 0.15, 0.12, 0.09];

/** Weighted strength of the best six (on the card overall scale). */
export function rawStrength(ovrs: number[]): number {
  const best = [...ovrs].sort((a, b) => b - a).slice(0, RATING_WEIGHTS.length);
  const w = RATING_WEIGHTS.slice(0, best.length).reduce((a, b) => a + b, 0);
  return w ? best.reduce((n, v, i) => n + v * RATING_WEIGHTS[i], 0) / w : 0;
}

/** Wins (per 82 games) to rating. */
const WIN_POINTS: [number, number][] = [[0, 35], [10, 45], [25, 60], [40, 70], [45, 80], [58, 90], [68, 100]];
export function winsToRating(wins: number): number {
  if (wins >= 68) return 100 + (wins - 68) / 1.5;
  for (let i = 1; i < WIN_POINTS.length; i++) {
    const [w1, r1] = WIN_POINTS[i], [w0, r0] = WIN_POINTS[i - 1];
    if (wins <= w1) return r0 + (r1 - r0) * (Math.max(w0, wins) - w0) / (w1 - w0);
  }
  return 100;
}

interface Scale { raws: number[]; wins: number[] }
const scales = new WeakMap<NbaHistory, Scale>();

/** Real strengths and real win totals, both sorted, for quantile matching. Built once per dataset. */
function scale(h: NbaHistory): Scale {
  const cached = scales.get(h);
  if (cached) return cached;
  const pool = cardPool(h);
  const teams = huntTeams(h);
  const s = { raws: teams.map(t => rawStrength(t.roster.map(id => pool.byId.get(id)!.ovr))).sort((a, b) => a - b), wins: teams.map(t => t.w * 82 / Math.max(1, t.w + t.l)).sort((a, b) => a - b) };
  scales.set(h, s);
  return s;
}

/** Expected wins over 82 games for a weighted strength. Beyond the best real team, every point is worth 2.5 wins. */
export function expectedWins(h: NbaHistory, raw: number): number {
  const { raws, wins } = scale(h);
  const n = raws.length;
  if (raw <= raws[0]) return Math.max(0, wins[0] - (raws[0] - raw) * 2.5);
  if (raw >= raws[n - 1]) return Math.min(82, wins[n - 1] + (raw - raws[n - 1]) * 2.5);
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (raws[mid] <= raw) lo = mid; else hi = mid; }
  const t = raws[hi] === raws[lo] ? 0 : (raw - raws[lo]) / (raws[hi] - raws[lo]);
  return wins[lo] + (wins[hi] - wins[lo]) * t;
}

/** The 0-100 rating for a weighted strength. */
export const ratingOf = (h: NbaHistory, raw: number) => Math.round(winsToRating(expectedWins(h, raw)));
/** The 0-100 rating for a list of overalls. */
export const rosterRating = (h: NbaHistory, ovrs: number[]) => ratingOf(h, rawStrength(ovrs));

/** The smallest flat bonus for everyone that lifts a roster to `target` (with `exact`, it may also be negative). */
export function bonusToReach(h: NbaHistory, ovrs: number[], target: number, exact = false): number {
  // Exact lifts step by a quarter point so the rating lands on the target instead of jumping past it.
  const step = exact ? 0.25 : 1;
  for (let b = exact ? -20 : 0; b <= 40; b += step) if (rosterRating(h, ovrs.map(o => o + b)) >= target) return b;
  return 40;
}
