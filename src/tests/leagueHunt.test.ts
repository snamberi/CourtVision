import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool, cardPlayer } from '../hunt/cards';
import { huntTeams } from '../hunt/teams';
import { ERAS, underEra } from '../hunt/eras';
import { newRun, draftPick, playStop, takeReward, releaseCard, affordable, spent, SQUAD_SIZE, START_LIVES, CAP_PER_WIN, type HuntRun } from '../hunt/run';

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
    for (let i = 0; i < 30 && (run.stage === 'stop' || run.stage === 'reward'); i++) {
      if (run.stage === 'reward') { const cap = run.cap; expect(cap).toBe(72 + CAP_PER_WIN * wins); run = takeReward(h, run, null); continue; }
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
    expect(added.stopIndex).toBe(1);
    const replaced = takeReward(h, reward, card, reward.squad[3]);
    expect(replaced.squad).toHaveLength(SQUAD_SIZE);
    expect(replaced.squad).not.toContain(reward.squad[3]);
    const released = releaseCard(added, added.squad[0]);
    expect(released.squad).toHaveLength(SQUAD_SIZE);
    expect(spent(h, released.squad)).toBeLessThan(spent(h, added.squad));
  }, 120_000);
});
