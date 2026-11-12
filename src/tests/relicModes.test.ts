import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool } from '../hunt/cards';
import { newSurvivalRun, keepTen, tagFranchise, playRound, answerClaim, signPlayer, emergencyOffer, emergencySign, EMERGENCY_PRICE, WIN_CASH, ROSTER, type SurvivalRun } from '../survival/run';
import { newPerfectRun, quickSpinCard, pickPlayer, weeklyRule, ERA_RULES } from '../perfect/run';
import { mergeRelics, loadRelics, type RelicState } from '../relics/relics';
import { runCoins } from '../relics/rewards';

describe('Survival: emergency signing', () => {
  it('pays cash for wins and sells one free agent a round', async () => {
    const h = await loadHistoryForTests();
    let run: SurvivalRun | null = null;
    // Seeds until a run lives long enough to afford a signing.
    for (let seed = 21; seed < 40 && (!run || run.stage !== 'pregame' || (run.cash ?? 0) < EMERGENCY_PRICE); seed++) {
      let r = newSurvivalRun(h, seed, 'rookie');
      r = keepTen(r, r.dealt.slice(0, ROSTER));
      r = tagFranchise(h, r, r.roster[0]);
      if (seed === 21) {
        expect(r.cash ?? 0).toBe(0);
        const offer = emergencyOffer(h, r);
        expect(offer.length).toBe(3);
        expect(emergencySign(h, r, offer[0])).toBe(r); // no cash yet
      }
      for (let guard = 0; guard < 40 && !((r.cash ?? 0) >= EMERGENCY_PRICE && r.stage === 'pregame') && r.stage !== 'over'; guard++) {
        if (r.stage === 'pregame') r = playRound(h, r);
        else if (r.stage === 'claim') r = answerClaim(h, r, false);
        else if (r.stage === 'sign') r = signPlayer(h, r, r.claim!.offer[0] ?? null);
      }
      run = r;
    }
    expect(run!.stage).toBe('pregame');
    run = run!;
    expect((run.cash ?? 0) % WIN_CASH).toBe(0);
    const o = emergencyOffer(h, run);
    const signed = emergencySign(h, run, o[0]);
    expect(signed.roster).toContain(o[0]);
    expect(signed.roster.length).toBeLessThanOrEqual(ROSTER);
    expect(signed.roster).toContain(run.franchise);
    expect(signed.cash).toBe((run.cash ?? 0) - EMERGENCY_PRICE);
    expect(emergencyOffer(h, signed)).toEqual([]);
  });
});

describe('82-0: the weekly era rule', () => {
  it("every Quick Spin reel lands in the rule's era", async () => {
    const h = await loadHistoryForTests();
    let run = newPerfectRun(h, 'quick', 77, undefined, { rule: 'legends' });
    expect(run.rule).toBe('legends');
    for (let i = 0; i < 10; i++) {
      const c = quickSpinCard(h, run);
      expect(c.end).toBeLessThanOrEqual(ERA_RULES.legends.to);
      run = pickPlayer(h, run);
    }
    expect(run.squad.every(id => cardPool(h).byId.get(id)!.end <= 1989)).toBe(true);
    // The Daily ignores it.
    expect(newPerfectRun(h, 'quick', 77, '2026-10-10', { rule: 'legends' }).rule).toBeUndefined();
    expect(Object.keys(ERA_RULES)).toContain(weeklyRule('2026-W41'));
  });
});

describe('relic sync and rewards', () => {
  const st = (over: Partial<RelicState>): RelicState => ({ ...loadRelics(() => null), ...over });
  it("merges the collection, keeps the busier copy's coins and spins", () => {
    const a = st({ owned: { ring: 1, luckyPenny: 3 }, secrets: ['eternalSpin'], coins: 500, spins: 1, opens: 30, granted: ['x'] });
    const b = st({ owned: { luckyPenny: 5, whistle: 1 }, secrets: ['lastLook'], coins: 9000, spins: 9, opens: 2 });
    const m = mergeRelics(a, b);
    expect(m.owned).toEqual({ ring: 1, luckyPenny: 5, whistle: 1 });
    expect(m.secrets.sort()).toEqual(['eternalSpin', 'lastLook']);
    expect(m.coins).toBe(500);
    expect(m.spins).toBe(1);
    expect(mergeRelics(m, m)).toEqual(m);
  });
  it('every run pays coins', () => {
    expect(runCoins(0)).toBeGreaterThan(0);
    expect(runCoins(2)).toBeGreaterThan(runCoins(1));
  });
});

import { huntTeams } from '../hunt/teams';
import { rerollCoach } from '../perfect/run';
import { newRun, stopReels, rerollOfferedPlayer } from '../hunt/run';
import { newWheel, rerollLowest, wheelPool, wheelCategories, isComplete } from '../career/wheel';
import { CATEGORIES, categoryScore } from '../career/categories';

