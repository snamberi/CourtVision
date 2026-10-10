import { describe, it, expect } from 'vitest';
import {
  RELIC_RARITY, RARITY_ORDER, RELICS, SECRET_RELICS, SECRET_CHANCE, MAX_LUCK, rarityFor, spinRelic, grantSpins, luckPercent, luckMultiplier, loadRelics,
  autoEquip, PITY, LUCKY_PITY, SLOT_PRICES, BASE_SLOTS, EXTRA_SLOTS, RELIC_SETS, slotCount, buySlot, equipRelic, unequipRelic, setBonus, spinMany,
  grantReward, rewardOf, collectDailyCoins, DAILY_COINS, LUCKY_ODDS, STACK_MAX, SPIN_PRICE, LUCKY_SPIN_PRICE, RELIC_PRICE, UPGRADE_PRICE, buySpin, luckySpin, refreshShop, buyRelic, upgradeRelic, canGain,
  type RelicState,
} from '../relics/relics';
import { relicRunOpts } from '../relics/apply';
import { huntSpins, perfectSpins, survivalSpins, storySpins, careerSpins } from '../relics/rewards';
import { spinWeights, newRun } from '../hunt/run';
import { emptyPlay, guessesAllowed, GRID_GUESSES } from '../arcade/grid';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';

const base = (over: Partial<RelicState> = {}): RelicState => {
  const s: RelicState = { v: 1, spins: 0, coins: 0, owned: {}, secrets: [], granted: [], history: [], upgraded: [], equipped: [], slotsBought: 0, pity: { epic: 0, legendary: 0, mythic: 0, lucky: 0 }, opens: 0, ledger: [], rewards: [], ...over };
  return over.equipped ? s : { ...s, equipped: autoEquip(s) };
};
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };

describe('relics', () => {
  it('odds add up to 1, mythic is 0.07% and luck runs 1-5%', () => {
    const total = RARITY_ORDER.reduce((n, r) => n + RELIC_RARITY[r].odds, 0);
    expect(total).toBeCloseTo(1, 9);
    expect(RELIC_RARITY.mythic.odds).toBe(0.0007);
    expect(RARITY_ORDER.map(r => RELIC_RARITY[r].luck)).toEqual([1, 2, 3, 4, 5]);
    for (const r of RARITY_ORDER) expect(RELICS.some(x => x.rarity === r)).toBe(true);
    expect(SECRET_RELICS).toHaveLength(8);
  });

  it('maps rolls to rarities, rarest first', () => {
    expect(rarityFor(0)).toBe('mythic');
    expect(rarityFor(0.0006)).toBe('mythic');
    expect(rarityFor(0.001)).toBe('legendary');
    expect(rarityFor(0.999)).toBe('common');
    let mythic = 0;
    for (let i = 0; i < 100_000; i++) if (rarityFor(i / 100_000) === 'mythic') mythic++;
    expect(mythic).toBe(70);
  });

  it('a spin costs a spin; a duplicate pays coins by rarity', () => {
    expect(spinRelic(base())).toBeNull();
    // Rolls: secret check (miss), rarity (legendary), relic pick (first).
    const first = spinRelic(base({ spins: 2 }), seq(0.5, 0.01, 0))!;
    expect(first.result).toMatchObject({ kind: 'relic', rarity: 'legendary', duplicate: false, coins: 0 });
    expect(first.state.spins).toBe(1);
    const again = spinRelic(first.state, seq(0.5, 0.01, 0))!;
    expect(again.result).toMatchObject({ duplicate: true, coins: RELIC_RARITY.legendary.coins });
    expect(again.state.coins).toBe(RELIC_RARITY.legendary.coins);
    expect(again.state.owned[first.result.id]).toBe(2);
  });

  it('a tiny chance uncovers a secret you lack, never one you have', () => {
    const got = spinRelic(base({ spins: 1, secrets: SECRET_RELICS.slice(1).map(s => s.id) }), seq(SECRET_CHANCE / 2, 0.9))!;
    expect(got.result).toMatchObject({ kind: 'secret', id: SECRET_RELICS[0].id });
    // All found: the secret roll is skipped.
    const all = spinRelic(base({ spins: 1, secrets: SECRET_RELICS.map(s => s.id) }), seq(0, 0.5, 0))!;
    expect(all.result.kind).toBe('relic');
  });

  it('pays a reward once per key', () => {
    const a = grantSpins(base(), 'hunt:1', 2);
    expect(a.spins).toBe(2);
    expect(grantSpins(a, 'hunt:1', 2)).toBe(a);
    expect(grantSpins(a, 'x', 0)).toBe(a);
  });

  it('counts each relic once and caps luck', () => {
    expect(luckPercent({ owned: { ring: 5, netScrap: 1 } })).toBe(5);
    expect(luckPercent({ owned: Object.fromEntries(RELICS.map(r => [r.id, 1])) })).toBe(MAX_LUCK);
    expect(luckMultiplier(0.12)).toBeCloseTo(1.12);
    expect(luckMultiplier(5)).toBeCloseTo(1 + MAX_LUCK / 100);
  });

  it('reads the run options from storage, and survives junk', () => {
    const store = { 'cv-relics': JSON.stringify(base({ owned: { firstBall: 1 }, secrets: ['eternalSpin', 'bogus' as never] })) } as Record<string, string>;
    const o = relicRunOpts(k => store[k] ?? null);
    expect(o.luck).toBeCloseTo(0.05);
    expect(o.eternalSpin).toBe(true);
    expect(o.secondWind).toBe(false);
    expect(loadRelics(() => '{not json').spins).toBe(0);
  });

  it('rewards scale with the result', () => {
    expect(huntSpins({ stage: 'lost' })).toBe(0);
    expect(huntSpins({ stage: 'won', difficulty: 'legend', immortal: true })).toBe(3);
    expect(perfectSpins({ champion: true, perfectSeason: true, perfectPlayoffs: true })).toBe(3);
    expect(survivalSpins(4)).toBe(0);
    expect(survivalSpins(12)).toBe(2);
    expect(storySpins('legend')).toBe(2);
    expect(careerSpins('first-ballot')).toBe(2);
  });
});

