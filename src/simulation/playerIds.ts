import type { League } from './league';
import type { GMLeagueExtras } from './gm';
import type { PlayerSeason } from './types';

/**
 * A player's `playerId` is their display name, and every roster, contract, injury, watch list and
 * history lookup is keyed by it. Two players sharing an id therefore behave as one person: lookups
 * find only the first, contracts overwrite each other, and waiving or trading one removes both.
 * These helpers make sure that can never happen.
 */

const NAME_SUFFIXES = ['Jr.', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Every player id currently in use anywhere in the universe: rosters, free agents, the draft class, and retirees. */
export function collectPlayerIds(league: League, extras?: GMLeagueExtras): Set<string> {
  const ids = new Set<string>();
  for (const t of league.teams) for (const s of t.seasons) ids.add(s.playerId);
  for (const r of league.retiredPlayers ?? []) ids.add(r.playerId);
  if (extras) {
    for (const s of extras.freeAgents) ids.add(s.playerId);
    for (const p of extras.draftClass) ids.add(p.playerId);
  }
  return ids;
}

/**
 * Returns `base` if it is free, otherwise the first free variant ("Name Jr.", "Name III", ...).
 * The returned id is added to `taken` so repeated calls never hand out the same id twice.
 */
export function uniquePlayerId(base: string, taken: Set<string>): string {
  let candidate = base;
  if (taken.has(candidate)) {
    for (const suffix of NAME_SUFFIXES) {
      candidate = `${base} ${suffix}`;
      if (!taken.has(candidate)) break;
    }
    let n = 11;
    while (taken.has(candidate)) candidate = `${base} ${n++}`;
  }
  taken.add(candidate);
  return candidate;
}

/**
 * Gives a player a new unique id if theirs is already taken, keeping firstName/lastName in step so
 * the name shown around the app matches. Returns the same object untouched when no change is needed.
 */
export function withUniquePlayerId<T extends Pick<PlayerSeason, 'playerId' | 'firstName' | 'lastName'>>(season: T, taken: Set<string>): T {
  const oldId = season.playerId;
  const newId = uniquePlayerId(oldId, taken);
  if (newId === oldId) return season;
  const suffix = newId.slice(oldId.length).trim();
  const namesMatchId = !!season.firstName && !!season.lastName && `${season.firstName} ${season.lastName}`.trim() === oldId;
  return { ...season, playerId: newId, ...(namesMatchId ? { lastName: `${season.lastName} ${suffix}` } : {}) };
}
