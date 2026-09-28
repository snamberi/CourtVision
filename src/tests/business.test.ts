import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { gate, jerseySales, buyUpgrade, setTicketPrice, rollBusinessSeason, referencePrice, defaultBusiness, priceMoodDrift, capacity } from '../simulation/business';
import { computeTeamFinances } from '../simulation/finances';
import { calculateOverall } from '../simulation/engine/overall';

const { league, extras } = generateFullLeague(81, 8, 13, 20, '2026', { priorSeasons: false });
const team = league.teams[0];

describe('franchise business', () => {
  it('attendance falls with price and rises with winning and happy fans', () => {
    const fair = referencePrice(team, 0.5);
    expect(gate(team, 0.5, 55, fair * 1.6).attendance).toBeLessThan(gate(team, 0.5, 55, fair).attendance);
    expect(gate(team, 0.7, 55, fair).attendance).toBeGreaterThan(gate(team, 0.3, 55, fair).attendance);
    expect(gate(team, 0.5, 85, fair).attendance).toBeGreaterThanOrEqual(gate(team, 0.5, 30, fair).attendance);
    const g = gate(team, 0.5, 55);
    expect(g.fill).toBeGreaterThan(0.3); expect(g.fill).toBeLessThanOrEqual(1);
  });

  it('the best players sell the most jerseys', () => {
    const sales = jerseySales(team, 0.5, 55);
    const best = [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
    expect(sales[0].playerId).toBe(best.playerId);
  });

  it('upgrades add seats and a five-season loan that is paid down each season', () => {
    const t1 = buyUpgrade({ ...team, business: defaultBusiness(team) }, 'seats')!;
    expect(capacity(t1.business!)).toBe(capacity(defaultBusiness(team)) + 1000);
    expect(t1.business!.loans).toHaveLength(1);
    let t = t1; for (let i = 0; i < 5; i++) t = rollBusinessSeason(t);
    expect(t.business!.loans).toHaveLength(0);
    let maxed = t; for (let i = 0; i < 3; i++) maxed = buyUpgrade(maxed, 'scoreboard') ?? maxed;
    expect(buyUpgrade(maxed, 'scoreboard')).toBeNull();
  });

  it('revenue follows the business: a sensible default stays close to the standard model, gouging sours fans', () => {
    const standard = computeTeamFinances(team, extras.contracts, extras.capSettings, league.rulesSettings, 0.5).annualRevenue;
    const managed = computeTeamFinances({ ...team, business: defaultBusiness(team) }, extras.contracts, extras.capSettings, league.rulesSettings, 0.5).annualRevenue;
    expect(Math.abs(managed - standard) / standard).toBeLessThan(0.25);
    const gouge = setTicketPrice(team, referencePrice(team, 0.5) * 2);
    expect(priceMoodDrift(gouge, 0.5)).toBeLessThan(0);
    const withLoan = buyUpgrade({ ...team, business: defaultBusiness(team) }, 'practice')!;
    const a = computeTeamFinances({ ...team, business: defaultBusiness(team) }, extras.contracts, extras.capSettings, league.rulesSettings, 0.5);
    const b = computeTeamFinances(withLoan, extras.contracts, extras.capSettings, league.rulesSettings, 0.5);
    expect(b.expenseSpend).toBeGreaterThan(a.expenseSpend);
  });
});
