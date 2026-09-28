import type { League } from './league';
import type { GMLeagueExtras, Contract } from './gm';
import type { PlayerSeason } from './types';

/*
 * Sandbox "stick": a player stuck to a team never leaves it and never retires; a player stuck to another player
 * goes wherever that player goes (trades, free agency, historical rosters). Unsticking restores normal rules.
 * One normalisation pass (enforceSticky) puts every stuck player where his rule says, so every roster mover can
 * simply call it afterwards.
 */

export interface StickRule { teamId?: string; withPlayerId?: string }

export const isStuck = (p: Pick<PlayerSeason, 'stick'> | undefined) => !!p?.stick && (!!p.stick.teamId || !!p.stick.withPlayerId);

type Where = { teamId: string | null; player: PlayerSeason };
function locate(league: League, extras: GMLeagueExtras): Map<string, Where> {
  const at = new Map<string, Where>();
  for (const t of league.teams) for (const p of t.seasons) at.set(p.playerId, { teamId: t.teamId, player: p });
  for (const p of extras.freeAgents) if (!at.has(p.playerId)) at.set(p.playerId, { teamId: null, player: p });
  return at;
}

/** Where a stuck player belongs right now: his team, his anchor's team (or free agency), or undefined = leave him be. */
function destination(p: PlayerSeason, at: Map<string, Where>, league: League): string | null | undefined {
  if (p.stick?.teamId) return league.teams.some(t => t.teamId === p.stick!.teamId) ? p.stick.teamId : undefined;
  if (p.stick?.withPlayerId) { const anchor = at.get(p.stick.withPlayerId); return anchor ? anchor.teamId : undefined; }
  return undefined;
}

/** Moves every stuck player to where his rule puts him. Returns the same objects when nothing needed to move. */
export function enforceSticky(league: League, extras: GMLeagueExtras): { league: League; extras: GMLeagueExtras; moved: string[] } {
  const stuck = [...league.teams.flatMap(t => t.seasons), ...extras.freeAgents].filter(isStuck);
  if (!stuck.length) return { league, extras, moved: [] };
  let teams = league.teams, freeAgents = extras.freeAgents;
  const contracts: Record<string, Contract> = { ...extras.contracts };
  const moved: string[] = [];
  // A few passes so chains (A follows B, B follows C) settle.
  for (let pass = 0; pass < 4; pass++) {
    const cur = { ...league, teams };
    const at = locate(cur, { ...extras, freeAgents });
    let changed = false;
    for (const s of stuck) {
      const here = at.get(s.playerId);
      if (!here) continue; // retired or gone
      const to = destination(here.player, at, cur);
      if (to === undefined || to === here.teamId) continue;
      const p = here.player;
      teams = teams.map(t => t.teamId === here.teamId ? { ...t, seasons: t.seasons.filter(x => x.playerId !== p.playerId) } : t);
      freeAgents = freeAgents.filter(x => x.playerId !== p.playerId);
      if (to === null) {
        delete contracts[p.playerId];
        freeAgents = [...freeAgents, { ...p, teamId: null }];
      } else {
        contracts[p.playerId] = contracts[p.playerId] ? { ...contracts[p.playerId], teamId: to }
          : { playerId: p.playerId, teamId: to, annualSalary: extras.capSettings.minSalary, yearsRemaining: 2, playerOption: false, teamOption: false };
        teams = teams.map(t => t.teamId === to ? { ...t, seasons: [...t.seasons, { ...p, teamId: to }] } : t);
      }
      at.set(p.playerId, { teamId: to, player: p });
      moved.push(p.playerId);
      changed = true;
    }
    if (!changed) break;
  }
  if (!moved.length) return { league, extras, moved };
  return { league: { ...league, teams }, extras: { ...extras, contracts, freeAgents }, moved };
}

/** Trade rules for stuck players: team-stuck players can't be traded; a follower moves only with his anchor. */
export function stickyTradeProblems(league: League, fromA: string[], fromB: string[]): string[] {
  const all = new Map(league.teams.flatMap(t => t.seasons.map(p => [p.playerId, p] as const)));
  const problems: string[] = [];
  for (const side of [fromA, fromB]) for (const id of side) {
    const p = all.get(id);
    if (!p?.stick) continue;
    if (p.stick.teamId) problems.push(`${id} is stuck to ${league.teams.find(t => t.teamId === p.stick!.teamId)?.name ?? p.stick.teamId} (Sandbox). Unstick him to trade him.`);
    else if (p.stick.withPlayerId && !side.includes(p.stick.withPlayerId) && all.has(p.stick.withPlayerId)) problems.push(`${id} is stuck with ${p.stick.withPlayerId} and can only be traded together with him.`);
  }
  return problems;
}

/** Sets or clears a player's stick rule wherever he is, then settles everyone. */
export function setStick(league: League, extras: GMLeagueExtras, playerId: string, rule: StickRule | null): { league: League; extras: GMLeagueExtras } {
  if (rule?.withPlayerId === playerId) return { league, extras };
  const apply = (p: PlayerSeason): PlayerSeason => {
    if (p.playerId !== playerId) return p;
    const { stick: _old, ...rest } = p; void _old;
    return rule ? { ...rest, stick: rule } : rest;
  };
  const next = { league: { ...league, teams: league.teams.map(t => ({ ...t, seasons: t.seasons.map(apply) })) }, extras: { ...extras, freeAgents: extras.freeAgents.map(apply) } };
  const settled = enforceSticky(next.league, next.extras);
  return { league: settled.league, extras: settled.extras };
}
