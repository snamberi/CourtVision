import type { League } from './league';
import type { GMLeagueExtras } from './gm';
import { isTradeDeadlinePassed, computeFutureDraftPickValue, tradeableFuturePicks } from './gm';
import { packageValue, pickAssetValue, tradeAssetValue } from './tradeValue';
import { withGrudge } from './personality';
import { closeStint } from './stints';
import { appendHistoryEvent } from './playerHistory';
import { enforceSticky, stickyTradeProblems } from './sticky';
import type { PlayerSeason } from './types';

/*
 * Three-team trades. Every asset (a player or a future pick) moves from one team to another; each front office
 * judges only its own side: what it gives up against what it gets back, from its own situation, with the same
 * tolerance as two-team deals. A deal that one AI team won't sign off on gets a counter: the smallest addition
 * from your side that satisfies it.
 */

export interface AssetMove { kind: 'player' | 'pick'; id: string; from: string; to: string }
export interface ThreeTeamTrade { teams: [string, string, string]; moves: AssetMove[] }
export interface SideView { teamId: string; give: number; receive: number; ok: boolean }

const TOLERANCE = { easy: 0.3, normal: 0.12, hard: 0.04 } as const;
const year = (league: League) => parseInt((league.season ?? '2026').slice(0, 4), 10);

function assetValue(league: League, extras: GMLeagueExtras, m: AssetMove, viewer: string): number {
  if (m.kind === 'pick') { const pk = extras.futurePicks?.find(p => p.id === m.id); return pk ? pickAssetValue(computeFutureDraftPickValue(pk, league, year(league)), league, viewer) : 0; }
  const p = league.teams.find(t => t.teamId === m.from)?.seasons.find(s => s.playerId === m.id);
  return p ? tradeAssetValue(p, league, extras, viewer) : 0;
}

/** Each team's own view of the deal. */
export function threeTeamSides(league: League, extras: GMLeagueExtras, trade: ThreeTeamTrade): SideView[] {
  const tol = TOLERANCE[extras.tradeSettings.difficulty] ?? 0.12;
  return trade.teams.map(teamId => {
    const out = trade.moves.filter(m => m.from === teamId), inc = trade.moves.filter(m => m.to === teamId);
    const give = out.reduce((n, m) => n + assetValue(league, extras, m, teamId), 0);
    const receive = packageValue(inc.map(m => assetValue(league, extras, m, teamId)), out.filter(m => m.kind === 'player').length);
    return { teamId, give, receive, ok: give <= 0 || receive >= give * (1 - tol) };
  });
}

/** Everything that stops the deal, from any team's side. `userTeamId`'s own value is his call, not a blocker. */
export function validateThreeTeam(league: League, extras: GMLeagueExtras, trade: ThreeTeamTrade, userTeamId?: string | null): string[] {
  const reasons: string[] = [];
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  if (new Set(trade.teams).size !== 3 || trade.teams.some(id => !league.teams.some(t => t.teamId === id))) return ['Choose three different teams.'];
  if (isTradeDeadlinePassed(league)) reasons.push('The trade deadline has passed for this season.');
  for (const id of trade.teams) {
    const out = trade.moves.filter(m => m.from === id), inc = trade.moves.filter(m => m.to === id);
    if (!out.length && !inc.length) reasons.push(`${name(id)} isn't part of the deal yet.`);
  }
  const seen = new Set<string>();
  for (const m of trade.moves) {
    if (seen.has(`${m.kind}:${m.id}`)) reasons.push('An asset cannot move twice.');
    seen.add(`${m.kind}:${m.id}`);
    if (m.from === m.to || !trade.teams.includes(m.from) || !trade.teams.includes(m.to)) reasons.push('Every asset has to go to one of the other teams.');
    if (m.kind === 'player' && !league.teams.find(t => t.teamId === m.from)?.seasons.some(p => p.playerId === m.id)) reasons.push(`${name(m.from)} no longer has ${m.id}.`);
    if (m.kind === 'pick' && !tradeableFuturePicks(extras, m.from).some(p => p.id === m.id)) reasons.push(`${name(m.from)} doesn't own that pick.`);
  }
  reasons.push(...stickyTradeProblems(league, trade.moves.filter(m => m.kind === 'player').map(m => m.id), []));
  if ((league.seasonPhase ?? 'regular_season') === 'regular_season') for (const id of trade.teams) {
    const team = league.teams.find(t => t.teamId === id)!;
    const count = team.seasons.length - trade.moves.filter(m => m.kind === 'player' && m.from === id).length + trade.moves.filter(m => m.kind === 'player' && m.to === id).length;
    if (count > extras.capSettings.maxRosterSize && count > team.seasons.length) reasons.push(`${name(id)} would be above the ${extras.capSettings.maxRosterSize}-player maximum.`);
    if (count < extras.capSettings.minRosterSize && count < team.seasons.length) reasons.push(`${name(id)} would fall below the ${extras.capSettings.minRosterSize}-player minimum.`);
  }
  for (const s of threeTeamSides(league, extras, trade)) if (!s.ok && s.teamId !== userTeamId) reasons.push(`${name(s.teamId)} would lose too much value.`);
  return [...new Set(reasons)];
}

