import type { League } from './league';
import { expenseEffects } from './league';
import type { DraftProspect, GMLeagueExtras } from './gm';
import type { PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';
import { prospectComparison } from './draftScouting';
import { eyeOn, lookFactor, looksOn, specialtyNotes } from './scoutDept';

/* Scouting and the draft combine.
 *  - Combine measurements are public: everyone sees the same tape measure and stopwatch.
 *  - Scouting reports are private per team: potential shows as a range whose width depends on that team's
 *    scouting budget, and skill grades carry the same fog. A pre-draft workout clears most of the fog.
 *  - AI front offices draft from their own perceived potential, so a better scouting budget finds better players. */

/** Stable pseudo-random value in [-1, 1] for a key, so reports don't change every time a page renders. */
function hashUnit(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

export const WORKOUT_SLOTS_MIN = 3;
export function scoutingLevel(league: League, teamId: string | null): number {
  return league.teams.find(t => t.teamId === teamId)?.expenseLevels?.scouting ?? 50;
}
export function scoutingAccuracy(league: League, teamId: string | null): number {
  return expenseEffects(league.teams.find(t => t.teamId === teamId)?.expenseLevels).scoutingAccuracy;
}
/** Pre-draft workout invitations a team can hand out: 3 on a minimum budget, up to 8 on a maximum one. */
export function workoutSlots(league: League, teamId: string | null): number {
  return WORKOUT_SLOTS_MIN + Math.round(scoutingLevel(league, teamId) / 20);
}
export function workoutsFor(extras: GMLeagueExtras, teamId: string | null): string[] {
  if (!teamId) return [];
  const ids = new Set(extras.draftClass.map(p => p.playerId));
  return (extras.draftWorkouts?.[teamId] ?? []).filter(id => ids.has(id));
}
export function toggleWorkout(league: League, extras: GMLeagueExtras, teamId: string, prospectId: string): { extras: GMLeagueExtras; error?: string } {
  const current = workoutsFor(extras, teamId);
  if (current.includes(prospectId)) return { extras: { ...extras, draftWorkouts: { ...extras.draftWorkouts, [teamId]: current.filter(id => id !== prospectId) } } };
  if (!extras.draftClass.some(p => p.playerId === prospectId)) return { extras, error: 'That prospect is no longer in the draft class.' };
  if (current.length >= workoutSlots(league, teamId)) return { extras, error: `All ${workoutSlots(league, teamId)} workout slots are used. Raise the scouting budget for more.` };
  return { extras: { ...extras, draftWorkouts: { ...extras.draftWorkouts, [teamId]: [...current, prospectId] } } };
}

// ---- Combine drills (mini-games): a few prospects a year, each drill clears the fog on the skills it tests ----
export type Drill = 'shooting' | 'sprint' | 'vertical';
/** Shooting: makes out of 10. Sprint: 3/4-court seconds. Vertical: max vertical in inches. */
export interface DrillScores { shooting?: number; sprint?: number; vertical?: number }
export const COMBINE_TESTS = 3;
export const DRILL_REVEALS: Record<Drill, GradeCategory[]> = { shooting: ['Shooting'], sprint: ['Athleticism'], vertical: ['Finishing', 'Rebounding'] };
export function drillsFor(extras: GMLeagueExtras, teamId: string | null): Record<string, DrillScores> {
  if (!teamId) return {};
  const ids = new Set(extras.draftClass.map(p => p.playerId));
  return Object.fromEntries(Object.entries(extras.combineDrills?.[teamId] ?? {}).filter(([id]) => ids.has(id)));
}
/** Files a drill result. A new prospect needs a free testing slot (COMBINE_TESTS a year); re-running a drill keeps the best. */
export function recordDrill(extras: GMLeagueExtras, teamId: string, prospectId: string, drill: Drill, score: number): { extras: GMLeagueExtras; error?: string } {
  const mine = drillsFor(extras, teamId);
  if (!extras.draftClass.some(p => p.playerId === prospectId)) return { extras, error: 'That prospect is no longer in the draft class.' };
  if (!mine[prospectId] && Object.keys(mine).length >= COMBINE_TESTS) return { extras, error: `You only have time to test ${COMBINE_TESTS} prospects a year.` };
  const prev = mine[prospectId]?.[drill];
  const better = prev == null ? score : drill === 'sprint' ? Math.min(prev, score) : Math.max(prev, score);
  return { extras: { ...extras, combineDrills: { ...extras.combineDrills, [teamId]: { ...mine, [prospectId]: { ...mine[prospectId], [drill]: better } } } } };
}
function revealedBy(extras: GMLeagueExtras, teamId: string | null, prospectId: string): Set<GradeCategory> {
  const d = teamId ? extras.combineDrills?.[teamId]?.[prospectId] : undefined;
  return new Set(d ? (Object.keys(DRILL_REVEALS) as Drill[]).filter(k => d[k] != null).flatMap(k => DRILL_REVEALS[k]) : []);
}

/** How far off a team's read on a prospect can be, in potential points (a workout narrows it to about 1). */
function fogFor(accuracy: number, workedOut: boolean): number {
  return workedOut ? 1 : 3 + (1 - accuracy) * 22; // 50 budget -> ±8.5, 100 -> ±3, 0 -> ±14
}

/** How much your scouts' looks shrink the fog on a prospect (1 = no looks); a scout with the matching eye helps more. */
function scoutFactor(league: League, extras: GMLeagueExtras, teamId: string | null, prospectId: string, eye: 'upside' | 'skills'): number {
  const looks = teamId ? looksOn(league, extras, teamId, prospectId) : 0;
  return looks ? lookFactor(looks) * (eyeOn(extras, teamId, prospectId, eye) ? 0.8 : 1) : 1;
}

/** The potential a team believes a prospect has. Deterministic per team + prospect. */
export function perceivedPotential(prospect: DraftProspect, league: League, extras: GMLeagueExtras, teamId: string | null): number {
  if (!teamId) return prospect.scoutedPotential;
  const workedOut = workoutsFor(extras, teamId).includes(prospect.playerId);
  const tested = revealedBy(extras, teamId, prospect.playerId).size > 0;
  const fog = fogFor(scoutingAccuracy(league, teamId), workedOut) * scoutFactor(league, extras, teamId, prospect.playerId, 'upside') * (tested ? 0.7 : 1);
  const truth = prospect.trueSeason.development.potential;
  return Math.max(35, Math.min(99, Math.round(truth + hashUnit(`${prospect.playerId}|${teamId}|pot`) * fog)));
}

export type GradeCategory = 'Shooting' | 'Finishing' | 'Playmaking' | 'Defense' | 'Rebounding' | 'Athleticism';
const CATEGORIES: GradeCategory[] = ['Shooting', 'Finishing', 'Playmaking', 'Defense', 'Rebounding', 'Athleticism'];
export function letterGrade(v: number): string {
  const scale: [number, string][] = [[80, 'A+'], [74, 'A'], [69, 'A-'], [64, 'B+'], [59, 'B'], [55, 'B-'], [51, 'C+'], [47, 'C'], [43, 'C-'], [38, 'D+'], [33, 'D']];
  return scale.find(([min]) => v >= min)?.[1] ?? 'F';
}
const STRENGTH_TEXT: Record<GradeCategory, string> = {
  Shooting: 'Stretches the floor with a repeatable shot', Finishing: 'Finishes through contact at the rim', Playmaking: 'Sees the floor and creates for others',
  Defense: 'Disciplined, switchable defender', Rebounding: 'Owns the glass on both ends', Athleticism: 'Explosive first step and bounce',
};
const WEAKNESS_TEXT: Record<GradeCategory, string> = {
  Shooting: 'Jumper needs a rebuild', Finishing: 'Struggles to finish in traffic', Playmaking: 'Loose handle, tunnel vision',
  Defense: 'Gets lost off the ball', Rebounding: 'Rarely boxes out', Athleticism: 'Below-the-rim, a step slow',
};

export interface ScoutingReport {
  potLow: number; potHigh: number; potMid: number;
  confidence: 'Workout' | 'High' | 'Medium' | 'Low';
  grades: Record<GradeCategory, string>;
  strengths: string[]; weaknesses: string[];
  flags: string[];
  workedOut: boolean;
  /** Skills your combine drills measured exactly (0-100). */
  revealed: Partial<Record<GradeCategory, number>>;
  /** Looks your scouts have filed on him this season. */
  looks: number;
}

export function scoutingReport(prospect: DraftProspect, league: League, extras: GMLeagueExtras, teamId: string | null): ScoutingReport {
  const workedOut = workoutsFor(extras, teamId).includes(prospect.playerId);
  const accuracy = scoutingAccuracy(league, teamId);
  const revealedSet = revealedBy(extras, teamId, prospect.playerId);
  const fog = fogFor(accuracy, workedOut) * scoutFactor(league, extras, teamId, prospect.playerId, 'upside') * (revealedSet.size ? 0.7 : 1);
  const gradeFog = fogFor(accuracy, workedOut) * scoutFactor(league, extras, teamId, prospect.playerId, 'skills');
  const looks = teamId ? looksOn(league, extras, teamId, prospect.playerId) : 0;
  const mid = perceivedPotential(prospect, league, extras, teamId);
  const spread = Math.round(workedOut ? 1 : 1 + fog * 0.55);
  const p = prospect.trueSeason;
  const overall = calculateOverall(p);
  const raw = prospectComparison(p);
  const perceived = Object.fromEntries(CATEGORIES.map(c => [c, revealedSet.has(c) ? raw[c] : raw[c] + hashUnit(`${prospect.playerId}|${teamId}|${c}`) * gradeFog * 0.7])) as Record<GradeCategory, number>;
  const revealed = Object.fromEntries(CATEGORIES.filter(c => revealedSet.has(c)).map(c => [c, raw[c]])) as Partial<Record<GradeCategory, number>>;
  const ordered = [...CATEGORIES].sort((a, b) => perceived[b] - perceived[a]);
  const flags: string[] = [];
  if (p.attributes.physical.durability < 45 || p.development.injuryRisk >= 65) flags.push('Medical: durability concerns');
  if (p.age >= 22) flags.push('Older prospect, shorter runway');
  if (mid - overall >= 18) flags.push('Raw: boom-or-bust projection');
  if (overall >= 58) flags.push('NBA-ready contributor');
  // Character reads are what workouts are for: only a team that brought him in knows about his work ethic.
  if (workedOut && p.development.workEthic >= 75) flags.push('Gym rat: elite work ethic');
  if (workedOut && p.development.workEthic <= 35) flags.push('Interview: questions about work ethic');
  for (const note of specialtyNotes(league, extras, teamId, prospect)) if (!flags.some(f => f.split(':')[0] === note.split(':')[0])) flags.push(note);
  return {
    potLow: Math.max(overall, mid - spread), potHigh: Math.min(99, mid + spread), potMid: mid,
    confidence: workedOut ? 'Workout' : accuracy >= 0.85 || looks >= 6 ? 'High' : accuracy >= 0.65 || looks >= 2.5 ? 'Medium' : 'Low',
    grades: Object.fromEntries(CATEGORIES.map(c => [c, letterGrade(perceived[c])])) as Record<GradeCategory, string>,
    strengths: ordered.slice(0, 2).map(c => STRENGTH_TEXT[c]),
    weaknesses: ordered.slice(-2).reverse().map(c => WEAKNESS_TEXT[c]),
    flags, workedOut, looks, revealed,
  };
}

export interface CombineResults {
  heightNoShoes: number; heightShoes: number; wingspan: number; standingReach: number; weight: number;
  maxVertical: number; standingVertical: number; laneAgility: number; sprint: number; benchReps: number;
}
/** Draft combine numbers. Public and deterministic; derived from the prospect's physical ratings with a little day-of noise. */
export function combineResults(p: PlayerSeason): CombineResults {
  const a = p.attributes.physical, n = (k: string) => hashUnit(`${p.playerId}|combine|${k}`);
  const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
  const maxVertical = round(25 + a.vertical * 0.17 + n('v') * 1.5, 1);
  return {
    heightNoShoes: round(a.heightInches - 1.25 + n('h') * 0.25, 2), heightShoes: round(a.heightInches, 2),
    wingspan: round(a.wingspanInches + n('w') * 0.25, 2), standingReach: round(a.standingReachInches, 1), weight: Math.round(a.weightLbs + n('lb') * 3),
    maxVertical, standingVertical: round(maxVertical * 0.8 + n('sv') * 0.8, 1),
    laneAgility: round(12.6 - a.agility * 0.022 + n('la') * 0.12, 2), sprint: round(3.62 - a.speed * 0.0052 + n('sp') * 0.03, 2),
    benchReps: Math.max(0, Math.round(a.strength * 0.22 + n('b') * 2)),
  };
}
