import { describe, it, expect } from 'vitest';
import {
  RELIC_RARITY, RARITY_ORDER, RELICS, SECRET_RELICS, SECRET_CHANCE, MAX_LUCK, rarityFor, spinRelic, grantSpins, luckPercent, luckMultiplier, loadRelics,
  type RelicState,
} from '../relics/relics';
import { relicRunOpts } from '../relics/apply';
import { huntSpins, perfectSpins, survivalSpins, storySpins, careerSpins } from '../relics/rewards';
import { spinWeights, newRun } from '../hunt/run';
import { emptyPlay, guessesAllowed, GRID_GUESSES } from '../arcade/grid';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';

const base = (over: Partial<RelicState> = {}): RelicState => ({ v: 1, spins: 0, coins: 0, owned: {}, secrets: [], granted: [], history: [], ...over });
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
