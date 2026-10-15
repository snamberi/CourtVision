import { describe, it, expect } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool } from '../hunt/cards';
import { REAL_LOOKS, likenessKey } from '../visuals/likeness';
import { RELEASES } from '../content/whatsNew';
import { themeOf, itemsOf, updateNumber, searchUpdates, UPDATE_THEMES } from '../content/updates';

describe('real-player likenesses', () => {
  it('every likeness belongs to a real player in the data', async () => {
    const h = await loadHistoryForTests();
    const names = new Set(cardPool(h).cards.map(c => likenessKey(c.name)));
    const missing = Object.keys(REAL_LOOKS).filter(k => !names.has(k));
    expect(missing).toEqual([]);
    expect(Object.keys(REAL_LOOKS).length).toBeGreaterThanOrEqual(150);
  }, 120_000);
});

describe('the Updates hub', () => {
  it('gives every update a theme, a number and a short headline per item', () => {
    for (const r of RELEASES) {
      expect(UPDATE_THEMES[themeOf(r).id]).toBeDefined();
      const items = itemsOf(r);
      expect(items).toHaveLength(r.items.length);
      for (const it of items) { expect(it.head.length).toBeGreaterThan(0); expect(it.head.length).toBeLessThanOrEqual(80); expect(it.head).not.toContain('**'); }
    }
    expect(updateNumber(RELEASES[0])).toBe(RELEASES.length);
    expect(updateNumber(RELEASES[RELEASES.length - 1])).toBe(1);
  });
  it('reads the bold lead-in as the headline, and themes by title', () => {
    expect(itemsOf({ id: 'x', title: 'Season 3: INFERNO', items: ['**Clans:** found a clan.', 'Plain text with no bold at all. Second sentence.'] }))
      .toEqual([{ head: 'Clans', text: '**Clans:** found a clan.' }, { head: 'Plain text with no bold at all', text: 'Plain text with no bold at all. Second sentence.' }]);
    expect(themeOf({ id: 'x', title: 'Season 2: FROZEN', items: [] }).id).toBe('ice');
    expect(themeOf({ id: 'x', title: 'Anything', items: [], theme: 'glitch' }).id).toBe('glitch');
    expect(themeOf({ id: 'x', title: 'Anything at all', items: [] }).id).toBe('court');
    expect(searchUpdates('relic').length).toBeGreaterThan(0);
    expect(searchUpdates('zzzz-nothing')).toEqual([]);
  });
});
