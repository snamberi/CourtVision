import { DECKS, DIFFICULTIES, type HuntRun, type DeckId, type Difficulty } from './run';

/* League Hunt keeps its run, records and album in this browser (they are small: card ids and progress). Storage can
 * be blocked in a private window; everything then lasts as long as the page is open. */

const RUN_KEY = 'cv-hunt-run';
const RECORDS_KEY = 'cv-hunt-records';
const ALBUM_KEY = 'cv-hunt-album';

export interface DailyResult { won: boolean; stop: number; wins: number; losses: number }
export interface HuntRecords { runs: number; wins: number; bestStop: number; lastSeed?: number; daily?: Record<string, DailyResult> }
const EMPTY: HuntRecords = { runs: 0, wins: 0, bestStop: 0 };

export function loadRun(): HuntRun | null {
  try {
    // Hunts from before the series rework (versions 1 and 2) can't continue under the new rules; they are dropped.
    const r = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null') as { version?: number } | null;
    return r && r.version === 3 ? r as HuntRun : null;
  } catch { return null; }
}
export function saveRun(run: HuntRun): void {
  try { localStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch { /* storage blocked */ }
  addToAlbum(run.squad);
}
export function clearRun(): void { try { localStorage.removeItem(RUN_KEY); } catch { /* storage blocked */ } }

export function loadRecords(): HuntRecords {
  try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '{}') as Partial<HuntRecords>) }; } catch { return { ...EMPTY }; }
}

/** Counts a finished run once (by its seed); a Daily Legend also records the day's result. */
export function recordRun(run: HuntRun): HuntRecords {
  const r = loadRecords();
  if (r.lastSeed === run.seed) return r;
  const wins = run.results.filter(x => x.won).length;
  const next: HuntRecords = { ...r, runs: r.runs + 1, wins: r.wins + (run.stage === 'won' ? 1 : 0), bestStop: Math.max(r.bestStop, run.stage === 'won' ? run.series.length - 1 : run.seriesIndex), lastSeed: run.seed,
    ...(run.daily ? { daily: { ...(r.daily ?? {}), [run.daily]: { won: run.stage === 'won', stop: run.seriesIndex, wins, losses: run.results.length - wins } } } : {}) };
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return next;
}

// ---------------------------------------------------------------- unlocks

const DECK_RULE: Record<DeckId, (r: HuntRecords) => boolean> = {
  classic: () => true, bigMen: r => r.bestStop >= 2, oldSchool: r => r.runs >= 3, paceSpace: r => r.bestStop >= 4, dynasty: r => r.wins >= 1,
};
const DIFF_RULE: Record<Difficulty, (r: HuntRecords) => boolean> = { rookie: () => true, pro: () => true, legend: r => r.wins >= 1 };
export const deckUnlocked = (r: HuntRecords, d: DeckId) => DECK_RULE[d](r);
export const difficultyUnlocked = (r: HuntRecords, d: Difficulty) => DIFF_RULE[d](r);
export const DECK_IDS = Object.keys(DECKS) as DeckId[];
export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as Difficulty[];

// ---------------------------------------------------------------- album

export function loadAlbum(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(ALBUM_KEY) ?? '[]') as string[]); } catch { return new Set(); }
}
export function addToAlbum(ids: string[]): void {
  if (!ids.length) return;
  const album = loadAlbum();
  const before = album.size;
  for (const id of ids) album.add(id);
  if (album.size === before) return;
  try { localStorage.setItem(ALBUM_KEY, JSON.stringify([...album])); } catch { /* storage blocked */ }
}

// ---------------------------------------------------------------- the Daily Legend

/** Today's date in UTC (the Daily Legend changes at midnight UTC, the same moment for everyone). */
export const todayUtc = (now = new Date()) => now.toISOString().slice(0, 10);
/** The day's seed: the same hunt for everyone on that date. */
export function dailySeed(date: string): number {
  let hsh = 2166136261;
  for (const ch of `league-hunt-daily|${date}`) { hsh ^= ch.charCodeAt(0); hsh = Math.imul(hsh, 16777619); }
  return (hsh >>> 0) % 1_000_000_000;
}
