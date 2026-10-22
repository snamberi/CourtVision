import type { PlayerSeason } from './types';

/**
 * Scoring options: a coach's pecking order for shots. The first option gets the most shots, the second the next most,
 * the third after that. Set per team on the Roster page; a team with no options set plays exactly as before. They live
 * on the team, so a player who is traded or released simply stops being one.
 *
 * Options work through the two dials the possession engine already reads: ball-handler priority (who has the ball)
 * and ball dominance (who shoots it rather than passing, and who the pass finds). Each option lifts both to a floor;
 * when a team names any options, everyone else is capped below the lowest one, so the order holds.
 */
export type ScoringOption = 1 | 2 | 3;
export type ScoringOptions = Partial<Record<ScoringOption, string>>;

export const SCORING_OPTION_LABEL: Record<ScoringOption, string> = { 1: '1st option', 2: '2nd option', 3: '3rd option' };

const FLOOR: Record<ScoringOption, { priority: number; dominance: number }> = {
  1: { priority: 97, dominance: 94 },
  2: { priority: 86, dominance: 80 },
  3: { priority: 75, dominance: 66 },
};

/** The option `playerId` holds, if any. */
export function optionOf(options: ScoringOptions | undefined, playerId: string): ScoringOption | null {
  for (const o of [1, 2, 3] as const) if (options?.[o] === playerId) return o;
  return null;
}

/** The game-time dials for each player on a roster, with the team's scoring options applied (same array when none apply). */
export function withScoringOptions(roster: PlayerSeason[], options: ScoringOptions | undefined): PlayerSeason[] {
  const held = ([1, 2, 3] as const).filter(o => options?.[o] && roster.some(s => s.playerId === options[o]));
  if (!held.length) return roster;
  const lowest = held[held.length - 1];
  const cap = { priority: FLOOR[lowest].priority - 10, dominance: FLOOR[lowest].dominance - 12 };
  return roster.map(s => {
    const o = optionOf(options, s.playerId), f = o ? FLOOR[o] : null;
    const priority = f ? Math.max(s.ballHandlerPriority, f.priority) : Math.min(s.ballHandlerPriority, cap.priority);
    const dominance = f ? Math.max(s.tendencies.ballDominance, f.dominance) : Math.min(s.tendencies.ballDominance, cap.dominance);
    if (priority === s.ballHandlerPriority && dominance === s.tendencies.ballDominance) return s;
    return { ...s, ballHandlerPriority: priority, tendencies: { ...s.tendencies, ballDominance: dominance } };
  });
}

/** Gives `playerId` the option (or clears his option with null); a player holds at most one, and each option one player. */
export function setScoringOption(options: ScoringOptions | undefined, playerId: string, option: ScoringOption | null): ScoringOptions {
  const next: ScoringOptions = {};
  for (const o of [1, 2, 3] as const) if (options?.[o] && options[o] !== playerId) next[o] = options[o];
  if (option) next[option] = playerId;
  return next;
}
