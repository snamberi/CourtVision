import type { EventClock } from './eventPlaytime';
import { localRead, type Read } from '../lib/kv';

/** Annual UTC event windows. Overlapping events each award their own currency.
 * Unspent currency carries into later years of the same event; unlocks remain owned. */

export type HolidayId = 'halloween' | 'christmas' | 'newyear' | 'valentine' | 'allstar' | 'easter' | 'playoffs' | 'summer' | 'anniversary';
export interface Holiday {
  id: HolidayId; name: string; coin: string; coins: string; blurb: string;
  /** Start day (UTC), every year. */
  month: number; day: number; endMonth: number; endDay: number; keyName: string;
  /** Colours for the event's menu card and page. */
  colors: { bg: string; panel: string; accent: string; text: string; glow: string };
}
export const HOLIDAYS: Holiday[] = [
  { id: 'halloween', name: 'Spooky Season', coin: 'Candy', coins: 'Candy', month: 9, day: 1, endMonth: 10, endDay: 1, keyName: 'Haunted Key',
    blurb: 'Pumpkins on the hardwood and ghosts in the rafters. Play anything to collect Candy, then spend it in the Spooky Shop.',
    colors: { bg: '#140a1f', panel: '#24123a', accent: '#ff7a1a', text: '#fbeee0', glow: '#8bdc3f' } },
  { id: 'christmas', name: 'Winter Wonderland', coin: 'Snowflake', coins: 'Snowflakes', month: 11, day: 1, endMonth: 12, endDay: 1, keyName: 'Frost Key',
    blurb: 'Snow on the court and lights on the rim. Play anything to collect Snowflakes, then spend them in the Holiday Shop.',
    colors: { bg: '#071a14', panel: '#0f2e24', accent: '#e8323c', text: '#f4fbff', glow: '#9fd8ff' } },
  { id: 'newyear', name: 'New Year', coin: 'Spark', coins: 'Sparks', month: 11, day: 26, endMonth: 12, endDay: 8, keyName: 'Midnight Key', blurb: 'Fireworks and a fresh start.', colors: { bg: '#0b1018', panel: '#182437', accent: '#ffd166', text: '#f4f0e6', glow: '#ffd166' } },
  { id: 'valentine', name: 'Valentine’s', coin: 'Heart', coins: 'Hearts', month: 1, day: 1, endMonth: 2, endDay: 1, keyName: 'Heart Key', blurb: 'Celebrate your teammates.', colors: { bg: '#0b1018', panel: '#182437', accent: '#ff77aa', text: '#f4f0e6', glow: '#ff77aa' } },
  { id: 'allstar', name: 'All-Star Weekend', coin: 'Star', coins: 'Stars', month: 1, day: 14, endMonth: 1, endDay: 22, keyName: 'All-Star Key', blurb: 'An exhibition of basketball greatness.', colors: { bg: '#0b1018', panel: '#182437', accent: '#b48aff', text: '#f4f0e6', glow: '#b48aff' } },
  { id: 'easter', name: 'Easter', coin: 'Egg', coins: 'Eggs', month: 2, day: 1, endMonth: 4, endDay: 1, keyName: 'Egg Key', blurb: 'Collect spring treasures on the court.', colors: { bg: '#0b1018', panel: '#182437', accent: '#b7ef83', text: '#f4f0e6', glow: '#b7ef83' } },
  { id: 'playoffs', name: 'Playoff Fever', coin: 'Banner', coins: 'Banners', month: 3, day: 1, endMonth: 6, endDay: 1, keyName: 'Finals Key', blurb: 'Every win brings you closer to the rafters.', colors: { bg: '#0b1018', panel: '#182437', accent: '#ffd166', text: '#f4f0e6', glow: '#ffd166' } },
  { id: 'summer', name: 'Summer Heat', coin: 'Sun Token', coins: 'Sun Tokens', month: 5, day: 1, endMonth: 8, endDay: 1, keyName: 'Sun Key', blurb: 'Summer courts and bright rewards.', colors: { bg: '#0b1018', panel: '#182437', accent: '#ffb85c', text: '#f4f0e6', glow: '#ffb85c' } },
  { id: 'anniversary', name: 'CourtVision Anniversary', coin: 'Founder Token', coins: 'Founder Tokens', month: 8, day: 27, endMonth: 9, endDay: 1, keyName: 'Founder Key', blurb: 'Celebrate CourtVision every September 27.', colors: { bg: '#0b1018', panel: '#182437', accent: '#b9a0ff', text: '#f4f0e6', glow: '#b9a0ff' } },
];
export const HOLIDAY_BY_ID = new Map(HOLIDAYS.map(h => [h.id, h]));

