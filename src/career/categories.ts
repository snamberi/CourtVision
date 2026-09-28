import type { PlayerSeason } from '../simulation/types';

/*
 * The ten attribute categories of Career Mode. Each maps to real attribute fields of a player; taking a category from
 * a player on the wheel copies those fields exactly. Size fields are measurements (inches, pounds), the rest ratings.
 */

export type CategoryId = 'size' | 'body' | 'athleticism' | 'finishing' | 'midRange' | 'threePoint' | 'playmaking' | 'perimeterD' | 'interiorD' | 'iq';
type Group = 'physical' | 'offense' | 'defense' | 'mental';
export interface Category { id: CategoryId; name: string; short: string; blurb: string; fields: [Group, string][] }

const f = (group: Group, ...keys: string[]): [Group, string][] => keys.map(k => [group, k]);

export const CATEGORIES: Category[] = [
  { id: 'size', name: 'Height & Length', short: 'SIZE', blurb: 'Height, wingspan and reach.', fields: f('physical', 'heightInches', 'wingspanInches', 'standingReachInches') },
  { id: 'body', name: 'Body', short: 'BODY', blurb: 'Weight, strength, balance, stamina and durability.', fields: f('physical', 'weightLbs', 'strength', 'balance', 'stamina', 'durability') },
  { id: 'athleticism', name: 'Athleticism', short: 'ATH', blurb: 'Speed, acceleration, vertical and agility.', fields: f('physical', 'speed', 'acceleration', 'vertical', 'agility') },
  { id: 'finishing', name: 'Finishing', short: 'FIN', blurb: 'Layups, dunks, touch and the post.', fields: f('offense', 'closeShot', 'drivingLayup', 'drivingDunk', 'standingDunk', 'postHook', 'postFade', 'postControl', 'finishing', 'touch') },
  { id: 'midRange', name: 'Mid-Range', short: 'MID', blurb: 'Mid-range, long twos and free throws.', fields: f('offense', 'midrange', 'longMidrange', 'freeThrow') },
  { id: 'threePoint', name: 'Three-Point', short: '3PT', blurb: 'Every kind of three.', fields: f('offense', 'threePoint', 'corner3', 'aboveBreak3', 'pullUp3', 'catchAndShoot') },
  { id: 'playmaking', name: 'Playmaking', short: 'PLAY', blurb: 'Handles, passing and decisions.', fields: f('offense', 'ballHandling', 'ballSecurity', 'speedWithBall', 'passing', 'passingAccuracy', 'passingIQ', 'decisionMaking') },
  { id: 'perimeterD', name: 'Perimeter D', short: 'PER D', blurb: 'On-ball defense, closeouts and steals.', fields: f('defense', 'perimeterDefense', 'pickAndRollDefense', 'closeout', 'steal', 'stealIQ', 'onBallSteal', 'passingLaneSteal') },
  { id: 'interiorD', name: 'Interior D & Boards', short: 'INT D', blurb: 'Rim protection, blocks and rebounding.', fields: [...f('defense', 'interiorDefense', 'helpDefense', 'contest', 'block', 'blockIQ', 'blockTiming', 'rimProtection', 'defensiveRebounding'), ...f('offense', 'offensiveRebounding')] },
  { id: 'iq', name: 'IQ & Clutch', short: 'IQ', blurb: 'Basketball IQ, clutch, composure and consistency.', fields: [...f('mental', 'clutch', 'consistency', 'confidence', 'composure', 'discipline', 'aggression', 'effort', 'basketballIQ', 'playoffPerformance', 'pressurePerformance', 'leadership'), ...f('offense', 'offensiveIQ', 'shotIQ', 'offensiveConsistency'), ...f('defense', 'defensiveIQ', 'defensiveConsistency', 'defensiveAwareness', 'defensiveDiscipline')] },
];
export const CATEGORY_BY_ID = new Map(CATEGORIES.map(c => [c.id, c]));
export const MEASUREMENTS = new Set(['heightInches', 'wingspanInches', 'standingReachInches', 'weightLbs']);

export type CategoryValues = Record<string, number>;
const key = (g: Group, k: string) => `${g}.${k}`;

/** A player's values for one category, keyed "group.field". */
export function categoryValues(p: PlayerSeason, id: CategoryId): CategoryValues {
  const out: CategoryValues = {};
  for (const [g, k] of CATEGORY_BY_ID.get(id)!.fields) out[key(g, k)] = (p.attributes[g] as unknown as Record<string, number>)[k];
  return out;
}

/** Writes category values into a player (a new object). */
export function withCategory(p: PlayerSeason, values: CategoryValues): PlayerSeason {
  const attributes = { physical: { ...p.attributes.physical }, offense: { ...p.attributes.offense }, defense: { ...p.attributes.defense }, mental: { ...p.attributes.mental } };
  for (const [path, v] of Object.entries(values)) {
    const [g, k] = path.split('.') as [Group, string];
    (attributes[g] as unknown as Record<string, number>)[k] = v;
  }
  return { ...p, attributes };
}

export const feetInches = (inches: number) => `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"`;

/** One number for a category (the average rating; size and body show height and weight instead). */
export function categoryScore(values: CategoryValues): number {
  const vals = Object.entries(values).filter(([k]) => !MEASUREMENTS.has(k.split('.')[1])).map(([, v]) => v);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}
export function categoryLabel(id: CategoryId, values: CategoryValues): string {
  if (id === 'size') return `${feetInches(values['physical.heightInches'])} · ${feetInches(values['physical.wingspanInches'])} span`;
  if (id === 'body') return `${Math.round(values['physical.weightLbs'])} lb · ${categoryScore(values)}`;
  return String(categoryScore(values));
}
