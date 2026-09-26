import type { PlayerSeason, PlayerHistoryEvent, PlayerHistoryEventType } from './types';

/** Appends one event to a player's career history log without mutating the original season object. */
export function appendHistoryEvent(
  season: PlayerSeason,
  type: PlayerHistoryEventType,
  description: string,
  teamId?: string | null,
): PlayerSeason {
  const event: PlayerHistoryEvent = { season: season.season, type, description, teamId };
  return { ...season, history: [...(season.history ?? []), event] };
}