export interface HolidayRun { holiday: Holiday; year: number; key: string; start: Date; end: Date }
export function holidayRun(id: HolidayId, year: number): HolidayRun {
  const holiday = HOLIDAY_BY_ID.get(id)!;
  const start = new Date(Date.UTC(year, holiday.month, holiday.day));
  return { holiday, year, key: `${id}-${year}`, start, end: new Date(Date.UTC(year, holiday.endMonth, holiday.endDay)) };
}
/** The event that's on right now, if any (Christmas runs into January, so last year's counts too). */
export function activeHolidays(now = new Date()): HolidayRun[] {
  const y = now.getUTCFullYear();
  return HOLIDAYS.flatMap(h => [y, y - 1].map(year => holidayRun(h.id, year))).filter(run => now >= run.start && now < run.end);
}
export function activeHoliday(now = new Date()): HolidayRun | null { return activeHolidays(now)[0] ?? null; }
export const activeRun = (id: HolidayId, now = new Date()) => activeHolidays(now).find(r => r.holiday.id === id) ?? null;
/** Whole days left in an event (1 on its last day). */
export const daysLeft = (run: HolidayRun, now = new Date()) => Math.max(1, Math.ceil((run.end.getTime() - now.getTime()) / 86_400_000));

/* ---- Event cosmetics: shop keys "evt-<holiday>-<piece>", bought with event coins (holidayShop.ts). ---- */

export const EVENT_PREFIX = 'evt-';
export const holidayOfKey = (key: string): HolidayId | null => HOLIDAYS.find(h => key.startsWith(`evt-${h.id}-`))?.id ?? null;
/** An event piece stays out of every picker unless you own it or its event is on. */
export function eventPieceHidden(key: string | null | undefined, owned: readonly string[], now = new Date()): boolean {
  if (!key) return false;
  const id = holidayOfKey(key);
  if (!id || owned.includes(key)) return false;
  return !activeRun(id, now);
}

/* ---- Event coins ---- */

export interface HolidayState { v: 1; playClocks?: Record<string, EventClock>; bonusHalves?: Record<string, number>; earned: Record<string, number>; spent: Record<string, number>; counted: string[] }
export const HOLIDAY_KEY = 'cv-holiday';
export const HOLIDAY_EVENT = 'cv-holiday-changed';
const empty = (): HolidayState => ({ v: 1, earned: {}, spent: {}, counted: [] });
const nums = (x: unknown): Record<string, number> => Object.fromEntries(Object.entries(x && typeof x === 'object' ? x as Record<string, unknown> : {}).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) >= 0).map(([k, v]) => [k, Math.floor(Number(v))]));
export function loadHoliday(read: Read = localRead): HolidayState {
  try {
    const x = JSON.parse(read(HOLIDAY_KEY) ?? 'null') as Partial<HolidayState> | null;
    if (!x || typeof x !== 'object') return empty();
    const playClocks = Object.fromEntries(Object.entries(x.playClocks ?? {}).filter(([, c]) => c && [c.elapsed,c.tenWeight,c.hourWeight,c.fraction].every(n => Number.isFinite(n) && n >= 0)));
    return { v: 1, playClocks, bonusHalves: nums(x.bonusHalves), earned: nums(x.earned), spent: nums(x.spent), counted: Array.isArray(x.counted) ? x.counted.filter(k => typeof k === 'string').slice(-500) : [] };
  } catch { return empty(); }
}
export function saveHoliday(s: HolidayState): void {
  try { localStorage.setItem(HOLIDAY_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new Event(HOLIDAY_EVENT)); } catch { /* no window (tests) */ }
}
/** Retain annual monotonic counters for cloud merges; pool balances without copying old money.
 * Subtract across all years before clamping: current-year spending can consume older earnings. */
