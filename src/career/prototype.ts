import type { NbaHistory } from '../history/nbaHistoryData';
import type { PlayerSeason } from '../simulation/types';
import { CATEGORIES, categoryScore, categoryValues, type CategoryId } from './categories';
import { wheelPool, donor } from './wheel';
import type { HuntCard } from '../hunt/cards';

/*
 * Prototypes: which real players a build plays like. A build is its nine skill categories plus height. The match
 * weighs the shape most (what you're best and worst at, relative to your own average), then height, then level, so a
 * young build with a shooter's shape still finds the shooters.
 */

export type SkillId = Exclude<CategoryId, 'size'>;
export const SKILL_IDS = CATEGORIES.filter(c => c.id !== 'size').map(c => c.id as SkillId);
export interface BuildShape { skills: Record<SkillId, number>; height: number }
export interface Prototype { card: HuntCard; shape: BuildShape; match: number }

/** Ratings past 99 still read as 99: nobody in the data is rated higher. */
const cap = (v: number) => Math.max(0, Math.min(99, v));
export const shapeOf = (p: PlayerSeason): BuildShape => ({
  skills: Object.fromEntries(SKILL_IDS.map(id => [id, categoryScore(categoryValues(p, id))])) as Record<SkillId, number>,
  height: p.attributes.physical.heightInches,
});

/** How far apart two builds are: shape, then height (an inch counts 1.5), then level (half weight). */
export function buildDistance(a: BuildShape, b: BuildShape): number {
  const av = SKILL_IDS.map(id => cap(a.skills[id])), bv = SKILL_IDS.map(id => cap(b.skills[id]));
  const am = av.reduce((n, v) => n + v, 0) / av.length, bm = bv.reduce((n, v) => n + v, 0) / bv.length;
  const style = Math.sqrt(av.reduce((n, v, i) => n + ((v - am) - (bv[i] - bm)) ** 2, 0) / av.length);
  return style + Math.abs(am - bm) * 0.5 + Math.abs(a.height - b.height) * 1.5;
}
/** 100 = the same build. */
export const matchPercent = (distance: number) => Math.max(1, Math.round(100 * Math.exp(-distance / 30)));

/** The pool: the best 600 player-seasons (names people know), built once per history. */
export const PROTOTYPE_POOL = 600;
const pools = new WeakMap<NbaHistory, { card: HuntCard; shape: BuildShape }[]>();
export function prototypePool(h: NbaHistory): { card: HuntCard; shape: BuildShape }[] {
  const hit = pools.get(h);
  if (hit) return hit;
  const cards = [...wheelPool(h)].sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id)).slice(0, PROTOTYPE_POOL);
  const out = cards.map(card => ({ card, shape: shapeOf(donor(h, card.id)) }));
  pools.set(h, out);
  return out;
}

/** The n closest real players to a build, best first (one season per player; `skip` leaves a player out). */
export function closestPrototypes(shape: BuildShape, pool: { card: HuntCard; shape: BuildShape }[], n = 3, skip?: string): Prototype[] {
  return pool.filter(e => e.card.playerId !== skip)
    .map(e => ({ ...e, d: buildDistance(shape, e.shape) }))
    .sort((a, b) => a.d - b.d || a.card.id.localeCompare(b.card.id))
    .slice(0, n)
    .map(e => ({ card: e.card, shape: e.shape, match: matchPercent(e.d) }));
}

/** The skills where a build differs most from its prototype (positive: you're better). */
export function prototypeGaps(shape: BuildShape, proto: BuildShape, n = 2): { id: SkillId; by: number }[] {
  return SKILL_IDS.map(id => ({ id, by: Math.round(cap(shape.skills[id]) - proto.skills[id]) }))
    .filter(g => g.by !== 0).sort((a, b) => Math.abs(b.by) - Math.abs(a.by)).slice(0, n);
}
