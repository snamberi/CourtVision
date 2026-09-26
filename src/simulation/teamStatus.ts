import type { LeagueTeam, StandingsRow } from './league';
import type { PlayerSeason, PositionSuitability } from './types';
import { calculateOverall } from './engine/overall';

const STARTER_COUNT = 5;
const POSITIONS: (keyof PositionSuitability)[] = ['PG', 'SG', 'SF', 'PF', 'C'];

/** Whichever position a player is best suited for, per their positional-suitability ratings. */
export function primaryPosition(season: PlayerSeason): keyof PositionSuitability {
  return POSITIONS.reduce((best, pos) => (season.positions[pos] > season.positions[best] ? pos : best), POSITIONS[0]);
}

/** Whichever player has the highest current Overall on the roster — shown with a star icon as the team leader in the UI. */
export function teamLeader(team: LeagueTeam): PlayerSeason | null {
  if (team.seasons.length === 0) return null;
  return [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
}

/**
 * The effective starter/bench designation for every player on a roster:
 * manual `rotationRole` overrides win first; everyone else is auto-ranked by
 * their minutes.target, and the top STARTER_COUNT (that aren't manually
 * benched) fill out the remaining starter slots.
 */
export function effectiveRotation(team: LeagueTeam): Record<string, 'starter' | 'bench'> {
  const manualStarters = team.seasons.filter((s) => s.rotationRole === 'starter').map((s) => s.playerId);
  const manualBench = new Set(team.seasons.filter((s) => s.rotationRole === 'bench').map((s) => s.playerId));
  const unassigned = team.seasons.filter((s) => s.rotationRole == null);

  const slotsLeft = Math.max(0, STARTER_COUNT - manualStarters.length);
  const depthOrder = getRotationOrder(team);
  const autoStarters = [...unassigned].sort((a, b) => depthOrder.indexOf(a.playerId) - depthOrder.indexOf(b.playerId)).slice(0, slotsLeft).map((s) => s.playerId);
  const starterSet = new Set([...manualStarters, ...autoStarters]);

  const result: Record<string, 'starter' | 'bench'> = {};
  for (const s of team.seasons) {
    result[s.playerId] = starterSet.has(s.playerId) && !manualBench.has(s.playerId) ? 'starter' : 'bench';
  }
  return result;
}

/**
 * Manually sets a player's rotation role. Setting someone to 'starter' when
 * there are already 5 keeps the invariant by demoting whichever other
 * starter has the lowest minutes.target down to bench.
 */
export function setRotationRole(team: LeagueTeam, playerId: string, role: 'starter' | 'bench'): LeagueTeam {
  const current = effectiveRotation(team);
  let seasons = team.seasons.map((s) => (s.playerId === playerId ? { ...s, rotationRole: role } : s));

  if (role === 'starter') {
    const startersNow = seasons.filter((s) => (s.playerId === playerId ? true : current[s.playerId] === 'starter'));
    if (startersNow.length > STARTER_COUNT) {
      const demote = [...startersNow]
        .filter((s) => s.playerId !== playerId)
        .sort((a, b) => a.minutes.target - b.minutes.target)[0];
      if (demote) seasons = seasons.map((s) => (s.playerId === demote.playerId ? { ...s, rotationRole: 'bench' } : s));
    }
  }

  return { ...team, seasons };
}

/** The full roster in depth-chart order: stored order first (filtered to currently-rostered players), then any players not yet placed (new signings/draftees) appended by minutes.target. First STARTER_COUNT are starters. */
export function getRotationOrder(team: LeagueTeam): string[] {
  const stored = team.rotationOrder ?? [];
  const rosterIds = new Set(team.seasons.map((s) => s.playerId));
  const validStored = stored.filter((id) => rosterIds.has(id));
  const placed = new Set(validStored);
  const missing = team.seasons
    .filter((s) => !placed.has(s.playerId))
    .sort((a, b) => b.minutes.target - a.minutes.target)
    .map((s) => s.playerId);
  return [...validStored, ...missing];
}

/** Sets the full depth-chart order explicitly (e.g. after a drag-and-drop reorder), syncing rotationRole so the first STARTER_COUNT are starters. */
export function reorderRoster(team: LeagueTeam, orderedPlayerIds: string[]): LeagueTeam {
  const starterIds = new Set(orderedPlayerIds.slice(0, STARTER_COUNT));
  const seasons = team.seasons.map((s) => ({ ...s, rotationRole: (starterIds.has(s.playerId) ? 'starter' : 'bench') as 'starter' | 'bench' }));
  return { ...team, seasons, rotationOrder: orderedPlayerIds };
}

/** Swaps a player one slot up or down the depth chart. */
export function moveInRotation(team: LeagueTeam, playerId: string, direction: 'up' | 'down'): LeagueTeam {
  const order = getRotationOrder(team);
  const idx = order.indexOf(playerId);
  if (idx === -1) return team;
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= order.length) return team;
  const next = [...order];
  [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
  return reorderRoster(team, next);
}

/** Moves one player to just before another in the depth chart - the core operation behind drag-and-drop reordering. */
export function moveToPosition(team: LeagueTeam, playerId: string, beforePlayerId: string): LeagueTeam {
  if (playerId === beforePlayerId) return team;
  const order = getRotationOrder(team).filter((id) => id !== playerId);
  const targetIdx = order.indexOf(beforePlayerId);
  order.splice(targetIdx === -1 ? order.length : targetIdx, 0, playerId);
  return reorderRoster(team, order);
}

/** Sum (not average) of every rostered player's current Overall - a single "Team Overall" number. */
export function computeTeamOverallSum(team: LeagueTeam): number {
  return team.seasons.reduce((sum, s) => sum + calculateOverall(s), 0);
}

export function computeTeamOverallAverage(team: LeagueTeam): number {
  if (team.seasons.length === 0) return 0;
  return computeTeamOverallSum(team) / team.seasons.length;
}

export type TeamStatus = 'Contending' | 'Retooling' | 'Rebuilding' | 'Bottom Feeder' | 'Unproven';

/**
 * A simple heuristic: winning teams with reasonable talent are "Contending";
 * young rosters with poor records are "Rebuilding"; everything else nets
 * out to "Retooling". Falls back to "Unproven" with no standings history.
 */
export function computeTeamStatus(team: LeagueTeam, standingsRow: StandingsRow | null): TeamStatus {
  const avgAge = team.seasons.length > 0 ? team.seasons.reduce((s, p) => s + p.age, 0) / team.seasons.length : 27;
  const avgOverall = computeTeamOverallAverage(team);

  if (!standingsRow || standingsRow.wins + standingsRow.losses === 0) return 'Unproven';

  const winPct = standingsRow.winPct;
  if (winPct >= 0.55 && avgOverall >= 65) return 'Contending';
  if (winPct <= 0.4 && avgAge <= 26) return 'Rebuilding';
  if (winPct <= 0.35) return 'Bottom Feeder';
  return 'Retooling';
}
