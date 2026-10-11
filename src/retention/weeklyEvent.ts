/*
 * The Weekly Event: one special rule for the whole week (Monday to Sunday, UTC), the same for everyone, changing every
 * Monday. Each event changes something real: run coins, run spins, the pass streak bonus, friend gifts or the chance
 * of a secret cosmetic. No imports from the vault, so the vault and the menu can both read it.
 */
export type WeeklyEventId = 'coinRush' | 'spinStorm' | 'passBoost' | 'giftWeek' | 'secretWeek';
export interface WeeklyEvent { id: WeeklyEventId; name: string; blurb: string }
export const WEEKLY_EVENTS: WeeklyEvent[] = [
  { id: 'coinRush', name: 'Coin Rush', blurb: 'Every finished run pays double coins.' },
  { id: 'spinStorm', name: 'Spin Storm', blurb: 'Every finished run that pays spins pays one extra Relic Spin.' },
  { id: 'passBoost', name: 'Pass Boost', blurb: 'Your daily streak bonus fills the Season Pass twice as fast.' },
  { id: 'giftWeek', name: 'Gift Week', blurb: 'Gifts you collect from friends pay double coins.' },
  { id: 'secretWeek', name: 'Secret Week', blurb: 'Secret cosmetics drop from spins three times as often.' },
];
const WEEK_MS = 7 * 86_400_000;
/** Monday 2026-01-05 00:00 UTC: week 0 of the rotation. */
const ANCHOR = Date.UTC(2026, 0, 5);

export function weeklyEvent(now = new Date()): WeeklyEvent {
  const n = Math.floor((now.getTime() - ANCHOR) / WEEK_MS);
  return WEEKLY_EVENTS[((n % WEEKLY_EVENTS.length) + WEEKLY_EVENTS.length) % WEEKLY_EVENTS.length];
}
export const isEvent = (id: WeeklyEventId, now = new Date()) => weeklyEvent(now).id === id;
