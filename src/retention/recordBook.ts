import { localRead, type Read } from '../lib/kv';
import { HIGH_CATS, type GameHighs, type HighCat } from '../hunt/statLines';

/*
 * The run record book: your best single games across League Hunt and the 82-0 Challenge ("Most points in a game: 58,
 * Curry 2016 vs the 1996 Bulls"), and the Finals MVP of each 82-0 title. It belongs to the account (synced).
 */

export const RECORD_BOOK_KEY = 'cv-record-book';
export type RunMode = 'hunt' | 'perfect';
export interface BookHigh { v: number; name: string; vs: string; mode: RunMode; at: number }
export interface FinalsMvp { name: string; record: string; pts: number; g: number; at: number }
export interface RecordBook { highs: Partial<Record<HighCat, BookHigh>>; finals: FinalsMvp[] }

const EMPTY: RecordBook = { highs: {}, finals: [] };
const MAX_FINALS = 30;

export function readRecordBook(read: Read = localRead): RecordBook {
  try {
    const r = JSON.parse(read(RECORD_BOOK_KEY) ?? 'null') as RecordBook | null;
    return r && typeof r === 'object' ? { highs: r.highs && typeof r.highs === 'object' ? r.highs : {}, finals: Array.isArray(r.finals) ? r.finals : [] } : EMPTY;
  } catch { return EMPTY; }
}
const save = (b: RecordBook) => { try { localStorage.setItem(RECORD_BOOK_KEY, JSON.stringify(b)); window.dispatchEvent(new Event('courtvision:progress')); } catch { /* storage blocked */ } };

/** Takes a finished run's best games into the book; returns the categories it set a new record in. */
export function noteRunHighs(mode: RunMode, highs: GameHighs | undefined, at = Date.now()): HighCat[] {
  if (!highs) return [];
  const book = readRecordBook(), set: HighCat[] = [];
  for (const k of HIGH_CATS) {
    const h = highs[k];
    if (h && h.v > (book.highs[k]?.v ?? 0)) { book.highs[k] = { ...h, mode, at }; set.push(k); }
  }
  if (set.length) save(book);
  return set;
}

export function noteFinalsMvp(mvp: Omit<FinalsMvp, 'at'>, at = Date.now()): void {
  const book = readRecordBook();
  if (book.finals.some(f => f.at === at)) return;
  save({ ...book, finals: [{ ...mvp, at }, ...book.finals].slice(0, MAX_FINALS) });
}

/** Two devices: the better game in each category, and every Finals MVP once. */
export function mergeRecordBook(a: RecordBook, b: RecordBook): RecordBook {
  const highs: RecordBook['highs'] = { ...b.highs };
  for (const k of HIGH_CATS) { const x = a.highs[k], y = b.highs[k]; if (x && (!y || x.v > y.v || (x.v === y.v && x.at < y.at))) highs[k] = x; }
  const seen = new Set<string>(), finals: FinalsMvp[] = [];
  for (const f of [...a.finals, ...b.finals].sort((x, y) => y.at - x.at)) { const key = `${f.at}|${f.name}`; if (!seen.has(key)) { seen.add(key); finals.push(f); } }
  return { highs, finals: finals.slice(0, MAX_FINALS) };
}
