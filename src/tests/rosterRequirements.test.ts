import { describe, it, expect } from 'vitest';
import { rosterComplianceIssues, isLeagueRosterCompliant, describeRosterIssue } from '../simulation/rosterRequirements';
import { DEFAULT_CAP_SETTINGS, DEFAULT_GM_FLAGS, validateTrade, type GMLeagueExtras } from '../simulation/gm';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import type { League } from '../simulation/league';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';

function leagueWithRosterSizes(sizes: number[]): League {
  const teams = sizes.map((n, i) => {
    const demo = buildDemoTeam(`T${i}`, `Team ${i}`);
    const seasons = Array.from({ length: n }, (_, j) => demo.seasons[j % demo.seasons.length]);
    return { teamId: `T${i}`, name: `Team ${i}`, seasons };
  });
  return { teams, schedule: [], settings: { ...DEFAULT_GAME_SETTINGS } };
}

describe('rosterComplianceIssues', () => {
  it('flags nothing when every roster is within the window', () => {
    const league = leagueWithRosterSizes([12, 13, 15]);
    expect(rosterComplianceIssues(league, DEFAULT_CAP_SETTINGS)).toEqual([]);
    expect(isLeagueRosterCompliant(league, DEFAULT_CAP_SETTINGS)).toBe(true);
  });

  it('flags a team below the minimum', () => {
    const league = leagueWithRosterSizes([9, 12]);
    const issues = rosterComplianceIssues(league, DEFAULT_CAP_SETTINGS);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ teamId: 'T0', kind: 'under', count: 9, min: 10 });
    expect(describeRosterIssue(issues[0])).toContain('minimum 10');
    expect(isLeagueRosterCompliant(league, DEFAULT_CAP_SETTINGS)).toBe(false);
  });

  it('flags a team above the maximum', () => {
    const league = leagueWithRosterSizes([12, 19]);
    const issues = rosterComplianceIssues(league, DEFAULT_CAP_SETTINGS);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ teamId: 'T1', kind: 'over', count: 19, max: 18 });
    expect(describeRosterIssue(issues[0])).toContain('maximum 18');
  });

  it('can flag multiple teams at once', () => {
    const league = leagueWithRosterSizes([9, 12, 20]);
    expect(rosterComplianceIssues(league, DEFAULT_CAP_SETTINGS).map((i) => i.teamId)).toEqual(['T0', 'T2']);
  });
});

describe('validateTrade roster-size gate', () => {
  it('rejects a trade that would push either side below the minimum', () => {
    const teamA = buildDemoTeam('A', 'Team A'); // 5 players
    const teamB = buildDemoTeam('B', 'Team B');
    const league: League = {
      teams: [
        { teamId: 'A', name: 'Team A', seasons: teamA.seasons },
        { teamId: 'B', name: 'Team B', seasons: teamB.seasons },
      ],
      schedule: [], settings: { ...DEFAULT_GAME_SETTINGS },
    };
    const extras: GMLeagueExtras = {
      contracts: {}, freeAgents: [], draftClass: [],
      capSettings: { ...DEFAULT_CAP_SETTINGS, enforceCapOnTrades: false, minRosterSize: 4, maxRosterSize: 6 },
      tradeSettings: { difficulty: 'easy' },
      ...DEFAULT_GM_FLAGS,
    };
    // A sends 2 for 1: A drops to 4 (fine), B rises to 6 (fine) — should be legal on headcount grounds.
    const evenish = validateTrade(league, extras, {
      teamAId: 'A', teamBId: 'B',
      playersFromA: [teamA.seasons[0].playerId, teamA.seasons[1].playerId],
      playersFromB: [teamB.seasons[0].playerId],
    });
    expect(evenish.reasons.some((r) => r.includes('minimum') || r.includes('maximum'))).toBe(false);

    // A sends 3 away for nothing back: A would drop to 2, below the 4-player minimum.
    const tooFew = validateTrade(league, extras, {
      teamAId: 'A', teamBId: 'B',
      playersFromA: [teamA.seasons[0].playerId, teamA.seasons[1].playerId, teamA.seasons[2].playerId],
      playersFromB: [],
    });
    expect(tooFew.valid).toBe(false);
    expect(tooFew.reasons.some((r) => r.includes('below the 4-player minimum'))).toBe(true);
  });

  it('rejects a trade that would push either side above the maximum', () => {
    const teamA = buildDemoTeam('A', 'Team A');
    const teamB = buildDemoTeam('B', 'Team B');
    const league: League = {
      teams: [
        { teamId: 'A', name: 'Team A', seasons: teamA.seasons },
        { teamId: 'B', name: 'Team B', seasons: teamB.seasons },
      ],
      schedule: [], settings: { ...DEFAULT_GAME_SETTINGS },
    };
    const extras: GMLeagueExtras = {
      contracts: {}, freeAgents: [], draftClass: [],
      capSettings: { ...DEFAULT_CAP_SETTINGS, enforceCapOnTrades: false, minRosterSize: 1, maxRosterSize: 5 },
      tradeSettings: { difficulty: 'easy' },
      ...DEFAULT_GM_FLAGS,
    };
    // B sends nothing, receives 1: B would rise to 6, above the 5-player maximum.
    const tooMany = validateTrade(league, extras, {
      teamAId: 'A', teamBId: 'B', playersFromA: [teamA.seasons[0].playerId], playersFromB: [],
    });
    expect(tooMany.valid).toBe(false);
    expect(tooMany.reasons.some((r) => r.includes('above the 5-player maximum'))).toBe(true);
  });
});
