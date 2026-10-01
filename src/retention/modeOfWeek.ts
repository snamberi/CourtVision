import { localRead, type Read } from '../lib/kv';
import { weekKey, weekEndsAt } from './week';

/*
 * Mode of the Week: one mode each week earns double XP. Profile XP is read from each mode's records, so the doubling
 * is kept as a bonus log: every run finished in the featured mode that week adds its XP again (once per run, capped
 * per week). The log follows the account like the records do.
 */

export type FeaturedMode = 'perfect' | 'legends' | 'career' | 'rebuild';
export const FEATURED_ROTATION: FeaturedMode[] = ['perfect', 'legends', 'career', 'rebuild'];
export const FEATURED_NAME: Record<FeaturedMode, string> = { perfect: '82-0 Challenge', legends: 'League Hunt', career: 'Career Mode', rebuild: 'Rebuild Challenge' };
export const BONUS_XP_KEY = 'cv-bonus-xp';
/** The most bonus XP one week can give. */
export const WEEKLY_BONUS_CAP = 3000;

export interface BonusEntry { xp: number; week: string; mode: FeaturedMode }
export type BonusLog = Record<string, BonusEntry>;

/** This week's featured mode (the same for everyone; the rotation steps once a week). */
export function modeOfWeek(week = weekKey()): FeaturedMode {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  const n = m ? Number(m[1]) * 53 + Number(m[2]) : 0;
  return FEATURED_ROTATION[n % FEATURED_ROTATION.length];
}
export const modeOfWeekEnds = (now = new Date()) => weekEndsAt(now);

export function readBonusLog(read: Read = localRead): BonusLog {
  try { const v = JSON.parse(read(BONUS_XP_KEY) ?? '{}') as BonusLog; return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

/** Bonus XP earned, after the weekly cap. */
export function bonusXp(log: BonusLog): { xp: number; runs: number } {
  const byWeek = new Map<string, number>();
  let runs = 0;
  for (const e of Object.values(log)) {
    if (!e || typeof e.xp !== 'number' || e.xp <= 0 || typeof e.week !== 'string') continue;
    byWeek.set(e.week, (byWeek.get(e.week) ?? 0) + Math.round(e.xp));
    runs++;
  }
  return { xp: [...byWeek.values()].reduce((n, v) => n + Math.min(WEEKLY_BONUS_CAP, v), 0), runs };
}

/** A finished run in `mode` earned `xp`: logs the same again when `mode` is this week's featured mode. Returns the bonus. */
export function noteFeaturedXp(mode: FeaturedMode, key: string, xp: number, now = new Date()): number {
  const week = weekKey(now);
  if (modeOfWeek(week) !== mode || xp <= 0) return 0;
  const log = readBonusLog();
  if (log[key]) return 0;
  try { localStorage.setItem(BONUS_XP_KEY, JSON.stringify({ ...log, [key]: { xp: Math.round(xp), week, mode } })); } catch { return 0; }
  return Math.round(xp);
}

export const mergeBonusLog = (a: BonusLog, b: BonusLog): BonusLog => ({ ...b, ...a });
