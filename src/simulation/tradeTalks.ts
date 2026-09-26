import type { League } from './league';
import type { GMLeagueExtras, TradeProposal } from './gm';
import { validateTrade, tradeableFuturePicks, computeFutureDraftPickValue } from './gm';
import { pickAssetValue, tradeAssetValue } from './tradeValue';
import type { GMPersonality } from './aiGM';

/*
 * Trade talks: when an AI front office turns a proposal down on value, it answers with a counter instead of a flat
 * no — "add a pick", "not him, him", or "without that player" — shaped by its personality. Each team has limited
 * patience: after a few rounds without a deal, talks break off until a later game day.
 */

export type CounterKind = 'add' | 'swap' | 'remove';
export interface Counter { kind: CounterKind; proposal: TradeProposal; text: string }
export interface TradeTalkState { rounds: number; closedUntilRound?: number }

/** How many counters a front office will trade before walking away. */
export const PATIENCE: Record<GMPersonality, number> = { aggressive: 2, balanced: 3, conservative: 4 };

const currentRound = (league: League) => league.schedule.find(g => !g.played)?.round ?? 0;
export const talksKey = (league: League, teamId: string) => `${league.season ?? ''}:${teamId}`;

export function talkState(league: League, extras: GMLeagueExtras, teamId: string): TradeTalkState {
  return extras.tradeTalks?.[talksKey(league, teamId)] ?? { rounds: 0 };
}
/** True when this AI team has broken off talks for now. */
export function talksClosed(league: League, extras: GMLeagueExtras, teamId: string): boolean {
  const s = talkState(league, extras, teamId);
  return s.closedUntilRound != null && currentRound(league) < s.closedUntilRound;
}

function withTalks(league: League, extras: GMLeagueExtras, teamId: string, state: TradeTalkState): GMLeagueExtras {
  return { ...extras, tradeTalks: { ...(extras.tradeTalks ?? {}), [talksKey(league, teamId)]: state } };
}

/** Records a rejected round (declined counter or another lowball); returns whether talks just broke off. */
export function recordTalkRound(league: League, extras: GMLeagueExtras, aiTeamId: string): { extras: GMLeagueExtras; closed: boolean } {
  const personality = extras.teamPersonalities?.[aiTeamId] ?? 'balanced';
  const s = talkState(league, extras, aiTeamId);
  const rounds = s.rounds + 1;
  if (rounds >= PATIENCE[personality]) return { extras: withTalks(league, extras, aiTeamId, { rounds: 0, closedUntilRound: currentRound(league) + 5 }), closed: true };
  return { extras: withTalks(league, extras, aiTeamId, { rounds }), closed: false };
}

