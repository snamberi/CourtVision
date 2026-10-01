import { localRead, type Read } from '../lib/kv';

/*
 * The Season Pass: free, one a month (UTC). Every XP you earn that month (any mode) fills it; each of its 30 tiers
 * pays trophies, and tiers 10, 20 and 30 also unlock titles for good. Nothing is bought and nothing expires once
 * reached: a new month starts a fresh track.
 */

export const PASS_KEY = 'cv-pass';
export const PASS_TIERS = 30, PASS_TIER_XP = 150;
export interface PassMonth { start: number; tier: number }
export interface PassState { months: Record<string, PassMonth> }

export interface PassTier { tier: number; trophies: number; title?: string }
export const PASS_REWARDS: PassTier[] = Array.from({ length: PASS_TIERS }, (_, i) => {
  const tier = i + 1;
  return { tier, trophies: tier % 5 === 0 ? 1_000 : 250, ...(tier === 10 ? { title: 'Season Grinder' } : tier === 20 ? { title: 'Season Veteran' } : tier === 30 ? { title: 'Pass Master' } : {}) };
});

export const passMonth = (now = new Date()) => now.toISOString().slice(0, 7);

export function readPass(read: Read = localRead): PassState {
  try {
    const p = JSON.parse(read(PASS_KEY) ?? 'null') as PassState | null;
    const months: Record<string, PassMonth> = {};
    for (const [m, v] of Object.entries(p?.months ?? {})) {
      if (/^\d{4}-\d{2}$/.test(m) && v && typeof v.start === 'number' && Number.isInteger(v.tier) && v.tier >= 0 && v.tier <= PASS_TIERS) months[m] = { start: Math.max(0, v.start), tier: v.tier };
    }
    return { months };
  } catch { return { months: {} }; }
}

/** Where this month's pass stands, given your total XP now (the first look in a month records where it starts). */
export function notePass(totalXp: number, now = new Date()): { month: string; xp: number; tier: number; newTiers: PassTier[] } {
  const month = passMonth(now);
  const p = readPass();
  const cur = p.months[month] ?? { start: totalXp, tier: 0 };
  const xp = Math.max(0, totalXp - cur.start);
  const tier = Math.max(cur.tier, Math.min(PASS_TIERS, Math.floor(xp / PASS_TIER_XP)));
  if (!p.months[month] || tier !== cur.tier) {
    try { localStorage.setItem(PASS_KEY, JSON.stringify({ months: { ...p.months, [month]: { start: cur.start, tier } } })); } catch { /* storage blocked */ }
  }
  return { month, xp, tier, newTiers: PASS_REWARDS.filter(r => r.tier > cur.tier && r.tier <= tier) };
}

/** Two devices: per month, the earlier start and the higher tier. */
export function mergePass(a: PassState, b: PassState): PassState {
  const months: Record<string, PassMonth> = { ...b.months };
  for (const [m, x] of Object.entries(a.months)) { const y = months[m]; months[m] = y ? { start: Math.min(x.start, y.start), tier: Math.max(x.tier, y.tier) } : x; }
  return { months: Object.fromEntries(Object.entries(months).sort(([x], [y]) => x.localeCompare(y))) };
}

export const passTrophies = (p: PassState) => Object.values(p.months).reduce((n, m) => n + PASS_REWARDS.filter(r => r.tier <= m.tier).reduce((t, r) => t + r.trophies, 0), 0);
export const passBestTier = (p: PassState) => Math.max(0, ...Object.values(p.months).map(m => m.tier));
export const passTitles = (bestTier: number) => PASS_REWARDS.filter(r => r.title && bestTier >= r.tier).map(r => r.title!);
