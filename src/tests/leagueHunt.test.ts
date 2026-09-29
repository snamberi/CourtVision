import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool, cardPlayer } from '../hunt/cards';
import { huntTeams } from '../hunt/teams';
import { ERAS, underEra } from '../hunt/eras';
import {
  newRun, stopReels, lockReel, openSpins, draftBest, chooseFocus, playSeries, takeBoost, leaveShop, buyCard, buyCoach, buyItem, buyLife, train, gameBonuses, squadRating, opponentRating, spinWeights,
  SPINS, SLOTS, ENEMY_EDGE, SERIES_COUNT, SEMI_BOSS, START_COINS, MAX_TRAINING, BOOST_CAP, SERIES_START, MAX_BOOSTS, type HuntRun,
} from '../hunt/run';
import { MAX_ITEMS } from '../hunt/items';
import { rawStrength, rosterRating, winsToRating } from '../hunt/rating';
import { COACH_BY_ID } from '../hunt/coaches';
import { chemistry } from '../hunt/chemistry';

type H = Awaited<ReturnType<typeof loadHistoryForTests>>;
/** Locks the best player on the reels every round. */
const spinAll = (h: H, run: HuntRun) => draftBest(h, run);

describe('League Hunt', () => {
  it('cards are real player-seasons with rarity by rating', async () => {
    const h = await loadHistoryForTests();
    const pool = cardPool(h);
    expect(pool.cards.length).toBeGreaterThan(15000);
    const mj = pool.byId.get(`${h.players.find(p => p.displayName === 'Michael Jordan')!.id}@1996`)!;
    expect(mj.rarity).toBe('legendary');
    expect(mj.teamName).toBe('Chicago');
    const p = cardPlayer(h, mj, 'HUNT');
    expect(p.playerId).toBe("Michael Jordan '96");
    const minLegendary = Math.min(...pool.byRarity.legendary.map(c => c.ovr));
    expect(Math.max(...pool.byRarity.epic.map(c => c.ovr))).toBeLessThanOrEqual(minLegendary);
  }, 120_000);

  it('era rules: no threes before the line existed', async () => {
    const h = await loadHistoryForTests();
    const curry = cardPool(h).byId.get(`${h.players.find(p => p.displayName === 'Stephen Curry')!.id}@2016`)!;
    const p = cardPlayer(h, curry, 'HUNT');
    const sixties = underEra(p, ERAS[0]), tens = underEra(p, ERAS.find(e => e.id === '10s')!);
    expect(sixties.tendencies.shot.catchAndShoot3).toBeLessThan(p.tendencies.shot.catchAndShoot3 * 0.1);
    expect(tens.tendencies.shot.catchAndShoot3).toBeGreaterThanOrEqual(p.tendencies.shot.catchAndShoot3);
  }, 120_000);

  it('team ratings run 0-100 on real results, top-heavy', async () => {
    const h = await loadHistoryForTests();
    expect(winsToRating(25)).toBe(60);
    expect(winsToRating(40)).toBe(70);
    expect(winsToRating(45)).toBe(80);
    expect(winsToRating(58)).toBe(90);
    expect(winsToRating(68)).toBe(100);
    // One star beats the same total spread evenly.
    expect(rawStrength([90, 60, 60, 60, 60, 60])).toBeGreaterThan(rawStrength([65, 65, 65, 65, 65, 65]));
    const teams = huntTeams(h);
    const rate = (id: string) => rosterRating(h, teams.find(t => t.id === id)!.roster.map(c => cardPool(h).byId.get(c)!.ovr));
    expect(rate('GSW@2017')).toBeGreaterThanOrEqual(95);
    const bad = teams.filter(t => t.w / (t.w + t.l) < 0.25).slice(0, 20).map(t => rate(t.id));
    expect(bad.reduce((a, b) => a + b, 0) / bad.length).toBeLessThan(68);
  }, 120_000);

  it('the slot machine: every open slot spins, STOP freezes them, lock one and the rest respin; a Star and a Great land early', async () => {
    const h = await loadHistoryForTests();
    const pool = cardPool(h);
    expect(SPINS).toEqual(['PG', 'SG', 'SF', 'PF', 'C', 'COACH', '6TH']);
    expect(spinWeights(0).legendary).toBeGreaterThan(spinWeights(6).legendary);
    expect(spinWeights(0).epic).toBeGreaterThan(spinWeights(6).epic);
    for (const seed of [1, 2, 3, 4, 5]) {
      let run = newRun(h, seed);
      expect(run.reels).toBeNull();
      expect(lockReel(h, run, 'PG')).toBe(run); // nothing to lock while everything spins
      const seen: string[] = [];
      for (let round = 0; run.stage === 'draft'; round++) {
        const open = openSpins(run);
        expect(open).toHaveLength(SPINS.length - round);
        run = stopReels(h, run);
        expect(stopReels(h, run)).toBe(run); // already stopped
        expect(Object.keys(run.reels!).sort()).toEqual([...open].sort());
        for (const [k, id] of Object.entries(run.reels!)) {
          if (k === 'COACH') { expect(COACH_BY_ID.has(id!)).toBe(true); continue; }
          const c = pool.byId.get(id!)!;
          if (k !== '6TH') expect(c.pos === k || (c.pos === 'G' && (k === 'PG' || k === 'SG')) || (c.pos === 'F' && (k === 'SF' || k === 'PF'))).toBe(true);
          if (round === run.guarantees.star || round === run.guarantees.great) seen.push(c.rarity);
        }
        // Lock the last reel on the table: the others spin again.
        const k = open[open.length - 1];
        const id = run.reels![k]!;
        run = lockReel(h, run, k);
        expect(k === 'COACH' ? run.coach : run.squad[SLOTS.indexOf(k as typeof SLOTS[number])]).toBe(id);
        if (run.stage === 'draft') expect(run.reels).toBeNull();
      }
      expect(seen).toContain('legendary');
      expect(seen).toContain('epic');
      expect(run.squad.every(Boolean)).toBe(true);
      expect(run.squad).toHaveLength(SLOTS.length);
      expect(new Set(run.squad.map(id => pool.byId.get(id)!.playerId)).size).toBe(SLOTS.length);
      expect(run.coach).toBeTruthy();
      expect(run.stage).toBe('focus');
    }
  }, 120_000);

  it('the focus is set once and every opponent plays above its series rating', async () => {
    const h = await loadHistoryForTests();
    let run = chooseFocus(h, spinAll(h, newRun(h, 4242)), 'star');
    expect(run.focus).toBe('star');
    expect(chooseFocus(h, run, 'coach')).toBe(run); // can't change it in the shop
    run = leaveShop(run);
    expect(run.series.every(s => s.lift >= ENEMY_EDGE || s.kind !== 'normal')).toBe(true);
  }, 120_000);

  it('a run: ten best-of-seven series, a semi-boss and a 100-rated boss, boosts after wins, shops every two series', async () => {
    const h = await loadHistoryForTests();
    let run = spinAll(h, newRun(h, 4242));
    expect(run.series).toHaveLength(SERIES_COUNT);
    expect(run.series[SEMI_BOSS].kind).toBe('semi');
    expect(run.series[SERIES_COUNT - 1].kind).toBe('boss');
    expect(opponentRating(h, run, run.series[SERIES_COUNT - 1])).toBeGreaterThanOrEqual(100);
    expect(new Set(run.series.map(s => s.teamId)).size).toBe(SERIES_COUNT);
    run = chooseFocus(h, run, 'star');
    expect(run.stage).toBe('shop');
    expect(run.coins).toBe(START_COINS);
    let shops = 1, boosts = 0, series = 0;
    for (let i = 0; i < 40 && !['won', 'lost'].includes(run.stage); i++) {
      if (run.stage === 'shop') { run = leaveShop(run); continue; }
      if (run.stage === 'boost') {
        expect(run.boostOffer).toHaveLength(3);
        run = takeBoost(h, run, run.boostOffer![0]); boosts++;
        if (run.stage === 'shop') { shops++; expect(run.seriesIndex % 2).toBe(0); }
        continue;
      }
      const lives = run.lives, index = run.seriesIndex;
      const r = playSeries(h, run)!;
      series++;
      const w = r.play.games.filter(g => g.won).length, l = r.play.games.length - w;
      expect(Math.max(w, l)).toBe(4);
      expect(Math.min(w, l)).toBeLessThan(4);
      expect(r.play.games.every(g => g.won === g.us > g.them)).toBe(true);
      if (!r.play.won) { expect(r.run.lives).toBe(lives - 1); if (r.run.stage !== 'lost') expect(r.run.seriesIndex).toBe(index); }
      run = r.run;
    }
    expect(['won', 'lost']).toContain(run.stage);
    expect(boosts).toBe(run.boosts.length);
    expect(run.boosts.length).toBeLessThanOrEqual(MAX_BOOSTS);
    expect(series).toBe(run.results.length);
    expect(shops).toBeLessThanOrEqual(5);
    // Deterministic: the same seed plays the same series.
    const again = playSeries(h, leaveShop(chooseFocus(h, spinAll(h, newRun(h, 4242)), 'star')))!;
    expect(again.play.games).toEqual(run.results[0].games);
  }, 300_000);

  it('a hunt holds three boosts; after that, wins go straight on', async () => {
    const h = await loadHistoryForTests();
    let run = leaveShop(chooseFocus(h, spinAll(h, newRun(h, 4242)), 'star'));
    run = { ...run, boosts: ['spark', 'closer', 'momentum'], training: Object.fromEntries(run.squad.map(id => [id, 40])) };
    const r = playSeries(h, run)!;
    expect(r.play.won).toBe(true);
    expect(r.run.stage).not.toBe('boost');
    expect(r.run.seriesIndex).toBe(1);
  }, 120_000);

  it('boosts grow inside a series and are capped per player', async () => {
    const h = await loadHistoryForTests();
    const run = { ...leaveShop(chooseFocus(h, spinAll(h, newRun(h, 7)), 'sixth')), boosts: ['spark' as const] };
    const sixth = (st: typeof SERIES_START) => gameBonuses(h, run, undefined, st).cards[5];
    const g1 = sixth(SERIES_START), up2 = sixth({ ...SERIES_START, game: 3, ourWins: 2 });
    expect(up2.bonus - g1.bonus).toBe(6);
    const stacked = { ...run, boosts: ['spark', 'microwave', 'closer', 'fastStart', 'backToWall'] as HuntRun['boosts'] };
    const all = gameBonuses(h, stacked, undefined, { game: 6, ourWins: 3, theirWins: 3, streak: 0, lostLast: true }).cards[5];
    const base = gameBonuses(h, { ...stacked, boosts: [] }, undefined, { game: 6, ourWins: 3, theirWins: 3, streak: 0, lostLast: true }).cards[5];
    expect(all.bonus - base.bonus).toBe(BOOST_CAP);
    // Growth: the sixth-man focus adds +2 per series won.
    const grown = gameBonuses(h, { ...run, boosts: [], growth: { ...run.growth, sixth: 3 } }, undefined, SERIES_START).cards[5];
    expect(grown.bonus - gameBonuses(h, { ...run, boosts: [] }, undefined, SERIES_START).cards[5].bonus).toBe(6);
  }, 120_000);

  it('the shop: slot-for-slot signings, a coach, shop boosts (two), training and a life', async () => {
    const h = await loadHistoryForTests();
    const pool = cardPool(h);
    let run = chooseFocus(h, spinAll(h, newRun(h, 99)), 'chemistry');
    run = { ...run, coins: 1000, lives: 2 };
    const offer = run.shop!.cards[0];
    run = buyCard(h, run, offer.id);
    expect(run.squad[offer.slot]).toBe(offer.id);
    expect(run.squad).toHaveLength(SLOTS.length);
    expect(buyCard(h, run, offer.id)).toBe(run); // sold
    if (run.shop!.coach) { run = buyCoach(run); expect(run.coach).toBe(run.shop!.coach); }
    for (const i of run.shop!.items) run = buyItem(run, i);
    expect(run.items).toHaveLength(MAX_ITEMS); // two shop boosts at most
    const id = run.squad[0];
    for (let i = 0; i < 5; i++) run = train(h, run, id);
    expect(run.training[id]).toBe(MAX_TRAINING);
    // Lives are for sale only on Rookie.
    expect(buyLife(run)).toBe(run);
    const rookie = buyLife({ ...run, difficulty: 'rookie' });
    expect(rookie.lives).toBe(3);
    expect(buyLife(rookie)).toBe(rookie);
    expect(chooseFocus(h, run, 'coach').focus).toBe('chemistry'); // the focus is set for the whole hunt
    expect(squadRating(h, run)).toBeGreaterThan(0);
    expect(pool.byId.has(run.squad[5])).toBe(true);
    expect(leaveShop(run).stage).toBe('series');
  }, 120_000);

  it('chemistry: real teammates and rivals', async () => {
    const h = await loadHistoryForTests();
    const pool = cardPool(h);
    const id = (name: string, end: number) => `${h.players.find(p => p.displayName === name)!.id}@${end}`;
    const bonds = chemistry([pool.byId.get(id('Michael Jordan', 1996))!, pool.byId.get(id('Scottie Pippen', 1996))!, pool.byId.get(id('Larry Bird', 1986))!, pool.byId.get(id('Magic Johnson', 1987))!]);
    expect(bonds.some(b => b.kind === 'teammates' && b.bonus === 2)).toBe(true);
    expect(bonds.some(b => b.kind === 'rivals')).toBe(true);
  }, 120_000);
});
