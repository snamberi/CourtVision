import { localRead, type Read } from '../lib/kv';
import { weekKey } from '../retention/week';
import { summary, type PerfectMode, type PerfectRun } from './run';

/*
 * The 82-0 Challenge keeps its run and records in this browser (records follow the account through cloud sync).
 * The Daily 82-0 is one seed for everyone each day; the mode alternates by day so everyone plays the same thing.
 */

export const PERFECT_RUN_KEY = 'cv-perfect-run';
export const PERFECT_RECORDS_KEY = 'cv-perfect-records';

export interface PerfectResult { score: number; w: number; l: number; pw: number; pl: number; champion: boolean; mode: PerfectMode }
export interface PerfectRecords {
  runs: number;
  titles: number;
  /** Seasons that went 82-0, and 82-0 plus 16-0. */
  perfectSeasons: number;
  perfect98: number;
  bestWins: number;
  best?: PerfectResult;
  /** The Daily 82-0: your best result each day. */
  daily?: Record<string, PerfectResult & { tries: number }>;
  lastSeed?: number;
}
const EMPTY: PerfectRecords = { runs: 0, titles: 0, perfectSeasons: 0, perfect98: 0, bestWins: 0 };

export function loadPerfectRun(): PerfectRun | null {
  try { const r = JSON.parse(localStorage.getItem(PERFECT_RUN_KEY) ?? 'null') as PerfectRun | null; return r && r.v === 1 ? r : null; } catch { return null; }
}
export function savePerfectRun(run: PerfectRun | null): void {
  try { if (run) localStorage.setItem(PERFECT_RUN_KEY, JSON.stringify(run)); else localStorage.removeItem(PERFECT_RUN_KEY); } catch { /* storage blocked */ }
}

export function loadPerfectRecords(read: Read = localRead): PerfectRecords {
  try { return { ...EMPTY, ...(JSON.parse(read(PERFECT_RECORDS_KEY) ?? '{}') as Partial<PerfectRecords>) }; } catch { return { ...EMPTY }; }
}

const better = (a: PerfectResult | undefined, b: PerfectResult) => !a || b.score > a.score;

/** Counts a finished run once (by its seed and mode); a Daily 82-0 also keeps the day's best. */
export function recordPerfect(run: PerfectRun): PerfectRecords {
  const r = loadPerfectRecords();
  const key = run.seed * 2 + (run.mode === 'franchise' ? 1 : 0);
  if (run.stage !== 'done' || (r.lastSeed === key && !run.daily)) return r;
  const s = summary(run);
  const result: PerfectResult = { score: s.score, w: s.w, l: s.l, pw: s.pw, pl: s.pl, champion: s.champion, mode: run.mode };
  const next: PerfectRecords = {
    ...r, lastSeed: key, runs: r.runs + 1, titles: r.titles + (s.champion ? 1 : 0),
    perfectSeasons: r.perfectSeasons + (s.perfectSeason ? 1 : 0), perfect98: r.perfect98 + (s.perfectSeason && s.perfectPlayoffs ? 1 : 0),
    bestWins: Math.max(r.bestWins, s.w), best: better(r.best, result) ? result : r.best,
  };
  if (run.daily) {
    const d = r.daily?.[run.daily];
    next.daily = { ...(r.daily ?? {}), [run.daily]: { ...(better(d, result) ? result : d!), tries: (d?.tries ?? 0) + 1 } };
  }
  try { localStorage.setItem(PERFECT_RECORDS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return next;
}

/** Best of both devices. */
export function mergePerfectRecords(a: PerfectRecords, b: PerfectRecords): PerfectRecords {
  const daily: Record<string, PerfectResult & { tries: number }> = { ...(b.daily ?? {}) };
  for (const [day, x] of Object.entries(a.daily ?? {})) { const y = daily[day]; daily[day] = !y ? x : { ...(x.score >= y.score ? x : y), tries: Math.max(x.tries, y.tries) }; }
  const best = !a.best ? b.best : !b.best ? a.best : a.best.score >= b.best.score ? a.best : b.best;
  return {
    runs: Math.max(a.runs, b.runs), titles: Math.max(a.titles, b.titles), perfectSeasons: Math.max(a.perfectSeasons, b.perfectSeasons),
    perfect98: Math.max(a.perfect98, b.perfect98), bestWins: Math.max(a.bestWins, b.bestWins), ...(best ? { best } : {}), ...(Object.keys(daily).length ? { daily } : {}),
  };
}

/** The Daily 82-0: today's seed and mode (Quick Spin on even days, Franchise Spin on odd ones). */
export function dailyPerfect(day: string): { seed: number; mode: PerfectMode } {
  let h = 2166136261;
  for (const ch of `courtvision-82-0|${day}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const n = Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  return { seed: (h >>> 0) % 1_000_000_000, mode: n % 2 === 0 ? 'quick' : 'franchise' };
}

/** Your best Daily 82-0 score in each week (the online weekly board). */
export function perfectWeeks(r: PerfectRecords): Record<string, PerfectResult> {
  const out: Record<string, PerfectResult> = {};
  for (const [day, d] of Object.entries(r.daily ?? {})) {
    const t = Date.parse(`${day}T12:00:00Z`);
    if (!Number.isFinite(t)) continue;
    const wk = weekKey(new Date(t));
    if (!out[wk] || d.score > out[wk].score) out[wk] = { score: d.score, w: d.w, l: d.l, pw: d.pw, pl: d.pl, champion: d.champion, mode: d.mode };
  }
  return out;
}

/** Trophy Road points: your best season, your titles and the perfect seasons. */
export const perfectTrophies = (r: PerfectRecords) => r.bestWins * 10 + Math.min(r.titles, 50) * 60 + r.perfectSeasons * 1500 + r.perfect98 * 3000;
