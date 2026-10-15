import { localRead, type Read } from '../lib/kv';
import { CATEGORIES, feetInches, type CategoryId } from '../career/categories';

/*
 * Your own player's ratings (the character in your Closet). Everyone starts 5'3" with every skill at 45. Every five
 * profile levels earn 7 points to spend: a point raises a skill by one (up to 120), and an inch of height costs 5
 * points. Only three skills can be rated 99 or more. Your player plays 3v3 Street with these.
 */

export type MySkill = Exclude<CategoryId, 'size'>;
export const MY_SKILLS: { id: MySkill; name: string; short: string }[] = CATEGORIES.filter(c => c.id !== 'size').map(c => ({ id: c.id as MySkill, name: c.name, short: c.short }));
export const BASE_RATING = 45, BASE_HEIGHT = 63, MAX_RATING = 120, MAX_HEIGHT = 90;
export const POINTS_PER_STEP = 7, LEVELS_PER_STEP = 5, INCH_COST = 5;
/** Only this many skills can be rated ELITE_FROM or more. */
export const ELITE_FROM = 99, ELITE_SLOTS = 3;

export interface MyRatings { v: 1; skills: Record<MySkill, number>; height: number }
export const MY_RATINGS_KEY = 'cv-my-ratings';
export const MY_RATINGS_EVENT = 'cv-my-ratings-changed';

export const baseRatings = (): MyRatings => ({ v: 1, skills: Object.fromEntries(MY_SKILLS.map(s => [s.id, BASE_RATING])) as Record<MySkill, number>, height: BASE_HEIGHT });

/** Points earned by a profile level: 7 for every 5 levels. */
export const pointsEarned = (level: number) => Math.floor(Math.max(0, level) / LEVELS_PER_STEP) * POINTS_PER_STEP;
export const pointsSpent = (r: MyRatings) => MY_SKILLS.reduce((n, s) => n + (r.skills[s.id] - BASE_RATING), 0) + (r.height - BASE_HEIGHT) * INCH_COST;
export const pointsLeft = (r: MyRatings, level: number) => pointsEarned(level) - pointsSpent(r);
export const eliteCount = (r: MyRatings) => MY_SKILLS.filter(s => r.skills[s.id] >= ELITE_FROM).length;

/** Why a skill can't go up one more point (null when it can). */
export function raiseBlock(r: MyRatings, skill: MySkill, level: number): string | null {
  const v = r.skills[skill];
  if (v >= MAX_RATING) return `${MAX_RATING} is the most a skill can reach.`;
  if (pointsLeft(r, level) < 1) return `No points left. You earn ${POINTS_PER_STEP} more every ${LEVELS_PER_STEP} levels.`;
  if (v + 1 === ELITE_FROM && eliteCount(r) >= ELITE_SLOTS) return `Only ${ELITE_SLOTS} skills can be rated ${ELITE_FROM} or more.`;
  return null;
}
export const heightBlock = (r: MyRatings, level: number): string | null =>
  r.height >= MAX_HEIGHT ? `${feetInches(MAX_HEIGHT)} is as tall as you can grow.` : pointsLeft(r, level) < INCH_COST ? `An inch costs ${INCH_COST} points.` : null;

/** Raises (by +1) or lowers (by -1) a skill; lowering gives the point back. Returns the same object if not allowed. */
export function stepSkill(r: MyRatings, skill: MySkill, by: 1 | -1, level: number): MyRatings {
  if (by === 1 && raiseBlock(r, skill, level)) return r;
  if (by === -1 && r.skills[skill] <= BASE_RATING) return r;
  return { ...r, skills: { ...r.skills, [skill]: r.skills[skill] + by } };
}
export function stepHeight(r: MyRatings, by: 1 | -1, level: number): MyRatings {
  if (by === 1 && heightBlock(r, level)) return r;
  if (by === -1 && r.height <= BASE_HEIGHT) return r;
  return { ...r, height: r.height + by };
}

/** Keeps a stored build legal (ratings in range, three 99+ at most, never more points than the level has earned). */
export function cleanRatings(raw: unknown, level: number): MyRatings {
  const x = raw as Partial<MyRatings> | null;
  const r = baseRatings();
  if (!x || typeof x !== 'object') return r;
  const num = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : d);
  r.height = num(x.height, BASE_HEIGHT, MAX_HEIGHT, BASE_HEIGHT);
  let elite = 0;
  for (const s of [...MY_SKILLS].sort((a, b) => num(x.skills?.[b.id], 0, MAX_RATING, 0) - num(x.skills?.[a.id], 0, MAX_RATING, 0))) {
    let v = num(x.skills?.[s.id], BASE_RATING, MAX_RATING, BASE_RATING);
    if (v >= ELITE_FROM) { if (elite >= ELITE_SLOTS) v = ELITE_FROM - 1; else elite++; }
    r.skills[s.id] = v;
  }
  // Over budget (an old build, a lower level on another device): trim the highest skills first, then height.
  while (pointsSpent(r) > pointsEarned(level)) {
    const top = [...MY_SKILLS].sort((a, b) => r.skills[b.id] - r.skills[a.id])[0];
    if (r.skills[top.id] > BASE_RATING) r.skills[top.id]--;
    else if (r.height > BASE_HEIGHT) r.height--;
    else break;
  }
  return r;
}

export function loadMyRatings(level: number, read: Read = localRead): MyRatings {
  try { return cleanRatings(JSON.parse(read(MY_RATINGS_KEY) ?? 'null'), level); } catch { return baseRatings(); }
}
export function saveMyRatings(r: MyRatings): void {
  try { localStorage.setItem(MY_RATINGS_KEY, JSON.stringify(r)); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new Event(MY_RATINGS_EVENT)); } catch { /* no window (tests) */ }
}

/** One number for your player: the average skill, plus a little for height past 6'3". */
export const myOverall = (r: MyRatings) => Math.round(MY_SKILLS.reduce((n, s) => n + r.skills[s.id], 0) / MY_SKILLS.length + Math.max(0, r.height - 75) * 0.3);
