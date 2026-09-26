import type { MinutesConfig, PlayerId } from '../types';

export interface RosterEntry {
  playerId: PlayerId;
  minutes: MinutesConfig;
}

export interface QuarterPlan {
  quarter: number;
  onCourt: PlayerId[]; // exactly 5 (or fewer if roster is short)
  secondsEach: number; // seconds each on-court player is credited this quarter (simplified: uniform per quarter chunk)
}

/**
 * Builds a full-game substitution plan. This is a Phase-1 approximation: it
 * allocates quarters (not possession-by-possession clock) to the 5 players
 * whose remaining target-minute need is highest, so EXACT minutes converge
 * on the requested total across the game. Manual/quarter-specific configs
 * are respected when provided.
 */
export function buildGamePlan(
  roster: RosterEntry[],
  numQuarters: number,
  quarterLengthMinutes: number,
): QuarterPlan[] {
  const remaining: Record<PlayerId, number> = {};
  for (const r of roster) remaining[r.playerId] = r.minutes.target;

  const plans: QuarterPlan[] = [];
  for (let q = 1; q <= numQuarters; q++) {
    const perQuarterOverride = roster
      .filter((r) => r.minutes.mode === 'EXACT' && r.minutes.perQuarter)
      .map((r) => ({ playerId: r.playerId, minutes: r.minutes.perQuarter![Math.min(3, q - 1)] ?? 0 }));

    let onCourt: PlayerId[];
    if (perQuarterOverride.length >= 5) {
      onCourt = perQuarterOverride
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 5)
        .map((r) => r.playerId);
    } else {
      // Rank by remaining need (highest remaining / quarters left plays first).
      const quartersLeft = numQuarters - q + 1;
      const ranked = roster
        .map((r) => ({ playerId: r.playerId, need: remaining[r.playerId] / quartersLeft }))
        .sort((a, b) => b.need - a.need);
      onCourt = ranked.slice(0, 5).map((r) => r.playerId);
    }

    for (const id of onCourt) {
      remaining[id] = Math.max(0, (remaining[id] ?? 0) - quarterLengthMinutes);
    }

    plans.push({ quarter: q, onCourt, secondsEach: quarterLengthMinutes * 60 });
  }

  return plans;
}
