import type { NbaHistory } from '../history/nbaHistoryData';
import type { PlayerSeason } from '../simulation/types';
import { RNG } from '../simulation/engine/rng';
import { cardPool, cardPlayer, type HuntCard } from '../hunt/cards';
import { CATEGORIES, categoryValues, type CategoryId, type CategoryValues } from './categories';

/*
 * The Career Mode wheel. Every real player in NBA history is on it once, at his best season, and every one is equally
 * likely: most spins land on role players, and a LeBron is as rare as he was. When it stops you may take one of that
 * player's ten categories for your player (his exact ratings), once per category.
 *
 * Tools: Move Left and Move Right (once each) shift a stopped wheel one slice; two Respins spin again without taking
 * anything; one Triple Spin spins three wheels at once, and you may take one category from each of them (at least one
 * before the next spin).
 */

export const REEL_LENGTH = 24;
export const RESPINS = 2;

export interface Wheel { reel: string[]; stop: number }
export interface WheelPick { cardId: string; values: CategoryValues }
export interface WheelState {
  seed: number;
  spinCount: number;
  /** The wheels on the table (one, or three for the triple spin); null before the first spin and once complete. */
  current: Wheel[] | null;
  /** Wheels (by index) already taken from in the current spin. */
  takenFrom: number[];
  picks: Partial<Record<CategoryId, WheelPick>>;
  moves: { left: boolean; right: boolean };
  respins: number;
  triple: boolean;
}

export const newWheel = (seed: number): WheelState => ({ seed, spinCount: 0, current: null, takenFrom: [], picks: {}, moves: { left: true, right: true }, respins: RESPINS, triple: true });

const pools = new WeakMap<NbaHistory, HuntCard[]>();
/** Every player at his best season (players with at least two real seasons). */
export function wheelPool(h: NbaHistory): HuntCard[] {
  const hit = pools.get(h);
  if (hit) return hit;
  const best = new Map<string, HuntCard>(), seasons = new Map<string, number>();
  for (const c of cardPool(h).cards) {
    seasons.set(c.playerId, (seasons.get(c.playerId) ?? 0) + 1);
    const b = best.get(c.playerId);
    if (!b || c.ovr > b.ovr) best.set(c.playerId, c);
  }
  const list = [...best.values()].filter(c => (seasons.get(c.playerId) ?? 0) >= 2).sort((a, b) => a.id.localeCompare(b.id));
  pools.set(h, list);
  return list;
}

const donors = new Map<string, PlayerSeason>();
/** The playable player behind a wheel slice (cached; building one takes a moment). */
export function donor(h: NbaHistory, cardId: string): PlayerSeason {
  let p = donors.get(cardId);
  if (!p) {
    p = cardPlayer(h, cardPool(h).byId.get(cardId)!, 'CAREER');
    if (donors.size > 400) donors.clear();
    donors.set(cardId, p);
  }
  return p;
}

/** A player's ten categories as they would be taken. */
export const donorCategories = (h: NbaHistory, cardId: string) => Object.fromEntries(CATEGORIES.map(c => [c.id, categoryValues(donor(h, cardId), c.id)])) as Record<CategoryId, CategoryValues>;

const complete = (s: WheelState) => CATEGORIES.every(c => s.picks[c.id]);
export const isComplete = complete;
/** A spin is waiting for a pick (or a respin) before the next one. */
export const mustTake = (s: WheelState) => !!s.current && s.takenFrom.length === 0;
export const canSpin = (s: WheelState) => !complete(s) && !mustTake(s);

function makeWheels(h: NbaHistory, s: WheelState, count: number): Wheel[] {
  const pool = wheelPool(h);
  const rng = new RNG(s.seed * 7919 + s.spinCount * 104_729 + 17);
  return Array.from({ length: count }, () => ({ reel: Array.from({ length: REEL_LENGTH }, () => pool[rng.nextInt(pool.length)].id), stop: rng.nextInt(REEL_LENGTH) }));
}

/** Spins the wheel (or, with `triple`, the triple spin). */
export function spin(h: NbaHistory, s: WheelState, triple = false): WheelState {
  if (!canSpin(s) || (triple && !s.triple)) return s;
  const next = { ...s, spinCount: s.spinCount + 1, takenFrom: [], triple: triple ? false : s.triple };
  return { ...next, current: makeWheels(h, next, triple ? 3 : 1) };
}

/** Spins again without taking anything from this spin. */
export function respin(h: NbaHistory, s: WheelState): WheelState {
  if (!mustTake(s) || s.respins <= 0) return s;
  const next = { ...s, spinCount: s.spinCount + 1, respins: s.respins - 1, takenFrom: [] };
  return { ...next, current: makeWheels(h, next, s.current!.length) };
}

/** Shifts a stopped single wheel one slice left or right (each direction once). */
export function move(s: WheelState, dir: 'left' | 'right'): WheelState {
  if (!mustTake(s) || s.current!.length !== 1 || !s.moves[dir]) return s;
  const w = s.current![0];
  const stop = (w.stop + (dir === 'left' ? -1 : 1) + REEL_LENGTH) % REEL_LENGTH;
  return { ...s, current: [{ ...w, stop }], moves: { ...s.moves, [dir]: false } };
}

export const landed = (w: Wheel) => w.reel[w.stop];
export const neighbour = (w: Wheel, dir: 'left' | 'right') => w.reel[(w.stop + (dir === 'left' ? -1 : 1) + REEL_LENGTH) % REEL_LENGTH];

/** Takes one category from the player a wheel stopped on. */
export function take(h: NbaHistory, s: WheelState, wheel: number, cat: CategoryId): WheelState {
  if (!s.current || s.picks[cat] || s.takenFrom.includes(wheel) || !s.current[wheel]) return s;
  const cardId = landed(s.current[wheel]);
  const picks = { ...s.picks, [cat]: { cardId, values: categoryValues(donor(h, cardId), cat) } };
  const takenFrom = [...s.takenFrom, wheel];
  const done = CATEGORIES.every(c => picks[c.id]);
  // The spin stays on the table (a triple spin's other wheels can still be taken from) until the next spin.
  return { ...s, picks, takenFrom, current: done ? null : s.current };
}

/** Wheels that can still be taken from in the current spin. */
export const openWheels = (s: WheelState) => (s.current ?? []).map((_, i) => i).filter(i => !s.takenFrom.includes(i));
