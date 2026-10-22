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
  it('players start with the team they finished the real season with: DeMarcus Cousins opens 2016-17 in New Orleans', () => {
    expect(teamOf(built.league, 'DeMarcus Cousins')).toBe('NOP');
    expect(built.extras.contracts['DeMarcus Cousins'].teamId).toBe('NOP');
    // The real deadline deal is already done, so the deadline moves nobody (and stays a no-op).
    const r = applyHistoricalDeadline(built.league, built.extras, 'BOS');
    expect(teamOf(r.league, 'DeMarcus Cousins')).toBe('NOP');
    expect(r.moved).toHaveLength(0);
  });

  it("your team's players stay put", () => {
    const r = applyHistoricalDeadline(built.league, built.extras, 'NOP');
    expect(teamOf(r.league, 'DeMarcus Cousins')).toBe('NOP');
  });

  it('AI teams draft the real picks in real order', () => {
    const seeds = built.league.historical!.futureClasses['2017'];
    const draftClass = prospectsFromSeeds(seeds, '2017', 2017);
    const league = { ...built.league, season: '2017' };
    const extras = { ...built.extras, draftClass, draftOrder: buildTwoRoundDraftOrder(league, 1), draftDayOpen: true, draftPickIndex: 0, draftPicksMade: [] };
    const first = draftOnePick(league, extras).pick!;
    // The team on the clock takes the player it really drafted; a team without a real pick takes the best real one left.
    const real = draftClass.filter(p => p.trueSeason.draftPick != null);
    const own = real.filter(p => p.trueSeason.draftTeamId === first.teamId).sort((a, b) => a.trueSeason.draftPick! - b.trueSeason.draftPick!)[0];
    expect(first.playerId).toBe(own?.playerId ?? 'Markelle Fultz');
  });
});
