import type { HistRating, NbaHistory } from './nbaHistoryData';

/*
 * Real ratings come from ranking each season's production on its own, so a star on a stacked team (Curry the year
 * Durant arrived) or a player who missed half a season can swing 10+ points in a year. Real careers move more
 * gently: here each player's ratings are blended with the seasons either side, a single year can move at most
 * MAX_STEP points, and good players get a small boost (the old ceiling was 91). Used for Franchise leagues, where a
 * player lives through many seasons.
 */
export const MAX_STEP = 6;
const W_PREV = 0.25, W_SELF = 0.5, W_NEXT = 0.25;

/** The boost: none below 50, rising to +4 at the top (91 → 95). */
export const ratingBoost = (ovr: number) => Math.round(4 * Math.max(0, Math.min(1, (ovr - 50) / 41)));

/** Smoothed, step-limited and boosted Overall for one player's seasons, in season order. Pure. */
export function smoothCareer(raw: { season: number; ovr: number }[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const prev = i > 0 && raw[i - 1].season === raw[i].season - 1 ? raw[i - 1].ovr : null;
    const next = i + 1 < raw.length && raw[i + 1].season === raw[i].season + 1 ? raw[i + 1].ovr : null;
    let sum = raw[i].ovr * W_SELF, w = W_SELF;
    if (prev != null) { sum += prev * W_PREV; w += W_PREV; }
    if (next != null) { sum += next * W_NEXT; w += W_NEXT; }
    let v = sum / w;
    // A season straight after the last one can move at most MAX_STEP (a gap year, injury or comeback is free).
    if (i > 0 && prev != null) v = Math.max(out[i - 1] - MAX_STEP, Math.min(out[i - 1] + MAX_STEP, v));
    out.push(v);
  }
  return out.map(v => Math.max(25, Math.min(99, Math.round(v) + ratingBoost(Math.round(v)))));
}

const cache = new WeakMap<NbaHistory, Map<number, Map<number, HistRating>>>();
/**
 * Franchise ratings by player and season: the single-season ratings (which Hunt and Career cards keep, since a card
 * is one season) smoothed with smoothCareer. Built once per dataset.
 */
export function franchiseRatings(h: NbaHistory): Map<number, Map<number, HistRating>> {
  const hit = cache.get(h);
  if (hit) return hit;
  const out = new Map<number, Map<number, HistRating>>();
  for (const [player, m] of h.ratingsByPlayer) {
    const seasons = [...m.values()].sort((a, b) => a.season - b.season);
    const smoothed = smoothCareer(seasons);
    out.set(player, new Map(seasons.map((r, i) => [r.season, { ...r, ovr: smoothed[i] }])));
  }
  cache.set(h, out);
  return out;
}
