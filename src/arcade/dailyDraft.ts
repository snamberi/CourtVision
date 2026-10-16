import type { NbaHistory } from '../history/nbaHistoryData';

/* Daily Draft: everyone gets the same real draft class each day and holds the same five picks. The rest of the league
 * drafts in real order (the players really taken first go first); you pick whoever you like at your slots. You score
 * your players' real career Win Shares, against the players really taken at your picks. */

const NBA = new Set(['BAA', 'NBA']);
export const DAILY_DRAFT_KEY = 'cv-daily-draft';
export const PICKS = 5;

export interface Prospect { idx: number | null; name: string; pick: number; team: string; college: string | null; pos: string | null; ws: number; pts: number; games: number }
export interface DailyDraft { day: string; year: number; prospects: Prospect[]; slots: number[] }

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const careerCache = new WeakMap<NbaHistory, Map<number, { ws: number; pts: number; games: number }>>();
/** Real NBA career totals: Win Shares, points and games. */
export function career(h: NbaHistory, idx: number): { ws: number; pts: number; games: number } {
  let cache = careerCache.get(h);
  if (!cache) { cache = new Map(); careerCache.set(h, cache); }
  const hit = cache.get(idx);
  if (hit) return hit;
  const rows = (h.seasonsByPlayer.get(idx) ?? []).filter(r => NBA.has(r.league));
  const bySeason = new Map<number, typeof rows>();
  for (const r of rows) (bySeason.get(r.season) ?? bySeason.set(r.season, []).get(r.season)!).push(r);
  let ws = 0, pts = 0, games = 0;
  for (const rs of bySeason.values()) {
    const agg = rs.find(r => r.isAggregate) ?? rs[0];
    ws += agg.adv?.ws ?? 0; pts += agg.stats.pts ?? 0; games += agg.stats.g ?? 0;
  }
  const out = { ws: Math.round(ws * 10) / 10, pts, games };
  cache.set(idx, out);
  return out;
}

/** Draft years with careers long enough to judge (through ~5 seasons before the data ends). */
export function draftYears(h: NbaHistory): number[] {
  const last = Math.max(...h.drafts.filter(d => NBA.has(d.league)).map(d => d.year)) - 5;
  const years: number[] = [];
  for (let y = 1966; y <= last; y++) if (h.drafts.filter(d => d.year === y && NBA.has(d.league) && d.player != null).length >= 30) years.push(y);
  return years;
}

/** The day's draft: a real class (first two rounds, up to 50 players) and your five pick slots. */
export function dailyDraft(h: NbaHistory, day: string): DailyDraft {
  const years = draftYears(h);
  const r = rng(hash(`draft:${day}`));
  const year = years[Math.floor(r() * years.length)];
  const prospects: Prospect[] = h.drafts.filter(d => d.year === year && NBA.has(d.league) && d.pick != null).sort((a, b) => a.pick! - b.pick!).slice(0, 50).map(d => {
    const p = d.player != null ? h.players[d.player] : null;
    const c = d.player != null ? career(h, d.player) : { ws: 0, pts: 0, games: 0 };
    return { idx: d.player, name: p?.displayName ?? d.name, pick: d.pick!, team: d.team, college: d.college ?? p?.college ?? null, pos: p?.pos ?? null, ...c };
  });
  const max = prospects.length;
  const slots: number[] = [];
  let at = 2 + Math.floor(r() * 7); // first pick: 2nd to 8th
  for (let i = 0; i < PICKS && at <= max; i++) { slots.push(at); at += 6 + Math.floor(r() * 5); }
  return { day, year, prospects, slots };
}

/**
 * Plays the draft with your choices so far: before each of your slots, the other teams take the best-remaining players
 * in real draft order. Returns who is still available when you are on the clock, and every pick made.
 */
export function runDraft(d: DailyDraft, mine: number[]): { taken: Map<number, number>; onClock: number | null; available: Prospect[] } {
  const taken = new Map<number, number>(); // real pick number of the player -> draft slot he went at
  const avail = () => d.prospects.filter(p => !taken.has(p.pick));
  let choice = 0;
  for (let slot = 1; slot <= d.prospects.length; slot++) {
    if (d.slots.includes(slot)) {
      if (choice >= mine.length) return { taken, onClock: slot, available: avail() };
      taken.set(mine[choice++], slot);
    } else {
      const next = avail()[0];
      if (!next) break;
      taken.set(next.pick, slot);
    }
    if (choice >= d.slots.length && slot >= Math.max(...d.slots)) break;
  }
  return { taken, onClock: null, available: avail() };
}

export interface DraftScore { yours: Prospect[]; real: Prospect[]; score: number; realScore: number; best: number; grade: string }
export function scoreDraft(d: DailyDraft, mine: number[]): DraftScore {
  const by = new Map(d.prospects.map(p => [p.pick, p]));
  const yours = mine.map(m => by.get(m)!).filter(Boolean);
  const real = d.slots.map(s => by.get(s)).filter((p): p is Prospect => !!p);
  const score = Math.round(yours.reduce((s, p) => s + p.ws, 0) * 10) / 10;
  const realScore = Math.round(real.reduce((s, p) => s + p.ws, 0) * 10) / 10;
  const best = Math.round([...d.prospects].sort((a, b) => b.ws - a.ws).slice(0, d.slots.length).reduce((s, p) => s + p.ws, 0) * 10) / 10;
  const ratio = best > 0 ? score / best : 0;
  const grade = ratio >= 0.8 ? 'A+' : ratio >= 0.65 ? 'A' : ratio >= 0.5 ? 'B' : ratio >= 0.35 ? 'C' : ratio >= 0.2 ? 'D' : 'F';
  return { yours, real, score, realScore, best, grade };
}

export interface DailyDraftRecord { picks: number[]; score: number; realScore: number; grade: string }
export function readDailyDraftWith(read: (key: string) => string | null): Record<string, DailyDraftRecord> {
  try { const v = JSON.parse(read(DAILY_DRAFT_KEY) ?? '{}') as unknown; return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, DailyDraftRecord> : {}; } catch { return {}; }
}
export const readDailyDraft = () => readDailyDraftWith(key => { try { return localStorage.getItem(key); } catch { return null; } });
/** XP for one finished Daily Draft: 30, plus more for a better grade. */
export const dailyDraftXp = (grade: string) => 30 + (({ 'A+': 40, A: 30, B: 20, C: 10 } as Record<string, number>)[grade] ?? 0);
export function saveDailyDraft(day: string, rec: DailyDraftRecord) {
  try { localStorage.setItem(DAILY_DRAFT_KEY, JSON.stringify({ ...readDailyDraft(), [day]: rec })); } catch { /* storage blocked */ }
}
/** Days in a row (ending today or yesterday) with a finished draft. */
export function draftStreak(records: Record<string, DailyDraftRecord>, today: string): number {
  let n = 0;
  const d = new Date(`${today}T00:00:00Z`);
  if (!records[today]) d.setUTCDate(d.getUTCDate() - 1);
  while (records[d.toISOString().slice(0, 10)]) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}
