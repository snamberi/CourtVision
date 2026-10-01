import { localRead, type Read } from '../lib/kv';

/*
 * The daily streak: one visit a day (UTC) keeps it going; a missed day starts it again. Your best streak earns
 * trophies and titles (STREAK_REWARDS), so a broken streak never takes anything back.
 */

export const STREAK_KEY = 'cv-streak';
export interface Streak { last: string; current: number; best: number }
const EMPTY: Streak = { last: '', current: 0, best: 0 };

export const STREAK_REWARDS: { days: number; trophies: number; title?: string }[] = [
  { days: 3, trophies: 500 }, { days: 7, trophies: 1_500, title: 'Regular' }, { days: 14, trophies: 3_000, title: 'Dedicated' },
  { days: 30, trophies: 8_000, title: 'Ironman' }, { days: 60, trophies: 15_000, title: 'Unstoppable' },
];

export function readStreak(read: Read = localRead): Streak {
  try {
    const s = JSON.parse(read(STREAK_KEY) ?? 'null') as Partial<Streak> | null;
    if (!s || typeof s.last !== 'string') return { ...EMPTY };
    const n = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 100_000 ? v : 0);
    return { last: s.last, current: n(s.current), best: Math.max(n(s.best), n(s.current)) };
  } catch { return { ...EMPTY }; }
}

const dayBefore = (day: string) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

/** Today's visit. Returns the streak and, the first time today, the rewards it just reached. */
export function noteVisit(now = new Date()): { streak: Streak; reached: typeof STREAK_REWARDS } {
  const today = now.toISOString().slice(0, 10);
  const s = readStreak();
  if (s.last === today) return { streak: s, reached: [] };
  const current = s.last === dayBefore(today) ? s.current + 1 : 1;
  const next: Streak = { last: today, current, best: Math.max(s.best, current) };
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return { streak: next, reached: STREAK_REWARDS.filter(r => r.days > s.best && r.days <= next.best) };
}

/** Two devices: the later visit's streak, and the best of both. */
export function mergeStreak(a: Streak, b: Streak): Streak {
  const later = a.last > b.last || (a.last === b.last && a.current >= b.current) ? a : b;
  return { last: later.last, current: later.current, best: Math.max(a.best, b.best) };
}

export const streakTrophies = (s: Streak) => STREAK_REWARDS.filter(r => s.best >= r.days).reduce((n, r) => n + r.trophies, 0);
export const streakTitles = (best: number) => STREAK_REWARDS.filter(r => r.title && best >= r.days).map(r => r.title!);
