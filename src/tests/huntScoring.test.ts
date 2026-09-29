import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool } from '../hunt/cards';
import { newRun, spinPick, chooseFocus, playSeries, leaveShop, SPINS } from '../hunt/run';
import { COACH_BY_ID } from '../hunt/coaches';

describe('League Hunt scoring', () => {
  it('real team-seasons score like real NBA games (not ~250 a night)', async () => {
    const h = await loadHistoryForTests();
    const pool = cardPool(h);
    const totals: number[] = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      let r = newRun(h, seed);
      while (r.stage === 'draft') {
        const coach = SPINS[r.spin] === 'COACH';
        r = spinPick(h, r, [...r.offer].sort((a, b) => (coach ? COACH_BY_ID.get(b)!.bonus - COACH_BY_ID.get(a)!.bonus : pool.byId.get(b)!.ovr - pool.byId.get(a)!.ovr))[0]);
      }
      r = leaveShop(chooseFocus(h, r, 'star'));
      for (let i = 0; i < 2; i++) {
        const p = playSeries(h, { ...r, stage: 'series', seriesIndex: i })!;
        totals.push(...p.play.games.map(g => g.us + g.them));
      }
    }
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    expect(avg).toBeGreaterThan(190);
    expect(avg).toBeLessThan(235);
  }, 300_000);
});
