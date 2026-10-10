import { luckMultiplier } from '../relics/relics';
import type { NbaHistory } from '../history/nbaHistoryData';
import type { PlayerSeason } from '../simulation/types';
import { RNG } from '../simulation/engine/rng';
import { cardPool, cardPlayer, type HuntCard } from '../hunt/cards';
import { CATEGORIES, categoryValues, categoryScore, type CategoryId, type CategoryValues } from './categories';
import { legendRank } from '../draft/allTimeDraft';
import { FAV_BOOST } from '../profile/favorites';

/*
 * The Career Mode wheel. Every real player in NBA history is on it once, at his best season. Most spins land on role
 * players; the odds lean a little toward good ones (a Star about 7% of the time, a Great about 18%). When it stops you
 * may take one of that player's ten categories for your player (his exact ratings), once per category.
 *
 * The best ever at something go past 99: the top 60 in a skill, ranked by what they really did that season (threes
 * made, assists, steals, boards and blocks, scoring efficiency), get up to +21, so the very best reaches 120 (Curry's
 * shooting, Stockton's passing).
 *
 * Among Stars the all-time greats come up most (weighted by their Top 100 rank), and a Star's ratings come in 3 higher.
 *
 * Tools: two Lucky Spins (they always land on a Star or a Great); Move Left and Move Right (once each) shift a stopped
 * wheel one slice; two Respins spin again without taking anything; one Triple Spin spins three wheels at once, and you
 * may take one category from each of them (at least one before the next spin); one free Prime Boost.
 */

export const REEL_LENGTH = 24;
export const RESPINS = 2;
/** Lucky spins per player: they always land on a Star or a Great (and the reel around them is richer, LUCK times the Stars and Greats). */
export const LUCKY_SPINS = 2;
export const LUCK = 2.5;
/** Every rating taken from a Star (not his measurements) comes in this much higher. */
export const STAR_BONUS = 3;

/** Prime Boosts per player (free: they don't use a Lucky Spin). */
export const PRIME_BOOSTS = 1;
/** A boosted landing: his absolute prime (`prime`) or, already there, six skills raised 10-20% (`surge`). */
export interface Boost { mode: 'prime' | 'surge'; values: Partial<Record<CategoryId, CategoryValues>>; raised: string[] }
export interface Wheel { reel: string[]; stop: number; lucky?: boolean; boost?: Boost }
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
  /** Lucky spins left (absent in builds started before they existed: they get the full count). */
  lucky?: number;
  /** Prime Boosts left (absent: the full count). */
  boost?: number;
  /** Your favourite player (Profile): when a spin lands on his rarity, FAV_BOOST more chance it is him, until he comes up once. */
  fav?: string;
  favLanded?: boolean;
  /** Relic luck (relics.ts): Stars and Greats come up that much more often on ordinary spins. */
  relicLuck?: number;
}

export const newWheel = (seed: number, fav?: string, relics?: { luck?: number; eternalSpin?: boolean }): WheelState => ({ seed, spinCount: 0, current: null, takenFrom: [], picks: {}, moves: { left: true, right: true },
  respins: RESPINS + (relics?.eternalSpin ? 1 : 0), triple: true, lucky: LUCKY_SPINS, ...(fav ? { fav } : {}), ...(relics?.luck ? { relicLuck: Math.round(relics.luck * 100) / 100 } : {}) });
export const luckyLeft = (s: WheelState) => s.lucky ?? LUCKY_SPINS;
export const boostLeft = (s: WheelState) => s.boost ?? PRIME_BOOSTS;

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

// ---------------------------------------------------------------- the best ever at something

export const ELITE_MAX = 120;
/** How deep the all-time lists go: the top 100 at a skill are rated as the best. */
export const ELITE_RANKS = 100;
type EliteCat = 'threePoint' | 'midRange' | 'finishing' | 'playmaking' | 'perimeterD' | 'interiorD' | 'iq';
const ELITE_CATS: EliteCat[] = ['threePoint', 'midRange', 'finishing', 'playmaking', 'perimeterD', 'interiorD', 'iq'];

