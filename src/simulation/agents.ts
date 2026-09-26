import type { League } from './league';
import type { Contract, GMLeagueExtras } from './gm';
import type { PlayerSeason } from './types';
import { signingDecision } from './freeAgentDecision';
import { personalityOf } from './personality';
import { calculateOverall } from './engine/overall';

/*
 * Contract talks go through agents. Every player is represented by one of a dozen (fictional) agents, and the
 * agent's style plus the player's own personality set the opening demand, how far they'll come down, how many
 * rounds of back-and-forth they'll sit through, and whether a star's camp issues the classic ultimatum:
 * "a max deal or he walks". Walking away means that player won't sign with you this offseason.
 */

export type AgentStyle = 'Hardball' | 'Showman' | 'Dealmaker' | 'Steady' | 'Loyalist';
export interface Agent { id: string; name: string; agency: string; style: AgentStyle }

export const AGENTS: Agent[] = [
  { id: 'a1', name: 'Marcus Vell', agency: 'Vell Sports Group', style: 'Hardball' },
  { id: 'a2', name: 'Dana Kessler', agency: 'Keystone Athlete Management', style: 'Steady' },
  { id: 'a3', name: 'Rico Almeida', agency: 'Almeida & Partners', style: 'Showman' },
  { id: 'a4', name: 'Priya Natarajan', agency: 'Baseline Representation', style: 'Dealmaker' },
  { id: 'a5', name: 'Tom Brennigan', agency: 'Brennigan Family Sports', style: 'Loyalist' },
  { id: 'a6', name: 'Shay Okafor', agency: 'Crown Court Agency', style: 'Hardball' },
  { id: 'a7', name: 'Lena Hartwell', agency: 'Hartwell Global', style: 'Showman' },
  { id: 'a8', name: 'Greg Tamura', agency: 'Pacific Rim Sports', style: 'Steady' },
  { id: 'a9', name: 'Andre Beaumont', agency: 'Fullcourt Management', style: 'Dealmaker' },
  { id: 'a10', name: 'Nadia Voss', agency: 'Voss Talent', style: 'Hardball' },
  { id: 'a11', name: 'Carl Mendes', agency: 'Hometown Athletes', style: 'Loyalist' },
  { id: 'a12', name: 'Ivy Chen', agency: 'Tipoff Partners', style: 'Steady' },
];

export const STYLE_BLURB: Record<AgentStyle, string> = {
  Hardball: 'Opens high, concedes little, and will walk a star out the door.',
  Showman: 'Wants a big number and a player option, and talks to the press.',
  Dealmaker: 'Flexible on money if the years are right. Likes to close.',
  Steady: 'Fair opening number, patient, no drama.',
  Loyalist: 'Values fit and loyalty. Gives the incumbent team a real chance.',
};

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** A player's agent: stable for his career. Stars skew toward the hardball and showman agencies. */
export function agentFor(player: PlayerSeason): Agent {
  const h = hash(`agent|${player.playerId}`);
  const star = calculateOverall(player) >= 76;
  const pool = star && h % 3 !== 0 ? AGENTS.filter(a => a.style === 'Hardball' || a.style === 'Showman') : AGENTS;
  return pool[h % pool.length];
}

export interface NegotiationLine { from: 'agent' | 'you'; text: string }
export interface Negotiation {
  playerId: string;
  teamId: string;
  season: string;
  agentId: string;
  /** What the camp is asking for right now. */
  demand: { salary: number; years: number; playerOption: boolean };
  /** The lowest yearly salary they would sign for at their preferred length (never shown). */
  floor: number;
  /** Rounds of talks left before they walk. */
  patience: number;
  /** "Max or he walks": anything under the demand ends the talks. */
  ultimatum: boolean;
  status: 'open' | 'agreed' | 'walked';
  rounds: number;
  log: NegotiationLine[];
  /** The agreed contract, once there is one. */
  deal?: Omit<Contract, 'playerId' | 'teamId'>;
}

export const negotiationKey = (playerId: string, teamId: string) => `${teamId}|${playerId}`;
export function currentNegotiation(league: League, extras: GMLeagueExtras, playerId: string, teamId: string): Negotiation | undefined {
  const n = extras.negotiations?.[negotiationKey(playerId, teamId)];
  return n && n.season === (league.season ?? '') ? n : undefined;
}

const round50k = (n: number) => Math.round(n / 50_000) * 50_000;

/** How many years this player wants. Stars in their prime want flexibility; veterans want security. */
function preferredYears(player: PlayerSeason, overall: number): number {
  if (player.age >= 33) return 2;
  if (player.age >= 30) return 3;
  return overall >= 76 ? 3 : 4;
}

