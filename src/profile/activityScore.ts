import { localRead, type Read } from '../lib/kv';
/** Additional points only for completed runs after Update 50. Existing XP is never rescaled. */
export const ACTIVITY_SCORE_KEY = 'cv-activity-score';
export type ActivityScore = Record<string, string[]>;
export function readActivityScore(read: Read = localRead): ActivityScore {
  try { const raw = JSON.parse(read(ACTIVITY_SCORE_KEY) ?? '{}'); return cleanActivityScore(raw); } catch { return {}; }
}
export function cleanActivityScore(raw: unknown): ActivityScore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([day,ids]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(ids)).map(([day,ids]) => [day,[...new Set((ids as unknown[]).filter((id): id is string => typeof id==='string' && id.length<=160))].sort().slice(0,5)]));
}
export function mergeActivityScore(a: ActivityScore,b: ActivityScore): ActivityScore { return cleanActivityScore(Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(day=>[day,[...(a[day]??[]),...(b[day]??[])]]))); }
export const activityScore = (s: ActivityScore) => Object.values(s).reduce((n,ids)=>n+ids.length*20,0);
export function noteActivityScore(key: string, now = new Date()): void {
  const s=readActivityScore(), day=now.toISOString().slice(0,10);
  if (Object.values(s).some(ids=>ids.includes(key)) || (s[day]?.length ?? 0)>=5) return;
  try { localStorage.setItem(ACTIVITY_SCORE_KEY,JSON.stringify({...s,[day]:[...(s[day]??[]),key]})); window.dispatchEvent(new Event('courtvision:progress')); } catch { /* private storage */ }
}
