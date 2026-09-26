function clampChemistry(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Small per-game nudge: wins build cohesion, losses erode it. Deliberately subtle so it takes a real streak to move the needle. */
export function driftChemistryAfterGame(chemistry: number | undefined, won: boolean): number {
  const current = chemistry ?? 70;
  return clampChemistry(current + (won ? 0.3 : -0.25));
}

/**
 * Chemistry shift from offseason roster turnover: a team that mostly kept its
 * core together gets a cohesion bump for continuity; a team that churned
 * through the draft/free-agency/waives takes a hit as new pieces re-learn
 * how to play together. `beforeRosterIds` is the roster right as the
 * offseason began (post-retirement/contract-resolution, pre-draft/FA);
 * `afterRosterIds` is the roster once the new season actually starts.
 */
export function driftChemistryForRosterContinuity(chemistry: number | undefined, beforeRosterIds: string[], afterRosterIds: string[]): number {
  const current = chemistry ?? 70;
  if (beforeRosterIds.length === 0) return current;
  const afterSet = new Set(afterRosterIds);
  const retained = beforeRosterIds.filter((id) => afterSet.has(id)).length;
  const continuity = retained / beforeRosterIds.length;

  if (continuity >= 0.8) return clampChemistry(current + 5);
  if (continuity >= 0.6) return clampChemistry(current + 1);
  if (continuity >= 0.4) return current;
  if (continuity >= 0.2) return clampChemistry(current - 6);
  return clampChemistry(current - 12);
}
