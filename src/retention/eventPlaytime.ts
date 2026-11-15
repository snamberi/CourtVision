import { activeHolidays, loadHoliday, saveHoliday } from './holiday';
export interface EventClock { elapsed: number; tenWeight: number; hourWeight: number; fraction: number }
export const emptyClock = (): EventClock => ({ elapsed: 0, tenWeight: 0, hourWeight: 0, fraction: 0 });
/** Prorate mode bonuses across each milestone, so switching just before payout cannot multiply an hour. */
export function advanceEventClock(clock: EventClock, milliseconds: number, boosted: boolean) {
  const next = { ...clock }; let left = Math.max(0, Math.min(15000, milliseconds)); let earned = 0;
  while (left > 0) {
    const step = Math.min(left, 600000 - next.elapsed % 600000);
    next.elapsed += step; left -= step;
    next.tenWeight += step * (boosted ? 1.5 : 1); next.hourWeight += step * (boosted ? 1.5 : 1);
    if (next.elapsed % 600000 === 0) { next.fraction += next.tenWeight / 600000; next.tenWeight = 0; }
    if (next.elapsed % 3600000 === 0) { next.fraction += 20 * next.hourWeight / 3600000; next.hourWeight = 0; }
  }
  earned = Math.floor(next.fraction + 1e-9); next.fraction = Math.max(0, next.fraction - earned);
  return { clock: next, earned };
}
export function tickEventPlaytime(milliseconds: number, boosted: boolean, now = new Date()) {
  const state = loadHoliday(); let changed = false;
  const clocks = { ...state.playClocks }, earned = { ...state.earned };
  for (const run of activeHolidays(now)) {
    const result = advanceEventClock(clocks[run.key] ?? emptyClock(), milliseconds, boosted);
    clocks[run.key] = result.clock; earned[run.key] = (earned[run.key] ?? 0) + result.earned; changed = true;
  }
  if (changed) saveHoliday({ ...state, earned, playClocks: clocks });
}
