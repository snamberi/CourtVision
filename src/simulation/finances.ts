import { staffSalary } from './staffManagement';
import type { LeagueTeam } from './league';
import type { Contract, SalaryCapSettings } from './gm';
import { teamPayroll } from './gm';
import type { LeagueRulesSettings } from './leagueRules';
import { expenseAnnualCost, defaultExpenseLevels } from './league';

export interface TeamFinancialProfile {
  marketSize: number; // 0-100
  annualRevenue: number;
  payroll: number;
  operatingIncome: number; // revenue minus payroll, luxury tax, coach salary and expense-level spend
  expenseSpend: number; // total annual cost of the four expense levels
  spendingWillingness: number; // 0-100 — how eager ownership is to spend into/through the luxury tax
  financialHealth: 'Thriving' | 'Stable' | 'Strained' | 'Crisis';
}

const BASE_REVENUE_AT_MARKET_50 = 180_000_000; // a mid-size market's rough annual revenue baseline

/**
 * A team's financial picture. The shared salary cap is still one league-wide number every team plays
 * under (see SalaryCapSettings) — market size instead shapes how much money a team actually brings in
 * and how willing its ownership is to spend up to (or past, into the tax) that shared cap.
 */
export function computeTeamFinances(
  team: LeagueTeam,
  contracts: Record<string, Contract>,
  capSettings: SalaryCapSettings,
  rules: LeagueRulesSettings | undefined,
  winPct = 0.5,
): TeamFinancialProfile {
  const marketSize = team.marketSize ?? 50;
  const marketFactor = 0.4 + (marketSize / 100) * 1.2; // market 0 -> 0.4x, 50 -> 1.0x, 100 -> 1.6x
  const performanceFactor = 0.85 + winPct * 0.3; // winning teams draw a bit more locally (tickets/merch/sponsors)

  const ticketW = (rules?.ticketRevenueWeight ?? 40) / 100;
  const merchW = (rules?.merchandiseRevenueWeight ?? 20) / 100;
  const tvW = (rules?.tvRevenueWeight ?? 30) / 100;
  const sponsorW = (rules?.sponsorshipRevenueWeight ?? 10) / 100;

  const localFactor = marketFactor * performanceFactor;
  // National TV money is shared far more evenly across the league than local revenue streams.
  const tvFactor = 0.7 + marketFactor * 0.3;
  const revenue = BASE_REVENUE_AT_MARKET_50 * (ticketW * localFactor + merchW * localFactor + tvW * tvFactor + sponsorW * localFactor);

  const payroll = teamPayroll(contracts, team);
  const luxuryTaxOwed = payroll > capSettings.luxuryTaxLine ? (payroll - capSettings.luxuryTaxLine) * capSettings.luxuryTaxMultiplier : 0;
  const coachSalary = staffSalary(team) + (team.coachingControl?.payout ?? 0);
  const levels = team.expenseLevels ?? defaultExpenseLevels();
  const expenseSpend = expenseAnnualCost(levels.scouting) + expenseAnnualCost(levels.coaching)
    + expenseAnnualCost(levels.health) + expenseAnnualCost(levels.facilities);
  const operatingIncome = revenue - payroll - luxuryTaxOwed - coachSalary - expenseSpend;

  const profitabilityImpact = (rules?.teamProfitabilityImpact ?? 30) / 100;
  const baseWillingness = marketSize * 0.7 + performanceFactor * 15;
  // A team already losing money is pulled toward being more cautious, scaled by how much the league rules say profitability should matter.
  const profitabilityDrag = operatingIncome < 0 ? Math.min(30, Math.abs(operatingIncome) / 5_000_000) * profitabilityImpact : 0;
  const spendingWillingness = Math.max(5, Math.min(95, baseWillingness - profitabilityDrag));

  const financialHealth: TeamFinancialProfile['financialHealth'] =
    operatingIncome > revenue * 0.1 ? 'Thriving' :
    operatingIncome > 0 ? 'Stable' :
    operatingIncome > -revenue * 0.15 ? 'Strained' : 'Crisis';

  return { marketSize, annualRevenue: revenue, payroll, operatingIncome, expenseSpend, spendingWillingness, financialHealth };
}
