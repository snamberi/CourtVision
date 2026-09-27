import type { HuntRun } from './run';

/* League Hunt keeps its run in this browser (it is small: card ids and progress). Storage can be blocked in a
 * private window; the run then lasts as long as the page is open. */

const RUN_KEY = 'cv-hunt-run';
const RECORDS_KEY = 'cv-hunt-records';

export interface HuntRecords { runs: number; wins: number; bestStop: number; bestWin?: string; lastSeed?: number }
const EMPTY: HuntRecords = { runs: 0, wins: 0, bestStop: 0 };

export function loadRun(): HuntRun | null {
  try { const r = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null') as HuntRun | null; return r?.version === 1 ? r : null; } catch { return null; }
}
export function saveRun(run: HuntRun): void { try { localStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch { /* storage blocked */ } }
export function clearRun(): void { try { localStorage.removeItem(RUN_KEY); } catch { /* storage blocked */ } }

export function loadRecords(): HuntRecords {
  try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '{}') as Partial<HuntRecords>) }; } catch { return { ...EMPTY }; }
}

/** Counts a finished run once (by its seed). */
export function recordRun(run: HuntRun): HuntRecords {
  const r = loadRecords();
  if (r.lastSeed === run.seed) return r;
  const next: HuntRecords = { runs: r.runs + 1, wins: r.wins + (run.stage === 'won' ? 1 : 0), bestStop: Math.max(r.bestStop, run.stage === 'won' ? run.stops.length - 1 : run.stopIndex), bestWin: r.bestWin, lastSeed: run.seed };
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return next;
}
