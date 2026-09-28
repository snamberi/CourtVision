import type { CodeResult } from '../cloud/merge';

/* League codes: how your first season went in each coded league (for the code's board, with friends). */
const KEY = 'cv-code-results';
export function recordCodeResult(code: string, r: Omit<CodeResult, 'at'>): boolean {
  let all: Record<string, CodeResult> = {};
  try { all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, CodeResult>; } catch { /* none */ }
  if (all[code]) return false; // the first season counts
  try { localStorage.setItem(KEY, JSON.stringify({ ...all, [code]: { ...r, at: Date.now() } })); window.dispatchEvent(new Event('courtvision:progress')); } catch { /* storage blocked */ }
  return true;
}
