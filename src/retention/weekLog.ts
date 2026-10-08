import { localRead, type Read } from '../lib/kv';
import { weekKey } from './week';

/*
 * The week log behind the weekly recap: time played, runs finished and the best of each, and record-book entries,
 * per ISO week. Kept on this device for the last eight weeks.
 */

export const WEEK_LOG_KEY = 'cv-week-log';
export type LogMode = 'hunt' | 'perfect' | 'career' | 'rebuild' | 'draft' | 'guess' | 'hilo' | 'bracket' | 'quiz' | 'grid';
export const LOG_LABEL: Record<LogMode, [string, string]> = { hunt: ['League Hunt', 'League Hunts'], perfect: ['82-0 run', '82-0 runs'], career: ['career', 'careers'], rebuild: ['rebuild', 'rebuilds'], draft: ['All-Time Draft', 'All-Time Drafts'], guess: ['Guess the Player day', 'Guess the Player days'], hilo: ['Higher or Lower run', 'Higher or Lower runs'], bracket: ['bracket', 'brackets'], quiz: ['quiz round', 'quiz rounds'], grid: ['Daily Grid', 'Daily Grids'] };
export interface WeekBest { score: number; line: string }
export interface WeekEntry { seconds: number; runs: Partial<Record<LogMode, number>>; best: Partial<Record<LogMode, WeekBest>>; records: number; /** Runs already counted (a save can come through twice). */ ids?: string[] }
export type WeekLog = Record<string, WeekEntry>;
const KEEP = 8;

export function readWeekLog(read: Read = localRead): WeekLog {
  try { const r = JSON.parse(read(WEEK_LOG_KEY) ?? '{}') as WeekLog; return r && typeof r === 'object' ? r : {}; } catch { return {}; }
}
function update(fn: (e: WeekEntry) => WeekEntry, now = new Date()): void {
  const log = readWeekLog(), wk = weekKey(now);
  log[wk] = fn(log[wk] ?? { seconds: 0, runs: {}, best: {}, records: 0 });
  const keep = Object.keys(log).sort().slice(-KEEP);
  try { localStorage.setItem(WEEK_LOG_KEY, JSON.stringify(Object.fromEntries(keep.map(k => [k, log[k]])))); } catch { /* storage blocked */ }
}

export const noteWeekTime = (seconds: number, now = new Date()) => update(e => ({ ...e, seconds: e.seconds + seconds }), now);
export const noteWeekRecords = (n: number, now = new Date()) => { if (n > 0) update(e => ({ ...e, records: e.records + n }), now); };
/** A finished run, game or career: counted once (by `id`), and kept if it is the week's best in its mode. */
export function noteWeekRun(mode: LogMode, best?: WeekBest, id?: string, now = new Date()): void {
  update(e => {
    if (id && e.ids?.includes(id)) return e;
    return { ...e, runs: { ...e.runs, [mode]: (e.runs[mode] ?? 0) + 1 }, best: best && best.score > (e.best[mode]?.score ?? -Infinity) ? { ...e.best, [mode]: best } : e.best, ...(id ? { ids: [...(e.ids ?? []), id].slice(-200) } : {}) };
  }, now);
}

/** The ISO week before this one. */
export const lastWeekKey = (now = new Date()) => weekKey(new Date(now.getTime() - 7 * 24 * 3600 * 1000));
/** Whether a week has anything worth a recap (a few minutes of play or a finished run). */
export const recapWorthy = (e: WeekEntry | undefined) => !!e && (e.seconds >= 300 || Object.values(e.runs).some(n => (n ?? 0) > 0));

/** The recap as lines of text (the card and the share text). */
export function recapLines(e: WeekEntry, formatTime: (s: number) => string): string[] {
  const lines: string[] = [];
  if (e.seconds >= 60) lines.push(`${formatTime(e.seconds)} played`);
  for (const m of Object.keys(LOG_LABEL) as LogMode[]) {
    const n = e.runs[m] ?? 0;
    if (!n) continue;
    const b = e.best[m];
    lines.push(`${n} ${LOG_LABEL[m][n === 1 ? 0 : 1]}${b ? ` (best: ${b.line})` : ''}`);
  }
  if (e.records) lines.push(`${e.records} new record${e.records === 1 ? '' : 's'} in your record book`);
  return lines;
}
