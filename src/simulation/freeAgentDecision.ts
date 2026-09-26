import type { League, LeagueTeam } from './league';
import type { Contract, GMLeagueExtras } from './gm';
import { capSpaceRemaining, computeAskingSalary, priorTeamId, signFreeAgent } from './gm';
import { moraleContractAdjustment } from './personality';
import type { PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';
import { primaryPosition } from './teamStatus';

/** Team strength for free-agent decisions: the average Overall of a team's best eight players. */
export function teamStrength(team: LeagueTeam): number {
  const top = team.seasons.map(calculateOverall).sort((a, b) => b - a).slice(0, 8);
  return top.length ? top.reduce((n, v) => n + v, 0) / top.length : 0;
}
export function strengthRanking(league: League): string[] {
  return [...league.teams].sort((a, b) => teamStrength(b) - teamStrength(a) || a.teamId.localeCompare(b.teamId)).map(t => t.teamId);
}

export interface FreeAgentVerdict {
  accepted: boolean;
  /** Salary this player needs from this team (0 when he refuses the team outright). */
  required: number;
  /** 0-100: how keen he is on this team. */
  interest: number;
  refuses: boolean;
  reason: string;
}
export const STAR_FREE_AGENT = 78;

/**
 * How a free agent answers an offer. Stars will not join the league's best team or a ready-made super-team,
 * and every player prices in market size, team quality, role and rival bidders.
 * Pure: the same league, player and offer always give the same answer.
 */
export function freeAgentVerdict(league: League, extras: GMLeagueExtras, player: PlayerSeason, teamId: string,
  offer?: Pick<Contract, 'annualSalary' | 'yearsRemaining'>, ranking = strengthRanking(league)): FreeAgentVerdict {
  const team = league.teams.find(t => t.teamId === teamId);
  const overall = calculateOverall(player);
  const cap = extras.capSettings;
  const asking = computeAskingSalary(overall, cap);
  const star = overall >= STAR_FREE_AGENT;
  if (!team) return { accepted: false, required: asking, interest: 0, refuses: true, reason: 'Unknown team.' };
  const rank = ranking.indexOf(teamId);
  if (star && rank === 0) {
    return { accepted: false, required: 0, interest: 0, refuses: true,
      reason: `${player.playerId} won't join the league's best team. He wants to be the one who takes them down.` };
  }
  const peers = team.seasons.filter(s => calculateOverall(s) >= Math.max(80, overall - 2)).length;
  if (star && peers >= 3) {
    return { accepted: false, required: 0, interest: 5, refuses: true,
      reason: `${player.playerId} won't join a team that already has ${peers} players at his level — he wants to be a focal point.` };
  }
  let premium = 0;
  const notes: string[] = [];
  // Personality and history: unhappy players won't re-sign, and players remember teams that moved them.
  const history = moraleContractAdjustment(player, teamId, priorTeamId(player) === teamId);
  if (history.refuses) return { accepted: false, required: 0, interest: 0, refuses: true, reason: history.refuses };
  premium += history.premium; notes.push(...history.notes);
  const teams = Math.max(1, ranking.length);
  if (star && rank >= 1 && rank <= 3) { premium += 0.1; notes.push('contender tax'); }
  if (overall >= 70 && rank >= teams - Math.max(3, Math.round(teams / 4))) { premium += 0.12; notes.push('losing team'); }
  const market = team.marketSize ?? 50;
  premium += (50 - market) / 250;
  if (market <= 35) notes.push('small market');
  const pos = primaryPosition(player);
  const blockers = team.seasons.filter(s => primaryPosition(s) === pos && calculateOverall(s) > overall).length;
  if (blockers >= 2) { premium += 0.15; notes.push('bench role'); }
  // Stars get other offers: every AI team with room to pay him pushes his price up.
  if (star) {
    const rivals = league.teams.filter(t => t.teamId !== teamId && t.teamId !== ranking[0] && capSpaceRemaining(extras.contracts, t, cap) >= asking * 0.9).length;
    if (rivals) { premium += 0.06 * Math.min(3, rivals); notes.push(`${rivals} rival bid${rivals === 1 ? '' : 's'}`); }
  }
  const floor = star ? 0.9 : overall >= 65 ? 0.8 : 0.7;
  const required = Math.round(Math.max(cap.minSalary, asking * Math.max(floor, 1 + premium)) / 50_000) * 50_000;
  const interest = Math.max(5, Math.min(100, Math.round(80 - premium * 150)));
  if (!offer) return { accepted: true, required, interest, refuses: false, reason: notes.length ? `Price includes: ${notes.join(', ')}.` : 'Open to signing here.' };
  const years = offer.yearsRemaining;
  if (years < 1 || years > 5) return { accepted: false, required, interest, refuses: false, reason: 'Contracts run 1-5 years.' };
  if (offer.annualSalary < required) {
    return { accepted: false, required, interest, refuses: false,
      reason: `${player.playerId} turned it down. He wants at least $${(required / 1e6).toFixed(1)}M a year from this team${notes.length ? ` (${notes.join(', ')})` : ''}.` };
  }
  return { accepted: true, required, interest, refuses: false, reason: `${player.playerId} accepts.` };
}

/* ---- One place for every signing's rules ----
 * market    - signing someone else's free agent: he must accept (price, refusals) and the team needs cap room
 *             (minimum-salary deals are always allowed, as in the NBA).
 * resign    - a team's own free agent (Bird rights): no cap-room limit, but morale and history still decide.
 * emergency - filling the league's minimum roster during the season: he must accept and gets his price, cap room
 *             is waived; a caller may force the best candidate only when nobody at all will accept.
 * The hard cap applies to every path. Sandbox edits call signFreeAgent directly and skip all of this. */
export type SigningPath = 'market' | 'resign' | 'emergency';
export interface SigningDecision extends FreeAgentVerdict { path: SigningPath }

/** A team's own free agent: last season's mood and how he was treated set the price (see personality.ts). */
export function resignVerdict(extras: GMLeagueExtras, player: PlayerSeason, teamId: string): FreeAgentVerdict {
  const adj = moraleContractAdjustment(player, teamId, true);
  if (adj.refuses) return { accepted: false, required: 0, interest: 0, refuses: true, reason: adj.refuses };
  const required = Math.round(Math.max(extras.capSettings.minSalary, computeAskingSalary(calculateOverall(player), extras.capSettings) * Math.max(0.8, 1 + adj.premium)) / 50_000) * 50_000;
  const interest = Math.max(5, Math.min(100, Math.round(72 - adj.premium * 150)));
  return { accepted: true, required, interest, refuses: false, reason: adj.notes.length ? `Price includes: ${adj.notes.join(', ')}.` : 'Happy to talk about staying.' };
}

export function signingDecision(league: League, extras: GMLeagueExtras, player: PlayerSeason, teamId: string,
  offer?: Pick<Contract, 'annualSalary' | 'yearsRemaining'>, opts: { emergency?: boolean; ranking?: string[] } = {}): SigningDecision {
  const path: SigningPath = priorTeamId(player) === teamId ? 'resign' : opts.emergency ? 'emergency' : 'market';
  const base = path === 'resign' ? resignVerdict(extras, player, teamId) : freeAgentVerdict(league, extras, player, teamId, undefined, opts.ranking);
  const quote: SigningDecision = { ...base, path };
  if (base.refuses || !offer) return quote;
  const reject = (reason: string): SigningDecision => ({ ...quote, accepted: false, reason });
  if (offer.yearsRemaining < 1 || offer.yearsRemaining > 5) return reject('Contracts run 1-5 years.');
  if (offer.annualSalary < base.required) return reject(`${player.playerId} turned it down. He wants at least $${(base.required / 1e6).toFixed(1)}M a year from this team${base.reason.startsWith('Price includes') ? ` (${base.reason.replace(/^Price includes: /, '').replace(/\.$/, '')})` : ''}.`);
  const team = league.teams.find(t => t.teamId === teamId);
  if (!team) return reject('Unknown team.');
  const cap = extras.capSettings;
  const payroll = team.seasons.reduce((n, s) => n + (extras.contracts[s.playerId]?.annualSalary ?? 0), 0);
  if (cap.hardCapEnabled && payroll + offer.annualSalary > cap.salaryCap) return reject(`${team.name} would go over the hard cap.`);
  if (path === 'market') {
    const room = capSpaceRemaining(extras.contracts, team, cap);
    if (offer.annualSalary > Math.max(room, cap.minSalary)) return reject(`${player.playerId} is willing, but ${team.name} only has $${(Math.max(0, room) / 1e6).toFixed(1)}M in cap space. Clear room or offer a minimum deal.`);
  }
  return { ...quote, accepted: true, reason: `${player.playerId} accepts.` };
}

/** signFreeAgent behind signingDecision. Returns the league unchanged (and why) when the player or the rules say no. */
export function signFreeAgentChecked(league: League, extras: GMLeagueExtras, playerId: string, teamId: string, contract: Omit<Contract, 'playerId' | 'teamId'>,
  opts: { emergency?: boolean; force?: boolean; ranking?: string[] } = {}): { league: League; extras: GMLeagueExtras; decision: SigningDecision } {
  const player = extras.freeAgents.find(p => p.playerId === playerId);
  if (!player) return { league, extras, decision: { accepted: false, refuses: false, required: 0, interest: 0, reason: `${playerId} is not a free agent.`, path: 'market' } };
  const decision = signingDecision(league, extras, player, teamId, contract, opts);
  if (!decision.accepted && !(opts.force && opts.emergency)) return { league, extras, decision };
  const signed = signFreeAgent(league, extras, playerId, teamId, contract, opts.emergency);
  if (signed.league === league && signed.extras === extras) return { league, extras, decision: { ...decision, accepted: false, reason: "That signing didn't go through: free agency must be open and the roster needs room." } };
  return { ...signed, decision };
}
