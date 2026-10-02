import type { NbaHistory } from '../history/nbaHistoryData';
import { allFacts, type PlayerFacts } from './facts';

/*
 * Higher or Lower: two real players and one career number. Is the second one's higher or lower? Right, and he stays
 * on as the next player to beat; wrong, and the run is over. Ties count as right.
 */

export type HiloStat = 'ppg' | 'rpg' | 'apg' | 'points' | 'allStars' | 'rings';
export const HILO_STATS: { id: HiloStat; label: string; show: (f: PlayerFacts) => string }[] = [
  { id: 'ppg', label: 'career points per game', show: f => f.ppg.toFixed(1) },
  { id: 'rpg', label: 'career rebounds per game', show: f => f.rpg.toFixed(1) },
  { id: 'apg', label: 'career assists per game', show: f => f.apg.toFixed(1) },
  { id: 'points', label: 'career points', show: f => f.points.toLocaleString() },
  { id: 'allStars', label: 'All-Star selections', show: f => String(f.allStars) },
  { id: 'rings', label: 'championships', show: f => String(f.rings) },
];
export const statDef = (id: HiloStat) => HILO_STATS.find(s => s.id === id)!;

/** Players for this game: well known (two All-Star games, or 15,000 career points) and with full counting stats (1974 on). */
export function hiloPool(h: NbaHistory): PlayerFacts[] {
  return allFacts(h).filter(f => f.debut >= 1974 && (f.allStars >= 2 || f.points >= 15_000) && f.games >= 300);
}

export interface HiloRound { a: number; b: number; stat: HiloStat }

/** A round: the next player and a number on which the two differ (so every round has a right answer). */
export function nextRound(pool: PlayerFacts[], a: PlayerFacts, rand: () => number, avoid: Set<number>): HiloRound {
  for (let tries = 0; tries < 200; tries++) {
    const b = pool[Math.floor(rand() * pool.length)];
    if (!b || b.idx === a.idx || avoid.has(b.idx)) continue;
    const stats = HILO_STATS.filter(s => a[s.id] !== b[s.id] && !(s.id === 'rings' && a.rings + b.rings === 0));
    if (!stats.length) continue;
    return { a: a.idx, b: b.idx, stat: stats[Math.floor(rand() * stats.length)].id };
  }
  const b = pool.find(p => p.idx !== a.idx && p.ppg !== a.ppg)!;
  return { a: a.idx, b: b.idx, stat: 'ppg' };
}

/** Whether "higher" (or "lower") is right for this round. Ties would be right either way. */
export const isRight = (r: HiloRound, byIdx: Map<number, PlayerFacts>, higher: boolean) => {
  const va = byIdx.get(r.a)![r.stat], vb = byIdx.get(r.b)![r.stat];
  return vb === va || (higher ? vb > va : vb < va);
};

export function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
