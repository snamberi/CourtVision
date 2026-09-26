import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { freeAgentVerdict, strengthRanking, STAR_FREE_AGENT } from '../simulation/freeAgentDecision';
import { calculateOverall } from '../simulation/engine/overall';
import { computeAskingSalary } from '../simulation/gm';

function withStarFreeAgent() {
  const { league, extras } = generateFullLeague(31, 12, 14, 10);
  const donor = league.teams[5];
  const star = [...donor.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
  const boosted = { ...star, teamId: null, history: [] as typeof star.history, attributes: JSON.parse(JSON.stringify(star.attributes)) };
  while (calculateOverall(boosted) < STAR_FREE_AGENT + 2) for (const g of ['offense', 'defense', 'mental'] as const) for (const k of Object.keys(boosted.attributes[g])) (boosted.attributes[g] as unknown as Record<string, number>)[k] += 1;
  const teams = league.teams.map(t => t.teamId === donor.teamId ? { ...t, seasons: t.seasons.filter(s => s.playerId !== star.playerId) } : t);
  return { league: { ...league, teams }, extras: { ...extras, freeAgents: [boosted], freeAgencyOpen: true }, star: boosted };
}

describe('free agent decisions', () => {
  it('stars refuse the best team but will talk to everyone else', () => {
    const { league, extras, star } = withStarFreeAgent();
    const [best, second] = strengthRanking(league);
    const refusal = freeAgentVerdict(league, extras, star, best, { annualSalary: 99_000_000, yearsRemaining: 3 });
    expect(refusal.refuses).toBe(true); expect(refusal.accepted).toBe(false);
    expect(freeAgentVerdict(league, extras, star, second).refuses).toBe(false);
  });
  it('lowball offers are turned down and a fair offer is accepted', () => {
    const { league, extras, star } = withStarFreeAgent();
    const team = strengthRanking(league)[6];
    const quote = freeAgentVerdict(league, extras, star, team);
    expect(quote.required).toBeGreaterThanOrEqual(computeAskingSalary(calculateOverall(star), extras.capSettings) * 0.9);
    expect(freeAgentVerdict(league, extras, star, team, { annualSalary: extras.capSettings.minSalary, yearsRemaining: 2 }).accepted).toBe(false);
    expect(freeAgentVerdict(league, extras, star, team, { annualSalary: quote.required, yearsRemaining: 2 }).accepted).toBe(true);
  });
});
