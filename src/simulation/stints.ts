import type { PlayerSeason, SeasonStatTotals, SeasonStint } from './types';
import { emptySeasonStatTotals } from './types';

/* Team-specific season stints.
 * `seasonStats` stays the player's whole-season total (like a "TOT" line), so awards, leaders and records are
 * unchanged. When a player leaves a team mid-season (trade, waiver, sandbox move), the part of his season played
 * there is closed as a stint. His current team's share is always the total minus the closed stints. */

const KEYS = Object.keys(emptySeasonStatTotals()) as (keyof SeasonStatTotals)[];
export function addTotals(a: SeasonStatTotals, b: SeasonStatTotals): SeasonStatTotals {
  const out = { ...a };
  for (const k of KEYS) out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  return out;
}
export function subtractTotals(a: SeasonStatTotals, b: SeasonStatTotals): SeasonStatTotals {
  const out = { ...a };
  for (const k of KEYS) out[k] = Math.max(0, (a[k] ?? 0) - (b[k] ?? 0));
  return out;
}
const hasPlayed = (t: SeasonStatTotals | undefined) => !!t && (t.gamesPlayed > 0 || t.minutes > 0);

/** The part of this season not yet assigned to a closed stint, i.e. what he's done for his current (or last) team. */
export function openStintStats(p: PlayerSeason): SeasonStatTotals {
  const total = p.seasonStats ?? emptySeasonStatTotals();
  return (p.seasonStints ?? []).reduce((rest, s) => subtractTotals(rest, s.stats), total);
}

/** Closes the stint with `fromTeamId` when the player leaves it. Safe to call when nothing was played (no-op). */
export function closeStint(p: PlayerSeason, fromTeamId: string): PlayerSeason {
  const open = openStintStats(p);
  if (!hasPlayed(open)) return p;
  const stints = [...(p.seasonStints ?? [])];
  const last = stints[stints.length - 1];
  if (last && last.teamId === fromTeamId) stints[stints.length - 1] = { teamId: fromTeamId, stats: addTotals(last.stats, open) };
  else stints.push({ teamId: fromTeamId, stats: open });
  return { ...p, seasonStints: stints };
}

/**
 * Every team this player suited up for this season with his totals there, in order. `currentTeamId` is the team he's
 * on now (null for a free agent, whose open share stays with his last closed team).
 */
export function seasonStintsFor(p: PlayerSeason, currentTeamId: string | null): SeasonStint[] {
  const closed = p.seasonStints ?? [];
  const open = openStintStats(p);
  const rows: SeasonStint[] = closed.map(s => ({ ...s }));
  if (hasPlayed(open)) {
    const teamId = currentTeamId ?? closed[closed.length - 1]?.teamId ?? p.teamId ?? null;
    if (teamId) {
      const last = rows[rows.length - 1];
      if (last && last.teamId === teamId) rows[rows.length - 1] = { teamId, stats: addTotals(last.stats, open) };
      else rows.push({ teamId, stats: open });
    }
  }
  return rows;
}

/** A team's share of a player's season (zero totals if he never played for them). */
export function statsWithTeam(p: PlayerSeason, currentTeamId: string | null, teamId: string): SeasonStatTotals {
  return seasonStintsFor(p, currentTeamId).filter(s => s.teamId === teamId).reduce((sum, s) => addTotals(sum, s.stats), emptySeasonStatTotals());
}
