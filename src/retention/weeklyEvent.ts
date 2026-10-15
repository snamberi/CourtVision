/*
 * The Weekly Event: one special rule for the whole week (Monday to Sunday, UTC), the same for everyone, changing every
 * Monday. Each event changes something real: run coins, run spins, the pass streak bonus, friend gifts or the chance
 * of a secret cosmetic. No imports from the vault, so the vault and the menu can both read it.
 */
export type WeeklyEventId = 'coinRush' | 'spinStorm' | 'passBoost' | 'giftWeek' | 'secretWeek' | 'doubleRelics';
export interface WeeklyEvent { id: WeeklyEventId; name: string; blurb: string }
export const WEEKLY_EVENTS: WeeklyEvent[] = [
  { id: 'coinRush', name: 'Coin Rush', blurb: 'Every finished run pays double coins.' },
  { id: 'spinStorm', name: 'Spin Storm', blurb: 'Every finished run that pays spins pays one extra Relic Spin.' },
  { id: 'passBoost', name: 'Pass Boost', blurb: 'Your daily streak bonus fills the Season Pass twice as fast.' },
  { id: 'giftWeek', name: 'Gift Week', blurb: 'Gifts you collect from friends pay double coins.' },
  { id: 'secretWeek', name: 'Secret Week', blurb: 'Secret cosmetics drop from spins three times as often.' },
  { id: 'doubleRelics', name: 'Double Relics', blurb: 'Every spin opens two relics, and counts as two spins toward the guaranteed rarities.' },
];
/** The first five events took turns until Double Relics joined: from week ROTATION_6_FROM all six take turns, it first. */
const FIRST_FIVE = WEEKLY_EVENTS.slice(0, 5);
const ROTATION_6 = [WEEKLY_EVENTS[5], ...FIRST_FIVE];
const ROTATION_6_FROM = 41; // Monday 2026-10-19
const WEEK_MS = 7 * 86_400_000;
/** Monday 2026-01-05 00:00 UTC: week 0 of the rotation. */
const ANCHOR = Date.UTC(2026, 0, 5);

export function weeklyEvent(now = new Date()): WeeklyEvent {
  const n = Math.floor((now.getTime() - ANCHOR) / WEEK_MS);
  if (n < ROTATION_6_FROM) return FIRST_FIVE[((n % 5) + 5) % 5];
  return ROTATION_6[(n - ROTATION_6_FROM) % ROTATION_6.length];
}
export const isEvent = (id: WeeklyEventId, now = new Date()) => weeklyEvent(now).id === id;
