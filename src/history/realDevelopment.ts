import type { PlayerSeason } from '../simulation/types';
import type { League } from '../simulation/league';
import { calculateOverall, calculateFullAttributeOverall } from '../simulation/engine/overall';
import { rescaleToOverall, type RealPlayerInfo, type RatingFrame } from './realPlayers';

/* Real Player Development.
 * On (default for historical leagues): a real player's Overall follows his reference trajectory — Court Vision's own
 * rating computed from his statistics for each real season — applied once per season at rollover. Training, coaching,
 * facilities and minutes cannot permanently change his base attributes; they still drive workload, recovery, morale,
 * system familiarity and role familiarity.
 * Off: real players develop exactly like everyone else, starting from their current attributes.
 *
 * Coverage policy
 *  - A season with a reference point applies it ("reference").
 *  - A season between two reference points (a missed season: injury, retirement-and-comeback) is linearly
 *    interpolated and labelled "Interpolated".
 *  - Before the first or after the last reference point there is no trajectory: Court Vision development (aging,
 *    decline and retirement) takes over and the player profile says so. Nothing is extrapolated. */

export { realDevelopmentOn, followsRealDevelopment } from '../simulation/realDevelopmentGate';
import { realDevelopmentOn } from '../simulation/realDevelopmentGate';

export interface RealTarget { startYear: number; ovr: number; source: string; kind: 'reference' | 'interpolated' }

function referencePoints(info: RealPlayerInfo): RatingFrame[] {
  const pts = new Map<number, RatingFrame>();
  // The rating the player was created with is a reference point too, unless it was itself interpolated.
  if (info.rating.kind !== 'interpolated') pts.set(info.rating.startYear, [info.rating.startYear, info.rating.ovr, info.rating.source]);
  for (const f of info.frames ?? []) pts.set(f[0], f);
  return [...pts.values()].sort((a, b) => a[0] - b[0]);
}

/** The reference rating for a season start year, or null outside the trajectory. */
export function realTargetFor(info: RealPlayerInfo | undefined, startYear: number): RealTarget | null {
  if (!info) return null;
  const pts = referencePoints(info);
  const exact = pts.find(f => f[0] === startYear);
  if (exact) return { startYear, ovr: exact[1], source: exact[2], kind: 'reference' };
  const before = [...pts].reverse().find(f => f[0] < startYear), after = pts.find(f => f[0] > startYear);
  if (!before || !after) return null;
  const t = (startYear - before[0]) / (after[0] - before[0]);
  return { startYear, ovr: Math.round(before[1] + (after[1] - before[1]) * t), source: 'interpolated', kind: 'interpolated' };
}

/** Last season start year with a reference point. */
export function realCoverageEnd(info: RealPlayerInfo | undefined): number | null {
  if (!info) return null;
  const pts = referencePoints(info);
  return pts.length ? pts[pts.length - 1][0] : null;
}


/**
 * One offseason for a real player under Real Player Development: ages him a year and moves his Overall to the
 * reference for `newSeason`. Returns null when there is no reference (caller falls back to Court Vision development).
 * Idempotent: a player whose reference for `newSeason` is already applied is returned unchanged.
 */
export function applyRealDevelopment(p: PlayerSeason, newSeason: string): PlayerSeason | null {
  if (!p.real) return null;
  if (p.real.appliedSeason === newSeason) return p;
  const target = realTargetFor(p.real, Number(newSeason));
  if (!target) return null;
  const beforeOverall = calculateOverall(p), beforeFull = calculateFullAttributeOverall(p);
  const aged: PlayerSeason = { ...p, age: p.age + 1 };
  const next = rescaleToOverall(aged, target.ovr);
  return {
    ...next,
    previousOverall: beforeOverall, previousFullOverall: beforeFull,
    real: {
      ...p.real, appliedSeason: newSeason, fallbackSince: undefined,
      rating: { ovr: target.ovr, source: target.source, startYear: target.startYear, kind: target.kind },
    },
  };
}

/** Marks a real player whose trajectory has ended (or not begun) as developing through Court Vision this season. */
export function markRealFallback(p: PlayerSeason, newSeason: string): PlayerSeason {
  if (!p.real) return p;
  const end = realCoverageEnd(p.real);
  const beforeStart = end != null && Number(newSeason) < (referencePoints(p.real)[0]?.[0] ?? 0);
  return beforeStart ? p : { ...p, real: { ...p.real, fallbackSince: p.real.fallbackSince ?? newSeason } };
}

/** Whether a real player's reference trajectory says he played this season (so random retirement is skipped). */
export const realCareerContinues = (p: PlayerSeason, newSeason: string) => !!p.real && realTargetFor(p.real, Number(newSeason)) != null;

/** Plain-language status of a real player's development for profiles and the training page. */
export function realDevelopmentStatus(p: PlayerSeason, league: Pick<League, 'historical' | 'season'>): string | null {
  if (!p.real) return null;
  if (!realDevelopmentOn(league)) return 'Real Player Development is off in this league: this real player develops through Court Vision (team, coaching, training, minutes and aging).';
  if (p.real.fallbackSince) return `Reference trajectory ended after ${seasonText(realCoverageEnd(p.real))}. Since ${seasonText(Number(p.real.fallbackSince))} he develops, ages and retires through Court Vision's system.`;
  const season = Number(league.season ?? p.season);
  const upcoming = realTargetFor(p.real, season + 1);
  const first = referencePoints(p.real)[0]?.[0];
  if (first != null && season < first) return `His real trajectory starts in ${seasonText(first)}; until then he develops through Court Vision.`;
  if (p.real.appliedSeason !== String(season)) return 'Real Player Development resumes at the next season rollover (this season\'s ratings came from Court Vision development).';
  return upcoming
    ? `Follows his real rating trajectory: base ratings change only at season rollover${upcoming.kind === 'interpolated' ? ' (next season is interpolated between two reference points)' : ''}. Training affects workload, recovery, morale and familiarity, not ratings.`
    : `Follows his real rating trajectory through ${seasonText(realCoverageEnd(p.real))}. After that the reference data ends and Court Vision development takes over.`;
}
export const seasonText = (startYear: number | null) => (startYear == null ? '—' : `${startYear}–${String((startYear + 1) % 100).padStart(2, '0')}`);

/** The offseason log line for a real player (training history and coach reports). */
export function realDevelopmentNote(after: PlayerSeason, applied: boolean): string {
  const r = after.real;
  if (!r) return '';
  if (!applied) return r.fallbackSince
    ? `Real Player Development: no reference rating for ${seasonText(Number(r.fallbackSince))} — developed through Court Vision (aging, minutes, coaching).`
    : 'Real Player Development: his real trajectory has not started yet — developed through Court Vision.';
  const what = r.rating.kind === 'interpolated' ? 'interpolated between two reference seasons'
    : `Overall ${r.rating.ovr}, from his statistics`;
  return `Real Player Development: moved to his ${seasonText(r.rating.startYear)} reference (${what}). Training and coaching did not change his ratings.`;
}
