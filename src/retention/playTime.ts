import { localRead, type Read } from '../lib/kv';

/*
 * Time played: seconds spent in each part of the game while the tab is open and visible (an idle tab in the
 * background never counts). Shown on the profile ("14h 20m played · most in Career"). Synced with the account.
 */

export const PLAY_TIME_KEY = 'cv-play-time';
export type PlayArea = 'gm' | 'career' | 'hunt' | 'perfect' | 'draft' | 'rebuild' | 'menu' | 'other';
export const AREA_LABEL: Record<PlayArea, string> = { gm: 'GM Mode', career: 'Career', hunt: 'League Hunt', perfect: '82-0 Challenge', draft: 'All-Time Draft', rebuild: 'Rebuild', menu: 'Menus and profile', other: 'Everything else' };
export interface PlayTime { total: number; areas: Partial<Record<PlayArea, number>> }

export function readPlayTime(read: Read = localRead): PlayTime {
  try {
    const r = JSON.parse(read(PLAY_TIME_KEY) ?? 'null') as PlayTime | null;
    return r && Number.isFinite(r.total) ? { total: Math.max(0, r.total), areas: r.areas && typeof r.areas === 'object' ? r.areas : {} } : { total: 0, areas: {} };
  } catch { return { total: 0, areas: {} }; }
}

/** Adds seconds to an area (called every few seconds by the play clock). */
export function addPlayTime(area: PlayArea, seconds: number): PlayTime {
  const t = readPlayTime();
  const next = { total: t.total + seconds, areas: { ...t.areas, [area]: (t.areas[area] ?? 0) + seconds } };
  try { localStorage.setItem(PLAY_TIME_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return next;
}

/** Two devices can't add up safely (each holds what it has seen), so each area keeps the larger count. */
export function mergePlayTime(a: PlayTime, b: PlayTime): PlayTime {
  const areas: PlayTime['areas'] = {};
  for (const k of new Set([...Object.keys(a.areas), ...Object.keys(b.areas)]) as Set<PlayArea>) areas[k] = Math.max(a.areas[k] ?? 0, b.areas[k] ?? 0);
  const sum = Object.values(areas).reduce((n, v) => n + (v ?? 0), 0);
  return { total: Math.max(a.total, b.total, sum), areas };
}

/** "14h 20m", "35m", "under a minute". */
export function formatPlayTime(seconds: number): string {
  const m = Math.floor(seconds / 60), h = Math.floor(m / 60);
  if (h) return `${h}h ${m % 60}m`;
  return m ? `${m}m` : 'under a minute';
}
export const topArea = (t: PlayTime): PlayArea | null => (Object.entries(t.areas) as [PlayArea, number][]).filter(([k]) => k !== 'menu' && k !== 'other').sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
