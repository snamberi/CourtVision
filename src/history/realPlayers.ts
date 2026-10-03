import { realNationality } from '../worldGames/data';
import type { PlayerSeason, PositionSuitability } from '../simulation/types';
import { makeDefaultSeason } from '../simulation/presets/samplePlayers';
import { calculateOverall } from '../simulation/engine/overall';
import { RNG } from '../simulation/engine/rng';
import { syncPotential, compressElitePotential } from '../simulation/engine/potential';

/* Real players as simulation players.
 * Their headline rating is Court Vision's own Overall computed from statistics by the dataset builder (each season's
 * players ranked by production and matched to the Overall spread of a generated league); their skill SHAPE comes
 * from their real statistical profile (shooting, playmaking, rebounding, defense rates). All attributes are
 * estimates and are labelled as such. */

/** Rates from real statistics that shape a player's skills. null = not recorded in that era (neutral). */
export interface RealProfile {
  mpg: number | null; ptsPer36: number | null;
  fgPct: number | null; twoPct: number | null; threePct: number | null; threeRate: number | null; ftPct: number | null; ftRate: number | null;
  astPct: number | null; trbPct: number | null; orbPct: number | null; stlPct: number | null; blkPct: number | null; tovPct: number | null; usgPct: number | null;
  dbpm: number | null; obpm: number | null;
}
/** A reference point on Court Vision's Overall scale: [season start year, Overall, source]. */
export type RatingFrame = [startYear: number, ovr: number, source: string];

export interface RealPlayerSeed {
  id: string; name: string; birthDate: string | null; heightIn: number | null; weightLb: number | null; pos: string | null; college: string | null;
  draft: { year: number; round: number | null; pick: number | null; team: string } | null;
  profile: RealProfile | null;
  rating: { ovr: number; source: string; startYear: number };
  frames: RatingFrame[]; // future start-of-season reference ratings (hidden from the UI)
}

export interface RealPlayerInfo {
  id: string; dataset: string;
  /** The reference rating currently applied. kind 'interpolated' = between two reference points (labelled in the UI). */
  rating: { ovr: number; source: string; startYear: number; kind?: 'reference' | 'interpolated' };
  frames?: RatingFrame[];
  /** Season label whose reference was last applied — a rollover never applies the same season twice. */
  appliedSeason?: string;
  /** Start year of the last reference point in the data. */
  coverageEndYear?: number;
  /** Season from which Court Vision development took over because the reference trajectory had ended. */
  fallbackSince?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const hash = (s: string) => [...s].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 2166136261);
const nz = (v: number | null | undefined, neutral: number) => (v == null || !Number.isFinite(v) ? neutral : v);