const name = (league: League, id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
const pickText = (extras: GMLeagueExtras, id: string) => { const p = extras.futurePicks?.find(x => x.id === id); return p ? `your ${p.year} ${p.round === 1 ? 'first' : 'second'}-round pick` : 'a pick'; };

/** Would the AI side sign off? Everything must check out except whether it's a good deal for you (that's your call). */
export function aiAccepts(league: League, extras: GMLeagueExtras, proposal: TradeProposal, userTeamId: string): boolean {
  const mine = league.teams.find(t => t.teamId === userTeamId)?.name ?? userTeamId;
  return validateTrade(league, extras, proposal).reasons.every(r => r.startsWith(`${mine} would lose too much value`));
}

/**
 * The AI team's counter to a proposal it would reject for value. `userTeamId` is the person's side. Returns null
 * when the deal is already acceptable, fails for a non-value reason (cap, roster, deadline), or nothing works.
 */
export function counterOffer(league: League, extras: GMLeagueExtras, proposal: TradeProposal, userTeamId: string): Counter | null {
  if (aiAccepts(league, extras, proposal, userTeamId)) return null;
  const aiId = proposal.teamAId === userTeamId ? proposal.teamBId : proposal.teamAId;
  if (talksClosed(league, extras, aiId)) return null;
  const userIsA = proposal.teamAId === userTeamId;
  const personality: GMPersonality = extras.teamPersonalities?.[aiId] ?? 'balanced';
  const valid = (p: TradeProposal) => aiAccepts(league, extras, p, userTeamId);
  const userGives = userIsA ? proposal.playersFromA : proposal.playersFromB;
  const aiGives = userIsA ? proposal.playersFromB : proposal.playersFromA;
  const userPicks = (userIsA ? proposal.picksFromA : proposal.picksFromB) ?? [];
  const setUser = (players: string[], picks: string[]): TradeProposal => userIsA ? { ...proposal, playersFromA: players, picksFromA: picks } : { ...proposal, playersFromB: players, picksFromB: picks };
  const setAi = (players: string[]): TradeProposal => userIsA ? { ...proposal, playersFromB: players } : { ...proposal, playersFromA: players };
  const user = league.teams.find(t => t.teamId === userTeamId);
  if (!user) return null;
  const year = parseInt((league.season ?? '2026').slice(0, 4), 10);

  // What it would take: the smallest addition (a pick, or a player) that gets the deal done.
  const pickOptions = tradeableFuturePicks(extras, userTeamId).filter(p => !userPicks.includes(p.id))
    .map(p => ({ id: p.id, value: pickAssetValue(computeFutureDraftPickValue(p, league, year), league, aiId), round: p.round }))
    .sort((a, b) => a.value - b.value);
  const playerOptions = user.seasons.filter(p => !userGives.includes(p.playerId) && !p.stick)
    .map(p => ({ id: p.playerId, value: tradeAssetValue(p, league, extras, aiId) })).sort((a, b) => a.value - b.value);
  const adds: Counter[] = [];
  for (const pk of pickOptions) { const p = setUser(userGives, [...userPicks, pk.id]); if (valid(p)) { adds.push({ kind: 'add', proposal: p, text: `We'd do it if you add ${pickText(extras, pk.id)}.` }); break; } }
  for (const pl of playerOptions) { const p = setUser([...userGives, pl.id], userPicks); if (valid(p)) { adds.push({ kind: 'add', proposal: p, text: `We'd do it if you add ${pl.id}.` }); break; } }

  // Nothing single does it: they ask for a package — your most valuable pieces first, then trim what isn't needed.
  if (!adds.length) {
    const assets = [...pickOptions.map(p => ({ kind: 'pick' as const, id: p.id, value: p.value })), ...playerOptions.map(p => ({ kind: 'player' as const, id: p.id, value: p.value }))]
      .sort((a, b) => b.value - a.value).slice(0, 6);
    let chosen: typeof assets = [];
    const build = (list: typeof assets) => setUser([...userGives, ...list.filter(a => a.kind === 'player').map(a => a.id)], [...userPicks, ...list.filter(a => a.kind === 'pick').map(a => a.id)]);
    for (const a of assets) { chosen = [...chosen, a]; if (valid(build(chosen))) break; if (chosen.length >= 3) { chosen = []; break; } }
    if (chosen.length && valid(build(chosen))) {
      for (const a of [...chosen].reverse()) { const trimmed = chosen.filter(x => x !== a); if (trimmed.length && valid(build(trimmed))) chosen = trimmed; }
      const words = chosen.map(a => a.kind === 'pick' ? pickText(extras, a.id) : a.id);
      adds.push({ kind: 'add', proposal: build(chosen), text: `That's not close. We'd need ${words.slice(0, -1).join(', ')}${words.length > 1 ? ' and ' : ''}${words.at(-1)} added to make it work.` });
    }
  }

  // "Not him, but him": swap one of your outgoing players for a better-fitting one of yours.
  const swaps: Counter[] = [];
  for (const out of userGives) {
    for (const pl of playerOptions) {
      const p = setUser(userGives.map(id => id === out ? pl.id : id), userPicks);
      if (valid(p)) { swaps.push({ kind: 'swap', proposal: p, text: `Not ${out}, but we'd take ${pl.id} instead.` }); break; }
    }
    if (swaps.length) break;
  }

  // "Without him": keep one of the players you asked for.
  const removes: Counter[] = [];
  if (aiGives.length > 1) {
    for (const keep of [...aiGives].sort((a, b) => {
      const pa = league.teams.find(t => t.teamId === aiId)!.seasons.find(s => s.playerId === a), pb = league.teams.find(t => t.teamId === aiId)!.seasons.find(s => s.playerId === b);
      return (pb ? tradeAssetValue(pb, league, extras, aiId) : 0) - (pa ? tradeAssetValue(pa, league, extras, aiId) : 0);
    })) {
      const p = setAi(aiGives.filter(id => id !== keep));
      if (valid(p)) { removes.push({ kind: 'remove', proposal: p, text: `We'd do it without ${keep}; he stays with us.` }); break; }
    }
  }

  // Personality decides which answer comes first: patient offices ask for picks, aggressive ones for players.
  const order: Counter[] = personality === 'conservative' ? [...adds.filter(c => c.text.includes('pick')), ...removes, ...swaps, ...adds]
    : personality === 'aggressive' ? [...swaps, ...adds.filter(c => !c.text.includes('pick')), ...adds, ...removes]
    : [...adds, ...swaps, ...removes];
  const pick = order[0];
  if (!pick) return null;
  const voice = personality === 'aggressive' ? `${name(league, aiId)} push back hard. ` : personality === 'conservative' ? `${name(league, aiId)} are careful. ` : `${name(league, aiId)} come back with a counter. `;
  return { ...pick, text: voice + pick.text };
}
