import { describe, it, expect } from 'vitest';
import { perGameAverages } from '../simulation/careerStats';
import { computeTeamOverallSum, computeTeamOverallAverage, computeTeamStatus } from '../simulation/teamStatus';
import { computeSeasonAwards, computeLegacyScore } from '../simulation/awards';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { generateRoundRobinSchedule, simulateRemainingSeason, type League } from '../simulation/league';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { calculateOverall } from '../simulation/engine/overall';

function buildLeague(): League {
  const teams = ['A', 'B', 'C', 'D'].map((id) => {
    const demo = buildDemoTeam(id, id);
    return { teamId: demo.teamId, name: demo.label, seasons: demo.seasons };
  });
  const schedule = generateRoundRobinSchedule(teams.map((t) => t.teamId), 3);
  return { teams, schedule, settings: { ...DEFAULT_GAME_SETTINGS } };
}

describe('career stats accumulation', () => {
  it('simulating league games accrues seasonStats onto the actual player profile', () => {
    let league = buildLeague();
    league = simulateRemainingSeason(league, 10);
    const star = league.teams[0].seasons[0];
    expect(star.seasonStats).toBeDefined();
    expect(star.seasonStats!.gamesPlayed).toBeGreaterThan(0);
    expect(star.seasonStats!.points).toBeGreaterThan(0);
  });

  it('perGameAverages divides totals by games played correctly', () => {
    const totals = { gamesPlayed: 4, minutes: 100, points: 40, fgm: 16, fga: 32, tpm: 4, tpa: 10, ftm: 4, fta: 4, oreb: 4, dreb: 8, ast: 8, stl: 4, blk: 2, tov: 4, pf: 8, ba: 1, blkAtt: 6, clutchPoints: 5 };
    const avg = perGameAverages(totals);
    expect(avg.ppg).toBe(10);
    expect(avg.apg).toBe(2);
    expect(avg.fgPct).toBeCloseTo(0.5);
  });

  it('every team accumulates stats after a full round robin', () => {
    let league = buildLeague();
    league = simulateRemainingSeason(league, 20);
    for (const t of league.teams) {
      expect(t.seasons.some((s) => (s.seasonStats?.gamesPlayed ?? 0) > 0)).toBe(true);
    }
  });
});

describe('team overall and status', () => {
  it('team overall sum is the sum of every rostered player overall', () => {
    const demo = buildDemoTeam('T', 'Team'); const team = { teamId: demo.teamId, name: demo.label, seasons: demo.seasons };
    const expectedSum = team.seasons.reduce((s, p) => s + calculateOverall(p), 0);
    expect(computeTeamOverallSum(team)).toBe(expectedSum);
    expect(computeTeamOverallAverage(team)).toBeCloseTo(expectedSum / team.seasons.length);
  });

  it('a winning, talented team is classified Contending', () => {
    const demo = buildDemoTeam('T', 'Team'); const team = { teamId: demo.teamId, name: demo.label, seasons: demo.seasons };
    const row = { teamId: 'T', wins: 60, losses: 22, pointsFor: 0, pointsAgainst: 0, pointDiff: 0, winPct: 0.73 };
    for (const s of team.seasons) for (const k of Object.keys(s.attributes.offense) as (keyof typeof s.attributes.offense)[]) s.attributes.offense[k] = 85;
    expect(computeTeamStatus(team, row)).toBe('Contending');
  });

  it('a young, losing team is classified Rebuilding', () => {
    const demo = buildDemoTeam('T', 'Team'); const team = { teamId: demo.teamId, name: demo.label, seasons: demo.seasons };
    for (const s of team.seasons) s.age = 22;
    const row = { teamId: 'T', wins: 20, losses: 62, pointsFor: 0, pointsAgainst: 0, pointDiff: 0, winPct: 0.24 };
    expect(computeTeamStatus(team, row)).toBe('Rebuilding');
  });

  it('a team with no games played yet is Unproven', () => {
    const demo = buildDemoTeam('T', 'Team'); const team = { teamId: demo.teamId, name: demo.label, seasons: demo.seasons };
    const row = { teamId: 'T', wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0, winPct: 0 };
    expect(computeTeamStatus(team, row)).toBe('Unproven');
  });
});

describe('season awards', () => {
  it('only players meeting the games-played threshold are eligible', () => {
    let league = buildLeague();
    league = simulateRemainingSeason(league, 30);
    const awards = computeSeasonAwards(league, { minGames: 5 });
    if (awards.mvp) {
      const winnerTeam = league.teams.find((t) => t.teamId === awards.mvp!.teamId)!;
      const winnerSeason = winnerTeam.seasons.find((s) => s.playerId === awards.mvp!.playerId)!;
      expect(winnerSeason.seasonStats!.gamesPlayed).toBeGreaterThanOrEqual(5);
    }
  });

  it('MVP is not awarded when nobody has played enough games', () => {
    const league = buildLeague();
    const awards = computeSeasonAwards(league, { minGames: 5 });
    expect(awards.mvp).toBeNull();
  });

  it('legacy score increases with more awards won, all else equal', () => {
    let league = buildLeague();
    league = simulateRemainingSeason(league, 40);
    const player = league.teams[0].seasons[0];
    const withNoAwards = computeLegacyScore(player, 0);
    const withAwards = computeLegacyScore(player, 3);
    expect(withAwards).toBeGreaterThan(withNoAwards);
  });
});