export function positionsFrom(pos: string | null, heightIn: number | null): PositionSuitability {
  const p: PositionSuitability = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  const tokens = (pos ?? '').toUpperCase().split(/[-/ ]+/).filter(Boolean);
  const add = (k: keyof PositionSuitability, v: number) => { p[k] = Math.max(p[k], v); };
  tokens.forEach((t, i) => {
    const w = i === 0 ? 95 : 75;
    if (t === 'PG' || t === 'SG' || t === 'SF' || t === 'PF' || t === 'C') add(t, w);
    else if (t === 'G') { add('PG', w - 5); add('SG', w); }
    else if (t === 'F') { add('SF', w); add('PF', w - 5); }
  });
  if (!tokens.length) {
    const h = heightIn ?? 78;
    if (h <= 75) add('PG', 90); else if (h <= 78) add('SG', 90); else if (h <= 80) add('SF', 90); else if (h <= 82) add('PF', 90); else add('C', 90);
  }
  // neighbours are playable at a lower level
  const order: (keyof PositionSuitability)[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  order.forEach((k, i) => { const best = Math.max(order[i - 1] ? p[order[i - 1]] : 0, order[i + 1] ? p[order[i + 1]] : 0); if (p[k] < best - 30) p[k] = Math.max(p[k], best - 30); });
  return p;
}

/** Skill-group multipliers (1.0 = at the player's level) from his real rates. Neutral where the era didn't record a stat. */
function groupsFrom(prof: RealProfile | null, heightIn: number, weightLb: number, pos: PositionSuitability) {
  const pr = prof;
  const big = pos.C >= 90 || pos.PF >= 90;
  const guard = pos.PG >= 90 || pos.SG >= 90;
  const threeRate = nz(pr?.threeRate, big ? 0.05 : 0.25), threePct = nz(pr?.threePct, 0.33);
  const shooting3 = pr?.threeRate == null ? (big ? 0.72 : 0.9) : threeRate < 0.03 ? 0.62 : clamp(0.78 + (threePct - 0.32) * 2.6 + Math.min(0.2, threeRate * 0.35), 0.6, 1.3);
  const ft = clamp(0.72 + (nz(pr?.ftPct, 0.74) - 0.6) * 1.6, 0.55, 1.3);
  const two = nz(pr?.twoPct ?? pr?.fgPct, 0.47);
  const finishing = clamp(0.84 + (two - 0.46) * 2.4 + nz(pr?.ftRate, 0.28) * 0.25 + (big ? 0.06 : 0), 0.65, 1.3);
  const ast = nz(pr?.astPct, guard ? 22 : big ? 9 : 13);
  const passing = clamp(0.72 + ast * 0.018, 0.65, 1.38);
  const handling = clamp(0.74 + ast * 0.014 + (guard ? 0.06 : 0) - nz(pr?.tovPct, 12) * 0.006, 0.62, 1.32);
  const reb = clamp(0.62 + nz(pr?.trbPct, big ? 15 : 8) * 0.03, 0.62, 1.32);
  const steals = clamp(0.78 + nz(pr?.stlPct, 1.5) * 0.13, 0.7, 1.3);
  const blocks = clamp(0.7 + nz(pr?.blkPct, big ? 2.5 : 0.8) * 0.085, 0.62, 1.35);
  const dIQ = clamp(1 + nz(pr?.dbpm, 0) * 0.045, 0.78, 1.25);
  const usg = nz(pr?.usgPct, 19);
  return {
    finishing, postGame: clamp(big ? 0.95 + (two - 0.48) * 1.5 - threeRate * 0.6 : 0.8, 0.6, 1.2), midrange: clamp((ft + finishing) / 2 + (usg - 20) * 0.006, 0.65, 1.25),
    threePoint: shooting3, freeThrow: ft, handling, passing, offBall: clamp(0.9 + (nz(pr?.obpm, 0)) * 0.03 + (usg - 20) * 0.004, 0.72, 1.25),
    perimeterD: clamp((guard ? 1.02 : big ? 0.86 : 0.98) * (0.85 + steals * 0.15) * dIQ, 0.65, 1.3),
    interiorD: clamp((big ? 1.05 : 0.85) * (0.8 + blocks * 0.2) * dIQ, 0.62, 1.32), steals, blocks, rebounding: reb, defensiveIQ: dIQ,
    athleticism: clamp(1.02 + (guard ? 0.05 : big ? -0.06 : 0) + nz(pr?.blkPct, 1) * 0.01, 0.8, 1.2),
    strength: clamp(0.7 + (weightLb - 180) * 0.005, 0.7, 1.3),
    size: (heightIn - 72) / 6,
  };
}

function build(seed: RealPlayerSeed, season: string, teamId: string | null, age: number, caliber: number): PlayerSeason {
  const rng = new RNG(hash(seed.id));
  const s = makeDefaultSeason(seed.name, season, teamId, age);
  const heightIn = seed.heightIn ?? 78, weightLb = seed.weightLb ?? 210;
  const pos = positionsFrom(seed.pos, heightIn);
  const g = groupsFrom(seed.profile, heightIn, weightLb, pos);
  const a = (mult: number, spread = 5) => clamp(Math.round(caliber * mult + (rng.next() * 2 - 1) * spread), 15, 99);
  const o = s.attributes.offense;
  o.closeShot = a(g.finishing); o.drivingLayup = a(g.finishing); o.drivingDunk = a(g.finishing * (g.athleticism > 1.05 ? 1.06 : 0.94)); o.standingDunk = a(g.finishing * (heightIn >= 81 ? 1.08 : 0.85));
  o.finishing = a(g.finishing); o.touch = a((g.finishing + g.midrange) / 2); o.postHook = a(g.postGame); o.postFade = a(g.postGame); o.postControl = a(g.postGame);
  o.midrange = a(g.midrange); o.longMidrange = a(g.midrange); o.threePoint = a(g.threePoint); o.corner3 = a(g.threePoint); o.aboveBreak3 = a(g.threePoint);
  o.pullUp3 = a(g.threePoint * (g.handling > 1.05 ? 1.04 : 0.9)); o.catchAndShoot = a(g.offBall * g.threePoint); o.freeThrow = a(g.freeThrow);
  o.ballHandling = a(g.handling); o.ballSecurity = a(g.handling); o.speedWithBall = a((g.handling + g.athleticism) / 2);
  o.passing = a(g.passing); o.passingAccuracy = a(g.passing); o.passingIQ = a(g.passing); o.offensiveIQ = a(g.offBall); o.shotIQ = a(g.offBall);
  o.decisionMaking = a((g.passing + g.offBall) / 2); o.offensiveConsistency = a(1, 8); o.offensiveRebounding = a(g.rebounding * 0.92);
  const d = s.attributes.defense;
  d.perimeterDefense = a(g.perimeterD); d.interiorDefense = a(g.interiorD); d.defensiveIQ = a(g.defensiveIQ); d.helpDefense = a(g.defensiveIQ);
  d.pickAndRollDefense = a((g.defensiveIQ + g.perimeterD) / 2); d.closeout = a(g.perimeterD); d.contest = a((g.perimeterD + g.interiorD) / 2);
  d.steal = a(g.steals); d.stealIQ = a((g.steals + g.defensiveIQ) / 2); d.onBallSteal = a(g.steals); d.passingLaneSteal = a((g.steals + g.defensiveIQ) / 2);
  d.block = a(g.blocks); d.blockIQ = a((g.blocks + g.defensiveIQ) / 2); d.blockTiming = a(g.blocks); d.rimProtection = a((g.blocks + g.interiorD) / 2);
  d.defensiveRebounding = a(g.rebounding); d.defensiveConsistency = a(1, 8); d.defensiveAwareness = a(g.defensiveIQ); d.defensiveDiscipline = a(g.defensiveIQ);
  const ph = s.attributes.physical;
  ph.heightInches = heightIn; ph.weightLbs = weightLb; ph.wingspanInches = Math.round(heightIn + 2 + rng.next() * 3); ph.standingReachInches = Math.round(heightIn * 1.32 + rng.next() * 2);
  const ageAthletic = clamp(1.06 - Math.max(0, age - 27) * 0.025, 0.8, 1.08);
  ph.speed = a(g.athleticism * ageAthletic); ph.acceleration = a(g.athleticism * ageAthletic); ph.agility = a(g.athleticism * ageAthletic); ph.vertical = a(g.athleticism * ageAthletic);
  ph.strength = a(g.strength); ph.balance = a(1, 8); ph.stamina = a(clamp(0.8 + nz(seed.profile?.mpg, 22) / 110, 0.8, 1.15), 5); ph.durability = a(1, 10);
  const m = s.attributes.mental;
  for (const k of Object.keys(m) as (keyof typeof m)[]) m[k] = a(1, 8);
  m.basketballIQ = a((g.defensiveIQ + g.offBall) / 2);
  s.positions = pos;
  // Tendencies follow the real shot and usage profile.
  const pr = seed.profile;
  const threeRate = nz(pr?.threeRate, 0.2), usg = nz(pr?.usgPct, 19), ast = nz(pr?.astPct, 14), ftRate = nz(pr?.ftRate, 0.28);
  const t = s.tendencies;
  t.shot.corner3 = clamp(Math.round(threeRate * 90), 1, 99); t.shot.aboveBreak3 = clamp(Math.round(threeRate * 110), 1, 99);
  t.shot.catchAndShoot3 = clamp(Math.round(threeRate * 100 * (usg < 20 ? 1.1 : 0.8)), 1, 99); t.shot.pullUp3 = clamp(Math.round(threeRate * 70 * (usg > 24 ? 1.3 : 0.7)), 1, 99);
  t.shot.rim = clamp(Math.round(30 + ftRate * 80 + (pos.C >= 90 ? 20 : 0)), 5, 99); t.shot.dunk = clamp(Math.round((heightIn - 74) * 5 + ftRate * 30), 2, 95);
  t.shot.layup = clamp(Math.round(35 + ftRate * 50), 5, 95); t.shot.postShot = clamp(Math.round(pos.C >= 90 || pos.PF >= 90 ? 45 - threeRate * 80 : 8), 1, 80);
  t.shot.hook = clamp(Math.round(pos.C >= 90 ? 35 - threeRate * 60 : 3), 1, 70); t.shot.midrange = clamp(Math.round(45 - threeRate * 40), 5, 90);
  t.shot.longMidrange = clamp(Math.round(30 - threeRate * 40), 2, 80); t.shot.stepback = clamp(Math.round(usg > 26 ? 30 : 8), 1, 70);
  t.passing.passFrequency = clamp(Math.round(30 + ast * 1.4), 15, 95); t.passing.assistCreation = clamp(Math.round(20 + ast * 1.8), 10, 99);
  t.ballDominance = clamp(Math.round(15 + (usg - 12) * 3.3), 5, 98);
  const r = t.role;
  r.primaryBallHandler = clamp(Math.round(ast * 2.4), 2, 99); r.secondaryBallHandler = clamp(Math.round(ast * 1.8), 2, 90); r.pnrBallHandler = clamp(Math.round(ast * 2), 2, 95);
  r.shotCreator = clamp(Math.round((usg - 10) * 3.5), 5, 99); r.isolation = clamp(Math.round((usg - 14) * 3), 2, 95); r.spotUpShooter = clamp(Math.round(threeRate * 140 * (usg < 22 ? 1.2 : 0.7)), 2, 95);
  r.catchAndShoot = clamp(Math.round(threeRate * 120), 2, 95); r.postUp = clamp(Math.round(pos.C >= 90 || pos.PF >= 90 ? 55 - threeRate * 100 : 5), 1, 90);
  r.offensiveRebounder = clamp(Math.round(nz(pr?.orbPct, pos.C >= 90 ? 9 : 3) * 6), 2, 95); r.pnrScreener = clamp(Math.round(pos.C >= 90 || pos.PF >= 90 ? 60 : 10), 2, 90);
  s.ballHandlerPriority = clamp(Math.round(15 + ast * 2.1), 5, 98);
  // Identity and history
  s.source = 'historical';
  s.college = seed.college ?? undefined;
  s.archetypeLabel = archetypeLabel(g, pos);
  if (seed.draft) {
    s.draftYear = String(seed.draft.year); s.draftRound = seed.draft.round; s.draftPick = seed.draft.pick; s.draftTeamId = seed.draft.team;
  } else { s.draftYear = null; s.draftRound = null; s.draftPick = null; s.draftTeamId = null; }
  const mpg = nz(seed.profile?.mpg, 14);
  s.minutes = { mode: 'AI', target: clamp(Math.round(mpg), 4, 38) };
  s.jerseyNumber = rng.nextInt(100);
  return s;
}

function archetypeLabel(g: ReturnType<typeof groupsFrom>, pos: PositionSuitability): string {
  if (g.passing > 1.2 && (pos.PG >= 90 || pos.SG >= 90)) return 'Floor General';
  if (g.threePoint > 1.15 && g.passing < 1.05) return 'Sharpshooter';
  if (g.blocks > 1.15 && g.rebounding > 1.1) return 'Rim Protector';
  if (g.rebounding > 1.2) return 'Glass Cleaner';
  if (g.passing > 1.15 && (pos.SF >= 90 || pos.PF >= 90)) return 'Point Forward';
  if (g.finishing > 1.12 && g.threePoint < 0.9) return 'Slasher';
  if (g.steals > 1.12 && g.perimeterD > 1.05) return 'Defensive Specialist';
  if (g.threePoint > 1.02 && g.perimeterD > 1.02) return '3&D Wing';
  return 'Real player';
}

/** Builds a real player whose Overall matches `targetCv` (Court Vision scale), with skills shaped by his real profile. */
export function buildRealPlayer(seed: RealPlayerSeed, season: string, teamId: string | null, age: number, targetCv: number, dataset: string): PlayerSeason {
  let lo = 5, hi = 140, best = build(seed, season, teamId, age, 60);
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2, p = build(seed, season, teamId, age, mid);
    best = p;
    if (calculateOverall(p) < targetCv) lo = mid; else hi = mid;
  }
  best = build(seed, season, teamId, age, hi);
  best.real = { id: seed.id, dataset, rating: seed.rating, frames: seed.frames, appliedSeason: season, coverageEndYear: seed.frames.length ? seed.frames[seed.frames.length - 1][0] : seed.rating.startYear };
  // His real national team (for the World Games).
  best.nationality = realNationality(seed.name);
  // Potential follows Court Vision's usual projection from age and current level (no future real data leaks here).
  const overall = calculateOverall(best);
  const peakAge = 26;
  best.development.peakAge = peakAge; best.development.primeLengthYears = 5;
  best.development.potential = Math.max(overall, Math.min(99, Math.round(compressElitePotential(overall + Math.max(0, peakAge - age) * 1.6))));
  return syncPotential(best);
}

