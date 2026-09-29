import type { League } from './league';
import type { RivalArchetype } from './gmRivals';

/*
 * The Owner's Box dials the AI GM code reads for the owner's team (kept free of other imports so aiGM.ts can use
 * them without a cycle). See ownerBox.ts.
 */

export type OwnerGoal = 'title' | 'playoffs' | 'rebuild' | 'profit';
export type OwnerBudget = 'frugal' | 'standard' | 'lavish';
export const GOALS: Record<OwnerGoal, { label: string; blurb: string }> = {
  title: { label: 'Win the title now', blurb: 'Your GM buys: veterans for youth, cap room spent, the tax is fine.' },
  playoffs: { label: 'Make the playoffs', blurb: 'Your GM plays it his way, as long as the team is in the playoffs.' },
  rebuild: { label: 'Rebuild', blurb: 'Your GM sells veterans for young players and picks, and keeps the books light.' },
  profit: { label: 'Turn a profit', blurb: 'Your GM spends as little as he can. Wins are nice; money is the goal.' },
};
export const BUDGETS: Record<OwnerBudget, { label: string; blurb: string; expense: number; spend: number }> = {
  frugal: { label: 'Frugal', blurb: 'Cheap staff, facilities and scouting; the GM bids low in free agency.', expense: 25, spend: 0.75 },
  standard: { label: 'Standard', blurb: 'League-average spending everywhere.', expense: 50, spend: 1 },
  lavish: { label: 'Lavish', blurb: 'Top facilities, coaching, medical and scouting; the GM can outbid anyone.', expense: 85, spend: 1.3 },
};
/** How each GM style runs a team (its AI front-office personality, and which way it leans at the deadline). */
export const GM_STYLE: Record<RivalArchetype, { personality: 'aggressive' | 'conservative' | 'balanced'; lean: number; note: string }> = {
  shark: { personality: 'aggressive', lean: 0.04, note: 'Trades often and bids high. Always chasing the next deal.' },
  collector: { personality: 'conservative', lean: -0.06, note: 'Builds through the draft and young players; slow to buy.' },
  oldschool: { personality: 'balanced', lean: 0.02, note: 'Trusts veterans and big men; wants to win now.' },
};

/** How much more (or less) your GM will spend in free agency. 1 for every other team. */
export function ownerSpendFactor(league: League, teamId: string): number {
  const o = league.owner;
  if (!o || o.teamId !== teamId) return 1;
  return BUDGETS[o.budget].spend * (o.goal === 'profit' ? 0.8 : o.goal === 'title' ? 1.1 : 1);
}

/** Shifts the win-% lines for buying and selling: a title goal makes your GM a buyer, a rebuild a seller. */
export function ownerLean(league: League, teamId: string): { buyer: number; seller: number } {
  const o = league.owner;
  if (!o || o.teamId !== teamId) return { buyer: 0, seller: 0 };
  const style = o.gm ? GM_STYLE[o.gm.archetype].lean : 0;
  // buyer: added to the win-% line for buying; seller: taken off the line for selling (so + makes selling rarer).
  if (o.goal === 'title') return { buyer: -0.2, seller: 0.3 };
  if (o.goal === 'rebuild') return { buyer: 0.3, seller: -0.3 };
  return { buyer: -style, seller: style };
}

