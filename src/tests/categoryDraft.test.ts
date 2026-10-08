// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool } from '../hunt/cards';
import { categories, categoryById, MIN_CATEGORY, TIER_MULTIPLIER } from '../perfect/categories';
import { newPerfectRun, pickPlayer, pickCoach, categoryPool, rerollCategory, luckySpin, playToEnd, summary, categoryMultiplier, STARTERS, SQUAD } from '../perfect/run';
import { dailyPerfect } from '../perfect/storage';

describe('Category Draft categories', () => {
  it('has 100+ categories from real data, each big enough, tiered S to D', async () => {
    const h = await loadHistoryForTests();
    const cs = categories(h);
    expect(cs.length).toBeGreaterThanOrEqual(100);
    expect(new Set(cs.map(c => c.id)).size).toBe(cs.length);
    for (const c of cs) {
      expect(c.size).toBeGreaterThanOrEqual(MIN_CATEGORY);
      expect(new Set(c.pool.map(p => p.playerId)).size).toBe(c.pool.length);
    }
    expect(new Set(cs.map(c => c.tier))).toEqual(new Set(['S', 'A', 'B', 'C', 'D']));
    // An MVP comes in at his MVP season; the Lakers have the Lakers.
    const mvp = categoryById(h, 'mvp')!;
    expect(mvp.tier).toBe('S');
    expect(mvp.pool.find(p => p.name === 'Michael Jordan')?.end).toBeGreaterThan(1987);
    const lakers = cs.find(c => c.name === 'Los Angeles Lakers')!;
    expect(lakers.pool.some(p => p.name === 'Magic Johnson')).toBe(true);
    expect(lakers.pool.every(p => p.franchise === lakers.pool[0].franchise)).toBe(true);
  });
});

describe('Category Roll and Slot Spin', () => {
  it('Category Roll: five starters from one category, the bench from a second, then a coach and a full season', async () => {
    const h = await loadHistoryForTests();
    let r = newPerfectRun(h, 'category', 777);
    expect(r.cat).toBeTruthy();
    const first = r.cat;
    for (let i = 0; i < STARTERS; i++) { expect(r.cat).toBe(first); r = pickPlayer(h, r, categoryPool(h, r)[0].id); }
    expect(r.cat).not.toBe(first);
    while (r.stage === 'draft') r = pickPlayer(h, r, categoryPool(h, r)[0].id);
    expect(r.squad).toHaveLength(SQUAD);
    expect(new Set(r.squad.map(id => cardPool(h).byId.get(id)!.playerId)).size).toBe(SQUAD);
    expect(r.cats!.slice(0, STARTERS).every(c => c === first)).toBe(true);
    expect(r.stage).toBe('coach');
    r = pickCoach(h, r, r.coachOffer![0]);
    r = playToEnd(h, playToEnd(h, r, 'season'), 'playoffs');
    expect(r.stage).toBe('done');
    const s = summary(r);
    expect(s.multiplier).toBe(categoryMultiplier(r));
  }, 120000);

  it('Slot Spin rolls a new category for every pick and never repeats one', async () => {
    const h = await loadHistoryForTests();
    let r = newPerfectRun(h, 'slots', 31337);
    while (r.stage === 'draft') r = pickPlayer(h, r, categoryPool(h, r).at(-1)!.id);
    expect(new Set(r.cats).size).toBe(SQUAD);
  });

  it('rerolls and lucky rolls; a pick from outside the category is refused', async () => {
    const h = await loadHistoryForTests();
    let r = newPerfectRun(h, 'category', 5);
    const before = r.cat;
    expect(pickPlayer(h, r, 'nobody@1990')).toBe(r);
    r = rerollCategory(h, r);
    expect(r.cat).not.toBe(before);
    expect(r.rerolls.roll).toBe(2);
    r = luckySpin(h, r);
    expect(['S', 'A']).toContain(categoryById(h, r.cat!)!.tier);
    // Seeded: the same seed rolls the same categories.
    expect(newPerfectRun(h, 'category', 5).cat).toBe(before);
  });

  it('weaker categories pay more, starters counting double', () => {
    expect(categoryMultiplier({ tiers: Array(10).fill('S') })).toBe(1);
    expect(categoryMultiplier({ tiers: Array(10).fill('D') })).toBe(TIER_MULTIPLIER.D);
    expect(categoryMultiplier({ tiers: [...Array(5).fill('D'), ...Array(5).fill('S')] })).toBeGreaterThan(categoryMultiplier({ tiers: [...Array(5).fill('S'), ...Array(5).fill('D')] }));
  });

  it('the Daily rotates through all four draft styles', () => {
    const modes = new Set(['2027-03-01', '2027-03-02', '2027-03-03', '2027-03-04'].map(d => dailyPerfect(d).mode));
    expect(modes).toEqual(new Set(['quick', 'franchise', 'category', 'slots']));
  });
});