const elites = new WeakMap<NbaHistory, Map<string, Partial<Record<CategoryId, number>>>>();
/** Each wheel player's all-time rank (1 = the best) in the skills he is among the top 100 at, from that season's real stats. */
export function eliteRanks(h: NbaHistory): Map<string, Partial<Record<CategoryId, number>>> {
  const hit = elites.get(h);
  if (hit) return hit;
  const pool = wheelPool(h);
  const metrics: Record<EliteCat, { id: string; v: number }[]> = { threePoint: [], midRange: [], finishing: [], playmaking: [], perimeterD: [], interiorD: [], iq: [] };
  for (const c of pool) {
    const p = h.byId.get(c.playerId);
    const rows = p ? (h.seasonsByPlayer.get(p.idx) ?? []).filter(r => r.season === c.end && (r.league === 'NBA' || r.league === 'BAA')) : [];
    const r = rows.find(x => x.isAggregate) ?? rows[0];
    if (!r) continue;
    const g = r.stats.g ?? 0;
    if (g < 40) continue;
    const pg = (v: number | null) => (v ?? 0) / g;
    const pct = (m: number | null, a: number | null) => (a ? (m ?? 0) / a : 0);
    const tp = pct(r.stats.x3p, r.stats.x3pa), ft = pct(r.stats.ft, r.stats.fta), fg = pct(r.stats.fg, r.stats.fga), pts = pg(r.stats.pts);
    if (pg(r.stats.x3pa) >= 1 && tp >= 0.33) metrics.threePoint.push({ id: c.id, v: pg(r.stats.x3p) * (0.5 + tp) });
    if (pg(r.stats.fta) >= 3 && ft >= 0.8) metrics.midRange.push({ id: c.id, v: ft * Math.min(1, pts / 30) });
    if (fg >= 0.45) metrics.finishing.push({ id: c.id, v: pts * fg });
    metrics.playmaking.push({ id: c.id, v: pg(r.stats.ast) });
    if (r.stats.stl != null) metrics.perimeterD.push({ id: c.id, v: pg(r.stats.stl) });
    metrics.interiorD.push({ id: c.id, v: pg(r.stats.trb) + 2 * pg(r.stats.blk) });
    metrics.iq.push({ id: c.id, v: c.ovr });
  }
  const out = new Map<string, Partial<Record<CategoryId, number>>>();
  for (const cat of ELITE_CATS) {
    metrics[cat].sort((a, b) => b.v - a.v).slice(0, ELITE_RANKS).forEach((m, i) => {
      const e = out.get(m.id) ?? {};
      e[cat] = i + 1;
      out.set(m.id, e);
    });
  }
  elites.set(h, out);
  return out;
}

/**
 * What an all-time rank is worth: the category's average rating it is raised to at least. The best ever averages 115,
 * the top 10 about 102 and up, and 100th still 90 (so the 4th-best finisher ever is around 107, not 89).
 */
export const eliteTarget = (rank: number) => Math.round(90 + (ELITE_MAX - 5 - 90) * (1 - Math.log(rank) / Math.log(ELITE_RANKS + 1)));
/** Kept for older callers: how far past 99 a rank's target goes. */
export const eliteBonus = (rank: number) => Math.max(0, eliteTarget(rank) - 99);
/** A Star who is not top-10 ever at anything still has one category at this average: his best one. So does a Great in the top 50 ever at a skill. */
export const STAR_FLOOR = 100;
export const GREAT_FLOOR_RANK = 50;
const RATED: CategoryId[] = ['athleticism', 'finishing', 'midRange', 'threePoint', 'playmaking', 'perimeterD', 'interiorD', 'iq'];

/** Raises a category's average rating to `target`: his strong skills most, the rest part of the way, nothing past 120. */
function raiseTo(values: CategoryValues, target: number): CategoryValues {
  const out = { ...values };
  const keys = Object.keys(out).filter(k => !MEASURE.has(k));
  for (let pass = 0; pass < 3; pass++) {
    const avg = keys.reduce((n, k) => n + out[k], 0) / Math.max(1, keys.length);
    const need = target - avg;
    if (need <= 0.25) break;
    const room = keys.filter(k => out[k] < ELITE_MAX);
    if (!room.length) break;
    const w = (k: string) => (out[k] >= 80 ? 1 : 0.6);
    const mean = room.reduce((n, k) => n + w(k), 0) / room.length;
    const per = (need * keys.length) / room.length;
    for (const k of room) out[k] = Math.min(ELITE_MAX, Math.round(out[k] + per * (w(k) / mean)));
  }
  return out;
}

