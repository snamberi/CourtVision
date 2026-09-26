import { describe, it, expect, beforeAll } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import type { NbaHistory } from '../history/nbaHistoryData';
import { buildHistoricalLeague } from '../history/historicalLeague';
import { applyHistoricalDeadline, prospectsFromSeeds } from '../history/realRollover';
import { draftOnePick } from '../simulation/aiGM';
import { buildTwoRoundDraftOrder } from '../simulation/gm';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';

let h: NbaHistory;
let built: { league: League; extras: GMLeagueExtras };
beforeAll(async () => { h = await loadHistoryForTests(); built = buildHistoricalLeague(h, 2016, { realDevelopment: true, forceRosters: true, difficulty: 'normal', seed: 4 }); }, 120_000);
const teamOf = (l: League, id: string) => l.teams.find(t => t.seasons.some(p => p.playerId === id))?.teamId ?? null;

describe('historical rosters: real mid-season moves and real picks', () => {
  it('after the deadline, DeMarcus Cousins goes from Sacramento to New Orleans, once', () => {
    expect(teamOf(built.league, 'DeMarcus Cousins')).toBe('SAC');
    expect(built.league.historical!.realMoves!['2016'].some(m => m.to === 'NOP')).toBe(true);
    const r = applyHistoricalDeadline(built.league, built.extras, 'BOS');
    expect(teamOf(r.league, 'DeMarcus Cousins')).toBe('NOP');
    expect(r.extras.contracts['DeMarcus Cousins'].teamId).toBe('NOP');
    expect(r.moved.length).toBeGreaterThan(5);
    expect(applyHistoricalDeadline(r.league, r.extras, 'BOS').moved).toHaveLength(0); // applied once
  });

  it("your team's players stay put", () => {
    const r = applyHistoricalDeadline(built.league, built.extras, 'SAC');
    expect(teamOf(r.league, 'DeMarcus Cousins')).toBe('SAC');
  });

  it('AI teams draft the real picks in real order', () => {
    const seeds = built.league.historical!.futureClasses['2017'];
    const draftClass = prospectsFromSeeds(seeds, '2017', 2017);
    const league = { ...built.league, season: '2017' };
    const extras = { ...built.extras, draftClass, draftOrder: buildTwoRoundDraftOrder(league, 1), draftDayOpen: true, draftPickIndex: 0, draftPicksMade: [] };
    const first = draftOnePick(league, extras).pick!;
    expect(first.playerId).toBe('Markelle Fultz');
  });
});
