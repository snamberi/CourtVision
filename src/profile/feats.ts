import { localRead, type Read } from '../lib/kv';

/*
 * Feats: small counters that no other record keeps (a League Hunt won on Legend, PvP wins and best rating, the best
 * ranked tier, All-Time Drafts finished). They travel with the account (merged by keeping the higher number) and
 * feed the mode achievements.
 */

export const FEATS_KEY = 'cv-feats';
export const FEATS_EVENT = 'courtvision:progress';
export type FeatId = 'huntLegendWins' | 'pvpWins' | 'pvpBest' | 'rankedTier' | 'drafts' | 'draftTop';
export type Feats = Partial<Record<FeatId, number>>;

export function readFeats(read: Read = localRead): Feats {
  try {
    const raw = JSON.parse(read(FEATS_KEY) ?? '{}') as Record<string, unknown>;
    const out: Feats = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k as FeatId] = Math.floor(v);
    return out;
  } catch { return {}; }
}

/** Adds to a counter (`add`) or raises a best (`max`). */
export function noteFeat(id: FeatId, value: number, how: 'add' | 'max' = 'add'): void {
  const f = readFeats();
  const next = how === 'add' ? (f[id] ?? 0) + value : Math.max(f[id] ?? 0, value);
  if (next === f[id]) return;
  try { localStorage.setItem(FEATS_KEY, JSON.stringify({ ...f, [id]: next })); window.dispatchEvent(new Event(FEATS_EVENT)); } catch { /* storage blocked */ }
}

/** Two copies of the feats: the higher number of each. Keys in a fixed order so a merged copy merges to itself. */
export function mergeFeats(a: Feats, b: Feats): Feats {
  const out: Feats = {};
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort() as FeatId[]) out[k] = Math.max(a[k] ?? 0, b[k] ?? 0);
  return out;
}
