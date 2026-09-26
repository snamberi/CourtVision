import { RNG } from './engine/rng';
import { generatePlayerName } from './names';
import type { CoachTendencies, LeagueTeam } from './league';
import { defaultCoachTendencies } from './league';
import type { PlayerSeason } from './types';

export interface CoachContract {
  annualSalary: number;
  yearsRemaining: number;
}

/** The specific things a coach is good or bad at. Each is 0-99; the same list doubles as the source of
 * the displayed "strengths" and "weaknesses" tags (top/bottom traits relative to the coach's own average). */
export interface CoachTraits {
  offense: number;       // raises team offensive efficiency
  defense: number;       // raises team defensive efficiency
  development: number;   // speeds up young-player progression
  motivation: number;    // drives player mood/morale
  rotationMgmt: number;  // better minutes allocation, less fatigue
  discipline: number;    // fewer turnovers/fouls
}

export type CoachTraitKey = keyof CoachTraits;

export const COACH_TRAIT_LABELS: Record<CoachTraitKey, string> = {
  offense: 'Offensive Scheme',
  defense: 'Defensive Scheme',
  development: 'Player Development',
  motivation: 'Motivator',
  rotationMgmt: 'Rotation Management',
  discipline: 'Discipline',
};

/** A team's actual head coach — a named person with traits, a contract, a career record, and real
 * relationships with the players on the roster. */
export interface CoachIdentity {
  profile?: import('./coachingModel').StaffProfile;
  coachId: string; // also the display name, same convention as player identity
  age: number;
  rating: number; // 0-99 overall coaching skill, derived from traits
  hiredSeason: string;
  careerWins: number;
  careerLosses: number;
  championships: number;
  contract: CoachContract;
  traits: CoachTraits;
  /** playerId -> 0-100 relationship score. 50 is neutral; high means the player is bought in. */
  relationships: Record<string, number>;
}

