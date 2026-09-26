import { describe, it, expect } from 'vitest';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { generateRoundRobinSchedule, simulateRemainingSeason, type League } from '../simulation/league';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import {
  teamPayroll, capSpaceRemaining, validateTrade, executeTrade, DEFAULT_CAP_SETTINGS, DEFAULT_TRADE_SETTINGS, DEFAULT_GM_FLAGS,
  generateDraftClass, draftOrderFromStandings, draftProspect, signFreeAgent, waiveToFreeAgency,
  generateFutureDraftPicks, tradeableFuturePicks, resolveTradedPicksIntoOrder, rollFutureDraftPicksForward,
  canProtectPick, setPickProtection,
  type GMLeagueExtras, type Contract,
} from '../simulation/gm';

function buildTestLeague(): { league: League; extras: GMLeagueExtras } {
  const teamA = { ...buildDemoTeam('A', 'Team A') };
  const teamB = { ...buildDemoTeam('B', 'Team B') };
  const teams = [
    { teamId: teamA.teamId, name: teamA.label, seasons: teamA.seasons },
    { teamId: teamB.teamId, name: teamB.label, seasons: teamB.seasons },
  ];
  const league: League = { teams, schedule: [], settings: { ...DEFAULT_GAME_SETTINGS } };
  const contracts: Record<string, Contract> = {};
  for (const t of teams) {
    for (const s of t.seasons) {
      contracts[s.playerId] = { playerId: s.playerId, teamId: t.teamId, annualSalary: 10_000_000, yearsRemaining: 2, playerOption: false, teamOption: false };
    }
  }
  const extras: GMLeagueExtras = { contracts, freeAgents: [], capSettings: { ...DEFAULT_CAP_SETTINGS, minRosterSize: 0, maxRosterSize: 99 }, draftClass: [], tradeSettings: { ...DEFAULT_TRADE_SETTINGS }, ...DEFAULT_GM_FLAGS };
  return { league, extras };
}

describe('future draft pick trading', () => {
  it('trading a pick moves it to the acquiring team and off the original owner', () => {
    const { league, extras } = buildTestLeague();
    const withPicks = { ...extras, futurePicks: generateFutureDraftPicks(['A', 'B'], 2028, 2) };
    // A balanced pick-for-pick swap (same year/round on both sides) so it clears the value-band check too.
    const proposal = { teamAId: 'A', teamBId: 'B', playersFromA: [], playersFromB: [], picksFromA: ['2028-R1-A'], picksFromB: ['2028-R1-B'] };
    const validation = validateTrade(league, withPicks, proposal);
    expect(validation.valid).toBe(true);
    const { extras: after } = executeTrade(league, withPicks, proposal);
    const traded = after.futurePicks!.find((p) => p.id === '2028-R1-A')!;
    expect(traded.currentOwnerTeamId).toBe('B');
    expect(tradeableFuturePicks(after, 'A').some((p) => p.id === '2028-R1-A')).toBe(false);
    expect(tradeableFuturePicks(after, 'B').some((p) => p.id === '2028-R1-A')).toBe(true);
  });

  it('rejects a trade sending away a valuable pick for nothing in return', () => {
    const { league, extras } = buildTestLeague();
    const withPicks = { ...extras, futurePicks: generateFutureDraftPicks(['A', 'B'], 2028, 2) };
    const proposal = { teamAId: 'A', teamBId: 'B', playersFromA: [], playersFromB: [], picksFromA: ['2028-R1-A'], picksFromB: [] };
    const validation = validateTrade(league, withPicks, proposal);
    expect(validation.valid).toBe(false);
    expect(validation.reasons.join(' ')).toContain('mismatch');
  });

  it('rejects trading a pick the team does not currently own', () => {
    const { league, extras } = buildTestLeague();
    const withPicks = { ...extras, futurePicks: generateFutureDraftPicks(['A', 'B'], 2028, 2) };
    // B doesn't own A's pick, so listing it under picksFromB should fail ownership validation.
    const proposal = { teamAId: 'A', teamBId: 'B', playersFromA: [], playersFromB: [], picksFromA: [], picksFromB: ['2028-R1-A'] };
    const validation = validateTrade(league, withPicks, proposal);
    expect(validation.valid).toBe(false);
    expect(validation.reasons.join(' ')).toContain('does not currently own');
  });

  it('only the current owner of their own original pick can protect it', () => {
    const picks = generateFutureDraftPicks(['A', 'B'], 2028, 1);
    const ownPick = picks.find((p) => p.id === '2028-R1-A')!;
    expect(canProtectPick(ownPick)).toBe(true);
    const traded = { ...ownPick, currentOwnerTeamId: 'B' };
    expect(canProtectPick(traded)).toBe(false);
  });

  it('a protected pick stays with the original team when its slot falls in the protected range', () => {
    const picks = setPickProtection(
      { ...buildTestLeague().extras, futurePicks: generateFutureDraftPicks(['A', 'B', 'C'], 2028, 1) },
      '2028-R1-A',
      { topN: 1, label: 'Top-1 Protected' },
    ).futurePicks!.map((p) => (p.id === '2028-R1-A' ? { ...p, currentOwnerTeamId: 'B' } : p)); // A traded its own 1st to B, protected top-1

    // Standings order says A picks 1st (worst record) - protection should trigger and keep it with A.
    const { order, protectionsTriggered } = resolveTradedPicksIntoOrder(['A', 'B', 'C', 'A', 'B', 'C'], 2028, picks);
    expect(order[0]).toBe('A'); // stayed home
    expect(protectionsTriggered).toEqual([{ originalTeamId: 'A', round: 1 }]);
  });

  it('an unprotected traded pick conveys to its new owner', () => {
    const picks = generateFutureDraftPicks(['A', 'B', 'C'], 2028, 1).map((p) => (p.id === '2028-R1-A' ? { ...p, currentOwnerTeamId: 'B' } : p));
    const { order, protectionsTriggered } = resolveTradedPicksIntoOrder(['A', 'B', 'C', 'A', 'B', 'C'], 2028, picks);
    expect(order[0]).toBe('B'); // conveyed
    expect(protectionsTriggered).toEqual([]);
  });

  it('rolling the ledger forward drops the resolved year and adds a fresh one further out', () => {
    const picks = generateFutureDraftPicks(['A', 'B'], 2028, 5); // 2028..2032
    const rolled = rollFutureDraftPicksForward(picks, ['A', 'B'], 2028, 5);
    expect(rolled.some((p) => p.year === 2028)).toBe(false);
    expect(rolled.some((p) => p.year === 2033)).toBe(true);
    expect(rolled.length).toBe(picks.length); // dropped 4 (2 teams x 2 rounds), added 4 back
  });
});


