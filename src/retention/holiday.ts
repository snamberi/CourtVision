import { localRead, type Read } from '../lib/kv';

/*
 * Holiday events: Halloween (Spooky Season, from 31 October) and Christmas (Winter Wonderland, from 25 December),
 * two weeks each, every year. Nothing about them shows before they start: no menu card, no shop, no cosmetics in
 * the pickers (unless you already own one). While one is on, every finished game pays an event coin and every win
 * pays two; the coins only buy that event's cosmetics, in its own shop, and only while it's on. A run of an event is
 * keyed by year ("halloween-2026"), so each year's coins are separate.
 */

export type HolidayId = 'halloween' | 'christmas';
export interface Holiday {
  id: HolidayId; name: string; coin: string; coins: string; blurb: string;
  /** Start day (UTC), every year. */
  month: number; day: number;
  /** Colours for the event's menu card and page. */
  colors: { bg: string; panel: string; accent: string; text: string; glow: string };
}
export const HOLIDAY_DAYS = 14;
export const HOLIDAYS: Holiday[] = [
  { id: 'halloween', name: 'Spooky Season', coin: 'Candy', coins: 'Candy', month: 9, day: 31,
    blurb: 'Pumpkins on the hardwood and ghosts in the rafters. Play anything to collect Candy, then spend it in the Spooky Shop.',
    colors: { bg: '#140a1f', panel: '#24123a', accent: '#ff7a1a', text: '#fbeee0', glow: '#8bdc3f' } },
  { id: 'christmas', name: 'Winter Wonderland', coin: 'Snowflake', coins: 'Snowflakes', month: 11, day: 25,
    blurb: 'Snow on the court and lights on the rim. Play anything to collect Snowflakes, then spend them in the Holiday Shop.',
    colors: { bg: '#071a14', panel: '#0f2e24', accent: '#e8323c', text: '#f4fbff', glow: '#9fd8ff' } },
];
export const HOLIDAY_BY_ID = new Map(HOLIDAYS.map(h => [h.id, h]));

export interface HolidayRun { holiday: Holiday; year: number; key: string; start: Date; end: Date }
export function holidayRun(id: HolidayId, year: number): HolidayRun {
  const holiday = HOLIDAY_BY_ID.get(id)!;
  const start = new Date(Date.UTC(year, holiday.month, holiday.day));
  return { holiday, year, key: `${id}-${year}`, start, end: new Date(start.getTime() + HOLIDAY_DAYS * 86_400_000) };
}
/** The event that's on right now, if any (Christmas runs into January, so last year's counts too). */
export function activeHoliday(now = new Date()): HolidayRun | null {
  const y = now.getUTCFullYear();
  for (const h of HOLIDAYS) for (const year of [y, y - 1]) {
    const run = holidayRun(h.id, year);
    if (now >= run.start && now < run.end) return run;
  }
  return null;
}
/** Whole days left in an event (1 on its last day). */
export const daysLeft = (run: HolidayRun, now = new Date()) => Math.max(1, Math.ceil((run.end.getTime() - now.getTime()) / 86_400_000));

/* ---- Event cosmetics: shop keys "evt-<holiday>-<piece>", bought with event coins (holidayShop.ts). ---- */

export const EVENT_PREFIX = 'evt-';
export const holidayOfKey = (key: string): HolidayId | null => (key.startsWith('evt-halloween-') ? 'halloween' : key.startsWith('evt-christmas-') ? 'christmas' : null);
/** An event piece stays out of every picker unless you own it or its event is on. */
export function eventPieceHidden(key: string | null | undefined, owned: readonly string[], now = new Date()): boolean {
  if (!key) return false;
  const id = holidayOfKey(key);
  if (!id || owned.includes(key)) return false;
  return activeHoliday(now)?.holiday.id !== id;
}

/* ---- Event coins ---- */

export interface HolidayState { v: 1; earned: Record<string, number>; spent: Record<string, number>; counted: string[] }
export const HOLIDAY_KEY = 'cv-holiday';
export const HOLIDAY_EVENT = 'cv-holiday-changed';
const empty = (): HolidayState => ({ v: 1, earned: {}, spent: {}, counted: [] });
const nums = (x: unknown): Record<string, number> => Object.fromEntries(Object.entries(x && typeof x === 'object' ? x as Record<string, unknown> : {}).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) >= 0).map(([k, v]) => [k, Math.floor(Number(v))]));
export function loadHoliday(read: Read = localRead): HolidayState {
  try {
    const x = JSON.parse(read(HOLIDAY_KEY) ?? 'null') as Partial<HolidayState> | null;
    if (!x || typeof x !== 'object') return empty();
    return { v: 1, earned: nums(x.earned), spent: nums(x.spent), counted: Array.isArray(x.counted) ? x.counted.filter(k => typeof k === 'string').slice(-500) : [] };
  } catch { return empty(); }
}
export function saveHoliday(s: HolidayState): void {
  try { localStorage.setItem(HOLIDAY_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new Event(HOLIDAY_EVENT)); } catch { /* no window (tests) */ }
}
/** Coins left to spend in a run of an event. */
export const eventCoins = (s: HolidayState, runKey: string) => Math.max(0, (s.earned[runKey] ?? 0) - (s.spent[runKey] ?? 0));
export const FINISH_COINS = 1, WIN_COINS = 2;

/** A finished game during an event: 1 coin, or 2 for a win (each game once, by `id` when it has one). Pure. */
export function earnFinish(s: HolidayState, won: boolean, id: string | undefined, now = new Date()): HolidayState {
  const run = activeHoliday(now);
  if (!run) return s;
  const tag = id ? `${run.key}:${id}` : null;
  if (tag && s.counted.includes(tag)) return s;
  const add = won ? WIN_COINS : FINISH_COINS;
  return { ...s, earned: { ...s.earned, [run.key]: (s.earned[run.key] ?? 0) + add }, counted: tag ? [...s.counted, tag].slice(-500) : s.counted };
}
/** Saves the coins for a finished game. Returns the coins paid (0 with no event on, or a game already counted). */
export function noteHolidayFinish(won: boolean, id?: string, now = new Date()): number {
  const before = loadHoliday(), after = earnFinish(before, won, id, now);
  if (after === before) return 0;
  saveHoliday(after);
  const key = activeHoliday(now)!.key;
  return (after.earned[key] ?? 0) - (before.earned[key] ?? 0);
}
/** Spends event coins (pure); null when the event isn't on or there aren't enough. */
export function spendEventCoins(s: HolidayState, price: number, now = new Date()): HolidayState | null {
  const run = activeHoliday(now);
  if (!run || eventCoins(s, run.key) < price) return null;
  return { ...s, spent: { ...s.spent, [run.key]: (s.spent[run.key] ?? 0) + price } };
}
/** Two copies (this device and the cloud): the most earned and the most spent per event, and every game counted. */
export function mergeHoliday(a: HolidayState, b: HolidayState): HolidayState {
  const max = (x: Record<string, number>, y: Record<string, number>) => Object.fromEntries([...new Set([...Object.keys(x), ...Object.keys(y)])].map(k => [k, Math.max(x[k] ?? 0, y[k] ?? 0)]));
  return { v: 1, earned: max(a.earned, b.earned), spent: max(a.spent, b.spent), counted: [...new Set([...b.counted, ...a.counted])].slice(-500) };
}
