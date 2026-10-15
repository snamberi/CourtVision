import { describe, it, expect } from 'vitest';
import {
  RELICS, RELIC_BY_ID, relicLuck, luckPercent, totalLuck, relicPower, slotCount, buySlot, SLOT_PRICES, MAX_SLOTS, spinRelic, spinMany, luckySpin, buySpin, upgradeRelic,
  discounted, SPIN_PRICE, LUCKY_SPIN_PRICE, UPGRADE_PRICE, RELIC_RARITY, DAILY_COINS, type RelicState,
} from '../relics/relics';
import { runCoins } from '../relics/rewards';
import { PET_SECOND, SECOND_PRICE, cleanPets, withSecond, secondOpen, petDiscount, PETS_KEY } from '../profile/pets';
import { mergeValue } from '../cloud/merge';

const base = (over: Partial<RelicState> = {}): RelicState => ({ v: 1, spins: 0, coins: 0, owned: {}, secrets: [], granted: [], history: [], upgraded: [], equipped: [], slotsBought: 0, pity: { epic: 0, legendary: 0, mythic: 0, lucky: 0 }, opens: 0, ledger: [], rewards: [], ...over });
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };
const DOUBLE_WEEK = new Date('2026-10-21T12:00:00Z'), PLAIN_WEEK = new Date('2026-10-28T12:00:00Z');

describe('relic economy', () => {
  it('relics give 20% less luck, with no cap on the total', () => {
    const ring = RELIC_BY_ID.get('ring')!;
    expect(relicLuck(ring, 1)).toBeCloseTo(RELIC_RARITY[ring.rarity].luck * 0.8, 5);
    const all = Object.fromEntries(RELICS.map(r => [r.id, 1]));
    expect(totalLuck({ owned: all, slotsBought: 5 })).toBeGreaterThan(50);
  });

  it('the 15th slot costs 2.5 million and doubles every relic', () => {
    expect(SLOT_PRICES[4]).toBe(2_500_000);
    let s = base({ coins: 10_000_000, owned: { ring: 1 }, equipped: ['ring'] });
    const before = luckPercent(s);
    for (let i = 0; i < 4; i++) s = buySlot(s)!;
    expect(slotCount(s)).toBe(MAX_SLOTS - 1);
    expect(relicPower(s)).toBe(1);
    const coins = s.coins;
    s = buySlot(s)!;
    expect(coins - s.coins).toBe(2_500_000);
    expect(relicPower(s)).toBe(2);
    expect(luckPercent(s)).toBeCloseTo(before * 2, 5);
  });

  it('pays 15% fewer coins', () => {
    expect(DAILY_COINS).toBe(21);
    expect(runCoins(0)).toBe(21);
    expect(runCoins(2)).toBe(106);
    expect(RELIC_RARITY.common.coins).toBe(43);
  });

  it('Double Relics: one spin opens two relics and counts twice toward the guarantees', () => {
    const r = seq(0.9, 0.5, 0.1, 0.9);
    const out = spinRelic(base({ spins: 1 }), r, DOUBLE_WEEK)!;
    expect(out.bonus).toBeDefined();
    expect(out.state.spins).toBe(0);
    expect(out.state.opens).toBe(2);
    expect(out.state.pity.epic).toBe(2);
    const plain = spinRelic(base({ spins: 1 }), seq(0.9, 0.5, 0.1, 0.9), PLAIN_WEEK)!;
    expect(plain.bonus).toBeUndefined();
    expect(plain.state.opens).toBe(1);
    expect(spinMany(base({ spins: 3 }), 3, Math.random, DOUBLE_WEEK).results).toHaveLength(6);
    const lucky = luckySpin(base({ coins: 1000 }), Math.random, 0, DOUBLE_WEEK)!;
    expect(lucky.bonus).toBeDefined();
  });

  it('a pet with its second ability cuts spin, Lucky Spin and upgrade prices (up to 10%)', () => {
    expect(Math.max(...Object.values(PET_SECOND).map(p => p.discount))).toBe(0.1);
    expect(discounted(SPIN_PRICE, 0.1)).toBe(180);
    expect(discounted(SPIN_PRICE, 0.5)).toBe(180); // never more than 10%
    expect(buySpin(base({ coins: 180 }), 0.1)!.coins).toBe(0);
    expect(buySpin(base({ coins: 180 }))).toBeNull();
    expect(luckySpin(base({ coins: discounted(LUCKY_SPIN_PRICE, 0.05) }), Math.random, 0.05, PLAIN_WEEK)!.state.coins).toBe(0);
    const ring = RELIC_BY_ID.get('ring')!;
    expect(upgradeRelic(base({ coins: UPGRADE_PRICE[ring.rarity], owned: { ring: 1 } }), 'ring', 0.1)!.coins).toBe(UPGRADE_PRICE[ring.rarity] - discounted(UPGRADE_PRICE[ring.rarity], 0.1));
  });

  it('second abilities cost 15k, only work with that pet along, and survive cleaning and syncing', () => {
    expect(SECOND_PRICE).toBe(15_000);
    const s = withSecond(cleanPets({ v: 1, equipped: 'cat', looks: {} }), 'cat');
    expect(secondOpen(s, 'cat')).toBe(true);
    expect(cleanPets(JSON.parse(JSON.stringify(s))).second).toEqual(['cat']);
    expect(petDiscount(5, k => (k === PETS_KEY ? JSON.stringify(s) : null))).toBe(PET_SECOND.cat.discount);
    expect(petDiscount(5, k => (k === PETS_KEY ? JSON.stringify({ ...s, equipped: 'dog' }) : null))).toBe(0);
    const merged = JSON.parse(mergeValue('cv-pets', JSON.stringify({ v: 1, equipped: 'cat', looks: {}, second: ['cat'] }), JSON.stringify({ v: 1, equipped: 'dog', looks: {}, second: ['dog'] }))!);
    expect(merged.second.sort()).toEqual(['cat', 'dog']);
  });
});