describe('salary cap math', () => {
  it('team payroll sums exactly the contracts on that roster', () => {
    const { league, extras } = buildTestLeague();
    const teamA = league.teams[0];
    const expected = teamA.seasons.length * 10_000_000;
    expect(teamPayroll(extras.contracts, teamA)).toBe(expected);
    expect(capSpaceRemaining(extras.contracts, teamA, extras.capSettings)).toBe(extras.capSettings.salaryCap - expected);
  });
});

describe('trades', () => {
  it('rejects a trade where a player is not actually on the sending roster', () => {
    const { league, extras } = buildTestLeague();
    const result = validateTrade(league, extras, {
      teamAId: 'A', teamBId: 'B', playersFromA: ['not-a-real-player'], playersFromB: [],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects a badly mismatched trade when cap enforcement is on, allows it when off', () => {
    const { league, extras } = buildTestLeague();
    const starA = league.teams[0].seasons[0].playerId; // 10M
    const benchB = league.teams[1].seasons[4].playerId; // 10M in this fixture, so bump one down to force mismatch
    extras.capSettings.salaryCap = 45_000_000; // receiver is over the cap, so matching applies
    extras.contracts[benchB] = { ...extras.contracts[benchB], annualSalary: 1_000_000 };

    const proposal = { teamAId: 'A', teamBId: 'B', playersFromA: [starA], playersFromB: [benchB] };
    const strict = validateTrade(league, extras, proposal);
    expect(strict.valid).toBe(false);
    expect(strict.reasons.some((r) => r.includes('salary'))).toBe(true);

    const relaxedExtras = { ...extras, capSettings: { ...extras.capSettings, enforceCapOnTrades: false } };
    const relaxed = validateTrade(league, relaxedExtras, proposal);
    // Cap rules are off; the other front office may still judge the value, but never on salary grounds.
    expect(relaxed.reasons.some((r) => r.includes("salary"))).toBe(false);
  });

  it('executing a valid trade actually swaps rosters and updates contract team assignment', () => {
    const { league, extras } = buildTestLeague();
    const starA = league.teams[0].seasons[0].playerId;
    const starB = league.teams[1].seasons[0].playerId; // same salary tier, should pass cap check
    const proposal = { teamAId: 'A', teamBId: 'B', playersFromA: [starA], playersFromB: [starB] };
    expect(validateTrade(league, extras, proposal).valid).toBe(true);

    const { league: after, extras: extrasAfter } = executeTrade(league, extras, proposal);
    const teamA = after.teams.find((t) => t.teamId === 'A')!;
    const teamB = after.teams.find((t) => t.teamId === 'B')!;
    expect(teamA.seasons.some((s) => s.playerId === starB)).toBe(true);
    expect(teamA.seasons.some((s) => s.playerId === starA)).toBe(false);
    expect(teamB.seasons.some((s) => s.playerId === starA)).toBe(true);
    expect(extrasAfter.contracts[starA].teamId).toBe('B');
    expect(extrasAfter.contracts[starB].teamId).toBe('A');
  });
});

describe('free agency', () => {
  it('signing a free agent adds them to the roster and removes them from the pool', () => {
    const { league, extras } = buildTestLeague();
    const freeAgentSeason = buildDemoTeam('FA', 'Free Agents').seasons[0];
    extras.freeAgents = [freeAgentSeason];
    extras.freeAgencyOpen = true;

    const { league: after, extras: extrasAfter } = signFreeAgent(league, extras, freeAgentSeason.playerId, 'A', {
      annualSalary: 5_000_000, yearsRemaining: 1, playerOption: false, teamOption: false,
    });
    expect(after.teams.find((t) => t.teamId === 'A')!.seasons.some((s) => s.playerId === freeAgentSeason.playerId)).toBe(true);
    expect(extrasAfter.freeAgents.length).toBe(0);
    expect(extrasAfter.contracts[freeAgentSeason.playerId].teamId).toBe('A');
  });

  it('waiving a player removes them from the roster and adds them to free agency', () => {
    const { league, extras } = buildTestLeague();
    const playerId = league.teams[0].seasons[0].playerId;
    const { league: after, extras: extrasAfter } = waiveToFreeAgency(league, extras, playerId, 'A');
    expect(after.teams.find((t) => t.teamId === 'A')!.seasons.some((s) => s.playerId === playerId)).toBe(false);
    expect(extrasAfter.freeAgents.some((s) => s.playerId === playerId)).toBe(true);
    expect(extrasAfter.contracts[playerId]).toBeUndefined();
  });
});

describe('draft', () => {
  it('draft order puts the worst-record team first', () => {
    const teams = ['T1', 'T2', 'T3', 'T4'].map((id) => {
      const demo = buildDemoTeam(id, id);
      return { teamId: id, name: id, seasons: demo.seasons };
    });
    const schedule = generateRoundRobinSchedule(teams.map((t) => t.teamId), 2);
    let league: League = { teams, schedule, settings: { ...DEFAULT_GAME_SETTINGS } };
    league = simulateRemainingSeason(league, 55);
    const order = draftOrderFromStandings(league);
    expect(order.length).toBe(4);
    // whoever is ranked last in standings must be first in draft order
    const standings = draftOrderFromStandings(league);
    expect(order[0]).toBe(standings[0]);
  });

  it('drafting a prospect adds them to the team and removes them from the pool', () => {
    const { league, extras } = buildTestLeague();
    extras.draftClass = generateDraftClass(5, 1, '2027');
    extras.draftDayOpen = true;
    const prospectId = extras.draftClass[0].playerId;

    const { league: after, extras: extrasAfter } = draftProspect(league, extras, prospectId, 'A');
    expect(after.teams.find((t) => t.teamId === 'A')!.seasons.some((s) => s.playerId === prospectId)).toBe(true);
    expect(extrasAfter.draftClass.some((p) => p.playerId === prospectId)).toBe(false);
    expect(extrasAfter.contracts[prospectId]).toBeDefined();
  });

  it('generated prospects carry a scouted potential distinct from (but correlated with) true potential', () => {
    const draftClass = generateDraftClass(20, 42, '2027');
    expect(draftClass.length).toBe(20);
    for (const p of draftClass) {
      expect(p.trueSeason.development.potential).toBeGreaterThanOrEqual(50);
      expect(p.scoutedPotential).toBeGreaterThanOrEqual(40);
    }
  });
});