function traitAverage(traits: CoachTraits): number {
  const vals = Object.values(traits);
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/** The 2 traits a coach is best at relative to their own baseline (only counts genuinely good ones). */
export function coachStrengths(coach: CoachIdentity): CoachTraitKey[] {
  const avg = traitAverage(coach.traits);
  return (Object.keys(coach.traits) as CoachTraitKey[])
    .filter((k) => coach.traits[k] >= avg + 8 && coach.traits[k] >= 60)
    .sort((a, b) => coach.traits[b] - coach.traits[a])
    .slice(0, 2);
}

/** The 2 traits a coach is worst at relative to their own baseline (only counts genuinely bad ones). */
export function coachWeaknesses(coach: CoachIdentity): CoachTraitKey[] {
  const avg = traitAverage(coach.traits);
  return (Object.keys(coach.traits) as CoachTraitKey[])
    .filter((k) => coach.traits[k] <= avg - 8 && coach.traits[k] <= 55)
    .sort((a, b) => coach.traits[a] - coach.traits[b])
    .slice(0, 2);
}

function randomCoachSalary(rating: number, rng: RNG): number {
  const t = Math.max(0, Math.min(1, (rating - 40) / 55));
  return Math.round(1_500_000 + t * 9_000_000 + rng.nextInt(500_000));
}

/** Generates a brand-new coach with a spiky, believable trait profile (not flat across the board). */
export function generateCoachIdentity(rng: RNG, hiredSeason: string, usedNames: Set<string>): CoachIdentity {
  const name = generatePlayerName(rng, usedNames);
  const base = 38 + rng.nextInt(40); // the coach's general caliber
  const spike = (): number => Math.max(20, Math.min(99, base + rng.nextInt(36) - 18));
  const traits: CoachTraits = {
    offense: spike(), defense: spike(), development: spike(),
    motivation: spike(), rotationMgmt: spike(), discipline: spike(),
  };
  const rating = Math.round(traitAverage(traits));
  return {
    coachId: name,
    age: 38 + rng.nextInt(30),
    rating,
    hiredSeason,
    careerWins: 0,
    careerLosses: 0,
    championships: 0,
    contract: { annualSalary: randomCoachSalary(rating, rng), yearsRemaining: 2 + rng.nextInt(3) },
    traits,
    relationships: {},
  };
}

/** A pool of available coaches to hire, refreshed whenever the user opens the hiring screen. */
export function generateCoachCandidates(seed: number, season: string, count = 5): CoachIdentity[] {
  const rng = new RNG(seed);
  const used = new Set<string>();
  return Array.from({ length: count }, () => generateCoachIdentity(rng, season, used));
}

/** A coach's rating nudges their team's own style dials slightly. */
export function coachInfluencedTendencies(base: CoachTendencies, coach: CoachIdentity | undefined): CoachTendencies {
  if (!coach) return base;
  const sharpness = (coach.rating - 50) / 200;
  const pull = (v: number) => Math.max(0, Math.min(100, v + (v - 50) * sharpness));
  return {
    ...base,
    paceTendency: pull(base.paceTendency),
    threePointFrequency: pull(base.threePointFrequency),
    starUsage: pull(base.starUsage),
    benchUsage: base.benchUsage,
    defensiveAggression: pull(base.defensiveAggression),
    doubleTeamFrequency: pull(base.doubleTeamFrequency),
    switchingFrequency: base.switchingFrequency,
    zoneFrequency: base.zoneFrequency,
    pnrFrequency: base.pnrFrequency,
    postFrequency: base.postFrequency,
  };
}

/** Records one game's result onto a coach's career ledger. */
export function recordCoachResult(coach: CoachIdentity | undefined, won: boolean): CoachIdentity | undefined {
  if (!coach) return coach;
  return { ...coach, careerWins: coach.careerWins + (won ? 1 : 0), careerLosses: coach.careerLosses + (won ? 0 : 1) };
}

export function relationshipWith(coach: CoachIdentity | undefined, playerId: string): number {
  if (!coach) return 50;
  return coach.relationships[playerId] ?? 50;
}

export function relationshipLabel(score: number): string {
  if (score >= 80) return 'Loves coach';
  if (score >= 62) return 'Bought in';
  if (score >= 42) return 'Neutral';
  if (score >= 25) return 'Frustrated';
  return 'Wants out';
}

/**
 * Drifts every player's relationship with their coach after a game. A motivating coach pulls everyone
 * up; winning helps; players buried on the bench despite being good sour on the coach over time.
 */
export function driftRelationships(
  coach: CoachIdentity | undefined,
  roster: PlayerSeason[],
  won: boolean,
  minutesByPlayer: Record<string, number>,
  unavailablePlayerIds: ReadonlySet<string> = new Set(),
): CoachIdentity | undefined {
  if (!coach) return coach;
  const motivationPull = (coach.traits.motivation - 50) / 100; // -0.5 .. +0.49 per game
  const next: Record<string, number> = { ...coach.relationships };
  for (const p of roster) {
    if (unavailablePlayerIds.has(p.playerId)) continue;
    const current = next[p.playerId] ?? 50;
    const minutes = minutesByPlayer[p.playerId] ?? 0;
    // Expected minutes scale loosely with how good the player is; falling well short of that stings.
    const expected = Math.max(8, Math.min(34, (p.minutes?.target ?? 20)));
    const minutesGap = (minutes - expected) / 30; // roughly -1 .. +0.5
    const delta = motivationPull * 0.6 + (won ? 0.25 : -0.2) + minutesGap * 0.8;
    next[p.playerId] = Math.max(0, Math.min(100, current + delta));
  }
  return { ...coach, relationships: next };
}

/** How much this coach currently helps (or hurts) their roster, as a multiplier applied in-sim. */
export function coachPerformanceModifiers(coach: CoachIdentity | undefined, roster: PlayerSeason[]) {
  if (!coach) return { offense: 1, defense: 1, turnover: 1, fatigue: 1, development: 1 };
  const avgRelationship = roster.length > 0
    ? roster.reduce((s, p) => s + relationshipWith(coach, p.playerId), 0) / roster.length
    : 50;
  // A coach the locker room has tuned out gets less out of the same schemes.
  const buyIn = 0.85 + (avgRelationship / 100) * 0.3; // 0.85 .. 1.15
  return {
    offense: (1 + (coach.traits.offense - 50) / 500) * buyIn,
    defense: (1 + (coach.traits.defense - 50) / 500) * buyIn,
    turnover: 1 - (coach.traits.discipline - 50) / 400, // higher discipline -> fewer turnovers
    fatigue: 1 - (coach.traits.rotationMgmt - 50) / 400, // better rotations -> less fatigue
    development: 1 + (coach.traits.development - 50) / 200,
  };
}

/** Fires the current coach and hires a freshly generated replacement. */
export function fireAndReplaceCoach(seed: number, season: string, usedNames: Set<string> = new Set()): CoachIdentity {
  return generateCoachIdentity(new RNG(seed), season, usedNames);
}

/** Hires a specific candidate onto a team, resetting relationships to neutral for the new roster. */
export function hireCoach(team: LeagueTeam, candidate: CoachIdentity, season: string): LeagueTeam {
  const relationships: Record<string, number> = {};
  for (const p of team.seasons) relationships[p.playerId] = 50;
  return { ...team, coachIdentity: { ...candidate, hiredSeason: season, relationships } };
}

export { defaultCoachTendencies };
