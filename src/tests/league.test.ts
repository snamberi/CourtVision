import { describe, it, expect } from 'vitest';
import {
  generateRoundRobinSchedule, generateSeasonSchedule, computeStandings, simulateRemainingSeason,
  simulateRounds, simulateFullRound, simulateDays, gamesRemainingForTeam, totalGamesForTeam, type League,
} from '../simulation/league';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';

describe('round robin schedule', () => {
  it('every team plays every other team exactly once for gamesPerMatchup=1', () => {
    const teamIds = ['A', 'B', 'C', 'D'];
    const schedule = generateRoundRobinSchedule(teamIds, 1);
    const matchupCounts: Record<string, number> = {};
    for (const g of schedule) {
      const key = [g.homeTeamId, g.awayTeamId].sort().join('-');
      matchupCounts[key] = (matchupCounts[key] ?? 0) + 1;
    }
    const expectedPairs = (teamIds.length * (teamIds.length - 1)) / 2;
    expect(Object.keys(matchupCounts).length).toBe(expectedPairs);
    expect(Object.values(matchupCounts).every((c) => c === 1)).toBe(true);
  });

  it('handles an odd number of teams via a bye without crashing or scheduling the bye team', () => {
    const teamIds = ['A', 'B', 'C'];
    const schedule = generateRoundRobinSchedule(teamIds, 1);
    for (const g of schedule) {
      expect(g.homeTeamId).not.toBe('__BYE__');
      expect(g.awayTeamId).not.toBe('__BYE__');
    }
  });
});

describe('season simulation + standings', () => {
  it('simulating a full round-robin season produces standings that sum correctly (every game has exactly one winner)', () => {
    const teams = ['T1', 'T2', 'T3', 'T4'].map((id) => {
      const demo = buildDemoTeam(id, id);
      return { teamId: id, name: id, seasons: demo.seasons };
    });
    const schedule = generateRoundRobinSchedule(teams.map((t) => t.teamId), 1);
    let league: League = { teams, schedule, settings: { ...DEFAULT_GAME_SETTINGS }, season: '2026' };
    league = simulateRemainingSeason(league, 100);
    // A real league would be forced through All-Star Weekend here before the rest of the season
    // can be simulated - this fixture has no award/roster setup for that, so just mark it done.
    league = { ...league, allStarWeekend: { season: league.season!, completed: true } };
    league = simulateRemainingSeason(league, 100);

    expect(league.schedule.every((g) => g.played)).toBe(true);

    const standings = computeStandings(league);
    const totalWins = standings.reduce((s, r) => s + r.wins, 0);
    const totalLosses = standings.reduce((s, r) => s + r.losses, 0);
    expect(totalWins).toBe(league.schedule.length);
    expect(totalLosses).toBe(league.schedule.length);
    expect(totalWins).toBe(totalLosses);
  });

  it('refuses to simulate past the All-Star break until the weekend is marked completed for the current season', () => {
    const teams = ['T1', 'T2', 'T3', 'T4'].map((id) => {
      const demo = buildDemoTeam(id, id);
      return { teamId: id, name: id, seasons: demo.seasons };
    });
    const schedule = generateRoundRobinSchedule(teams.map((t) => t.teamId), 4); // enough rounds to have a real break point
    let league: League = { teams, schedule, settings: { ...DEFAULT_GAME_SETTINGS }, season: '2026' };
    league = simulateRemainingSeason(league, 7);

    const stillUnplayed = league.schedule.some((g) => !g.played);
    expect(stillUnplayed).toBe(true); // blocked at the break, not actually finished

    // Simulating again with no state change should be a genuine no-op (not slowly grinding forward).
    const again = simulateRemainingSeason(league, 7);
    expect(again.schedule.filter((g) => g.played).length).toBe(league.schedule.filter((g) => g.played).length);

    // Once the weekend is marked complete for this season, the rest of the schedule plays out normally.
    league = { ...league, allStarWeekend: { season: '2026', completed: true } };
    league = simulateRemainingSeason(league, 7);
    expect(league.schedule.every((g) => g.played)).toBe(true);
  });

  it('simulateFullRound plays every game in the current round, not just one', () => {
    const teams = ['T1', 'T2', 'T3', 'T4'].map((id) => {
      const demo = buildDemoTeam(id, id);
      return { teamId: id, name: id, seasons: demo.seasons };
    });
    const schedule = generateRoundRobinSchedule(teams.map((t) => t.teamId), 1);
    const league: League = { teams, schedule, settings: { ...DEFAULT_GAME_SETTINGS }, season: '2026' };
    const gamesInFirstRound = schedule.filter((g) => g.round === schedule[0].round).length;
    expect(gamesInFirstRound).toBeGreaterThan(1); // 4 teams -> 2 games share round 0

    const after = simulateFullRound(league, 5);
    const playedCount = after.schedule.filter((g) => g.played).length;
    expect(playedCount).toBe(gamesInFirstRound); // the whole round played, not just the first game
  });

  it('simulateDays converts a day count into schedule rounds via DAYS_PER_ROUND', () => {
    const teams = ['T1', 'T2', 'T3', 'T4'].map((id) => {
      const demo = buildDemoTeam(id, id);
      return { teamId: id, name: id, seasons: demo.seasons };
    });
    const schedule = generateRoundRobinSchedule(teams.map((t) => t.teamId), 4);
    const league: League = { teams, schedule, settings: { ...DEFAULT_GAME_SETTINGS }, season: '2026' };
    const after = simulateDays(league, 8, 3); // 8 days / 2 days-per-round = 4 rounds
    const roundsPlayed = new Set(after.schedule.filter((g) => g.played).map((g) => g.round)).size;
    expect(roundsPlayed).toBe(4);
  });
});