export function annualEventBalance(earned: Record<string, number>, spent: Record<string, number>, runKey: string): number {
  const match = /^(.*)-(\d{4})$/.exec(runKey);
  if (!match || !HOLIDAY_BY_ID.has(match[1] as HolidayId)) return 0;
  const year = Number(match[2]), prefix = `${match[1]}-`;
  const valid = (key: string) => key.startsWith(prefix) && /^\d{4}$/.test(key.slice(prefix.length)) && Number(key.slice(prefix.length)) <= year;
  const count = (n: number | undefined) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const keys = new Set([...Object.keys(earned), ...Object.keys(spent)]);
  return Math.max(0, [...keys].filter(valid).reduce((total, key) => total + count(earned[key]) - count(spent[key]), 0));
}
/** Coins available through this year's occurrence of the matching event. */
export const eventCoins = (s: HolidayState, runKey: string) => annualEventBalance(s.earned, s.spent, runKey);
export const FINISH_COINS = 1, WIN_COINS = 2;

/** A finished game during an event: 1 coin, or 2 for a win (each game once, by `id` when it has one). Pure. */
export function earnFinish(s: HolidayState, won: boolean, id: string | undefined, now = new Date(), boosted = false): HolidayState {
  let next = s;
  for (const run of activeHolidays(now)) {
    const tag = id ? `${run.key}:${id}` : null;
    if (tag && next.counted.includes(tag)) continue;
    const base = won ? WIN_COINS : FINISH_COINS;
    const halves = (next.bonusHalves?.[run.key] ?? 0) + (boosted ? base : 0);
    const add = base + Math.floor(halves / 2);
    next = { ...next, bonusHalves: { ...next.bonusHalves, [run.key]: halves % 2 }, earned: { ...next.earned, [run.key]: (next.earned[run.key] ?? 0) + add }, counted: tag ? [...next.counted, tag].slice(-500) : next.counted };
  }
  return next;
}
/** Saves the coins for a finished game. Returns the coins paid (0 with no event on, or a game already counted). */
export function noteHolidayFinish(won: boolean, id?: string, now = new Date(), boosted = false): number {
  const before = loadHoliday(), after = earnFinish(before, won, id, now, boosted);
  if (after === before) return 0;
  saveHoliday(after);
  return activeHolidays(now).reduce((n, { key }) => n + (after.earned[key] ?? 0) - (before.earned[key] ?? 0), 0);
}
/** Spends event coins (pure); null when the event isn't on or there aren't enough. */
export function spendEventCoins(s: HolidayState, price: number, now = new Date(), event?: HolidayId): HolidayState | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const run = event ? activeRun(event, now) : activeHoliday(now);
  if (!run || eventCoins(s, run.key) < price) return null;
  return { ...s, spent: { ...s.spent, [run.key]: (s.spent[run.key] ?? 0) + price } };
}
/** Two copies (this device and the cloud): the most earned and the most spent per event, and every game counted. */
export function mergeHoliday(a: HolidayState, b: HolidayState): HolidayState {
  const max = (x: Record<string, number>, y: Record<string, number>) => Object.fromEntries([...new Set([...Object.keys(x), ...Object.keys(y)])].map(k => [k, Math.max(x[k] ?? 0, y[k] ?? 0)]));
  const playClocks = { ...a.playClocks };
  for (const [key, clock] of Object.entries(b.playClocks ?? {})) if (clock.elapsed > (playClocks[key]?.elapsed ?? -1)) playClocks[key] = clock;
  return { v: 1, playClocks, bonusHalves: max(a.bonusHalves ?? {}, b.bonusHalves ?? {}), earned: max(a.earned, b.earned), spent: max(a.spent, b.spent), counted: [...new Set([...b.counted, ...a.counted])].slice(-500) };
}
