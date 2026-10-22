import { localRead, type Read } from '../lib/kv';

/*
 * Recent activity: the last few things you finished (a hunt, an 82-0 run, a career, a GM title, an achievement), newest
 * first. Shown on your public profile. Kept on this device and synced; two devices keep both lists.
 */

export const ACTIVITY_KEY = 'cv-activity';
export const ACTIVITY_KEEP = 20;
export interface Activity { id: string; at: number; kind: string; line: string }

const valid = (a: Partial<Activity> | null | undefined): a is Activity =>
  !!a && typeof a.id === 'string' && typeof a.kind === 'string' && typeof a.line === 'string' && Number.isFinite(a.at);

export function readActivity(read: Read = localRead): Activity[] {
  try { const v = JSON.parse(read(ACTIVITY_KEY) ?? '[]') as unknown; return Array.isArray(v) ? v.filter(valid) : []; } catch { return []; }
}

/** Every entry from both lists (one per id), newest first. */
export function mergeActivity(a: Activity[], b: Activity[]): Activity[] {
  const byId = new Map<string, Activity>();
  for (const x of [...b, ...a]) if (!byId.has(x.id) || byId.get(x.id)!.at < x.at) byId.set(x.id, x);
  return [...byId.values()].sort((x, y) => y.at - x.at).slice(0, ACTIVITY_KEEP);
}

/** Notes a finished run or a milestone (once per id). */
export function noteActivity(kind: string, line: string, id: string, at = Date.now()): void {
  const list = readActivity();
  if (list.some(x => x.id === id)) return;
  try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(mergeActivity([{ id, at, kind, line: line.slice(0, 120) }], list))); } catch { /* storage blocked */ }
}
