import type { PlayerSeason } from './types';

/** A redshirt/DNP year is not a played season. Age and draft year are not evidence of experience. */
export function previousSeasonsPlayed(player: PlayerSeason): number {
  return new Set((player.careerHistory ?? [])
    .filter(h => h.season !== player.season && h.stats.gamesPlayed > 0)
    .map(h => h.season)).size;
}

export function isRookieEligible(player: PlayerSeason): boolean {
  return previousSeasonsPlayed(player) === 0;
}