const starBest = new Map<string, CategoryId | null>();
/** The category a Star is best at, when none of his all-time ranks already puts a category past 100. */
function starFloorCategory(h: NbaHistory, cardId: string): CategoryId | null {
  if (starBest.has(cardId)) return starBest.get(cardId)!;
  let pick: CategoryId | null = null;
  const rarity = cardPool(h).byId.get(cardId)?.rarity;
  const ranks = eliteRanks(h).get(cardId) ?? {};
  const ranked = (Object.entries(ranks) as [CategoryId, number][]).sort((a, b) => a[1] - b[1]);
  const topTarget = ranked.length ? eliteTarget(ranked[0][1]) : 0;
  if (topTarget < STAR_FLOOR) {
    // A Star: his best category. A Great who is top 50 ever at something (Ja's playmaking): that skill.
    if (rarity === 'legendary') { const p = donor(h, cardId); pick = [...RATED].sort((a, b) => categoryScore(categoryValues(p, b)) - categoryScore(categoryValues(p, a)))[0]; }
    else if (rarity === 'epic' && ranked.length && ranked[0][1] <= GREAT_FLOOR_RANK) pick = ranked[0][0];
  }
  if (starBest.size > 2000) starBest.clear();
  starBest.set(cardId, pick);
  return pick;
}

/** A category as it would be taken: his ratings, raised when he is one of the best ever at it (or it is a Star's best). */
export function takenValues(h: NbaHistory, cardId: string, cat: CategoryId): CategoryValues {
  let base = categoryValues(donor(h, cardId), cat);
  // A Star's ratings come in a little higher.
  if (cardPool(h).byId.get(cardId)?.rarity === 'legendary') base = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, MEASURE.has(k) ? v : Math.min(ELITE_MAX, v + STAR_BONUS)]));
  const rank = eliteRanks(h).get(cardId)?.[cat];
  const target = Math.max(rank ? eliteTarget(rank) : 0, starFloorCategory(h, cardId) === cat ? STAR_FLOOR : 0);
  return target ? raiseTo(base, target) : base;
}
const MEASURE = new Set(['physical.heightInches', 'physical.wingspanInches', 'physical.standingReachInches', 'physical.weightLbs']);

/** A player's ten categories as they would be taken. */
export const donorCategories = (h: NbaHistory, cardId: string) => Object.fromEntries(CATEGORIES.map(c => [c.id, takenValues(h, cardId, c.id)])) as Record<CategoryId, CategoryValues>;

const complete = (s: WheelState) => CATEGORIES.every(c => s.picks[c.id]);
export const isComplete = complete;
/** A spin is waiting for a pick (or a respin) before the next one. */
export const mustTake = (s: WheelState) => !!s.current && s.takenFrom.length === 0;
export const canSpin = (s: WheelState) => !complete(s) && !mustTake(s);

/** Odds by rarity: a little kinder than history (Stars about 7%, Greats about 18%). */
export const RARITY_WEIGHT: Record<HuntCard['rarity'], number> = { legendary: 1.6, epic: 1.35, rare: 1, common: 0.9 };

/**
 * Among Stars, the famous ones come up more: an all-time Top 100 player is weighted by his rank (the very top about
 * four times as often as an unranked Star). Stars as a whole keep the same share of the wheel.
 */
const fame = new WeakMap<NbaHistory, Map<string, number>>();
function fameWeight(h: NbaHistory, c: HuntCard): number {
  let m = fame.get(h);
  if (!m) {
    const stars = wheelPool(h).filter(x => x.rarity === 'legendary');
    const raw = new Map(stars.map(x => { const r = legendRank(h, x.playerId); return [x.id, r ? 1 + (101 - r) / 33 : 1] as const; }));
    const mean = [...raw.values()].reduce((a, b) => a + b, 0) / Math.max(1, raw.size);
    m = new Map([...raw].map(([id, w]) => [id, w / mean]));
    fame.set(h, m);
  }
  return m.get(c.id) ?? 1;
}
/** A slice's weight on the wheel; `luck` multiplies the Stars and Greats (lucky spins). */
export function sliceWeight(h: NbaHistory, c: HuntCard, luck = 1): number {
  const rare = c.rarity === 'legendary' || c.rarity === 'epic';
  return RARITY_WEIGHT[c.rarity] * (rare ? luck : 1) * (c.rarity === 'legendary' ? fameWeight(h, c) : 1);
}
const cumulative = new WeakMap<NbaHistory, Map<number, number[]>>();
function pickCard(h: NbaHistory, rng: RNG, luck = 1): HuntCard {
  const pool = wheelPool(h);
  let byLuck = cumulative.get(h);
  if (!byLuck) { byLuck = new Map(); cumulative.set(h, byLuck); }
  let cum = byLuck.get(luck);
  if (!cum) { let t = 0; cum = pool.map(c => (t += sliceWeight(h, c, luck))); byLuck.set(luck, cum); }
  const x = rng.next() * cum[cum.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] > x) hi = mid; else lo = mid + 1; }
  return pool[lo];
}