/**
 * What it would take from your side: for each AI team still short, the cheapest of your assets that satisfies it
 * (or your most valuable one, if nothing single does), until everyone is on board. Up to four additions.
 */
export function threeTeamCounter(league: League, extras: GMLeagueExtras, trade: ThreeTeamTrade, userTeamId: string): { trade: ThreeTeamTrade; text: string } | null {
  if (!validateThreeTeam(league, extras, trade, userTeamId).every(r => r.includes('would lose too much value'))) return null;
  const me = league.teams.find(t => t.teamId === userTeamId)!;
  let current = trade;
  const added: AssetMove[] = [];
  for (let step = 0; step < 4; step++) {
    const unhappy = threeTeamSides(league, extras, current).filter(s => !s.ok && s.teamId !== userTeamId).sort((a, b) => (b.give - b.receive) - (a.give - a.receive))[0];
    if (!unhappy) break;
    const used = new Set(current.moves.map(m => `${m.kind}:${m.id}`));
    const options: AssetMove[] = [
      ...tradeableFuturePicks(extras, userTeamId).filter(p => !used.has(`pick:${p.id}`)).map(p => ({ kind: 'pick' as const, id: p.id, from: userTeamId, to: unhappy.teamId })),
      ...me.seasons.filter((p: PlayerSeason) => !used.has(`player:${p.playerId}`) && !p.stick).map(p => ({ kind: 'player' as const, id: p.playerId, from: userTeamId, to: unhappy.teamId })),
    ].sort((a, b) => assetValue(league, extras, a, unhappy.teamId) - assetValue(league, extras, b, unhappy.teamId));
    if (!options.length) return null;
    const satisfies = options.find(o => threeTeamSides(league, extras, { ...current, moves: [...current.moves, o] }).find(s => s.teamId === unhappy.teamId)!.ok);
    const pick = satisfies ?? options[options.length - 1];
    current = { ...current, moves: [...current.moves, pick] };
    added.push(pick);
  }
  if (!added.length || validateThreeTeam(league, extras, current, userTeamId).length) return null;
  const label = (m: AssetMove) => m.kind === 'pick' ? (() => { const pk = (extras.futurePicks ?? []).find(p => p.id === m.id); return pk ? `your ${pk.year} ${pk.round === 1 ? 'first' : 'second'}-round pick` : 'a pick'; })() : m.id;
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  return { trade: current, text: `To get everyone on board: ${added.map(m => `${label(m)} to ${name(m.to)}`).join(', ')}.` };
}

/** Moves every asset. Call validateThreeTeam first. */
export function executeThreeTeam(league: League, extras: GMLeagueExtras, trade: ThreeTeamTrade): { league: League; extras: GMLeagueExtras } {
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const players = trade.moves.filter(m => m.kind === 'player');
  const moving = new Map(players.map(m => [m.id, m]));
  const teams = league.teams.map(t => {
    if (!trade.teams.includes(t.teamId)) return t;
    const incoming = players.filter(m => m.to === t.teamId).map(m => {
      const p = league.teams.find(x => x.teamId === m.from)!.seasons.find(s => s.playerId === m.id)!;
      return appendHistoryEvent(withGrudge({ ...closeStint(p, m.from), teamId: t.teamId }, m.from, league.season), 'traded', `Traded from ${name(m.from)} to ${name(t.teamId)} (three-team deal)`, t.teamId);
    });
    return { ...t, seasons: [...t.seasons.filter(p => !moving.has(p.playerId)), ...incoming] };
  });
  const contracts = { ...extras.contracts };
  for (const m of players) if (contracts[m.id]) contracts[m.id] = { ...contracts[m.id], teamId: m.to };
  const pickTo = new Map(trade.moves.filter(m => m.kind === 'pick').map(m => [m.id, m.to]));
  const futurePicks = (extras.futurePicks ?? []).map(p => pickTo.has(p.id) ? { ...p, currentOwnerTeamId: pickTo.get(p.id)! } : p);
  const settled = enforceSticky({ ...league, teams }, { ...extras, contracts, futurePicks, tradeBlock: extras.tradeBlock.filter(id => !moving.has(id)), picksOnBlock: (extras.picksOnBlock ?? []).filter(id => !pickTo.has(id)) });
  return { league: settled.league, extras: settled.extras };
}
