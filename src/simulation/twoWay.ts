import type { PlayerSeason } from './types';
import type { League } from './league';
import { calculateOverall } from './engine/overall';
import { rescaleToOverall } from '../history/realPlayers';
import { appendHistoryEvent } from './playerHistory';

/* Two-way contracts: up to two young players per team play in the G League. They are not part of the 15-man roster,
 * suit up for NBA games only when called up, are not playoff eligible, and develop faster from the G League minutes. */

export const TWO_WAY_SLOTS = 2;
export const TWO_WAY_MAX_AGE = 25;
export const TWO_WAY_MAX_OVERALL = 62;

export function twoWayEligible(p: PlayerSeason): boolean {
  return p.age <= TWO_WAY_MAX_AGE && calculateOverall(p) <= TWO_WAY_MAX_OVERALL && !p.careerPlayer && !p.stick;
}

/** Why a player can't be moved to a two-way deal right now, or null when he can. */
export function twoWayBlocker(team: { seasons: PlayerSeason[] }, p: PlayerSeason): string | null {
  if (p.twoWay) return null;
  if (!twoWayEligible(p)) return `Two-way deals are for players ${TWO_WAY_MAX_AGE} or younger rated ${TWO_WAY_MAX_OVERALL} or lower.`;
  if (team.seasons.filter(s => s.twoWay).length >= TWO_WAY_SLOTS) return `Both two-way slots are full (${TWO_WAY_SLOTS} per team).`;
  return null;
}

/** Moves a player onto (or off) a two-way deal. Leaving a two-way deal also ends any call-up. */
export function setTwoWay(league: League, teamId: string, playerId: string, on: boolean): League {
  return { ...league, teams: league.teams.map(t => t.teamId !== teamId ? t : { ...t, seasons: t.seasons.map(p => {
    if (p.playerId !== playerId) return p;
    if (on && twoWayBlocker(t, p)) return p;
    const next: PlayerSeason = on ? { ...p, twoWay: true, calledUp: false } : { ...p, twoWay: undefined, calledUp: undefined };
    return appendHistoryEvent(next, 'signed', on ? `Moved to a two-way contract with ${t.name} (G League)` : `Converted to a standard contract with ${t.name}`, t.teamId);
  }) }) };
}

export function setCalledUp(league: League, teamId: string, playerId: string, calledUp: boolean): League {
  return { ...league, teams: league.teams.map(t => t.teamId !== teamId ? t : { ...t, seasons: t.seasons.map(p => (p.playerId === playerId && p.twoWay ? { ...p, calledUp } : p)) }) };
}

/** Roster spots that count toward the 15-man limit (two-way players do not). */
export const standardRosterCount = (team: { seasons: PlayerSeason[] }) => team.seasons.filter(p => !p.twoWay).length;

/** End-of-season G League bump: young two-way players gain one to two more points than they otherwise would. */
export function gLeagueGrowth(before: PlayerSeason, developed: PlayerSeason): PlayerSeason {
  if (before.age > TWO_WAY_MAX_AGE) return developed;
  const was = calculateOverall(before), now = calculateOverall(developed);
  const bonus = before.age <= 21 ? 2 : 1;
  return rescaleToOverall(developed, Math.max(now, was) + bonus);
}