/** Stars and Greats only, by their wheel weight (a lucky spin's landing). */
const elitePools = new WeakMap<NbaHistory, { list: HuntCard[]; cum: number[] }>();
function pickElite(h: NbaHistory, rng: RNG): HuntCard {
  let e = elitePools.get(h);
  if (!e) { const list = wheelPool(h).filter(c => c.rarity === 'legendary' || c.rarity === 'epic'); let t = 0; e = { list, cum: list.map(c => (t += sliceWeight(h, c, LUCK))) }; elitePools.set(h, e); }
  const x = rng.next() * e.cum[e.cum.length - 1];
  let lo = 0, hi = e.cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (e.cum[mid] > x) hi = mid; else lo = mid + 1; }
  return e.list[lo];
}

/** Your favourite player's slice on the wheel (his best season), by player id or name. */
export function favCard(h: NbaHistory, fav: string): HuntCard | undefined {
  const key = fav.toLowerCase();
  return wheelPool(h).find(c => c.playerId.toLowerCase() === key || c.name.toLowerCase() === key);
}
/** Once your favourite has come up on a wheel, the odds go back to normal for the rest of this player. */
function noteFav(h: NbaHistory, s: WheelState): WheelState {
  if (!s.fav || s.favLanded || !s.current) return s;
  const fav = favCard(h, s.fav);
  return fav && s.current.some(w => landed(w) === fav.id) ? { ...s, favLanded: true } : s;
}

function makeWheels(h: NbaHistory, s: WheelState, count: number, lucky = false): Wheel[] {
  const rng = new RNG(s.seed * 7919 + s.spinCount * 104_729 + 17);
  const luck = lucky ? LUCK : luckMultiplier(s.relicLuck);
  return Array.from({ length: count }, () => {
    const reel = Array.from({ length: REEL_LENGTH }, () => pickCard(h, rng, luck).id), stop = rng.nextInt(REEL_LENGTH);
    // A lucky spin always lands on a Star or a Great.
    if (lucky) { const rarity = cardPool(h).byId.get(reel[stop])?.rarity; if (rarity !== 'legendary' && rarity !== 'epic') reel[stop] = pickElite(h, rng).id; }
    // Your favourite player: landing on his rarity, a FAV_BOOST chance it is him (until he has come up once).
    const fav = s.fav && !s.favLanded ? favCard(h, s.fav) : undefined;
    if (fav && cardPool(h).byId.get(reel[stop])?.rarity === fav.rarity && !reel.includes(fav.id) && rng.next() < FAV_BOOST) reel[stop] = fav.id;
    return { reel, stop, ...(lucky ? { lucky: true } : {}) };
  });
}

/** Spins the wheel (or, with `triple`, the triple spin; with `lucky`, one of the lucky spins). */
export function spin(h: NbaHistory, s: WheelState, triple = false, lucky = false): WheelState {
  if (!canSpin(s) || (triple && !s.triple) || (lucky && luckyLeft(s) <= 0)) return s;
  const next = { ...s, spinCount: s.spinCount + 1, takenFrom: [], triple: triple ? false : s.triple, ...(lucky ? { lucky: luckyLeft(s) - 1 } : {}) };
  return noteFav(h, { ...next, current: makeWheels(h, next, triple ? 3 : 1, lucky) });
}

/** Spins again without taking anything from this spin. */
export function respin(h: NbaHistory, s: WheelState): WheelState {
  // A boosted wheel stays: respinning would throw away the Lucky Spin the boost cost.
  if (!mustTake(s) || s.respins <= 0 || s.current!.some(w => w.boost)) return s;
  const next = { ...s, spinCount: s.spinCount + 1, respins: s.respins - 1, takenFrom: [] };
  // A respin of a lucky spin stays lucky.
  return noteFav(h, { ...next, current: makeWheels(h, next, s.current!.length, !!s.current![0]?.lucky) });
}