describe('release event relic gameplay', () => {
  it('offers a one-use Hunt reroll and excludes personal bonuses from shared runs', async () => {
    const h = await loadHistoryForTests();
    const opts = { secrets: ['forbiddenPlaybook', 'stockingStuffer', 'goldenEgg'] };
    const plain = newRun(h, 42), special = newRun(h, 42, opts);
    expect(special.coins).toBe(plain.coins + 35);
    const stopped = stopReels(h, special);
    const slot = Object.keys(stopped.reels!).find(k => k !== 'COACH') as 'PG';
    const changed = rerollOfferedPlayer(h, stopped, slot);
    expect(changed.forbiddenPlaybook).toBe(false);
    expect(changed.spin).toBe(stopped.spin);
    expect(changed.reels?.COACH).toBe(stopped.reels?.COACH);
    expect(changed.squad).toEqual(stopped.squad);
    expect(rerollOfferedPlayer(h, changed, slot)).toBe(changed);
    const daily = newRun(h, 42, { ...opts, daily: '2026-10-15' });
    expect(daily.forbiddenPlaybook).toBe(false);
    expect(daily.coins).toBe(newRun(h, 42, { daily: '2026-10-15' }).coins);
  });
  it('coach rerolls never consume regular rerolls or affect shared-seed runs', async () => {
    const h = await loadHistoryForTests();
    const opts = { secrets: ['trickOrTreat', 'allStarClipboard'] };
    let run = newPerfectRun(h, 'quick', 17, undefined, opts);
    expect(run.coachRerolls).toBe(2);
    expect(rerollCoach(h, run)).toBe(run);
    for (let i = 0; i < 10; i++) run = pickPlayer(h, run);
    const rerolled = rerollCoach(h, run);
    expect(rerolled.coachRerolls).toBe(1);
    expect(rerolled.rerolls).toEqual(run.rerolls);
    expect(newPerfectRun(h, 'quick', 17, '2026-10-15', opts).coachRerolls).toBe(0);
    expect(newPerfectRun(h, 'category', 17, undefined, { ...opts, weekly: '2026-W42' }).coachRerolls).toBe(0);
  });
  it('Cursed Dice replaces only the lowest completed category and cannot be reused', async () => {
    const h = await loadHistoryForTests();
    const cardId = wheelPool(h)[0].id, cats = wheelCategories(h, { reel: [cardId], stop: 0 });
    const s = { ...newWheel(17, undefined, { secrets: ['cursedDice'] }), picks: Object.fromEntries(CATEGORIES.map(c => [c.id, { cardId, values: cats[c.id] }])) };
    expect(isComplete(s)).toBe(true);
    const low = CATEGORIES.filter(c => c.id !== 'size').sort((a, b) => categoryScore(cats[a.id]) - categoryScore(cats[b.id]))[0].id;
    const rerolled = rerollLowest(h, s);
    expect(rerolled.cursedDice).toBe(false);
    expect(rerolled.picks[low]?.cardId).not.toBe(cardId);
    for (const c of CATEGORIES.filter(c => c.id !== low)) expect(rerolled.picks[c.id]).toBe(s.picks[c.id]);
    expect(rerollLowest(h, rerolled)).toBe(rerolled);
  });
  it('Second Life preserves the loss and rescues exactly one elimination', async () => {
    const h = await loadHistoryForTests();
    let found = false;
    for (let seed = 1; seed < 30 && !found; seed++) {
      let run = newSurvivalRun(h, seed, 'legend', undefined, { secrets: ['secondLife'] });
      run = tagFranchise(h, keepTen(run, run.dealt.slice(0, 10)), run.dealt[0]);
      const weak = cardPool(h).byRarity.common.slice(0, 10).map(c => c.id);
      const strongest = [...huntTeams(h)].sort((a, b) => b.strength - a.strength)[0];
      run = { ...run, roster: weak, franchise: weak[0], next: strongest.id };
      const played = playRound(h, run);
      if (played.games.at(-1)?.won) continue;
      found = true;
      expect(played.secondLife).toBe(false);
      expect(played.shields).toBe(1);
      expect(played.stage).toBe('pregame');
      expect(played.games.at(-1)?.won).toBe(false);
      expect(playRound(h, { ...run, secondLife: false }).stage).toBe('over');
    }
    expect(found).toBe(true);
    const daily = newSurvivalRun(h, 1, 'pro', '2026-10-15', { secrets: ['secondLife', 'winterGuard', 'playoffArmor'] });
    expect(daily.secondLife).toBeUndefined();
    expect(daily.shields).toBe(1);
  });
});
