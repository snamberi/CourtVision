import { describe, it, expect } from 'vitest';
import {
  isTradeDeadlinePassed, canManageTeam, toggleTradeBlock, signFreeAgent, draftProspect, waiveToFreeAgency,
  DEFAULT_CAP_SETTINGS, DEFAULT_TRADE_SETTINGS, DEFAULT_GM_FLAGS, generateDraftClass, type GMLeagueExtras,
} from '../simulation/gm';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { generateRoundRobinSchedule, type League } from '../simulation/league';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';

function fixtureLeague(playedFraction: number): League {
  const teams = ['A', 'B'].map((id) => {
    const demo = buildDemoTeam(id, id);
    return { teamId: demo.teamId, name: demo.label, seasons: demo.seasons };
  });
  const schedule = generateRoundRobinSchedule(['A', 'B'], 20).map((g, i, arr) => ({
    ...g, played: i / arr.length < playedFraction,
  }));
  return { teams, schedule, settings: { ...DEFAULT_GAME_SETTINGS } };
}

describe('trade deadline', () => {
  it('is not passed early in the season', () => {
    expect(isTradeDeadlinePassed(fixtureLeague(0.1))).toBe(false);
  });
  it('is passed once ~65% of games are played', () => {
    expect(isTradeDeadlinePassed(fixtureLeague(0.9))).toBe(true);
  });
  it('an empty schedule is never past the deadline', () => {
    expect(isTradeDeadlinePassed({ teams: [], schedule: [], settings: { ...DEFAULT_GAME_SETTINGS } })).toBe(false);
  });
});

describe('controlled-team restriction', () => {
  it('allows everything when no team is controlled (sandbox)', () => {
    expect(canManageTeam(null, 'ANY_TEAM')).toBe(true);
  });
  it('only allows managing the controlled team', () => {
    expect(canManageTeam('A', 'A')).toBe(true);
    expect(canManageTeam('A', 'B')).toBe(false);
  });

  it('waiveToFreeAgency refuses to waive a player from a team you do not control', () => {
    const league = fixtureLeague(0);
    const extras: GMLeagueExtras = { contracts: {}, freeAgents: [], capSettings: { ...DEFAULT_CAP_SETTINGS, minRosterSize: 0, maxRosterSize: 99 }, draftClass: [], tradeSettings: { ...DEFAULT_TRADE_SETTINGS }, ...DEFAULT_GM_FLAGS };
    const targetPlayer = league.teams[1].seasons[0].playerId;
    const result = waiveToFreeAgency(league, extras, targetPlayer, 'B', 'A');
    expect(result.league.teams[1].seasons.some((s) => s.playerId === targetPlayer)).toBe(true);
  });

  it('waiveToFreeAgency succeeds when the requesting team matches', () => {
    const league = fixtureLeague(0);
    const extras: GMLeagueExtras = { contracts: {}, freeAgents: [], capSettings: { ...DEFAULT_CAP_SETTINGS, minRosterSize: 0, maxRosterSize: 99 }, draftClass: [], tradeSettings: { ...DEFAULT_TRADE_SETTINGS }, ...DEFAULT_GM_FLAGS };
    const targetPlayer = league.teams[0].seasons[0].playerId;
    const result = waiveToFreeAgency(league, extras, targetPlayer, 'A', 'A');
    expect(result.league.teams[0].seasons.some((s) => s.playerId === targetPlayer)).toBe(false);
  });
});

describe('draft day gating', () => {
  it('draftProspect does nothing while draftDayOpen is false', () => {
    const league = fixtureLeague(0);
    const draftClass = generateDraftClass(3, 1, '2027');
    const extras: GMLeagueExtras = { contracts: {}, freeAgents: [], capSettings: { ...DEFAULT_CAP_SETTINGS, minRosterSize: 0, maxRosterSize: 99 }, draftClass, tradeSettings: { ...DEFAULT_TRADE_SETTINGS }, draftDayOpen: false, freeAgencyOpen: false, tradeBlock: [], draftPickIndex: 0, pendingTradeOffers: [], freeAgencyDaysRemaining: 0 };
    const result = draftProspect(league, extras, draftClass[0].playerId, 'A');
    expect(result.extras.draftClass.length).toBe(3);
  });

  it('draftProspect works once draftDayOpen is true', () => {
    const league = fixtureLeague(0);
    const draftClass = generateDraftClass(3, 1, '2027');
    const extras: GMLeagueExtras = { contracts: {}, freeAgents: [], capSettings: { ...DEFAULT_CAP_SETTINGS, minRosterSize: 0, maxRosterSize: 99 }, draftClass, tradeSettings: { ...DEFAULT_TRADE_SETTINGS }, draftDayOpen: true, freeAgencyOpen: false, tradeBlock: [], draftPickIndex: 0, pendingTradeOffers: [], freeAgencyDaysRemaining: 0 };
    const result = draftProspect(league, extras, draftClass[0].playerId, 'A');
    expect(result.extras.draftClass.length).toBe(2);
  });
});

describe('free agency window', () => {
  it('signFreeAgent does nothing while freeAgencyOpen is false', () => {
    const league = fixtureLeague(0);
    const freeAgent = buildDemoTeam('FA', 'FA').seasons[0];
    const extras: GMLeagueExtras = { contracts: {}, freeAgents: [freeAgent], capSettings: { ...DEFAULT_CAP_SETTINGS, minRosterSize: 0, maxRosterSize: 99 }, draftClass: [], tradeSettings: { ...DEFAULT_TRADE_SETTINGS }, draftDayOpen: false, freeAgencyOpen: false, tradeBlock: [], draftPickIndex: 0, pendingTradeOffers: [], freeAgencyDaysRemaining: 0 };
    const result = signFreeAgent(league, extras, freeAgent.playerId, 'A', { annualSalary: 1, yearsRemaining: 1, playerOption: false, teamOption: false });
    expect(result.extras.freeAgents.length).toBe(1);
  });

  it('signFreeAgent works once freeAgencyOpen is true', () => {
    const league = fixtureLeague(0);
    const freeAgent = buildDemoTeam('FA', 'FA').seasons[0];
    const extras: GMLeagueExtras = { contracts: {}, freeAgents: [freeAgent], capSettings: { ...DEFAULT_CAP_SETTINGS, minRosterSize: 0, maxRosterSize: 99 }, draftClass: [], tradeSettings: { ...DEFAULT_TRADE_SETTINGS }, draftDayOpen: false, freeAgencyOpen: true, tradeBlock: [], draftPickIndex: 0, pendingTradeOffers: [], freeAgencyDaysRemaining: 0 };
    const result = signFreeAgent(league, extras, freeAgent.playerId, 'A', { annualSalary: 1, yearsRemaining: 1, playerOption: false, teamOption: false });
    expect(result.extras.freeAgents.length).toBe(0);
  });
});

describe('trade block', () => {
  it('toggles a player onto and back off the trade block', () => {
    const extras: GMLeagueExtras = { contracts: {}, freeAgents: [], capSettings: { ...DEFAULT_CAP_SETTINGS, minRosterSize: 0, maxRosterSize: 99 }, draftClass: [], tradeSettings: { ...DEFAULT_TRADE_SETTINGS }, ...DEFAULT_GM_FLAGS };
    const after1 = toggleTradeBlock(extras, 'player1');
    expect(after1.tradeBlock).toContain('player1');
    const after2 = toggleTradeBlock(after1, 'player1');
    expect(after2.tradeBlock).not.toContain('player1');
  });
});
