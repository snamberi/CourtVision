/*
 * Rank changes on the online boards, kept in this browser: one snapshot of each board's ranks a day, two weeks back.
 * A row's arrow compares today's rank with the newest snapshot at least a week old (or the oldest one there is), so
 * "since last week" means what it says once you have been visiting for a week, and "since you last looked" before that.
 */

/** Your own rank, stored under this id so it is tracked even when you are below the rows the board sends. */
export const YOU = '__you';
const DAY = 86_400_000;
const KEEP_DAYS = 14;

export interface RankSnapshot { day: number; ranks: Record<string, number> }

const dayOf = (now: number) => Math.floor(now / DAY);

/** Adds (or replaces) today's snapshot and drops ones older than two weeks. */
export function recordRanks(history: RankSnapshot[], ranks: Record<string, number>, now: number): RankSnapshot[] {
  const today = dayOf(now);
  return [...history.filter(s => s.day !== today && today - s.day <= KEEP_DAYS), { day: today, ranks }].sort((a, b) => a.day - b.day);
}

/** The snapshot to compare against: the newest one at least 7 days old, else the oldest from before today. */
export function baseline(history: RankSnapshot[], now: number): RankSnapshot | null {
  const today = dayOf(now);
  const older = history.filter(s => s.day < today);
  if (!older.length) return null;
  return [...older].reverse().find(s => today - s.day >= 7) ?? older[0];
}

/** Places gained (positive) or lost (negative) since the baseline; 'new' if not on it then; null with nothing to compare. */
export function rankChange(base: RankSnapshot | null, id: string, rank: number): number | 'new' | null {
  if (!base) return null;
  const then = base.ranks[id];
  return then == null ? 'new' : then - rank;
}

const storeKey = (board: string) => `cv-rank-history:${board}`;
export function loadRankHistory(board: string): RankSnapshot[] {
  try { const v = JSON.parse(localStorage.getItem(storeKey(board)) ?? '[]'); return Array.isArray(v) ? v as RankSnapshot[] : []; } catch { return []; }
}
export function saveRankHistory(board: string, history: RankSnapshot[]): void {
  try { localStorage.setItem(storeKey(board), JSON.stringify(history)); } catch { /* storage blocked */ }
}