const SKILL_GROUPS = ['offense', 'defense', 'mental'] as const;
const PHYS_SKILLS = ['speed', 'acceleration', 'agility', 'vertical', 'strength', 'balance', 'stamina'] as const;
/** Scales a player's skills (keeping their shape) until his Overall reaches `targetCv`. Body measurements are untouched. */
export function rescaleToOverall(p: PlayerSeason, targetCv: number): PlayerSeason {
  const apply = (f: number): PlayerSeason => {
    const next: PlayerSeason = { ...p, attributes: { ...p.attributes, offense: { ...p.attributes.offense }, defense: { ...p.attributes.defense }, mental: { ...p.attributes.mental }, physical: { ...p.attributes.physical } } };
    for (const g of SKILL_GROUPS) {
      const grp = next.attributes[g] as unknown as Record<string, number>, src = p.attributes[g] as unknown as Record<string, number>;
      for (const k of Object.keys(grp)) grp[k] = clamp(Math.round(src[k] * f), 15, 99);
    }
    const ph = next.attributes.physical as unknown as Record<string, number>, sp = p.attributes.physical as unknown as Record<string, number>;
    for (const k of PHYS_SKILLS) ph[k] = clamp(Math.round(sp[k] * f), 15, 99);
    return next;
  };
  let lo = 0.3, hi = 2.5;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (calculateOverall(apply(mid)) < targetCv) lo = mid; else hi = mid; }
  const out = apply(hi);
  const overall = calculateOverall(out);
  return syncPotential({ ...out, development: { ...out.development, potential: Math.max(overall, Math.min(out.development.potential, 99)) } });
}

/** The reference frame for a season start year, or null past the end of the player's real trajectory. */
export function frameFor(info: RealPlayerInfo | undefined, startYear: number): RatingFrame | null {
  return info?.frames?.find(f => f[0] === startYear) ?? null;
}
