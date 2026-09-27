import type { PlayerSeason, PositionSuitability } from '../simulation/types';
import { makeDefaultSeason } from '../simulation/presets/samplePlayers';
import { calculateOverall } from '../simulation/engine/overall';
import { positionsFrom } from '../history/realPlayers';
import { RNG } from '../simulation/engine/rng';
import { CATEGORIES, CATEGORY_BY_ID, MEASUREMENTS, categoryScore, withCategory, type CategoryId, type CategoryValues } from './categories';

/*
 * Building the Career Mode player. What you pick (on the wheel or in MyPlayer) is his PRIME: the ratings he grows into.
 * He enters the league at 19 at part of it and develops category by category; `progress` per category is 0 as a
 * rookie, 1 at his prime, up to 1.15 when training pushes past it, and falls below 0 with age. Height never changes.
 */

export type Position = keyof PositionSuitability;
export type Prime = Record<CategoryId, CategoryValues>;
export type Progress = Record<CategoryId, number>;
export const MAX_PROGRESS = 1.15;
export const START_AGE = 19;

export interface Identity { name: string; pos: Position; jersey: number; hometown?: string }
/** How much of his prime a rookie brings: late bloomers start further back and peak a little higher. */
export type Readiness = 'raw' | 'balanced' | 'ready';
export const READINESS: Record<Readiness, { name: string; blurb: string; start: number; primeBonus: number }> = {
  raw: { name: 'Late bloomer', blurb: 'Starts at 72% of his prime; his prime is 3 higher.', start: 0.72, primeBonus: 3 },
  balanced: { name: 'Balanced', blurb: 'Starts at 80% of his prime.', start: 0.8, primeBonus: 0 },
  ready: { name: 'NBA-ready', blurb: 'Starts at 88% of his prime; his prime is 2 lower.', start: 0.88, primeBonus: -2 },
};

const clamp = (v: number, lo = 20, hi = 99) => Math.max(lo, Math.min(hi, Math.round(v)));

/** The values of each category at a given progress. */
export function valuesAt(prime: Prime, progress: Progress, readiness: Readiness): Prime {
  const r = READINESS[readiness];
  const out = {} as Prime;
  for (const c of CATEGORIES) {
    const p = progress[c.id] ?? 0;
    const vals: CategoryValues = {};
    for (const [path, target] of Object.entries(prime[c.id])) {
      const field = path.split('.')[1];
      if (MEASUREMENTS.has(field)) {
        // Rookies are a little lighter; everything else is fixed.
        vals[path] = field === 'weightLbs' ? Math.round(target - 10 * Math.max(0, 1 - p)) : target;
        continue;
      }
      const top = target + r.primeBonus;
      // Ratings top out at 120 (the best ever at something, see wheel.ts).
      vals[path] = clamp(top * (r.start + (1 - r.start) * p), 20, 120);
    }
    out[c.id] = vals;
  }
  return out;
}

/** Shot, passing and role tendencies that follow his ratings (so a great shooter shoots). */
export function tendenciesFor(p: PlayerSeason): PlayerSeason['tendencies'] {
  const o = p.attributes.offense, ph = p.attributes.physical;
  const three = (o.threePoint + o.catchAndShoot + o.pullUp3) / 3, mid = (o.midrange + o.longMidrange) / 2;
  const fin = (o.finishing + o.drivingLayup + o.closeShot) / 3, post = (o.postHook + o.postControl) / 2;
  const play = (o.passing + o.ballHandling + o.passingIQ) / 3, h = ph.heightInches;
  const t = structuredClone(p.tendencies);
  const s = t.shot;
  const k = (v: number, lo: number, hi: number) => clamp(v, lo, hi);
  s.corner3 = k((three - 45) * 1.6, 1, 95); s.aboveBreak3 = k((three - 45) * 1.9, 1, 99); s.catchAndShoot3 = k((three - 45) * 1.8, 1, 99);
  s.pullUp3 = k((three - 55) * 1.4 + (play - 60) * 0.8, 1, 90); s.stepback = k((three - 60) + (play - 60) * 0.8, 1, 75);
  s.midrange = k(20 + (mid - 50) * 1.2, 5, 90); s.longMidrange = k(10 + (mid - 55), 2, 70); s.fadeaway = k((mid - 55) * 0.9, 1, 60);
  s.rim = k(30 + (fin - 50) + (h - 76) * 2, 5, 99); s.layup = k(35 + (fin - 50) * 0.8, 5, 95); s.close = k(25 + (fin - 50) * 0.6, 5, 90);
  s.dunk = k((h - 74) * 5 + (ph.vertical - 60) * 0.8, 2, 95);
  s.postShot = k((post - 50) * 1.2 + (h - 79) * 3, 1, 80); s.hook = k((post - 55) + (h - 81) * 4, 1, 70);
  t.passing.passFrequency = k(25 + (play - 45) * 1.1, 15, 95); t.passing.assistCreation = k(15 + (play - 45) * 1.5, 10, 99);
  t.driving.driveFrequency = k(25 + (fin - 50) * 0.8 + (ph.speed - 60) * 0.5, 10, 95);
  t.ballDominance = k(20 + (play - 50) * 1.2 + (Math.max(three, fin) - 60) * 0.6, 5, 95);
  t.role.primaryBallHandler = k((play - 45) * 2, 2, 99); t.role.secondaryBallHandler = k((play - 40) * 1.6, 2, 90); t.role.pnrBallHandler = k((play - 45) * 1.8, 2, 95);
  t.role.spotUpShooter = k((three - 40) * 1.6, 2, 99); t.role.catchAndShoot = k((three - 40) * 1.5, 2, 99);
  t.role.postUp = k((post - 45) * 1.5, 2, 90); t.role.shotCreator = k((Math.max(mid, three) - 50) * 1.2 + (play - 50) * 0.8, 2, 95);
  t.role.offensiveRebounder = k((p.attributes.offense.offensiveRebounding - 40) * 1.5, 2, 95);
  return t;
}

