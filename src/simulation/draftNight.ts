import type { League } from './league';
import { computeStandings } from './league';
import type { GMLeagueExtras, DraftProspect, TradeProposal } from './gm';
import { validateTrade, tradeableFuturePicks, currentDraftOrder } from './gm';
import { calculateOverall } from './engine/overall';

/*
 * Draft night: the lottery reveal, the consensus board the media grades picks against, and the calls a war room
 * gets while it's on the clock.
 */

export interface LotteryEntry { teamId: string; before: number; after: number; oddsTop: number }
export interface LotteryResult { season: string; entries: LotteryEntry[]; revealed?: boolean }

/** Who was where before the balls were drawn, and where they ended up (round 1, the 14 lottery slots). */
export function lotteryResult(league: League, round1: string[], season: string): LotteryResult | undefined {
  const pre = [...computeStandings(league)].sort((a, b) => a.winPct - b.winPct).slice(0, Math.min(14, league.teams.length)).map(r => r.teamId);
  if (pre.length < 2) return undefined;
  const total = pre.reduce((n, _, i) => n + (pre.length - i), 0);
  return { season, entries: pre.map((teamId, i) => ({ teamId, before: i + 1, after: round1.indexOf(teamId) + 1, oddsTop: Math.round(((pre.length - i) / total) * 1000) / 10 })) };
}

/** The media's consensus value of a prospect: today's ability and upside (their read sits between the truth and the scouts'). */
export function consensusScore(p: DraftProspect): number {
  const upside = (p.trueSeason.development.potential + p.scoutedPotential) / 2;
  return calculateOverall(p.trueSeason) * 0.4 + upside * 0.6;
}
/** The consensus big board: each prospect's rank (0 = the best) in the class. */
export function consensusBoard(prospects: DraftProspect[]): Record<string, number> {
  return Object.fromEntries([...prospects].sort((a, b) => consensusScore(b) - consensusScore(a) || a.playerId.localeCompare(b.playerId)).map((p, i) => [p.playerId, i]));
}

export type PickReaction = 'Steal' | 'Great value' | 'Best available' | 'Solid pick' | 'Slight reach' | 'Reach';
/** How the room reacts to a pick: where the consensus had him against where he went. */
export function pickReaction(boardRank: number, pickNumber: number, bestRemainingRank: number): PickReaction {
  const diff = pickNumber - boardRank;
  if (diff >= 6) return 'Steal';
  if (diff >= 3) return 'Great value';
  if (diff <= -8) return 'Reach';
  if (diff <= -4) return 'Slight reach';
  return boardRank === bestRemainingRank ? 'Best available' : 'Solid pick';
}

/**
 * Calls to the war room while you're on the clock: teams picking later offer their pick plus a future pick to move
 * up into your slot. Only offers their front office would sign off on.
 */
export function tradeDownOffers(league: League, extras: GMLeagueExtras, userTeamId: string, max = 3): (TradeProposal & { note: string })[] {
  const order = currentDraftOrder(league, extras);
  const slot = extras.draftPickIndex;
  if (!extras.draftDayOpen || order[slot] !== userTeamId) return [];
  const made = new Set((extras.draftPicksMade ?? []).map(p => p.pickNumber));
  const n = Math.max(1, league.teams.length);
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const mine = league.teams.find(t => t.teamId === userTeamId)?.name ?? userTeamId;
  const offers: (TradeProposal & { note: string })[] = [];
  const seen = new Set<string>();
  for (let later = slot + 2; later < Math.min(order.length, slot + 14) && offers.length < max; later++) {
    const team = order[later];
    if (team === userTeamId || made.has(later) || seen.has(team)) continue;
    seen.add(team);
    const futures = tradeableFuturePicks(extras, team).sort((a, b) => b.round - a.round || a.year - b.year);
    for (const extra of [undefined, ...futures.slice(0, 4)]) {
      const p: TradeProposal = { teamAId: team, teamBId: userTeamId, playersFromA: [], playersFromB: [], currentPicksFromA: [later], currentPicksFromB: [slot], ...(extra ? { picksFromA: [extra.id] } : {}) };
      const reasons = validateTrade(league, extras, p).reasons.filter(r => !r.startsWith(`${mine} would lose too much value`));
      if (reasons.length) continue;
      const label = (s: number) => `R${Math.floor(s / n) + 1} #${s % n + 1}`;
      offers.push({ ...p, note: `${name(team)} want to move up: their ${label(later)}${extra ? ` and a ${extra.year} ${extra.round === 1 ? 'first' : 'second'}-rounder` : ''} for your ${label(slot)}.` });
      break;
    }
  }
  return offers;
}
