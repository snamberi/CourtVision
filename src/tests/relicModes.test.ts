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
