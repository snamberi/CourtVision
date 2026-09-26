import type { League } from './league';
import type { GMLeagueExtras, Contract } from './gm';
import { computeAskingSalary } from './gm';
import type { PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';
import { agentFor, type Negotiation } from './agents';
import { personalityOf } from './personality';

/*
 * In-season extensions: sign one of your players to a new deal before he reaches free agency. His agent talks the
 * same way as in the summer; unhappy players won't talk, and some stars would rather test the market. An agreed
 * extension starts when the current contract runs out. A player entering the last year of his deal without an
 * extension is in a contract year: he plays a little harder.
 */

export interface ExtensionDeal { annualSalary: number; years: number; agreedSeason: string }
export type ExtensionStance = { open: true; note: string } | { open: false; reason: string };

const round50k = (n: number) => Math.round(n / 50_000) * 50_000;
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 13);
export const EXTENSION_WINDOW_YEARS = 2;

/** Whether he'll talk extension now, and why not if he won't. */
export function extensionStance(league: League, extras: GMLeagueExtras, player: PlayerSeason): ExtensionStance {
  const c = extras.contracts[player.playerId];
  if (!c) return { open: false, reason: 'No contract to extend.' };
  if (c.extension) return { open: false, reason: `Already extended: ${c.extension.years} more years from ${Number(league.season) + c.yearsRemaining + 1}.` };
  if (c.yearsRemaining > EXTENSION_WINDOW_YEARS) return { open: false, reason: `Not eligible until the last ${EXTENSION_WINDOW_YEARS} years of his deal.` };
  const phase = league.seasonPhase ?? 'regular_season';
  if (phase !== 'regular_season' && phase !== 'all_star' && phase !== 'preseason') return { open: false, reason: 'Extension talks happen during the season.' };
  if (player.morale?.tradeRequest) return { open: false, reason: "He's asked for a trade. He won't talk about staying." };
  if ((player.morale?.score ?? 60) < 45) return { open: false, reason: "He's unhappy here and wants to wait until the summer." };
  const agent = agentFor(player), ovr = calculateOverall(player);
  if (ovr >= 76 && player.age <= 30 && (agent.style === 'Hardball' || agent.style === 'Showman') && hash(`${player.playerId}|${league.season}`) % 10 < 6)
    return { open: false, reason: `His agent (${agent.name}) wants him to test free agency this summer.` };
  return { open: true, note: c.yearsRemaining === 1 ? 'Contract year: last chance before free agency.' : 'Two years left: extending now can save money.' };
}

/** Opens extension talks: the camp's ask for the years after his current deal. */
export function openExtension(league: League, extras: GMLeagueExtras, player: PlayerSeason, teamId: string): Negotiation | null {
  const existing = extras.extensionTalks?.[player.playerId];
  if (existing && existing.season === league.season) return existing;
  if (!extensionStance(league, extras, player).open) return null;
  const agent = agentFor(player), p = personalityOf(player), ovr = calculateOverall(player);
  const max = round50k(extras.capSettings.salaryCap * extras.capSettings.maxSalaryPctOfCap);
  const asking = computeAskingSalary(ovr, extras.capSettings);
  // Security has value: an extension asks a little less than the open market, more from a greedy camp.
  const markup = { Hardball: 0.14, Showman: 0.1, Dealmaker: 0.04, Steady: 0.02, Loyalist: -0.04 }[agent.style] + (p.greed - 50) / 500 - (p.loyalty - 50) / 600;
  const salary = Math.min(max, round50k(asking * (1 + markup)));
  const years = player.age >= 32 ? 2 : player.age >= 29 ? 3 : 4;
  const floor = Math.min(salary, round50k(asking * (agent.style === 'Hardball' ? 1.02 : 0.94)));
  const patience = Math.max(1, { Hardball: 2, Showman: 3, Dealmaker: 4, Steady: 4, Loyalist: 5 }[agent.style] - (p.temper >= 70 ? 1 : 0));
  const money = `$${(salary / 1e6).toFixed(1)}M`;
  return {
    playerId: player.playerId, teamId, season: league.season ?? '', agentId: agent.id,
    demand: { salary, years, playerOption: false }, floor, patience, ultimatum: false, status: 'open', rounds: 0,
    log: [{ from: 'agent', text: `${player.playerId} would sign on for ${years} more years at ${money} a year, starting when his current deal ends.` }],
  };
}

export const storeExtensionTalks = (extras: GMLeagueExtras, n: Negotiation): GMLeagueExtras => ({ ...extras, extensionTalks: { ...(extras.extensionTalks ?? {}), [n.playerId]: n } });

/** The least he'll accept for an extension (the rules side of an offer). */
export const extensionMinimum = (player: PlayerSeason, extras: GMLeagueExtras) => round50k(computeAskingSalary(calculateOverall(player), extras.capSettings) * 0.8);

/** Records the agreed extension on his contract; it replaces the contract when the current one runs out. */
export function signExtension(league: League, extras: GMLeagueExtras, playerId: string, deal: { annualSalary: number; years: number }): { league: League; extras: GMLeagueExtras } {
  const c = extras.contracts[playerId];
  if (!c) return { league, extras };
  const contracts = { ...extras.contracts, [playerId]: { ...c, extension: { annualSalary: deal.annualSalary, years: deal.years, agreedSeason: league.season ?? '' } } };
  const teams = league.teams.map(t => ({ ...t, seasons: t.seasons.map(p => p.playerId === playerId ? { ...p, contractYear: undefined } : p) }));
  return { league: { ...league, teams }, extras: { ...extras, contracts } };
}

/** At a contract's end, an agreed extension becomes the new contract. */
export function extensionTakesOver(c: Contract): Contract | null {
  return c.extension ? { playerId: c.playerId, teamId: c.teamId, annualSalary: c.extension.annualSalary, yearsRemaining: c.extension.years, playerOption: false, teamOption: false } : null;
}

/** A contract-year player plays a little harder: steadier, smarter shots, more legs. Applied on game nights. */
export function withContractYear(p: PlayerSeason): PlayerSeason {
  if (!p.contractYear) return p;
  const o = p.attributes.offense, ph = p.attributes.physical;
  return { ...p, attributes: { ...p.attributes, offense: { ...o, offensiveConsistency: Math.min(99, o.offensiveConsistency + 4), shotIQ: Math.min(99, o.shotIQ + 2) }, physical: { ...ph, stamina: Math.min(99, ph.stamina + 3) } } };
}

/** Marks who is playing for his next contract this season (last year, no extension). */
export function markContractYears(league: League, contracts: Record<string, Contract>): League {
  return { ...league, teams: league.teams.map(t => ({ ...t, seasons: t.seasons.map(p => {
    const c = contracts[p.playerId];
    const cy = !!c && c.yearsRemaining === 1 && !c.extension;
    return cy === !!p.contractYear ? p : cy ? { ...p, contractYear: true } : { ...p, contractYear: undefined };
  }) })) };
}