describe('relic shop, stacks and upgrades', () => {
  it('has 59 relics with unique ids, some stacking', () => {
    expect(RELICS).toHaveLength(59);
    expect(new Set(RELICS.map(r => r.id)).size).toBe(RELICS.length);
    expect(RELICS.filter(r => r.stack).length).toBe(10);
  });

  it('a stacking relic adds 1% a copy up to five, then pays coins', () => {
    let s = base({ spins: 7 });
    // Rolls: secret miss, common, the luckyPenny slot in the common pool.
    const commons = RELICS.filter(r => r.rarity === 'common');
    const at = commons.findIndex(r => r.id === 'luckyPenny');
    const pick = (at + 0.5) / commons.length;
    for (let i = 1; i <= STACK_MAX; i++) {
      const out = spinRelic(s, seq(0.5, 0.9, pick))!;
      expect(out.result).toMatchObject({ id: 'luckyPenny', duplicate: false, stack: i, coins: 0 });
      s = out.state;
      expect(luckPercent(s)).toBe(i);
    }
    const extra = spinRelic(s, seq(0.5, 0.9, pick))!;
    expect(extra.result).toMatchObject({ duplicate: true, coins: RELIC_RARITY.common.coins });
    expect(luckPercent(extra.state)).toBe(STACK_MAX);
  });

  it('upgrades add 50% luck to relics that do not stack, once', () => {
    const s = base({ coins: 10_000, owned: { whistle: 1, luckyPenny: 2 } });
    expect(luckPercent(s)).toBe(4);
    const up = upgradeRelic(s, 'whistle')!;
    expect(up.coins).toBe(10_000 - UPGRADE_PRICE.rare);
    expect(luckPercent(up)).toBe(5);
    expect(upgradeRelic(up, 'whistle')).toBeNull();
    expect(upgradeRelic(s, 'luckyPenny')).toBeNull();
    expect(upgradeRelic(s, 'ring')).toBeNull();
    expect(upgradeRelic(base({ owned: { whistle: 1 } }), 'whistle')).toBeNull();
  });

  it('sells spins and Lucky Spins for coins', () => {
    expect(buySpin(base({ coins: SPIN_PRICE - 1 }))).toBeNull();
    expect(buySpin(base({ coins: SPIN_PRICE }))).toMatchObject({ coins: 0, spins: 1 });
    expect(luckySpin(base({ coins: LUCKY_SPIN_PRICE - 1 }))).toBeNull();
    const lucky = luckySpin(base({ coins: LUCKY_SPIN_PRICE }), seq(0.5, 0.99, 0))!;
    expect(lucky.state.coins).toBe(0);
    expect(lucky.result.rarity).not.toBe('common');
    expect(lucky.result.lucky).toBe(true);
  });

  it('Lucky Spins never land a Common and double the top odds', () => {
    expect(LUCKY_ODDS.common).toBe(0);
    expect(Object.values(LUCKY_ODDS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(LUCKY_ODDS.mythic / LUCKY_ODDS.rare).toBeCloseTo((RELIC_RARITY.mythic.odds * 2) / RELIC_RARITY.rare.odds);
    for (let i = 0; i < 1000; i++) expect(rarityFor(i / 1000, true)).not.toBe('common');
  });

  it('rolls three daily relics once a day and sells each once', () => {
    const s = refreshShop(base({ coins: 100_000, salt: 7 }), '2026-10-10');
    expect(s.shop!.offers).toHaveLength(3);
    expect(refreshShop(s, '2026-10-10')).toBe(s);
    expect(refreshShop(base({ salt: 7 }), '2026-10-10').shop!.offers).toEqual(s.shop!.offers);
    expect(refreshShop(s, '2026-10-11').shop!.offers).not.toEqual(s.shop!.offers);
    const id = s.shop!.offers[0], r = RELICS.find(x => x.id === id)!;
    const bought = buyRelic(s, id)!;
    expect(bought.coins).toBe(100_000 - RELIC_PRICE[r.rarity]);
    expect(bought.owned[id]).toBe(1);
    expect(buyRelic(bought, id)).toBeNull();
    expect(buyRelic(s, 'notInShop')).toBeNull();
    expect(buyRelic({ ...s, coins: 0 }, id)).toBeNull();
    expect(RELIC_PRICE.common).toBe(750);
  });

  it('never offers a relic you cannot gain from', () => {
    const owned = Object.fromEntries(RELICS.filter(r => r.rarity !== 'mythic').map(r => [r.id, STACK_MAX]));
    const s = refreshShop(base({ owned, salt: 1 }), '2026-10-10');
    for (const id of s.shop!.offers) expect(canGain(s, RELICS.find(r => r.id === id)!)).toBe(true);
  });

  it('old saves load with no upgrades or shop', () => {
    const old = { v: 1, spins: 2, coins: 5, owned: { ring: 1 }, secrets: [], granted: [], history: [] };
    const s = loadRelics(() => JSON.stringify(old));
    expect(s.upgraded).toEqual([]);
    expect(s.shop).toBeUndefined();
    expect(luckPercent(s)).toBe(4);
  });
});

describe('slots, pity, sets and coins', () => {
  // Rolls: secret miss, the worst common, the first relic.
  const bad = () => seq(0.5, 0.999, 0);

  it('epic, legendary and mythic pity end unlucky streaks', () => {
    let s = base({ spins: 400, secretPityDone: true });
    const got: string[] = [];
    for (let i = 0; i < PITY.mythic; i++) { const o = spinRelic(s, bad())!; s = o.state; got.push(o.result.rarity); }
    expect(got[PITY.epic - 1]).toBe('epic');
    expect(got.slice(0, PITY.epic - 1).every(r => r === 'common')).toBe(true);
    expect(got[PITY.legendary - 1]).toBe('legendary');
    expect(got[PITY.mythic - 1]).toBe('mythic');
    expect(s.pity).toMatchObject({ epic: 0, legendary: 0, mythic: 0 });
  });

  it('every 10th Lucky Spin lands Legendary or better', () => {
    let s = base({ coins: LUCKY_SPIN_PRICE * LUCKY_PITY });
    const got: string[] = [];
    for (let i = 0; i < LUCKY_PITY; i++) { const o = luckySpin(s, seq(0.5, 0.999, 0))!; s = o.state; got.push(o.result.rarity); }
    expect(got.slice(0, -1).every(r => r === 'rare' || r === 'epic')).toBe(true);
    expect(got.at(-1)).toBe('legendary');
  });

  it('the 50th spin ever opened uncovers a secret, once', () => {
    let s = base({ spins: 120 });
    const secrets: number[] = [];
    for (let i = 1; i <= 120; i++) { const o = spinRelic(s, bad())!; s = o.state; if (o.result.kind === 'secret') secrets.push(i); }
    expect(secrets).toEqual([50]);
    expect(s.secretPityDone).toBe(true);
    expect(s.opens).toBe(120);
  });

  it('only relics in your slots add luck; ten slots, five more to buy', () => {
    const owned = Object.fromEntries(RELICS.slice(0, 20).map(r => [r.id, 1]));
    const s = base({ owned, coins: 100_000 });
    expect(s.equipped).toHaveLength(BASE_SLOTS);
    const luck = luckPercent(s);
    const off = unequipRelic(s, s.equipped[0]);
    expect(luckPercent(off)).toBeLessThan(luck);
    expect(equipRelic(s, RELICS[19].id)).toBeNull();
    let t = s;
    for (let i = 0; i < EXTRA_SLOTS; i++) t = buySlot(t)!;
    expect(slotCount(t)).toBe(BASE_SLOTS + EXTRA_SLOTS);
    expect(t.coins).toBe(100_000 - SLOT_PRICES.reduce((a, b) => a + b, 0));
    expect(buySlot(t)).toBeNull();
    // Each bought slot took the best spare relic; full again now.
    expect(t.equipped).toHaveLength(BASE_SLOTS + EXTRA_SLOTS);
    expect(luckPercent(t)).toBeGreaterThan(luck);
    const spare = RELICS.slice(0, 20).find(r => !t.equipped.includes(r.id))!.id;
    expect(equipRelic(t, spare)).toBeNull();
    expect(equipRelic(unequipRelic(t, t.equipped[0]), spare)!.equipped).toContain(spare);
    expect(equipRelic(s, 'notOwned')).toBeNull();
  });

  it('new relics fill a free slot', () => {
    const o = spinRelic(base({ spins: 1 }), bad())!;
    expect(o.state.equipped).toEqual([o.result.id]);
  });

  it('a complete set adds its bonus', () => {
    const set = RELIC_SETS[0];
    const part = Object.fromEntries(set.relics.slice(1).map(id => [id, 1]));
    expect(setBonus({ owned: part })).toBe(0);
    expect(setBonus({ owned: { ...part, [set.relics[0]]: 1 } })).toBe(set.bonus);
    for (const st of RELIC_SETS) for (const id of st.relics) expect(RELICS.some(r => r.id === id)).toBe(true);
  });

  it('logs coins, pays the daily coins once a day', () => {
    const s = collectDailyCoins(base(), '2026-10-10');
    expect(s.coins).toBe(DAILY_COINS);
    expect(collectDailyCoins(s, '2026-10-10')).toBe(s);
    const b = buySpin({ ...s, coins: SPIN_PRICE })!;
    expect(b.ledger.at(-1)).toMatchObject({ amount: -SPIN_PRICE, why: 'Relic Spin' });
  });

  it('a run pays spins, coins and its feat secret once', () => {
    const s = grantReward(base(), 'hunt:1', { spins: 2, coins: 125, secret: 'secondWind' });
    expect(s).toMatchObject({ spins: 2, coins: 125, secrets: ['secondWind'] });
    expect(rewardOf(s, 'hunt:1')).toMatchObject({ spins: 2, coins: 125, secret: 'secondWind' });
    expect(grantReward(s, 'hunt:1', { spins: 2, coins: 125 })).toBe(s);
    expect(rewardOf(grantReward(s, 'hunt:2', { spins: 0, coins: 25, secret: 'secondWind' }), 'hunt:2')?.secret).toBeUndefined();
  });

  it('spins many at once', () => {
    const out = spinMany(base({ spins: 3 }), 10, bad());
    expect(out.results).toHaveLength(3);
    expect(out.state.spins).toBe(0);
  });

  it('old saves get their best relics slotted', () => {
    const owned = Object.fromEntries(RELICS.map(r => [r.id, 1]));
    const s = loadRelics(() => JSON.stringify({ v: 1, spins: 0, coins: 0, owned, secrets: [], granted: [], history: [] }));
    expect(s.equipped).toHaveLength(BASE_SLOTS);
    expect(s.equipped.map(id => RELICS.find(r => r.id === id)!.rarity).slice(0, 5)).toEqual(['mythic', 'mythic', 'mythic', 'mythic', 'mythic']);
  });
});

describe('relic hooks', () => {
  it('luck makes the best hunt cards likelier', () => {
    const plain = spinWeights(0), lucky = spinWeights(0, 0.2);
    expect(lucky.legendary).toBeCloseTo(plain.legendary * 1.2);
    expect(lucky.epic).toBeCloseTo(plain.epic * 1.2);
    expect(lucky.common).toBeLessThan(plain.common);
  });

  it('shared hunts ignore relics; your own hunts use them', async () => {
    const h = await loadHistoryForTests();
    const opts = { luck: 0.2, secondWind: true, goldenTouch: true };
    const mine = newRun(h, 42, opts), plain = newRun(h, 42), daily = newRun(h, 42, { ...opts, daily: '2026-10-10' });
    expect(mine.lives).toBe(plain.lives + 1);
    expect(mine.coins).toBe(plain.coins + 30);
    expect(mine.luck).toBe(0.2);
    expect(daily.lives).toBe(plain.lives);
    expect(daily.coins).toBe(plain.coins);
    expect(daily.luck).toBeUndefined();
  });

  it('The Last Look adds an endless grid guess', () => {
    expect(guessesAllowed(emptyPlay())).toBe(GRID_GUESSES);
    expect(guessesAllowed(emptyPlay(GRID_GUESSES + 1))).toBe(GRID_GUESSES + 1);
  });
});

describe('a bought slot', () => {
  it('fills itself with your best spare relic', async () => {
    const { buySlot: buy, RELICS: all, loadRelics: load } = await import('../relics/relics');
    const owned = Object.fromEntries(all.slice(0, 12).map(r => [r.id, 1]));
    const s = load(() => JSON.stringify({ v: 1, spins: 0, coins: 5000, owned, secrets: [], granted: [], history: [] }));
    expect(s.equipped).toHaveLength(10);
    const t = buy(s)!;
    expect(t.equipped).toHaveLength(11);
  });
});
