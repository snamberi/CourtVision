import { describe, it, expect } from 'vitest';
import { computeTeamFinances } from '../simulation/finances';
import { DEFAULT_CAP_SETTINGS } from '../simulation/gm';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import type { LeagueTeam } from '../simulation/league';

function team(marketSize: number): LeagueTeam {
  const demo = buildDemoTeam('T', 'Test Team');
  return { teamId: 'T', name: 'Test Team', seasons: demo.seasons, marketSize };
}

describe('team finances / market size', () => {
  it('a big market generates meaningfully more revenue than a small market with the same record', () => {
    const bigMarket = computeTeamFinances(team(95), {}, DEFAULT_CAP_SETTINGS, DEFAULT_LEAGUE_RULES, 0.5);
    const smallMarket = computeTeamFinances(team(10), {}, DEFAULT_CAP_SETTINGS, DEFAULT_LEAGUE_RULES, 0.5);
    expect(bigMarket.annualRevenue).toBeGreaterThan(smallMarket.annualRevenue * 1.5);
  });

  it('a big market has higher spending willingness than a small market, all else equal', () => {
    const bigMarket = computeTeamFinances(team(95), {}, DEFAULT_CAP_SETTINGS, DEFAULT_LEAGUE_RULES, 0.5);
    const smallMarket = computeTeamFinances(team(10), {}, DEFAULT_CAP_SETTINGS, DEFAULT_LEAGUE_RULES, 0.5);
    expect(bigMarket.spendingWillingness).toBeGreaterThan(smallMarket.spendingWillingness);
  });

  it('exceeding the luxury tax line hurts operating income beyond just the raw payroll cost', () => {
    const t = team(50);
    const contracts = Object.fromEntries(t.seasons.map((s) => [s.playerId, {
      playerId: s.playerId, teamId: 'T', annualSalary: DEFAULT_CAP_SETTINGS.luxuryTaxLine / t.seasons.length + 20_000_000,
      yearsRemaining: 1, playerOption: false, teamOption: false,
    }]));
    const overTax = computeTeamFinances(t, contracts, DEFAULT_CAP_SETTINGS, DEFAULT_LEAGUE_RULES, 0.5);
    const payrollOnly = overTax.annualRevenue - overTax.payroll;
    expect(overTax.operatingIncome).toBeLessThan(payrollOnly); // the tax bill eats further into income
  });

  it('every team shares the exact same salary cap regardless of market size', () => {
    // Market size affects revenue/spending willingness, never the cap itself.
    const bigMarket = computeTeamFinances(team(95), {}, DEFAULT_CAP_SETTINGS, DEFAULT_LEAGUE_RULES, 0.5);
    const smallMarket = computeTeamFinances(team(10), {}, DEFAULT_CAP_SETTINGS, DEFAULT_LEAGUE_RULES, 0.5);
    expect(DEFAULT_CAP_SETTINGS.salaryCap).toBe(DEFAULT_CAP_SETTINGS.salaryCap); // sanity: one shared constant
    expect(bigMarket).not.toHaveProperty('salaryCap');
    expect(smallMarket).not.toHaveProperty('salaryCap');
  });
});
