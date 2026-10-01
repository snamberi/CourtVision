import type { CodeResult } from '../cloud/merge';
import { FINISH_POINTS } from '../simulation/rebuildScenarios';

/* League codes: how your first season went in each coded league (for the code's board, with friends). */
const KEY = 'cv-code-results';
export function recordCodeResult(code: string, r: Omit<CodeResult, 'at'>): boolean {
  let all: Record<string, CodeResult> = {};
  try { all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, CodeResult>; } catch { /* none */ }
  if (all[code]) return false; // the first season counts
  try { localStorage.setItem(KEY, JSON.stringify({ ...all, [code]: { ...r, at: Date.now() } })); window.dispatchEvent(new Event('courtvision:progress')); } catch { /* storage blocked */ }
  return true;
}

/** A code's board score (the server posts the same): two a win, plus how far the playoffs went. */
export const codeScore = (r: Pick<CodeResult, 'wins' | 'finish'>) => r.wins * 2 + (FINISH_POINTS[r.finish as keyof typeof FINISH_POINTS] ?? 0);
/** Your first season in a coded league, if you have played it. */
export function readCodeResult(code: string): CodeResult | null {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, CodeResult>)[code] ?? null; } catch { return null; }
}
