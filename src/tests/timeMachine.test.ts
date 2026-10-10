import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { buildHistoricalLeague } from '../history/historicalLeague';
import { applyTimeMachine, defaultReplacement, destinationTeams, FAMOUS } from '../history/timeMachine';
import { huntTeams } from '../hunt/teams';
import { simulateFullRound } from '../simulation/league';
import { manageCoachRosters } from '../simulation/coachRosters';

describe('Time Machine', () => {
  it('every famous team is in the data', async () => {
    const h = await loadHistoryForTests();
    const ids = new Set(huntTeams(h).map(t => t.id));
    for (const id of FAMOUS) expect(ids.has(id)).toBe(true);
  });

  it('sends the 2016 Warriors to 1985-86 in place of their own franchise, and the season plays', async () => {
    const h = await loadHistoryForTests();
    const team = huntTeams(h).find(t => t.id === 'GSW@2016')!;
    const replace = defaultReplacement(h, team, 1985);
    expect(replace).toBeTruthy();
    expect(destinationTeams(h, 1985).some(d => d.abbr === replace)).toBe(true);
    const built = buildHistoricalLeague(h, 1985, { realDevelopment: true, difficulty: 'normal', seed: 3, allPlayers: true });
    const before = built.league.teams.find(t => t.teamId === replace)!.seasons.map(s => s.playerId);
    const moved = applyTimeMachine(h, built.league, built.extras, 'GSW@2016', replace!, 3);
    const mine = moved.league.teams.find(t => t.teamId === moved.teamId)!;
    expect(mine.seasons.some(s => s.playerId.startsWith('Stephen Curry'))).toBe(true);
    expect(mine.seasons.every(s => moved.extras.contracts[s.playerId]?.teamId === replace)).toBe(true);
    for (const id of before) { expect(moved.extras.freeAgents.some(f => f.playerId === id)).toBe(true); expect(moved.extras.contracts[id]).toBeUndefined(); }
    expect(moved.league.timeMachine?.fromLabel).toMatch(/Golden State/);
    // No player id appears twice.
    const all = [...moved.league.teams.flatMap(t => t.seasons.map(s => s.playerId)), ...moved.extras.freeAgents.map(s => s.playerId)];
    expect(new Set(all).size).toBe(all.length);
    const ready = manageCoachRosters(moved.league, moved.extras);
    const played = simulateFullRound(ready.league, 5);
    expect(played.schedule.filter(g => g.played).length).toBeGreaterThan(0);
  }, 120_000);

  it('a team whose franchise did not exist yet takes another team\'s place and keeps its name', async () => {
    const h = await loadHistoryForTests();
    const team = huntTeams(h).find(t => t.id === 'OKC@2012')!;
    expect(defaultReplacement(h, team, 1960)).toBeNull();
    const built = buildHistoricalLeague(h, 1960, { realDevelopment: true, difficulty: 'normal', seed: 4, allPlayers: true });
    const target = built.league.teams[0].teamId;
    const moved = applyTimeMachine(h, built.league, built.extras, 'OKC@2012', target, 4);
    expect(moved.league.teams.find(t => t.teamId === target)!.name).toBe(team.name);
  }, 120_000);
});