describe('team-scoped game counts', () => {
  function fixtureLeague(): League {
    const teams = ['T1', 'T2', 'T3', 'T4'].map((id) => {
      const demo = buildDemoTeam(id, id);
      return { teamId: id, name: id, seasons: demo.seasons };
    });
    const schedule = generateSeasonSchedule(teams.map((t) => t.teamId), 12);
    return { teams, schedule, settings: { ...DEFAULT_GAME_SETTINGS } };
  }

  it('totalGamesForTeam counts only that team\'s games, not the whole league schedule', () => {
    const league = fixtureLeague();
    expect(totalGamesForTeam(league, 'T1')).toBe(12);
    expect(totalGamesForTeam(league, null)).toBe(league.schedule.length);
    expect(totalGamesForTeam(league, null)).toBeGreaterThan(12);
  });

  it('gamesRemainingForTeam drops as that team\'s games are played, unaffected by other teams\' games', () => {
    const league = fixtureLeague();
    expect(gamesRemainingForTeam(league, 'T1')).toBe(12);
    const oneRound = simulateRounds(league, 1, 1);
    const t1Left = gamesRemainingForTeam(oneRound, 'T1');
    expect(t1Left).toBeLessThan(12);
    expect(t1Left).toBe(11); // exactly one game removed for T1 after advancing one round
  });
});

describe('simulateRounds', () => {
  it('advances only the requested number of rounds, leaving later games unplayed', () => {
    const teams = ['T1', 'T2', 'T3', 'T4'].map((id) => {
      const demo = buildDemoTeam(id, id);
      return { teamId: id, name: id, seasons: demo.seasons };
    });
    const schedule = generateSeasonSchedule(teams.map((t) => t.teamId), 12);
    const league: League = { teams, schedule, settings: { ...DEFAULT_GAME_SETTINGS } };
    const advanced = simulateRounds(league, 3, 1);
    const maxPlayedRound = Math.max(...advanced.schedule.filter((g) => g.played).map((g) => g.round));
    const minUnplayedRound = Math.min(...advanced.schedule.filter((g) => !g.played).map((g) => g.round));
    expect(maxPlayedRound).toBeLessThan(minUnplayedRound + 1);
    expect(advanced.schedule.some((g) => !g.played)).toBe(true);
  });
});
