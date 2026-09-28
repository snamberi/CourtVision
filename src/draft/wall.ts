/** A steal went at least this many picks after his spot on the board (the pool ranked by draft value). */
export const STEAL_GAP = 15;
/** A reach went at least this many picks before it. */
export const REACH_GAP = 25;

/** Whether a pick was a steal, a reach, or neither: the overall pick against the player's rank on the board. */
export function pickVerdict(overall: number, boardRank: number): 'steal' | 'reach' | null {
  if (overall - boardRank >= STEAL_GAP) return 'steal';
  if (boardRank - overall >= REACH_GAP) return 'reach';
  return null;
}

export const PICK_CLOCK_KEY = 'cv-draft-clock';
export const PICK_CLOCK_SECONDS = 60;
export function readPickClock(): boolean { try { return localStorage.getItem(PICK_CLOCK_KEY) === 'on'; } catch { return false; } }
export function writePickClock(on: boolean): void { try { if (on) localStorage.setItem(PICK_CLOCK_KEY, 'on'); else localStorage.removeItem(PICK_CLOCK_KEY); } catch { /* storage blocked */ } }