/** Suggests a position from his height and skills. */
export function suggestPosition(prime: Prime): Position {
  const h = prime.size['physical.heightInches'];
  const play = categoryScore(prime.playmaking), inside = categoryScore(prime.interiorD);
  if (h <= 75 || (h <= 78 && play >= 75)) return 'PG';
  if (h <= 78) return 'SG';
  if (h <= 80) return play >= 80 ? 'PG' : 'SF';
  if (h <= 82) return inside >= 70 ? 'PF' : 'SF';
  return 'C';
}

/** The player himself at a given progress: a league-ready PlayerSeason. */
export function buildPlayer(id: Identity, prime: Prime, progress: Progress, readiness: Readiness, season: string, age: number, seed: number): PlayerSeason {
  let p = makeDefaultSeason(id.name, season, null, age);
  const vals = valuesAt(prime, progress, readiness);
  for (const c of CATEGORIES) p = withCategory(p, vals[c.id]);
  const rng = new RNG(seed);
  const positions = positionsFrom(id.pos, prime.size['physical.heightInches']);
  p = { ...p, positions, jerseyNumber: id.jersey, source: 'user', firstName: id.name.split(' ')[0], lastName: id.name.split(' ').slice(1).join(' ') || id.name,
  };
  p = { ...p, tendencies: tendenciesFor(p), ballHandlerPriority: clamp(categoryScore(vals.playmaking) - 10 + rng.nextInt(5), 5, 95) };
  const overall = calculateOverall(p);
  const primeOverall = calculateOverall(buildPrimeShell(p, prime, readiness));
  return { ...p, development: { ...p.development, potential: Math.max(overall, primeOverall), peakAge: 27, primeLengthYears: 5 } };
}

function buildPrimeShell(p: PlayerSeason, prime: Prime, readiness: Readiness): PlayerSeason {
  const vals = valuesAt(prime, Object.fromEntries(CATEGORIES.map(c => [c.id, 1])) as Progress, readiness);
  let q = p;
  for (const c of CATEGORIES) q = withCategory(q, vals[c.id]);
  return q;
}

export const startProgress = (): Progress => Object.fromEntries(CATEGORIES.map(c => [c.id, 0])) as Progress;
/** His overall at his prime (what the wheel built). */
export function primeOverall(prime: Prime, readiness: Readiness, pos: Position): number {
  let p = makeDefaultSeason('prime', '2025', null, 27);
  const vals = valuesAt(prime, Object.fromEntries(CATEGORIES.map(c => [c.id, 1])) as Progress, readiness);
  for (const c of CATEGORIES) p = withCategory(p, vals[c.id]);
  return calculateOverall({ ...p, positions: positionsFrom(pos, prime.size['physical.heightInches']) });
}

// ---------------------------------------------------------------- MyPlayer: build him yourself

export interface Build { heightIn: number; weightLbs: number; wingspanIn: number; ratings: Record<Exclude<CategoryId, 'size'>, number> }
export const RATING_CATEGORIES = CATEGORIES.filter(c => c.id !== 'size').map(c => c.id) as Exclude<CategoryId, 'size'>[];
/** Points to spend across the nine rated categories (each from 40 to its cap). */
export const BUILD_BUDGET = 640;
export const BUILD_MIN = 40;

/** The most a category can reach at a height (a 7-footer can't handle like a point guard, and the reverse). */
export function capFor(id: Exclude<CategoryId, 'size'>, heightIn: number): number {
  const tall = heightIn - 78; // + for bigs, - for guards
  const caps: Record<string, number> = {
    body: 88 + tall * 1.5, athleticism: 97 - Math.max(0, tall) * 2.5, finishing: 97, midRange: 97 - Math.max(0, tall) * 1.2, threePoint: 99 - Math.max(0, tall) * 2.2,
    playmaking: 99 - Math.max(0, tall) * 3.2, perimeterD: 97 - Math.max(0, tall) * 2.2, interiorD: 90 + tall * 2.4, iq: 95,
  };
  return Math.max(55, Math.min(99, Math.round(caps[id])));
}

/** A category's values from one rating (each field varies a little around it, so he isn't flat). */
function spread(id: CategoryId, rating: number, seed: number): CategoryValues {
  const rng = new RNG(seed + id.length * 131);
  const out: CategoryValues = {};
  for (const [g, k] of CATEGORY_BY_ID.get(id)!.fields) out[`${g}.${k}`] = clamp(rating + rng.nextInt(7) - 3, 25, 99);
  return out;
}

export function primeFromBuild(b: Build, seed: number): Prime {
  const prime = {} as Prime;
  prime.size = { 'physical.heightInches': b.heightIn, 'physical.wingspanInches': b.wingspanIn, 'physical.standingReachInches': Math.round(b.heightIn * 1.32 + (b.wingspanIn - b.heightIn) * 0.6) };
  for (const id of RATING_CATEGORIES) prime[id] = spread(id, Math.min(b.ratings[id], capFor(id, b.heightIn)), seed);
  prime.body['physical.weightLbs'] = b.weightLbs;
  return prime;
}
export const buildSpent = (b: Build) => RATING_CATEGORIES.reduce((n, id) => n + b.ratings[id], 0);
