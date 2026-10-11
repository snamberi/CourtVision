import { describe, expect, it } from 'vitest';
import { weeklyEvent, WEEKLY_EVENTS } from '../retention/weeklyEvent';
import { loadRelics, toggleWish, wishedToday, mergeRelics, type RelicState } from '../relics/relics';

const base = (over: Partial<RelicState> = {}): RelicState => ({ ...loadRelics(() => null), ...over });

describe('weekly event', () => {
  it('is the same all week, changes on Monday, and cycles through every event', () => {
    const mon = new Date('2026-10-12T00:00:00Z'), sun = new Date('2026-10-18T23:59:00Z'), next = new Date('2026-10-19T00:00:00Z');
    expect(weeklyEvent(sun).id).toBe(weeklyEvent(mon).id);
    expect(weeklyEvent(next).id).not.toBe(weeklyEvent(mon).id);
    const seen = new Set(Array.from({ length: WEEKLY_EVENTS.length }, (_, i) => weeklyEvent(new Date(mon.getTime() + i * 7 * 86_400_000)).id));
    expect(seen.size).toBe(WEEKLY_EVENTS.length);
  });
});

describe('shop wish list', () => {
  it('stars and unstars, and says when a starred piece is on sale', () => {
    let s = base({ cosmeticShop: { day: '2026-10-12', offers: ['shop-tc-void', 'shop-skin-jade', 'shop-aurora'] } });
    s = toggleWish(s, 'shop-skin-jade');
    expect(wishedToday(s)).toEqual(['shop-skin-jade']);
    expect(wishedToday({ ...s, cosmetics: ['shop-skin-jade'] })).toEqual([]);
    expect(toggleWish(s, 'shop-skin-jade').wishlist).toEqual([]);
    expect(mergeRelics(base({ wishlist: ['a'] }), base({ wishlist: ['b'] })).wishlist?.sort()).toEqual(['a', 'b']);
  });
});
