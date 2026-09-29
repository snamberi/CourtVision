import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { newRun, draftBest, chooseFocus, playSeries, leaveShop } from '../hunt/run';

describe('League Hunt scoring', () => {
  it('real team-seasons score like real NBA games (not ~250 a night)', async () => {
    const h = await loadHistoryForTests();
    const totals: number[] = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      let r = draftBest(h, newRun(h, seed));
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
