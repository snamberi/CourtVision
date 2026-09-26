import { describe, it, expect } from 'vitest';
import { careerSummary, careerYearRows, computeAdvancedStats } from '../simulation/careerStats';
import { emptySeasonStatTotals, emptySeasonMilestones, type PlayerSeason, type CareerSeasonRecord } from '../simulation/types';
import { emptyStatLine } from '../simulation/boxscore';
import { applyGameResultToLeague } from '../simulation/careerStats';
import type { League } from '../simulation/league';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';

function line(overrides: Partial<ReturnType<typeof emptyStatLine>>) {
  return { ...emptyStatLine('p'), minutes: 30, ...overrides };
}

describe('double/triple/quad/quint-double counting', () => {
  it('counts a 10/10 game as exactly a double-double, not a triple-double', () => {
    const homeTeamId = 'H';
    const league: League = { teams: [{ teamId: homeTeamId, name: 'H', seasons: [minimalSeason('p', homeTeamId)] }], schedule: [], settings: {} as any };
    const result = {
      homeTeamId, awayTeamId: 'A', homeScore: 1, awayScore: 0,
      homeBox: { players: { p: line({ points: 10, oreb: 4, dreb: 6, ast: 2 }) } },
      awayBox: { players: {} },
      possessionLog: [], injuries: [],
    } as any;
    const next = applyGameResultToLeague(league, result);
    const p = next.teams[0].seasons[0];
    expect(p.seasonMilestones!.doubleDoubles).toBe(1);
    expect(p.seasonMilestones!.tripleDoubles).toBe(0);
  });

  it('counts a 10/10/10 game as both a double-double and a triple-double (cumulative convention)', () => {
    const league: League = { teams: [{ teamId: 'H', name: 'H', seasons: [minimalSeason('p', 'H')] }], schedule: [], settings: {} as any };
    const result = {
      homeTeamId: 'H', awayTeamId: 'A', homeScore: 1, awayScore: 0,
      homeBox: { players: { p: line({ points: 10, oreb: 4, dreb: 6, ast: 10 }) } },
      awayBox: { players: {} },
      possessionLog: [], injuries: [],
    } as any;
    const next = applyGameResultToLeague(league, result);
    const p = next.teams[0].seasons[0];
    expect(p.seasonMilestones!.doubleDoubles).toBe(1);
    expect(p.seasonMilestones!.tripleDoubles).toBe(1);
    expect(p.seasonMilestones!.quadrupleDoubles).toBe(0);
  });

  it('counts a full 5x5 game as a quintuple-double AND every lower threshold', () => {
    const league: League = { teams: [{ teamId: 'H', name: 'H', seasons: [minimalSeason('p', 'H')] }], schedule: [], settings: {} as any };
    const result = {
      homeTeamId: 'H', awayTeamId: 'A', homeScore: 1, awayScore: 0,
      homeBox: { players: { p: line({ points: 10, oreb: 5, dreb: 5, ast: 10, stl: 10, blk: 10 }) } },
      awayBox: { players: {} },
      possessionLog: [], injuries: [],
    } as any;
    const next = applyGameResultToLeague(league, result);
    const m = next.teams[0].seasons[0].seasonMilestones!;
    expect(m.doubleDoubles).toBe(1);
    expect(m.tripleDoubles).toBe(1);
    expect(m.quadrupleDoubles).toBe(1);
    expect(m.quintupleDoubles).toBe(1);
  });

  it('does not credit a milestone or a game to a player who did not play (0 minutes)', () => {
    const league: League = { teams: [{ teamId: 'H', name: 'H', seasons: [minimalSeason('p', 'H')] }], schedule: [], settings: {} as any };
    const result = {
      homeTeamId: 'H', awayTeamId: 'A', homeScore: 1, awayScore: 0,
      homeBox: { players: { p: { ...line({ points: 30 }), minutes: 0 } } },
      awayBox: { players: {} },
      possessionLog: [], injuries: [],
    } as any;
    const next = applyGameResultToLeague(league, result);
    const p = next.teams[0].seasons[0];
    expect(p.seasonStats!.gamesPlayed).toBe(0);
    expect(p.seasonMilestones!.doubleDoubles).toBe(0);
  });
});

describe('career rollups computed from totals, not averaged season-of-averages', () => {
  it('career PPG matches sum(points)/sum(games), not the mean of each season PPG', () => {
    const season: PlayerSeason = {
      ...minimalSeason('star', 'H'),
      seasonStats: { ...emptySeasonStatTotals(), gamesPlayed: 5, points: 150, minutes: 150 }, // 30 ppg this (short) season
      seasonMilestones: emptySeasonMilestones(),
      careerHistory: [
        {
          season: '2024-25', teamId: 'H', age: 24, overall: 80,
          stats: { ...emptySeasonStatTotals(), gamesPlayed: 80, points: 800, minutes: 2000 }, // 10 ppg over a full season
          milestones: emptySeasonMilestones(),
        } as CareerSeasonRecord,
      ],
    };
    const summary = careerSummary(season);
    // naive average-of-averages would give (30+10)/2 = 20 ppg — wrong, since it ignores sample size.
    // correct: (150+800) / (5+80) = 950/85 ≈ 11.18 ppg
    expect(summary.perGame.ppg).toBeCloseTo(950 / 85, 2);
    expect(summary.perGame.ppg).not.toBeCloseTo(20, 0);
    expect(summary.seasonsPlayed).toBe(2);
  });

  it('careerYearRows includes every archived season plus the in-progress current season', () => {
    const season: PlayerSeason = {
      ...minimalSeason('star', 'H'),
      seasonStats: { ...emptySeasonStatTotals(), gamesPlayed: 3, points: 60 },
      seasonMilestones: emptySeasonMilestones(),
      careerHistory: [
        { season: '2024-25', teamId: 'H', age: 24, overall: 80, stats: { ...emptySeasonStatTotals(), gamesPlayed: 80, points: 800 }, milestones: emptySeasonMilestones() },
      ],
    };
    const rows = careerYearRows(season);
    expect(rows.length).toBe(2);
    expect(rows[rows.length - 1].isCurrent).toBe(true);
  });

  it('advanced stats compute sane values (eFG% >= FG%, block success rate between 0 and 1)', () => {
    const totals = { ...emptySeasonStatTotals(), fga: 100, fgm: 45, tpa: 30, tpm: 15, blk: 20, blkAtt: 80 };
    const adv = computeAdvancedStats(totals);
    expect(adv.efgPct).toBeGreaterThanOrEqual(adv.efgPct >= 0.45 ? 0.45 : 0); // sanity: eFG should exceed raw FG% given made threes
    expect(adv.efgPct).toBeGreaterThan(0.45);
    expect(adv.blockSuccessPct).toBe(0.25);
  });
});

function minimalSeason(playerId: string, teamId: string): PlayerSeason {
  const demo = buildDemoTeam(teamId, teamId);
  return { ...demo.seasons[0], playerId, teamId };
}
