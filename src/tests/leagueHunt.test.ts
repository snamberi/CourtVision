import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool, cardPlayer } from '../hunt/cards';
import { huntTeams } from '../hunt/teams';
import { ERAS, underEra } from '../hunt/eras';
import { stopGame, commitGame, coachCards, COACH_CARDS, newRun, draftPick, playStop, takeReward, releaseCard, affordable, spent, moveOn, chooseRoad, buyCard, buyItem, buyLife, rest, resolveEvent, squadBonuses, upgradeRun, SQUAD_SIZE, START_LIVES, CAP_PER_WIN, START_COINS, type HuntRun } from '../hunt/run';
import { chemistry } from '../hunt/chemistry';
import { EVENT_IDS } from '../hunt/events';

const bestAffordable = (h: Awaited<ReturnType<typeof loadHistoryForTests>>, run: HuntRun) =>
  run.offer.filter(id => affordable(h, run, id)).sort((a, b) => cardPool(h).byId.get(b)!.ovr - cardPool(h).byId.get(a)!.ovr)[0];

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

  it('a run: draft under the cap, six stops ending with a boss, wins raise the cap, losses cost lives', async () => {
    const h = await loadHistoryForTests();
    let run = newRun(h, 4242);
    expect(run.stops).toHaveLength(6);
    expect(run.stops[5].boss).toBe(true);
    expect(huntTeams(h).find(t => t.id === run.stops[5].teamId)!.champion).toBe(true);
    expect(run.offer.every(id => ['epic', 'legendary'].includes(cardPool(h).byId.get(id)!.rarity))).toBe(true); // the star pick
    while (run.stage === 'draft') run = draftPick(h, run, bestAffordable(h, run));
    expect(run.squad).toHaveLength(SQUAD_SIZE);
    expect(spent(h, run.squad)).toBeLessThanOrEqual(run.cap);
    run = { ...run, stops: run.stops.map((s, i) => (i === 0 ? { ...s, eraId: '60s' } : s)) }; // the first stop under 1960s rules
    expect(new Set(run.squad.map(id => cardPool(h).byId.get(id)!.playerId)).size).toBe(SQUAD_SIZE);
    let wins = 0, losses = 0, noLineGames = 0;
    for (let i = 0; i < 40 && (run.stage === 'stop' || run.stage === 'reward'); i++) {
      if (run.stage === 'reward') { const cap = run.cap; expect(cap).toBe(72 + CAP_PER_WIN * wins); run = takeReward(h, run, null); expect(run.stage).toBe('crossroads'); run = moveOn(run); continue; }
      const r = playStop(h, run)!;
      // Nobody plays for both sides.
      const mine = new Set(r.game.home.seasons.map(p => p.real!.id));
      expect(r.game.away.seasons.some(p => mine.has(p.real!.id))).toBe(false);
      if (r.game.won) wins++; else { losses++; expect(r.run.lives).toBe(START_LIVES - losses); }
      const tpa = (box: typeof r.game.result.homeBox) => Object.values(box.players).reduce((n, l) => n + l.tpa, 0);
      if (r.game.era.threes === 'none') { noLineGames++; expect(tpa(r.game.result.homeBox) + tpa(r.game.result.awayBox)).toBeLessThanOrEqual(6); }
      run = r.run;
    }
    expect(['won', 'lost']).toContain(run.stage);
    expect(noLineGames).toBeGreaterThan(0);
    expect(run.results).toHaveLength(wins + losses);
  }, 300_000);

  it('rewards: take a card into an open spot or in place of one; release frees points', async () => {
    const h = await loadHistoryForTests();
    let run = newRun(h, 99);
    while (run.stage === 'draft') run = draftPick(h, run, bestAffordable(h, run));
    const reward: HuntRun = { ...run, stage: 'reward', offer: run.offer.length ? run.offer : [cardPool(h).byRarity.common.find(c => c.ovr >= 50 && !run.squad.some(s => cardPool(h).byId.get(s)!.playerId === c.playerId))!.id], cap: run.cap + 30 };
    const card = reward.offer[0];
    const added = takeReward(h, reward, card);
    expect(added.squad).toContain(card);
    expect(added.stage).toBe('crossroads');
    expect(moveOn(added).stopIndex).toBe(1);
    const replaced = takeReward(h, reward, card, reward.squad[3]);
    expect(replaced.squad).toHaveLength(SQUAD_SIZE);
    expect(replaced.squad).not.toContain(reward.squad[3]);
    const released = releaseCard(added, added.squad[0]);
    expect(released.squad).toHaveLength(SQUAD_SIZE);
    expect(spent(h, released.squad)).toBeLessThan(spent(h, added.squad));
  }, 120_000);

  it('chemistry: real teammates, franchise, home era and rivals', async () => {
    const h = await loadHistoryForTests();
    const pool = cardPool(h);
    const id = (name: string, end: number) => `${h.players.find(p => p.displayName === name)!.id}@${end}`;
    const cards = [id('Michael Jordan', 1996), id('Scottie Pippen', 1996), id('Larry Bird', 1986), id('Magic Johnson', 1987), id('Derrick Rose', 2011)].map(i => pool.byId.get(i)!);
    const bonds = chemistry(cards, ERAS.find(e => e.id === '80s'));
    const kinds = bonds.map(b => b.kind);
    expect(bonds.find(b => b.kind === 'teammates')!.cards).toHaveLength(2);
    expect(kinds).toContain('rivals');
    expect(kinds).toContain('franchise'); // Jordan, Pippen and Rose: the Bulls in two seasons
    const run = { ...newRun(h, 5), stage: 'stop' as const, squad: cards.map(c => c.id) };
    const jordan = squadBonuses(h, run, ERAS.find(e => e.id === '90s')).cards.find(c => c.card.name === 'Michael Jordan')!;
    expect(jordan.bonus).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it('the road: shop, events and rest', async () => {
    const h = await loadHistoryForTests();
    let run = newRun(h, 777);
    while (run.stage === 'draft') run = draftPick(h, run, bestAffordable(h, run));
    expect(run.coins).toBe(START_COINS);
    const at: HuntRun = { ...run, stage: 'crossroads', crossroads: ['shop', 'event'], coins: 500, cap: run.cap + 40 };
    // Shop: a card, an item and a life.
    const shop = chooseRoad(h, at, 'shop');
    expect(shop.stage).toBe('shop');
    expect(shop.shop!.cards).toHaveLength(4);
    const signed = buyCard(h, shop, shop.shop!.cards[0], shop.squad[0]);
    expect(signed.squad).toContain(shop.shop!.cards[0]);
    expect(signed.coins).toBeLessThan(500);
    const item = shop.shop!.items[0];
    const withItem = buyItem(signed, item);
    expect(withItem.items).toContain(item);
    expect(buyItem(withItem, item)).toBe(withItem); // sold out
    const healed = buyLife({ ...withItem, lives: 1 });
    expect(healed.lives).toBe(2);
    expect(moveOn(healed).stage).toBe('stop');
    // Events: every one resolves with a note for every option.
    for (const ev of EVENT_IDS) {
      const e: HuntRun = { ...at, stage: 'event', eventId: ev };
      for (const opt of ['play', 'rest', 'pay', 'refuse', 'swap', 'pass', 'send', 'skip', 'open', 'sell', 'decline']) {
        const r = resolveEvent(h, e, opt);
        if (r !== e) { expect(r.note).toBeTruthy(); expect(r.eventId).toBeUndefined(); }
      }
    }
    // Rest: a life back, or training.
    const restAt: HuntRun = { ...at, stage: 'rest', lives: 2 };
    expect(rest(restAt, { heal: true }).lives).toBe(3);
    const trained = rest(restAt, { train: restAt.squad[0] });
    expect(trained.boosts[restAt.squad[0]]).toBe(2);
    expect(trained.stage).toBe('stop');
  }, 120_000);

  it('an older saved run continues', async () => {
    const h = await loadHistoryForTests();
    const { coins: _c, items: _i, boosts: _b, ...old } = newRun(h, 3);
    void _c; void _i; void _b;
    const up = upgradeRun({ ...old, version: 1 });
    expect(up.version).toBe(2);
    expect(up.coins).toBe(START_COINS);
    expect(up.items).toEqual([]);
  }, 120_000);

  it('live coaching: calls change the game from that possession on; the result counts when committed', async () => {
    const h = await loadHistoryForTests();
    let run = newRun(h, 31337);
    while (run.stage === 'draft') run = draftPick(h, run, bestAffordable(h, run));
    const plain = stopGame(h, run)!;
    expect(plain.commands).toEqual([]);
    expect(stopGame(h, run)!.result.homeScore).toBe(plain.result.homeScore); // same game every time
    const at = Math.floor(plain.result.possessionLog.length / 2);
    const star = plain.home.seasons[0].playerId;
    const coached = stopGame(h, run, [{ kind: 'play', atPossession: at, teamId: 'HUNT', play: 'iso', focusId: star }, { kind: 'pace', atPossession: at, teamId: 'HUNT', pace: 'fast' }])!;
    // Everything before the call replays exactly.
    expect(coached.result.possessionLog.slice(0, at - 1).map(e => e.homeScoreAfter)).toEqual(plain.result.possessionLog.slice(0, at - 1).map(e => e.homeScoreAfter));
    expect(coached.commands).toHaveLength(2);
    expect(run.stage).toBe('stop'); // nothing recorded yet
    const after = commitGame(h, run, coached);
    expect(after.results).toHaveLength(1);
    expect(after.results[0].us).toBe(coached.result.homeScore);
    const lines = Object.values(after.lines ?? {});
    expect(lines.reduce((n, l) => n + l.pts, 0)).toBe(coached.result.homeScore);
    expect(coachCards(run)).toBe(COACH_CARDS);
    expect(coachCards({ ...run, items: ['clipboard'] })).toBe(COACH_CARDS + 2);
  }, 120_000);
});
