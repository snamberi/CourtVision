import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { signingDecision, signFreeAgentChecked, strengthRanking, STAR_FREE_AGENT } from '../simulation/freeAgentDecision';
import { autoSignForControlledTeam } from '../simulation/autoPlay';
import { waiveToFreeAgency, type GMLeagueExtras } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { appendHistoryEvent } from '../simulation/playerHistory';
import type { League } from '../simulation/league';
import type { PlayerSeason } from '../simulation/types';

const setup = (): { league: League; extras: GMLeagueExtras } => {
  const { league, extras } = generateFullLeague(131, 8, 13, 10, '2026', { priorSeasons: false });
  return { league: { ...league, seasonPhase: 'free_agency' as const }, extras: { ...extras, freeAgencyOpen: true, capSettings: { ...extras.capSettings, minRosterSize: 0, maxRosterSize: 99 } } };
};
const asFreeAgent = (league: League, extras: GMLeagueExtras, p: PlayerSeason, fromTeam: string): { league: League; extras: GMLeagueExtras } => {
  const moved = appendHistoryEvent({ ...p, teamId: null }, 'waived', 'test', fromTeam);
  return { league: { ...league, teams: league.teams.map(t => ({ ...t, seasons: t.seasons.filter(s => s.playerId !== p.playerId) })) }, extras: { ...extras, freeAgents: [...extras.freeAgents, moved] } };
};

describe('one set of signing rules for every path', () => {
  it('market: a star refuses the best team and the refusal holds everywhere', () => {
    let { league, extras } = setup();
    const best = strengthRanking(league)[0];
    const other = league.teams.find(t => t.teamId !== best)!;
    const star = { ...other.seasons[0], attributes: JSON.parse(JSON.stringify(other.seasons[0].attributes)) } as PlayerSeason;
    for (const g of ['offense', 'defense', 'mental'] as const) for (const k of Object.keys(star.attributes[g])) (star.attributes[g] as unknown as Record<string, number>)[k] = 95;
    expect(calculateOverall(star)).toBeGreaterThanOrEqual(STAR_FREE_AGENT);
    ({ league, extras } = asFreeAgent(league, extras, star, other.teamId));
    const r = signFreeAgentChecked(league, extras, star.playerId, best, { annualSalary: extras.capSettings.salaryCap, yearsRemaining: 2, playerOption: false, teamOption: false });
    expect(r.decision.refuses).toBe(true);
    expect(r.league).toBe(league);
  });

  it('market: a willing player still needs cap room, except for a minimum deal', () => {
    let { league, extras } = setup();
    const team = league.teams[0];
    const donor = league.teams[1].seasons.at(-1)!;
    ({ league, extras } = asFreeAgent(league, extras, donor, league.teams[1].teamId));
    const broke = { ...extras, capSettings: { ...extras.capSettings, salaryCap: 1 } };
    const quote = signingDecision(league, broke, extras.freeAgents.at(-1)!, team.teamId);
    if (quote.refuses) return;
    const big = signingDecision(league, broke, extras.freeAgents.at(-1)!, team.teamId, { annualSalary: Math.max(quote.required, broke.capSettings.minSalary * 3), yearsRemaining: 1 });
    expect(big.accepted).toBe(false);
    expect(big.reason).toMatch(/cap space/);
    const minDeal = signingDecision(league, { ...broke, capSettings: { ...broke.capSettings, minSalary: Math.max(quote.required, broke.capSettings.minSalary) } }, extras.freeAgents.at(-1)!, team.teamId,
      { annualSalary: Math.max(quote.required, broke.capSettings.minSalary), yearsRemaining: 1 });
    expect(minDeal.accepted).toBe(true);
  });

  it('re-sign: Bird rights ignore cap room, but an unhappy player refuses', () => {
    const { league: base, extras: e0 } = setup();
    const team = base.teams[0], p = team.seasons.at(-1)!;
    const { league, extras } = waiveToFreeAgency(base, e0, p.playerId, team.teamId);
    const fa = extras.freeAgents.find(s => s.playerId === p.playerId)!;
    const broke = { ...extras, capSettings: { ...extras.capSettings, salaryCap: 1 } };
    const happy = signingDecision(league, broke, { ...fa, morale: undefined, }, team.teamId, { annualSalary: signingDecision(league, broke, fa, team.teamId).required, yearsRemaining: 2 });
    expect(happy.path).toBe('resign');
    expect(happy.accepted).toBe(true);
    const unhappy = { ...fa, morale: { score: 10, season: '2026', teamId: team.teamId, games: 50, tradeRequest: '2026' } };
    expect(signingDecision(league, broke, unhappy, team.teamId).refuses).toBe(true);
  });

  it('Auto Play signs for your team only players who accept under the shared rules', () => {
    const { league: base, extras: e0 } = setup();
    const team = base.teams[0];
    let league: League = { ...base, teams: base.teams.map(t => t.teamId === team.teamId ? { ...t, seasons: t.seasons.slice(0, 8) } : t) };
    let extras: GMLeagueExtras = { ...e0, freeAgents: [...e0.freeAgents, ...base.teams[0].seasons.slice(8).map(s => appendHistoryEvent({ ...s, teamId: null }, 'waived', 'x', base.teams[3].teamId))] };
    const before = new Map(extras.freeAgents.map(p => [p.playerId, p]));
    const r = autoSignForControlledTeam(league, extras, team.teamId, 12, 3);
    for (const id of r.signings) {
      const contract = r.extras.contracts[id];
      const decision = signingDecision(league, extras, before.get(id)!, team.teamId, contract);
      expect(decision.refuses).toBe(false);
      expect(contract.annualSalary).toBeGreaterThanOrEqual(decision.required);
      ({ league, extras } = { league: r.league, extras: r.extras });
    }
  });
});