/** What an offer is worth to the camp: years away from what he wants and a missing player option both cost. */
export function offerValue(n: Negotiation, offer: { salary: number; years: number; playerOption: boolean }): number {
  const yearsOff = Math.abs(offer.years - n.demand.years);
  const option = n.demand.playerOption ? (offer.playerOption ? 1 : 0.95) : (offer.playerOption ? 1.03 : 1);
  return offer.salary * (1 - 0.04 * yearsOff) * option;
}

/** Opens talks (or returns the ones already open). Null when the player refuses this team outright. */
export function openNegotiation(league: League, extras: GMLeagueExtras, player: PlayerSeason, teamId: string): Negotiation | null {
  const existing = currentNegotiation(league, extras, player.playerId, teamId);
  if (existing) return existing;
  const quote = signingDecision(league, extras, player, teamId);
  if (quote.refuses) return null;
  const agent = agentFor(player);
  const p = personalityOf(player);
  const overall = calculateOverall(player);
  const max = round50k(extras.capSettings.salaryCap * extras.capSettings.maxSalaryPctOfCap);
  const resign = quote.path === 'resign';
  const markup = { Hardball: 0.22, Showman: 0.16, Dealmaker: 0.1, Steady: 0.08, Loyalist: resign ? 0.02 : 0.08 }[agent.style] + (p.greed - 50) / 400;
  const years = preferredYears(player, overall);
  const ultimatum = agent.style === 'Hardball' && overall >= 78 && player.age <= 31;
  const salary = ultimatum ? max : Math.min(max, round50k(Math.max(quote.required, quote.required * (1 + markup))));
  const floor = ultimatum ? max : Math.min(salary, round50k(quote.required * (agent.style === 'Hardball' ? 1.04 : 1)));
  const patience = Math.max(1, { Hardball: 2, Showman: 3, Dealmaker: 4, Steady: 4, Loyalist: 5 }[agent.style] - (p.temper >= 70 ? 1 : 0) + (resign && p.loyalty >= 70 ? 1 : 0));
  const playerOption = overall >= 75 && (agent.style === 'Showman' || agent.style === 'Hardball');
  const money = `$${(salary / 1e6).toFixed(1)}M`;
  const opener = ultimatum
    ? `${player.playerId} wants a max deal (${money} a year, ${years} years) or he walks. There's nothing to discuss below that.`
    : {
      Hardball: `We're at ${money} a year for ${years} years${playerOption ? ' with a player option' : ''}. Other teams are calling.`,
      Showman: `My client is one of the most marketable players in the league. ${money} a year, ${years} years${playerOption ? ', player option on the last year' : ''}.`,
      Dealmaker: `Let's get this done. ${money} a year over ${years} years works for us, and we can talk.`,
      Steady: `We think ${money} a year for ${years} years is fair for what he brings.`,
      Loyalist: resign ? `He'd like to stay. ${money} a year for ${years} years and we can sign today.` : `He's open to a fresh start: ${money} a year for ${years} years.`,
    }[agent.style];
  return {
    playerId: player.playerId, teamId, season: league.season ?? '', agentId: agent.id,
    demand: { salary, years, playerOption }, floor, patience, ultimatum, status: 'open', rounds: 0,
    log: [{ from: 'agent', text: opener }],
  };
}

export type OfferOutcome = 'agreed' | 'countered' | 'rejected' | 'walked';

/**
 * You put an offer on the table; the agent accepts, counters (meeting you partway, losing a little patience) or
 * turns it down. Lowballing costs more patience, and an ultimatum ends the talks at the first offer under it.
 * `required` is the least the player needs to accept under the league's signing rules (resign/market quote).
 */
