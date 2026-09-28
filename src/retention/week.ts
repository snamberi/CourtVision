/* ISO weeks and weekly seeds (no dependencies: shared with the online leaderboard). */

/** ISO week in UTC, e.g. "2026-W39". Weeks start on Monday. */
export function weekKey(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // the week's Thursday decides its year
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** When the current week ends (next Monday 00:00 UTC). */
export function weekEndsAt(now = new Date()): number {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  return d.getTime() + (8 - day) * 86_400_000;
}

export function weeklySeed(kind: string, week: string): number {
  let h = 2166136261;
  for (const ch of `courtvision-weekly|${kind}|${week}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 1_000_000_000;
}
