import { describe, it, expect } from 'vitest';
import { renamePlayer, movePlayerToTeam, updateContractDirect, type GMLeagueExtras } from '../simulation/gm';
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
    schedule: [],
    settings: {} as any,
    season: '2026-27',
  };
}

function makeExtras(league: League): GMLeagueExtras {
  const contracts: GMLeagueExtras['contracts'] = {};
  for (const t of league.teams) {
    for (const s of t.seasons) {
      contracts[s.playerId] = { playerId: s.playerId, teamId: t.teamId, annualSalary: 5_000_000, yearsRemaining: 2, playerOption: false, teamOption: false };
    }
  }
  return {
    contracts, freeAgents: [], capSettings: {} as any, draftClass: [], tradeSettings: {} as any,
    draftDayOpen: false, freeAgencyOpen: false, tradeBlock: [], draftPickIndex: 0,
    pendingTradeOffers: [], freeAgencyDaysRemaining: 0,
  };
}

describe('renamePlayer', () => {
  it('renames the player on their roster, rekeys their contract, and logs a history event', () => {
    const league = makeLeague();
    const extras = makeExtras(league);
    const oldId = league.teams[0].seasons[0].playerId;

    const result = renamePlayer(league, extras, oldId, 'Marcus', 'Vance');

    expect(result.newPlayerId).toBe('Marcus Vance');
    const renamed = result.league.teams[0].seasons.find((s) => s.playerId === 'Marcus Vance');
    expect(renamed).toBeTruthy();
    expect(renamed!.firstName).toBe('Marcus');
    expect(renamed!.lastName).toBe('Vance');
    expect(renamed!.history?.some((h) => h.type === 'renamed')).toBe(true);
    expect(result.league.teams[0].seasons.find((s) => s.playerId === oldId)).toBeUndefined();

    // contract rekeyed
    expect(result.extras.contracts['Marcus Vance']).toBeTruthy();
    expect(result.extras.contracts[oldId]).toBeUndefined();
  });

  it('is a no-op when the new name is empty or unchanged', () => {
    const league = makeLeague();
    const extras = makeExtras(league);
    const oldId = league.teams[0].seasons[0].playerId;
    const result = renamePlayer(league, extras, oldId, '', '');
    expect(result.newPlayerId).toBe(oldId);
    expect(result.league).toBe(league);
  });
});

describe('movePlayerToTeam', () => {
  it('moves a player from one roster to another and logs the move', () => {
    const league = makeLeague();
    const extras = makeExtras(league);
    const playerId = league.teams[0].seasons[0].playerId;

    const result = movePlayerToTeam(league, extras, playerId, 'B');

    expect(result.league.teams[0].seasons.some((s) => s.playerId === playerId)).toBe(false);
    const moved = result.league.teams[1].seasons.find((s) => s.playerId === playerId);
    expect(moved).toBeTruthy();
    expect(moved!.teamId).toBe('B');
    expect(moved!.history?.some((h) => h.type === 'moved')).toBe(true);
    expect(result.extras.contracts[playerId]?.teamId).toBe('B');
  });

  it('does nothing if the player is already on the destination team', () => {
    const league = makeLeague();
    const extras = makeExtras(league);
    const playerId = league.teams[0].seasons[0].playerId;
    const result = movePlayerToTeam(league, extras, playerId, 'A');
    expect(result.league).toBe(league);
  });
});

describe('updateContractDirect', () => {
  it('updates salary/years/options and logs a descriptive history event', () => {
    const league = makeLeague();
    const extras = makeExtras(league);
    const playerId = league.teams[0].seasons[0].playerId;

    const result = updateContractDirect(league, extras, playerId, { annualSalary: 20_000_000, yearsRemaining: 4, teamOption: true });

    expect(result.extras.contracts[playerId].annualSalary).toBe(20_000_000);
    expect(result.extras.contracts[playerId].yearsRemaining).toBe(4);
    expect(result.extras.contracts[playerId].teamOption).toBe(true);

    const updated = result.league.teams[0].seasons.find((s) => s.playerId === playerId);
    const lastEvent = updated?.history?.[updated.history.length - 1];
    expect(lastEvent?.type).toBe('resigned');
    expect(lastEvent?.description).toContain('salary');
  });

  it('is a no-op when the player has no existing contract', () => {
    const league = makeLeague();
    const extras = makeExtras(league);
    const result = updateContractDirect(league, extras, 'nobody', { annualSalary: 1 });
    expect(result.extras).toBe(extras);
  });
});