/** Shifts a stopped single wheel one slice left or right (each direction once). */
export function move(s: WheelState, dir: 'left' | 'right'): WheelState {
  if (!mustTake(s) || s.current!.length !== 1 || !s.moves[dir] || s.current![0].boost) return s;
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
  const picks = { ...s.picks, [cat]: { cardId, values: s.current[wheel].boost?.values[cat] ?? takenValues(h, cardId, cat) } };
  const takenFrom = [...s.takenFrom, wheel];
  const done = CATEGORIES.every(c => picks[c.id]);
  // The spin stays on the table (a triple spin's other wheels can still be taken from) until the next spin.
  return { ...s, picks, takenFrom, current: done ? null : s.current };
}

// ---------------------------------------------------------------- the Prime Boost

const careers = new WeakMap<NbaHistory, Map<string, string[]>>();
/** Every season card of a player (the wheel shows one: his best). */
function seasonsOf(h: NbaHistory, playerId: string): string[] {
  let m = careers.get(h);
  if (!m) { m = new Map(); for (const c of cardPool(h).cards) m.set(c.playerId, [...(m.get(c.playerId) ?? []), c.id]); careers.set(h, m); }
  return m.get(playerId) ?? [];
}
/** Categories a boost can touch: everything but height and length. */
const BOOSTABLE = CATEGORIES.filter(c => c.id !== 'size').map(c => c.id);
export const SURGE_SKILLS = 6;

/**
 * The Prime Boost for the player a wheel stopped on (once per player, free). It puts him in his
 * absolute prime: every skill at the best he ever had it, in any season. If that would raise fewer than six skills
 * (he is already at his peak), six random skills rise 10-20% instead. Nothing passes 120; height, length and weight
 * never change.
 */
export function primeBoost(h: NbaHistory, s: WheelState, wheel: number): WheelState {
  const w = s.current?.[wheel];
  if (!w || !mustTake(s) || s.takenFrom.includes(wheel) || w.boost || boostLeft(s) <= 0) return s;
  const cardId = landed(w), card = cardPool(h).byId.get(cardId)!;
  const base = Object.fromEntries(BOOSTABLE.map(c => [c, takenValues(h, cardId, c)])) as Record<CategoryId, CategoryValues>;
  const peak = structuredClone(base), raised: string[] = [];
  for (const other of seasonsOf(h, card.playerId)) {
    if (other === cardId) continue;
    for (const c of BOOSTABLE) for (const [k, v] of Object.entries(takenValues(h, other, c))) if (!MEASURE.has(k) && v > peak[c][k]) peak[c][k] = v;
  }
  for (const c of BOOSTABLE) for (const k of Object.keys(peak[c])) if (peak[c][k] > base[c][k]) raised.push(k);
  let boost: Boost;
  if (raised.length >= SURGE_SKILLS) boost = { mode: 'prime', values: peak, raised };
  else {
    const rng = new RNG(s.seed * 131 + s.spinCount * 7 + wheel);
    const fields = BOOSTABLE.flatMap(c => Object.keys(base[c]).filter(k => !MEASURE.has(k)).map(k => [c, k] as const));
    const values = structuredClone(base), picked: string[] = [];
    while (picked.length < SURGE_SKILLS && picked.length < fields.length) {
      const [c, k] = fields[rng.nextInt(fields.length)];
      if (picked.includes(k)) continue;
      values[c][k] = Math.min(ELITE_MAX, Math.round(values[c][k] * (1.1 + rng.next() * 0.1)));
      picked.push(k);
    }
    boost = { mode: 'surge', values, raised: picked };
  }
  return { ...s, boost: boostLeft(s) - 1, current: s.current!.map((x, i) => (i === wheel ? { ...x, boost } : x)) };
}

/** A wheel's categories as they would be taken (boosted when the Prime Boost was used on it). */
export const wheelCategories = (h: NbaHistory, w: Wheel) => {
  const cats = donorCategories(h, landed(w));
  return w.boost ? { ...cats, ...w.boost.values } as typeof cats : cats;
};

/** Wheels that can still be taken from in the current spin. */
export const openWheels = (s: WheelState) => (s.current ?? []).map((_, i) => i).filter(i => !s.takenFrom.includes(i));