export function makeOffer(n: Negotiation, offer: { salary: number; years: number; playerOption: boolean }, required: number): { negotiation: Negotiation; outcome: OfferOutcome } {
  if (n.status !== 'open') return { negotiation: n, outcome: n.status === 'agreed' ? 'agreed' : 'walked' };
  const money = (v: number) => `$${(v / 1e6).toFixed(1)}M`;
  const log: NegotiationLine[] = [...n.log, { from: 'you', text: `${money(offer.salary)} a year for ${offer.years} year${offer.years === 1 ? '' : 's'}${offer.playerOption ? ' with a player option' : ''}.` }];
  const value = offerValue(n, offer);
  const target = offerValue(n, n.demand);
  const rounds = n.rounds + 1;
  const agree = (text: string) => ({ negotiation: { ...n, rounds, log: [...log, { from: 'agent' as const, text }], status: 'agreed' as const,
    deal: { annualSalary: offer.salary, yearsRemaining: offer.years, playerOption: offer.playerOption, teamOption: false } }, outcome: 'agreed' as const });
  const meetsRules = offer.salary >= required && offer.years >= 1 && offer.years <= 5;
  if (meetsRules && value >= target * 0.995) return agree(rounds === 1 ? "That works. We have a deal." : 'Done. Send over the paperwork.');
  if (n.ultimatum) {
    return { negotiation: { ...n, rounds, patience: 0, status: 'walked', log: [...log, { from: 'agent', text: "We said max or nothing. He's taking his talents elsewhere." }] }, outcome: 'walked' };
  }
  const floorValue = offerValue(n, { ...n.demand, salary: n.floor });
  const insulting = value < floorValue * 0.85;
  const patience = n.patience - (insulting ? 2 : 1);
  if (meetsRules && value >= floorValue && patience <= 0) return agree("Fine. It's less than we wanted, but he wants this done.");
  if (patience <= 0) {
    return { negotiation: { ...n, rounds, patience: 0, status: 'walked', log: [...log, { from: 'agent', text: insulting ? "We're done here. That offer was an insult." : "We've gone as far as we can. He'll sign somewhere else." }] }, outcome: 'walked' };
  }
  if (value >= floorValue) {
    // Meet partway: the new ask sits between the old one and your offer, never under the floor.
    const salary = Math.max(n.floor, round50k((n.demand.salary + Math.max(offer.salary, n.floor)) / 2));
    const demand = { ...n.demand, salary };
    const close = offerValue(n, offer) >= offerValue({ ...n, demand }, demand) * 0.98;
    if (meetsRules && close) return agree("We're close enough. Let's shake on it.");
    return { negotiation: { ...n, rounds, patience, demand, log: [...log, { from: 'agent', text: `We can come down to ${money(salary)} a year for ${demand.years} years${demand.playerOption ? ' with the option' : ''}. That's a real move on our side.` }] }, outcome: 'countered' };
  }
  return { negotiation: { ...n, rounds, patience, log: [...log, { from: 'agent', text: insulting ? `Is that a joke? We're at ${money(n.demand.salary)}. Don't waste our time.` : `Not close. He's worth ${money(n.demand.salary)} a year and teams know it.` }] }, outcome: 'rejected' };
}

/** You end the talks yourself; he goes to the market (and still might come back through the normal signing rules later). */
export function walkAway(n: Negotiation): Negotiation {
  return n.status === 'open' ? { ...n, status: 'walked', log: [...n.log, { from: 'you', text: 'We are going in a different direction.' }] } : n;
}

export function storeNegotiation(extras: GMLeagueExtras, n: Negotiation): GMLeagueExtras {
  return { ...extras, negotiations: { ...(extras.negotiations ?? {}), [negotiationKey(n.playerId, n.teamId)]: n } };
}

/** Headline-worthy moments from this offseason's talks, for the news feed. */
export function negotiationStories(league: League, extras: GMLeagueExtras): { id: string; teamId: string; playerId: string; headline: string; detail: string }[] {
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const out: { id: string; teamId: string; playerId: string; headline: string; detail: string }[] = [];
  for (const n of Object.values(extras.negotiations ?? {})) {
    if (n.season !== (league.season ?? '')) continue;
    const agent = AGENTS.find(a => a.id === n.agentId);
    if (n.ultimatum) out.push({ id: `talks:ultimatum:${n.playerId}`, teamId: n.teamId, playerId: n.playerId,
      headline: `${n.playerId}'s camp to ${name(n.teamId)}: a max deal or he walks.`, detail: `${agent?.name ?? 'His agent'} (${agent?.agency ?? 'his agency'}) set the terms before talks began.` });
    if (n.status === 'walked') out.push({ id: `talks:walked:${n.playerId}`, teamId: n.teamId, playerId: n.playerId,
      headline: `Talks collapse: ${n.playerId} walks away from ${name(n.teamId)}.`, detail: `${n.rounds} round${n.rounds === 1 ? '' : 's'} of talks ended without a deal. He won't sign there this offseason.` });
    if (n.status === 'agreed' && n.deal && n.rounds >= 2) out.push({ id: `talks:agreed:${n.playerId}`, teamId: n.teamId, playerId: n.playerId,
      headline: `${n.playerId} and ${name(n.teamId)} reach a deal after ${n.rounds} rounds of talks.`, detail: `$${(n.deal.annualSalary / 1e6).toFixed(1)}M a year for ${n.deal.yearsRemaining} year${n.deal.yearsRemaining === 1 ? '' : 's'}${n.deal.playerOption ? ', player option' : ''}.` });
  }
  return out;
}
