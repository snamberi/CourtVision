import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { newRun, secretSeries, opponentRating } from '../hunt/run';
import { huntTeams } from '../hunt/teams';

describe('League Hunt secret boss', () => {
  it('is the strongest champion not already on the road, rated above the boss', async () => {
    const h = await loadHistoryForTests();
    const run = newRun(h, 21);
    const s = secretSeries(h, run);
    expect(s.secret).toBe(true);
    expect(s.kind).toBe('boss');
    expect(run.series.some(x => x.teamId === s.teamId)).toBe(false);
    expect(huntTeams(h).find(t => t.id === s.teamId)?.champion).toBe(true);
    const withSecret = { ...run, series: [...run.series, s], seriesIndex: run.series.length };
    const boss = { ...run, seriesIndex: run.series.length - 1 };
    expect(opponentRating(h, withSecret, s)).toBeGreaterThan(opponentRating(h, boss, run.series.at(-1)!));
  });
});
