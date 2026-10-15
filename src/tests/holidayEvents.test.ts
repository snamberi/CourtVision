// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { activeHoliday, holidayRun, eventPieceHidden, earnFinish, eventCoins, spendEventCoins, mergeHoliday, loadHoliday, noteHolidayFinish, HOLIDAY_KEY, type HolidayState } from '../retention/holiday';
import { EVENT_PIECES, piecesFor } from '../retention/holidayShop';
import { buyEventPiece } from '../retention/holidayBuy';
import { loadRelics, RELICS_KEY } from '../relics/relics';
import { isOpen, unlockContext } from '../profile/cosmetics';
import { themeOpen, visibleThemes } from '../theme/themes';
import { mergeValue, SYNC_KEYS } from '../cloud/merge';

const empty = (): HolidayState => ({ v: 1, earned: {}, spent: {}, counted: [] });
const HALLOWEEN = new Date('2026-11-02T12:00:00Z'), CHRISTMAS_JAN = new Date('2027-01-03T12:00:00Z'), OFF = new Date('2026-10-20T12:00:00Z');

describe('holiday events', () => {
  beforeEach(() => localStorage.clear());

  it('run two weeks from 31 October and 25 December, and are hidden before', () => {
    expect(activeHoliday(new Date('2026-10-30T23:59:00Z'))).toBeNull();
    expect(activeHoliday(new Date('2026-10-31T00:00:00Z'))?.key).toBe('halloween-2026');
    expect(activeHoliday(new Date('2026-11-13T23:59:00Z'))?.key).toBe('halloween-2026');
    expect(activeHoliday(new Date('2026-11-14T00:00:00Z'))).toBeNull();
    expect(activeHoliday(new Date('2026-12-25T08:00:00Z'))?.key).toBe('christmas-2026');
    expect(activeHoliday(CHRISTMAS_JAN)?.key).toBe('christmas-2026');
    expect(activeHoliday(new Date('2027-01-08T00:00:00Z'))).toBeNull();
    expect(holidayRun('halloween', 2027).start.toISOString()).toBe('2027-10-31T00:00:00.000Z');
  });

  it('keeps event pieces out of the pickers unless the event is on or you own one', () => {
    expect(eventPieceHidden('evt-halloween-icon', [], OFF)).toBe(true);
    expect(eventPieceHidden('evt-halloween-icon', [], HALLOWEEN)).toBe(false);
    expect(eventPieceHidden('evt-christmas-icon', [], HALLOWEEN)).toBe(true);
    expect(eventPieceHidden('evt-christmas-icon', ['evt-christmas-icon'], OFF)).toBe(false);
    expect(eventPieceHidden('shop-aurora', [], OFF)).toBe(false);
  });

  it('pays 1 coin a finished game and 2 a win, each game once, only during an event', () => {
    let s = earnFinish(empty(), false, 'a', HALLOWEEN);
    s = earnFinish(s, true, 'b', HALLOWEEN);
    s = earnFinish(s, true, 'b', HALLOWEEN);
    s = earnFinish(s, true, undefined, HALLOWEEN);
    expect(eventCoins(s, 'halloween-2026')).toBe(5);
    expect(earnFinish(s, true, 'c', OFF)).toBe(s);
    expect(spendEventCoins(s, 6, HALLOWEEN)).toBeNull();
    expect(eventCoins(spendEventCoins(s, 5, HALLOWEEN)!, 'halloween-2026')).toBe(0);
    expect(spendEventCoins(s, 1, OFF)).toBeNull();
  });

  it('every kind of cosmetic is in each shop, priced 15 to 250', () => {
    for (const id of ['halloween', 'christmas'] as const) {
      const kinds = new Set(piecesFor(id).map(p => p.kind));
      for (const k of ['avatar', 'icon', 'color', 'titleColor', 'title', 'frame', 'theme']) expect(kinds.has(k as never), `${id} ${k}`).toBe(true);
      const prices = piecesFor(id).map(p => p.price);
      expect(Math.min(...prices)).toBe(15);
      expect(Math.max(...prices)).toBe(250);
      expect(piecesFor(id).find(p => p.kind === 'theme')!.price).toBe(250);
    }
    expect(new Set(EVENT_PIECES.map(p => p.key)).size).toBe(EVENT_PIECES.length);
  });

  it('buying spends event coins and unlocks the piece for good; only while the event is on', () => {
    localStorage.setItem(HOLIDAY_KEY, JSON.stringify({ v: 1, earned: { 'halloween-2026': 300 }, spent: {}, counted: [] }));
    expect(buyEventPiece('evt-halloween-theme', OFF)).toBe('closed');
    expect(buyEventPiece('evt-christmas-theme', HALLOWEEN)).toBe('closed');
    expect(buyEventPiece('evt-halloween-theme', HALLOWEEN)).toBe('ok');
    expect(buyEventPiece('evt-halloween-theme', HALLOWEEN)).toBe('owned');
    expect(eventCoins(loadHoliday(), 'halloween-2026')).toBe(50);
    expect(buyEventPiece('evt-halloween-aura-haunted', HALLOWEEN)).toBe('coins');
    expect(loadRelics().cosmetics).toContain('evt-halloween-theme');
    expect(themeOpen('haunted', 1, 0)).toBe(true);
    expect(themeOpen('winterland', 1, 0)).toBe(false);
    const ctx = unlockContext(1);
    expect(isOpen({ shop: 'evt-halloween-theme' }, ctx)).toBe(true);
    expect(visibleThemes().some(t => t.id === 'haunted')).toBe(true);
    expect(localStorage.getItem(RELICS_KEY)).toContain('evt-halloween-theme');
  });

  it('noteHolidayFinish does nothing outside an event', () => {
    expect(noteHolidayFinish(true, 'x', OFF)).toBe(0);
    expect(noteHolidayFinish(true, 'x', HALLOWEEN)).toBe(2);
    expect(noteHolidayFinish(true, 'x', HALLOWEEN)).toBe(0);
  });

  it('syncs: the most earned and spent per event from both devices', () => {
    expect(SYNC_KEYS as readonly string[]).toContain('cv-holiday');
    const a = { v: 1, earned: { 'halloween-2026': 10 }, spent: { 'halloween-2026': 4 }, counted: ['halloween-2026:a'] };
    const b = { v: 1, earned: { 'halloween-2026': 7, 'christmas-2026': 3 }, spent: {}, counted: ['halloween-2026:b'] };
    const m = JSON.parse(mergeValue('cv-holiday', JSON.stringify(a), JSON.stringify(b))!);
    expect(m.earned).toEqual({ 'halloween-2026': 10, 'christmas-2026': 3 });
    expect(m.spent).toEqual({ 'halloween-2026': 4 });
    expect(m.counted.sort()).toEqual(['halloween-2026:a', 'halloween-2026:b']);
    expect(mergeHoliday(a as HolidayState, a as HolidayState).earned).toEqual(a.earned);
  });
});
