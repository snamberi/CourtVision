import type { League, LeagueTeam } from './league';
import type { Contract, GMLeagueExtras } from './gm';
import { computeAskingSalary } from './gm';
import { calculateOverall } from './engine/overall';
import { collectPlayerIds, withUniquePlayerId } from './playerIds';
import type { PlayerSeason } from './types';

export interface PlayerIdRepair {
  oldId: string;
  newId: string;
  location: string; // team name, "Free Agency", or "Draft Class"
}

/** Lists every player id that appears more than once across rosters, free agency, the draft class, or the retired list. */
export function findDuplicatePlayerIds(league: League, extras: GMLeagueExtras): string[] {
  const counts = new Map<string, number>();
  const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const t of league.teams) for (const s of t.seasons) bump(s.playerId);
  for (const s of extras.freeAgents) bump(s.playerId);
  for (const p of extras.draftClass) bump(p.playerId);
  for (const r of league.retiredPlayers ?? []) bump(r.playerId);
  return [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
}

function freshContract(season: PlayerSeason, teamId: string, extras: GMLeagueExtras): Contract {
  return {
    playerId: season.playerId,
    teamId,
    annualSalary: computeAskingSalary(calculateOverall(season), extras.capSettings),
    yearsRemaining: 2,
    playerOption: false,
    teamOption: false,
  };
}

/**
 * Repairs a universe where several different players ended up sharing one id (older versions generated
 * draft prospects without checking the names already in the league). The first player found keeps the
 * name; each later one is renamed with a suffix ("Jr.", "III", ...) and given a contract of its own if
 * the shared one didn't belong to it. Nothing is deleted. Returns the inputs unchanged (same object
 * references) when there is nothing to repair, so it is safe to call on every load.
 */
export function repairDuplicatePlayerIds(
  league: League,
  extras: GMLeagueExtras,
): { league: League; extras: GMLeagueExtras; repairs: PlayerIdRepair[] } {
  if (findDuplicatePlayerIds(league, extras).length === 0) return { league, extras, repairs: [] };

  const all = collectPlayerIds(league, extras); // every id in use; grows as suffixed ids are handed out
  const seen = new Set<string>((league.retiredPlayers ?? []).map((r) => r.playerId)); // a retiree's name stays theirs
  const repairs: PlayerIdRepair[] = [];
  const contracts: Record<string, Contract> = { ...extras.contracts };
  // Which contract owner-team each shared id had before we touched anything
  const originalContracts = extras.contracts;
  const keptOwnerTeam = new Map<string, string | null>(); // id -> team of the player that kept the name

  const claim = <T extends PlayerSeason>(season: T, location: string, teamId: string | null): T => {
    const id = season.playerId;
    if (!seen.has(id)) {
      seen.add(id);
      keptOwnerTeam.set(id, teamId);
      return season;
    }
    const renamed = withUniquePlayerId(season, all);
    seen.add(renamed.playerId);
    repairs.push({ oldId: id, newId: renamed.playerId, location });

    const shared = originalContracts[id];
    if (teamId) {
      if (shared && shared.teamId === teamId && keptOwnerTeam.get(id) !== teamId) {
        // The surviving contract actually belongs to this player, not the one that kept the name: hand it over.
        // (The player who kept the name gets a fresh contract in the pass below.)
        contracts[renamed.playerId] = { ...shared, playerId: renamed.playerId };
      } else {
        contracts[renamed.playerId] = freshContract(renamed, teamId, extras);
      }
    }
    return renamed;
  };

  const teams: LeagueTeam[] = league.teams.map((t) => ({
    ...t,
    seasons: t.seasons.map((s) => claim(s, t.name, t.teamId)),
  }));
  const freeAgents = extras.freeAgents.map((s) => claim(s, 'Free Agency', null));
  const draftClass = extras.draftClass.map((p) => {
    const trueSeason = claim(p.trueSeason, 'Draft Class', null);
    return trueSeason === p.trueSeason ? p : { ...p, playerId: trueSeason.playerId, trueSeason };
  });

  // The player who kept the shared name needs a contract that points at their own team.
  for (const t of teams) {
    for (const s of t.seasons) {
      const c = contracts[s.playerId];
      if (repairs.some((r) => r.oldId === s.playerId) && (!c || c.teamId !== t.teamId)) {
        contracts[s.playerId] = freshContract(s, t.teamId, extras);
      }
    }
  }

  return { league: { ...league, teams }, extras: { ...extras, contracts, freeAgents, draftClass }, repairs };
}
