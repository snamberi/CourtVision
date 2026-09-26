import { describe, it, expect } from 'vitest';
import { signFreeAgent, priorTeamId, computeAskingSalary, waiveToFreeAgency, DEFAULT_CAP_SETTINGS, type GMLeagueExtras } from '../simulation/gm';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import type { League } from '../simulation/league';

function makeLeague(): League {
  const teamA = buildDemoTeam('A', 'Alpha');
  const teamB = buildDemoTeam('B', 'Beta');
  return {
    teams: [
      { teamId: 'A', name: 'Alpha', seasons: teamA.seasons },
      { teamId: 'B', name: 'Beta', seasons: teamB.seasons },
    ],
    schedule: [], settings: {} as any, season: '2026-27',
  };
}

function makeExtras(): GMLeagueExtras {
  return {
    contracts: {}, freeAgents: [], capSettings: { ...DEFAULT_CAP_SETTINGS, minRosterSize: 0, maxRosterSize: 99 }, draftClass: [], tradeSettings: {} as any,
    draftDayOpen: false, freeAgencyOpen: false, tradeBlock: [], draftPickIndex: 0,
    pendingTradeOffers: [], freeAgencyDaysRemaining: 0,
  };
}

describe('exclusive re-signing window', () => {
  it('lets a team re-sign its own recently-waived player even while free agency is closed', () => {
    const league = makeLeague();
    const extras = makeExtras();
    const playerId = league.teams[0].seasons[0].playerId;

    const waived = waiveToFreeAgency(league, extras, playerId, 'A');
    expect(waived.extras.freeAgencyOpen).toBe(false);
    expect(priorTeamId(waived.extras.freeAgents[0])).toBe('A');

    const resigned = signFreeAgent(waived.league, waived.extras, playerId, 'A', {
      annualSalary: 5_000_000, yearsRemaining: 2, playerOption: false, teamOption: false,
    });
    expect(resigned.league.teams[0].seasons.some((s) => s.playerId === playerId)).toBe(true);
    expect(resigned.extras.contracts[playerId]?.teamId).toBe('A');
  });

  it('blocks signing someone else\'s free agent while the general market is still closed', () => {
    const league = makeLeague();
    const extras = makeExtras();
    const playerId = league.teams[0].seasons[0].playerId;

    const waived = waiveToFreeAgency(league, extras, playerId, 'A');
    // Team B has no prior relationship with this player and free agency is closed — should be a no-op.
    const attempted = signFreeAgent(waived.league, waived.extras, playerId, 'B', {
      annualSalary: 5_000_000, yearsRemaining: 2, playerOption: false, teamOption: false,
    });
    expect(attempted.league.teams[1].seasons.some((s) => s.playerId === playerId)).toBe(false);
    expect(attempted.extras.freeAgents.some((s) => s.playerId === playerId)).toBe(true);
  });

  it('allows any team to sign anyone once free agency is open', () => {
    const league = makeLeague();
    const extras = { ...makeExtras(), freeAgencyOpen: true };
    const playerId = league.teams[0].seasons[0].playerId;
    const waived = waiveToFreeAgency(league, extras, playerId, 'A');
    const signed = signFreeAgent(waived.league, { ...waived.extras, freeAgencyOpen: true }, playerId, 'B', {
      annualSalary: 5_000_000, yearsRemaining: 2, playerOption: false, teamOption: false,
    });
    expect(signed.league.teams[1].seasons.some((s) => s.playerId === playerId)).toBe(true);
  });
});

describe('computeAskingSalary', () => {
  it('scales between the league minimum and a max contract based on overall rating', () => {
    const low = computeAskingSalary(45, DEFAULT_CAP_SETTINGS);
    const high = computeAskingSalary(95, DEFAULT_CAP_SETTINGS);
    expect(low).toBeGreaterThanOrEqual(DEFAULT_CAP_SETTINGS.minSalary);
    expect(high).toBeLessThanOrEqual(DEFAULT_CAP_SETTINGS.salaryCap * DEFAULT_CAP_SETTINGS.maxSalaryPctOfCap);
    expect(high).toBeGreaterThan(low);
  });
});
