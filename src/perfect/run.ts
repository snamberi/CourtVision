import type { NbaHistory } from '../history/nbaHistoryData';
import { RNG } from '../simulation/engine/rng';
import { simulateGame } from '../simulation/engine/game';
import { DEFAULT_GAME_SETTINGS, ERA_PRESETS } from '../simulation/types';
import { cardPool, cardPlayer, seasonLabel, type HuntCard, type Rarity } from '../hunt/cards';
import { huntTeams, type HuntTeam } from '../hunt/teams';
import { ERAS, eraCoach, eraOf, eraRules, underEra, type HuntEra } from '../hunt/eras';
import { chemistry, chemistryBonus, type ChemistryBond } from '../hunt/chemistry';
import { COACHES, COACH_BY_ID, coachRarity, type HuntCoach, type CoachStyle } from '../hunt/coaches';
import { withRotation } from '../hunt/run';
import { rosterRating } from '../hunt/rating';
import { addBox, addHighs, type RunLine, type GameHighs } from '../hunt/statLines';
import { challengeMultiplier, STANDARD_VIEW, type Level, type RunView } from '../retention/challenge';
import type { PlayerStatLine } from '../simulation/boxscore';
import { categories, categoryById, TIER_MULTIPLIER, type CategoryInfo, type Tier } from './categories';

/*
 * The 82-0 Challenge: build a ten-man team and a coach, then play a whole 82-game season against real teams from
 * every era, and four best-of-seven playoff rounds. The goal is 82-0 and 16-0. Two ways to build:
 *
 *  - Quick Spin: ten spins (five starters by position, five bench spots) and a coach spin. Three rerolls send a card
 *    back; two lucky spins land on a sure Great or Star.
 *  - Franchise Spin: each spin rolls a franchise and an era ("Warriors, the 2010s"); you pick ONE player who played
 *    there then, at his best season with them. Three team-or-era rerolls, two lucky rolls (a Great or a Star in the
 *    pool) and one Absolute Prime boost (that spin's players at the best season of their whole career).
 *
 *  - Category Roll: the game rolls a category ("MVPs", "90s players", "Duke", "No. 1 picks"...) and you take your five
 *    starters from it, any five, each at his best season that fits. A second roll is the bench category. Three
 *    category rerolls, two lucky rolls (an S or A tier category).
 *  - Slot Spin: every one of the ten spots rolls its own category and you take one player from each.
 *  Weaker categories pay more (categories.ts tiers), so a title with second-round picks outscores one with MVPs.
 *
 * In the season you can set your own rotation (starters, then the bench in order) or leave it to the coach.
 *
 * The schedule has boss teams (the 72-10 Bulls, the 73-9 Warriors and the other great teams), every game is played
 * under the rules of the opponent's era, and everything is seeded, so the Daily 82-0 is the same for everyone.
 */

export type PerfectMode = 'quick' | 'franchise' | 'category' | 'slots';
export const isCategoryMode = (m: PerfectMode) => m === 'category' || m === 'slots';
export type PerfectStage = 'draft' | 'coach' | 'season' | 'playoffs' | 'done';
export interface PerfectGame { opp: string; us: number; them: number; won: boolean; top: string; boss?: boolean }
export interface PerfectSeries { round: number; opp: string; games: PerfectGame[] }
export interface PerfectRoll { franchise: string; eraId: string }

export interface PerfectRun {
  v: 1;
  mode: PerfectMode;
  seed: number;
  /** The day (YYYY-MM-DD) of a Daily 82-0. */
  daily?: string;
  stage: PerfectStage;
  /** Card ids, in the order they were picked. */
  squad: string[];
  coach?: string;
  /** Category Draft: the category on the board now, and the category and tier of each pick (parallel to squad). */
  cat?: string;
  cats?: string[];
  tiers?: Tier[];
  /** Franchise Spin: the current roll and how many rolls were made (it seeds the next one). */
  roll?: PerfectRoll;
  rolls: number;
  /**
   * Spin helpers. Quick Spin: `spin` rerolls the card the reel landed on, `lucky` makes the next spin a sure Great or
   * Star. Franchise Spin: `roll` rerolls the team or the era (older runs have one of each in `team` and `era`), `lucky`
   * rolls a franchise-era with a Great or a Star in it. Absent on older runs (see spinsLeft and friends).
   */
  rerolls: { team: number; era: number; prime: number; spin?: number; lucky?: number; roll?: number };
  /** Quick Spin: how many rerolls were used (it reseeds the reel), and whether the current spin is a lucky one. */
  spinSalt?: number;
  lucky?: boolean;
  /** Your rotation: all ten card ids, starters first, then the bench in order (the sixth man first). Absent = auto. */
  lineup?: string[];
  /** The Absolute Prime boost is on for the current roll. */
  prime?: boolean;
  /** Coach choices (Franchise Spin offers three; Quick Spin spins one). */
  coachOffer?: string[];
  /** Player totals: the regular season, the playoffs and the Finals (for the Finals MVP). Older runs start counting late. */
  lines?: Record<string, RunLine>;
  playoffLines?: Record<string, RunLine>;
  finalsLines?: Record<string, RunLine>;
  /** The best single games of the run (the record book). */
  highs?: GameHighs;
  /** A same-spin duel: the challenger's code (retention/duel.ts), compared at the end. */
  duel?: string;
  /** Difficulty and how the spins are shown (retention/challenge.ts); absent = Pro, ratings hidden, colours on. */
  level?: Level;
  view?: RunView;
  /** 82 opponent team ids; `bosses` are indexes into it. */
  schedule: string[];
  bosses: number[];
  games: PerfectGame[];
  playoffs: PerfectSeries[];
  result?: 'champion' | 'eliminated';
  /** A League Hunt squad brought over after winning its hunt (its own records). */
  from?: 'hunt';
}

export const SQUAD = 10;
/** Spin helpers each run starts with. */
export const SPIN_REROLLS = 3, LUCKY_SPINS = 2;
export const spinsLeft = (run: Pick<PerfectRun, 'rerolls'>) => run.rerolls.spin ?? 0;
export const luckyLeft = (run: Pick<PerfectRun, 'rerolls'>) => run.rerolls.lucky ?? 0;
/** Franchise Spin rerolls left for the team (or the era): the shared three, or an older run's one of each. */
export const rollRerollsLeft = (run: Pick<PerfectRun, 'rerolls'>, kind: 'team' | 'era') => run.rerolls.roll ?? run.rerolls[kind];
export const SEASON_GAMES = 82;
export const PLAYOFF_ROUNDS = 4;
export const WINS_NEEDED = 4;
/** Quick Spin slots: five starters by position, then the bench. */
export const QUICK_SLOTS = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'BIG', 'ANY', 'ANY'] as const;
export type QuickSlot = typeof QUICK_SLOTS[number];
export const QUICK_SLOT_LABEL: Record<QuickSlot, string> = { PG: 'Point guard', SG: 'Shooting guard', SF: 'Small forward', PF: 'Power forward', C: 'Center', G: 'Bench guard', F: 'Bench wing', BIG: 'Bench big', ANY: 'Bench' };

/** The great teams on every schedule, in the order you meet them. */
export const BOSS_TEAMS: { id: string; tag: string }[] = [
  { id: 'PHI@1967', tag: "Wilt's 68-13 Sixers" },
  { id: 'LAL@1972', tag: '33 straight wins' },
  { id: 'BOS@1986', tag: "Bird's 40-1 at home" },
  { id: 'CHI@1996', tag: 'The 72-10 Bulls' },
  { id: 'GSW@2016', tag: 'The 73-9 Warriors' },
  { id: 'GSW@2017', tag: 'The Durant Warriors' },
];
/** Where the bosses sit in the 82 (game numbers, 1-based). */
const BOSS_GAMES = [14, 28, 41, 55, 68, 82];

/** Score: wins and how big, bosses, the playoffs, and the two perfect bonuses. */
export const SCORE = { win: 100, marginCap: 25, boss: 400, playoffWin: 200, sweep: 250, title: 1500, perfectSeason: 5000, perfectPlayoffs: 5000 };

// ---------------------------------------------------------------- data

const card = (h: NbaHistory, id: string) => cardPool(h).byId.get(id)!;
const teamById = (h: NbaHistory) => {
  const m = new Map(huntTeams(h).map(t => [t.id, t]));
  return (id: string) => m.get(id);
};

interface FranchiseIndex {
  /** franchise → its latest name */
  names: Map<string, string>;
  /** `${franchise}|${eraId}` → each player's best card there, best first */
  pools: Map<string, HuntCard[]>;
  /** player → his best card anywhere */
  prime: Map<string, HuntCard>;
}
const indexes = new WeakMap<NbaHistory, FranchiseIndex>();
export function franchiseIndex(h: NbaHistory): FranchiseIndex {
  const cached = indexes.get(h);
  if (cached) return cached;
  const names = new Map<string, { name: string; end: number }>();
  const best = new Map<string, Map<string, HuntCard>>();
  const prime = new Map<string, HuntCard>();
  for (const c of cardPool(h).cards) {
    const n = names.get(c.franchise);
    if (!n || c.end > n.end) names.set(c.franchise, { name: c.teamName, end: c.end });
    const key = `${c.franchise}|${eraKey(c.end)}`;
    const m = best.get(key) ?? best.set(key, new Map()).get(key)!;
    const cur = m.get(c.playerId);
    if (!cur || c.ovr > cur.ovr) m.set(c.playerId, c);
    const p = prime.get(c.playerId);
    if (!p || c.ovr > p.ovr) prime.set(c.playerId, c);
  }
  const pools = new Map([...best].map(([k, m]) => [k, [...m.values()].sort((a, b) => b.ovr - a.ovr)]));
  const idx = { names: new Map([...names].map(([k, v]) => [k, v.name])), pools, prime };
  indexes.set(h, idx);
  return idx;
}

export const franchiseName = (h: NbaHistory, f: string) => franchiseIndex(h).names.get(f) ?? f;
/** The BAA and early NBA (before 1955) are their own roll; their games use the 1960s rules. */
const EARLY: HuntEra = { ...ERAS[0], id: 'early', label: 'The early NBA', from: 1947, to: 1954 };
const ROLL_ERAS = [EARLY, ...ERAS];
const eraKey = (end: number) => (end < EARLY.to + 1 ? EARLY.id : eraOf(end).id);
export const eraById = (id: string): HuntEra => ROLL_ERAS.find(e => e.id === id) ?? ERAS[ERAS.length - 1];

/** At most this many Stars (legendary cards) on a team: once you have them, the spins stop offering more. */
export const MAX_STARS = 3;
export const starCount = (h: NbaHistory, run: Pick<PerfectRun, 'squad'>) => run.squad.filter(id => card(h, id).rarity === 'legendary').length;
export const starCapReached = (h: NbaHistory, run: Pick<PerfectRun, 'squad'>) => starCount(h, run) >= MAX_STARS;

/** The players offered by a roll: each at his best season there (or of his career with the prime boost), minus anyone you have. */
export function rollPool(h: NbaHistory, run: Pick<PerfectRun, 'squad' | 'prime'>, roll: PerfectRoll): HuntCard[] {
  const idx = franchiseIndex(h);
  const taken = new Set(run.squad.map(id => card(h, id).playerId));
  const capped = starCapReached(h, run);
  const list = (idx.pools.get(`${roll.franchise}|${roll.eraId}`) ?? []).filter(c => !taken.has(c.playerId));
  const out = run.prime ? list.map(c => idx.prime.get(c.playerId) ?? c).sort((a, b) => b.ovr - a.ovr) : list;
  return capped ? out.filter(c => c.rarity !== 'legendary') : out;
}

const MIN_POOL = 3;
const rngFor = (run: Pick<PerfectRun, 'seed'>, salt: number) => new RNG(run.seed * 31 + salt * 7919 + 13);

/** A new franchise-and-era roll; `keep` holds the franchise or the era (the rerolls). */
function rollFor(h: NbaHistory, run: PerfectRun, keep?: { franchise?: string; eraId?: string }, lucky = false): PerfectRoll {
  const rng = rngFor(run, 1000 + run.rolls);
  const idx = franchiseIndex(h);
  // A lucky roll only lands where a Great or a Star (one you are allowed) is waiting.
  const ok = (franchise: string, eraId: string) => {
    const pool = rollPool(h, { squad: run.squad }, { franchise, eraId });
    return pool.length >= MIN_POOL && (!lucky || pool.some(c => c.rarity === 'epic' || c.rarity === 'legendary'));
  };
  // Franchises that played through more eras come up more often (the Celtics more than the Waterloo Hawks).
  const franchises = [...idx.names.keys()].sort();
  const weight = new Map(franchises.map(f => [f, ROLL_ERAS.filter(e => (idx.pools.get(`${f}|${e.id}`)?.length ?? 0) >= MIN_POOL).length]));
  const total = franchises.reduce((n, f) => n + weight.get(f)!, 0);
  const drawFranchise = () => { let r = rng.next() * total; for (const f of franchises) { r -= weight.get(f)!; if (r <= 0) return f; } return franchises[franchises.length - 1]; };
  for (let tries = 0; tries < 400; tries++) {
    const franchise = keep?.franchise ?? drawFranchise();
    const eras = ROLL_ERAS.map(e => e.id).filter(e => ok(franchise, e) && (!run.roll || keep?.franchise == null || e !== run.roll.eraId));
    const eraId = keep?.eraId ?? eras[Math.floor(rng.next() * eras.length)];
    if (!eraId || !ok(franchise, eraId)) continue;
    if (run.roll && keep && franchise === run.roll.franchise && eraId === run.roll.eraId) continue;
    return { franchise, eraId };
  }
  // A reroll with nothing left to change keeps the roll.
  return run.roll ?? { franchise: franchises[0], eraId: ERAS[0].id };
}

// ---------------------------------------------------------------- starting and drafting

export function newPerfectRun(h: NbaHistory, mode: PerfectMode, seed: number, daily?: string, opts: { level?: Level; view?: RunView } = {}): PerfectRun {
  // The Daily is the standard game for everyone.
  const level = daily ? 'pro' : opts.level ?? 'pro', view = daily ? STANDARD_VIEW : opts.view ?? STANDARD_VIEW;
  const rerolls = mode === 'quick' ? { team: 0, era: 0, prime: 0, spin: SPIN_REROLLS, lucky: LUCKY_SPINS } : { team: 0, era: 0, prime: mode === 'franchise' ? 1 : 0, roll: SPIN_REROLLS, lucky: LUCKY_SPINS };
  const run: PerfectRun = { v: 1, mode, seed, daily, stage: 'draft', squad: [], rolls: 0, rerolls, schedule: [], bosses: [], games: [], playoffs: [],
    ...(level !== 'pro' ? { level } : {}), ...(view.numbers !== STANDARD_VIEW.numbers || view.colors !== STANDARD_VIEW.colors ? { view } : {}) };
  if (isCategoryMode(mode)) return { ...run, cat: rollCategory(h, run).id, cats: [], tiers: [], rolls: 1 };
  return mode === 'franchise' ? { ...run, roll: rollFor(h, run), rolls: 1 } : run;
}

// ---------------------------------------------------------------- Category Draft

/** Starters come from the first category, the bench from the second (Category Roll). */
export const STARTERS = 5;
/** Players still to pick from the category on the board (Category Roll: the rest of the starters or the bench). */
export const picksFromCategory = (run: Pick<PerfectRun, 'mode' | 'squad'>) => run.mode === 'slots' ? 1 : run.squad.length < STARTERS ? STARTERS - run.squad.length : SQUAD - run.squad.length;

/** The category's players you can still take (each player once; nobody you already have). */
export function categoryPool(h: NbaHistory, run: Pick<PerfectRun, 'squad' | 'cat'>): HuntCard[] {
  const c = run.cat ? categoryById(h, run.cat) : undefined;
  if (!c) return [];
  const taken = new Set(run.squad.map(id => card(h, id).playerId));
  return c.pool.filter(x => !taken.has(x.playerId));
}

/**
 * A new category. Groups come up evenly (so the 30 teams don't crowd out the awards), a category is never rolled twice
 * in one run, it must still have enough players to choose from, and a lucky roll lands on an S or A tier.
 */
function rollCategory(h: NbaHistory, run: PerfectRun, lucky = false): CategoryInfo {
  const rng = rngFor(run, 3000 + run.rolls);
  const used = new Set([...(run.cats ?? []), ...(run.cat ? [run.cat] : [])]);
  const taken = new Set(run.squad.map(id => card(h, id).playerId));
  const need = picksFromCategory(run) + 3;
  const ok = categories(h).filter(c => !used.has(c.id) && (!lucky || c.tier === 'S' || c.tier === 'A') && c.pool.filter(x => !taken.has(x.playerId)).length >= need);
  const list = ok.length ? ok : categories(h).filter(c => !used.has(c.id));
  const groups = [...new Set(list.map(c => c.group))].sort();
  const group = groups[Math.floor(rng.next() * groups.length)];
  const inGroup = list.filter(c => c.group === group);
  return inGroup[Math.floor(rng.next() * inGroup.length)];
}

/** Category Draft: a new category for this spot (the rolled one goes back). */
export function rerollCategory(h: NbaHistory, run: PerfectRun): PerfectRun {
  if (!isCategoryMode(run.mode) || run.stage !== 'draft' || (run.rerolls.roll ?? 0) < 1) return run;
  const next = { ...run, rolls: run.rolls + 1 };
  return { ...next, cat: rollCategory(h, next).id, rerolls: { ...run.rerolls, roll: (run.rerolls.roll ?? 0) - 1 } };
}

/** The score multiplier from the categories (starters count double): weaker categories pay more. */
export function categoryMultiplier(run: Pick<PerfectRun, 'tiers'>): number {
  const t = run.tiers ?? [];
  if (!t.length) return 1;
  let n = 0, w = 0;
  t.forEach((tier, i) => { const k = i < STARTERS ? 2 : 1; n += TIER_MULTIPLIER[tier] * k; w += k; });
  return Math.round(n / w * 100) / 100;
}

/**
 * A League Hunt squad that won its hunt, taken into an 82-0 season: its six players and coach, then four Quick Spin
 * bench spots to make ten.
 */
export function newPerfectFromHunt(h: NbaHistory, seed: number, squad: string[], coach?: string): PerfectRun {
  const pool = cardPool(h);
  const ids = squad.filter(id => pool.byId.has(id)).slice(0, SQUAD);
  return { v: 1, mode: 'quick', seed, from: 'hunt', stage: 'draft', squad: ids, ...(coach && COACH_BY_ID.has(coach) ? { coach } : {}), rolls: 0, rerolls: { team: 0, era: 0, prime: 0, spin: SPIN_REROLLS, lucky: LUCKY_SPINS }, schedule: [], bosses: [], games: [], playoffs: [] };
}

const QUICK_WEIGHTS: Record<Rarity, number> = { common: 35, rare: 34, epic: 22, legendary: 9 };
const LUCKY_WEIGHTS: Record<Rarity, number> = { common: 0, rare: 0, epic: 70, legendary: 30 };
const fitsQuick = (c: HuntCard, s: QuickSlot) =>
  s === 'ANY' ? true
  : s === 'G' ? ['PG', 'SG', 'G'].includes(c.pos)
  : s === 'F' ? ['SF', 'F', 'SG'].includes(c.pos)
  : s === 'BIG' ? ['PF', 'C'].includes(c.pos)
  : c.pos === s || (c.pos === 'G' && (s === 'PG' || s === 'SG')) || (c.pos === 'F' && (s === 'SF' || s === 'PF'));

/** Quick Spin: the card the next reel lands on (seeded, so the Daily is the same for everyone). */
export function quickSpinCard(h: NbaHistory, run: PerfectRun): HuntCard {
  const slot = QUICK_SLOTS[run.squad.length] ?? 'ANY';
  // A reroll reseeds the reel (the same rerolls give everyone the same cards, so the Daily stays fair).
  const rng = rngFor(run, 50 + run.squad.length + (run.spinSalt ?? 0) * 101);
  const taken = new Set(run.squad.map(id => card(h, id).playerId));
  // A lucky spin lands on a Great or a Star; the star cap: with three Stars already, the reel can't land on another.
  const base = run.lucky ? LUCKY_WEIGHTS : QUICK_WEIGHTS;
  const weights = starCapReached(h, run) ? { ...base, legendary: 0 } : base;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rng.next() * total, rarity: Rarity = 'common';
  for (const k of Object.keys(weights) as Rarity[]) { r -= weights[k]; if (r <= 0 && weights[k] > 0) { rarity = k; break; } }
  const pool = cardPool(h).byRarity[rarity].filter(c => fitsQuick(c, slot) && !taken.has(c.playerId) && c.ovr >= 45);
  return pool[Math.floor(rng.next() * pool.length)] ?? cardPool(h).cards.find(c => !taken.has(c.playerId) && (rarity === 'legendary' || c.rarity !== 'legendary'))!;
}

/** Random cards for the reel to scroll past before it stops (cosmetic only). */
export function reelFiller(h: NbaHistory, n: number, salt: number): HuntCard[] {
  const rng = new RNG(salt * 97 + 5), cards = cardPool(h).byRarity;
  return Array.from({ length: n }, () => { const list = cards[(['common', 'rare', 'epic', 'legendary'] as Rarity[])[Math.floor(rng.next() * 4)]]; return list[Math.floor(rng.next() * list.length)]; });
}

const coachWeights: Record<Rarity, number> = { common: 30, rare: 40, epic: 20, legendary: 10 };
function coachOffer(run: PerfectRun, h: NbaHistory): string[] {
  const rng = rngFor(run, 777);
  const pickOne = (from: HuntCoach[]) => {
    const total = from.reduce((n, x) => n + coachWeights[coachRarity(x)], 0);
    let r = rng.next() * total;
    for (const x of from) { r -= coachWeights[coachRarity(x)]; if (r <= 0) return x; }
    return from[from.length - 1];
  };
  if (run.mode === 'quick') return [pickOne(COACHES).id];
  // Franchise Spin: three to choose from, one of them tied to a franchise you drafted from when there is one.
  const franchises = new Set(run.squad.map(id => card(h, id).franchise));
  const tied = COACHES.filter(x => x.franchises.some(f => franchises.has(f)));
  const out: string[] = [];
  if (tied.length) out.push(pickOne(tied).id);
  while (out.length < 3) { const x = pickOne(COACHES.filter(c => !out.includes(c.id))); out.push(x.id); }
  return out;
}

/** Adds a player (Quick Spin: the reel's card; Franchise Spin: your pick from the roll). */
export function pickPlayer(h: NbaHistory, run: PerfectRun, cardId?: string): PerfectRun {
  if (run.stage !== 'draft') return run;
  let id: string;
  if (run.mode === 'quick') id = quickSpinCard(h, run).id;
  else if (isCategoryMode(run.mode)) {
    if (!cardId || !categoryPool(h, run).some(c => c.id === cardId)) return run;
    id = cardId;
  } else {
    if (!run.roll || !cardId || !rollPool(h, run, run.roll).some(c => c.id === cardId)) return run;
    id = cardId;
  }
  const squad = [...run.squad, id];
  let next: PerfectRun = { ...run, squad, prime: false, lucky: false };
  if (isCategoryMode(run.mode)) {
    const cat = categoryById(h, run.cat!)!;
    next = { ...next, cats: [...(run.cats ?? []), cat.id], tiers: [...(run.tiers ?? []), cat.tier] };
    if (squad.length >= SQUAD) return { ...next, stage: 'coach', cat: undefined, coachOffer: coachOffer(next, h) };
    // Slot Spin: a new category every pick. Category Roll: a new one for the bench once the five starters are in.
    if (run.mode === 'slots' || squad.length === STARTERS) { const n2 = { ...next, rolls: run.rolls + 1 }; return { ...n2, cat: rollCategory(h, n2).id }; }
    return next;
  }
  // A hunt squad keeps its coach and goes straight to the season.
  if (squad.length >= SQUAD && run.coach) return { ...next, stage: 'season', roll: undefined, ...buildSchedule(h, next) };
  if (squad.length >= SQUAD) return { ...next, stage: 'coach', roll: undefined, coachOffer: coachOffer(next, h) };
  if (run.mode === 'franchise') next = { ...next, roll: rollFor(h, next), rolls: run.rolls + 1 };
  return next;
}

const spendRoll = (run: PerfectRun, kind: 'team' | 'era') => run.rerolls.roll != null ? { ...run.rerolls, roll: run.rerolls.roll - 1 } : { ...run.rerolls, [kind]: 0 };
export function rerollTeam(h: NbaHistory, run: PerfectRun): PerfectRun {
  if (run.mode !== 'franchise' || !run.roll || rollRerollsLeft(run, 'team') < 1) return run;
  const next = { ...run, rolls: run.rolls + 1 };
  return { ...next, roll: rollFor(h, next, { eraId: run.roll.eraId }), rerolls: spendRoll(run, 'team') };
}
export function rerollEra(h: NbaHistory, run: PerfectRun): PerfectRun {
  if (run.mode !== 'franchise' || !run.roll || rollRerollsLeft(run, 'era') < 1) return run;
  const next = { ...run, rolls: run.rolls + 1 };
  return { ...next, roll: rollFor(h, next, { franchise: run.roll.franchise }), rerolls: spendRoll(run, 'era') };
}

/** Quick Spin: a new card for this spot (the landed one goes back). */
export function rerollSpin(run: PerfectRun): PerfectRun {
  if (run.mode !== 'quick' || run.stage !== 'draft' || spinsLeft(run) < 1) return run;
  return { ...run, spinSalt: (run.spinSalt ?? 0) + 1, rerolls: { ...run.rerolls, spin: spinsLeft(run) - 1 } };
}

/** A lucky spin. Quick Spin: the next card is a sure Great or Star. Franchise Spin: a new roll with one waiting. */
export function luckySpin(h: NbaHistory, run: PerfectRun): PerfectRun {
  if (run.stage !== 'draft' || luckyLeft(run) < 1 || run.lucky) return run;
  const rerolls = { ...run.rerolls, lucky: luckyLeft(run) - 1 };
  if (run.mode === 'quick') return { ...run, lucky: true, rerolls };
  if (isCategoryMode(run.mode)) { const n2 = { ...run, rolls: run.rolls + 1 }; return { ...n2, cat: rollCategory(h, n2, true).id, rerolls }; }
  if (!run.roll) return run;
  const next = { ...run, rolls: run.rolls + 1 };
  return { ...next, roll: rollFor(h, next, undefined, true), rerolls, prime: false };
}
export function applyPrime(run: PerfectRun): PerfectRun {
  if (run.mode !== 'franchise' || run.stage !== 'draft' || run.rerolls.prime < 1) return run;
  return { ...run, prime: true, rerolls: { ...run.rerolls, prime: 0 } };
}

/** Takes the coach and builds the schedule. */
export function pickCoach(h: NbaHistory, run: PerfectRun, coachId: string): PerfectRun {
  if (run.stage !== 'coach' || !run.coachOffer?.includes(coachId)) return run;
  const sched = buildSchedule(h, run);
  return { ...run, coach: coachId, coachOffer: undefined, stage: 'season', ...sched };
}

// ---------------------------------------------------------------- the schedule

const winPct = (t: HuntTeam) => t.w / Math.max(1, t.w + t.l);

function buildSchedule(h: NbaHistory, run: PerfectRun): { schedule: string[]; bosses: number[] } {
  const rng = rngFor(run, 4242);
  const byId = teamById(h);
  const bossIds = BOSS_TEAMS.map(b => b.id).filter(id => byId(id));
  // Ordinary opponents: real teams with a winning record or close to it; tougher as the season goes on.
  const field = huntTeams(h).filter(t => winPct(t) >= 0.45 && !bossIds.includes(t.id)).sort((a, b) => a.strength - b.strength);
  const schedule: string[] = [];
  const bosses: number[] = [];
  const bossAt = new Map(BOSS_GAMES.slice(0, bossIds.length).map((g, i) => [g - 1, bossIds[i]]));
  for (let g = 0; g < SEASON_GAMES; g++) {
    const boss = bossAt.get(g);
    if (boss) { schedule.push(boss); bosses.push(g); continue; }
    // Early games lean on the lower half of the field, late games on the upper half.
    const lean = g / SEASON_GAMES;
    const at = Math.min(field.length - 1, Math.floor(Math.pow(rng.next(), 1.4 - lean * 0.9) * field.length));
    schedule.push(field[at].id);
  }
  return { schedule, bosses };
}

/** Playoff opponents by round: a good team, a very good one, a champion, then a boss-level champion. */
function playoffOpponent(h: NbaHistory, run: PerfectRun, round: number): string {
  const rng = rngFor(run, 9000 + round);
  const met = new Set(run.playoffs.map(s => s.opp));
  const teams = huntTeams(h).filter(t => !met.has(t.id));
  const sorted = [...teams].sort((a, b) => b.strength - a.strength);
  const cut = [0.12, 0.06, 0.03, 0.012][round] ?? 0.03;
  const top = sorted.slice(0, Math.max(5, Math.floor(sorted.length * cut)));
  const champs = top.filter(t => t.champion);
  const from = round >= 2 && champs.length ? champs : top;
  return from[Math.floor(rng.next() * from.length)].id;
}

// ---------------------------------------------------------------- playing

// ---------------------------------------------------------------- your lineup

/** Your rotation, if you set one that still matches the team: starters first, then the bench in order. */
export function lineupOf(run: Pick<PerfectRun, 'squad' | 'lineup'>): string[] | null {
  const l = run.lineup;
  if (!l || l.length !== run.squad.length || new Set(l).size !== l.length || !l.every(id => run.squad.includes(id))) return null;
  return l;
}
/** Sets your rotation (any order of your ten), or `null` for auto (the coach starts his best five). */
export function setLineup(run: PerfectRun, order: string[] | null): PerfectRun {
  if (run.stage === 'done' || run.stage === 'draft') return run;
  if (order == null) { const { lineup: _drop, ...rest } = run; void _drop; return rest; }
  const next = { ...run, lineup: order };
  return lineupOf(next) ? next : run;
}
/** Swaps two players in your rotation (starting from the order they were picked if you had none). */
export function swapLineup(run: PerfectRun, a: string, b: string): PerfectRun {
  const order = [...(lineupOf(run) ?? run.squad)];
  const i = order.indexOf(a), j = order.indexOf(b);
  if (i < 0 || j < 0 || i === j) return run;
  [order[i], order[j]] = [order[j], order[i]];
  return setLineup(run, order);
}
/** Minutes a game by rotation spot (the same as the auto rotation). */
export const ROTATION_MINUTES = [34, 33, 32, 31, 29, 21, 18, 15, 14, 13];

/** Lineup checks: the starters need someone to bring the ball up and someone to protect the rim. */
export function fitBonds(cards: HuntCard[], chosen?: HuntCard[]): ChemistryBond[] {
  const starters = chosen ?? [...cards].sort((a, b) => b.ovr - a.ovr).slice(0, 5);
  const ids = starters.map(c => c.id);
  const out: ChemistryBond[] = [];
  if (!starters.some(c => ['PG', 'SG', 'G'].includes(c.pos))) out.push({ kind: 'balance', label: 'No guard starts: nobody to bring it up (−3 starters)', cards: ids, bonus: -3 });
  if (!starters.some(c => ['C', 'PF'].includes(c.pos))) out.push({ kind: 'balance', label: 'No big starts: crushed on the boards (−3 starters)', cards: ids, bonus: -3 });
  const counts = new Map<string, number>();
  for (const c of starters) counts.set(c.pos, (counts.get(c.pos) ?? 0) + 1);
  if ([...counts.values()].some(n => n >= 3)) out.push({ kind: 'balance', label: 'Three or more starters at one position: they get in each other\'s way (−1 starters)', cards: ids, bonus: -1 });
  return out;
}

/** Every bond on your team: chemistry from the hunt (teammates, franchise, rivals) and the lineup checks. */
export function teamBonds(h: NbaHistory, run: Pick<PerfectRun, 'squad' | 'lineup'>): ChemistryBond[] {
  const cards = run.squad.map(id => card(h, id));
  const l = lineupOf(run);
  // The lineup checks wait for a full starting five: a half-built squad is not "missing a guard" yet.
  if (cards.length < 5) return chemistry(cards);
  return [...chemistry(cards), ...fitBonds(cards, l ? l.slice(0, 5).map(id => card(h, id)) : undefined)];
}

/** Overall bonus per card: chemistry, lineup and the coach. */
export function squadBonuses(h: NbaHistory, run: Pick<PerfectRun, 'squad' | 'coach' | 'lineup'>): Map<string, number> {
  const chem = chemistryBonus(teamBonds(h, run));
  const coach = run.coach ? COACH_BY_ID.get(run.coach) : undefined;
  return new Map(run.squad.map(id => {
    const c = card(h, id);
    const tied = coach && (coach.franchises.includes(c.franchise) || coach.franchises.includes(c.team)) ? 1 : 0;
    return [id, (chem.get(id) ?? 0) + (coach?.bonus ?? 0) + tied];
  }));
}

/** Your team's 0-100 rating (68 wins = 100) with every bonus. */
export function perfectRating(h: NbaHistory, run: Pick<PerfectRun, 'squad' | 'coach' | 'lineup'>): number {
  if (!run.squad.length) return 0;
  const b = squadBonuses(h, run);
  return rosterRating(h, run.squad.map(id => card(h, id).ovr + (b.get(id) ?? 0)));
}
export const teamRating = (h: NbaHistory, t: HuntTeam) => rosterRating(h, t.roster.map(id => card(h, id).ovr));

/**
 * How much stronger the real teams play (overall points). Franchise Spin lets you choose, so its opponents are
 * tougher; bosses and each playoff round add more. Tuned so a stacked team goes about 70-78 wins and 82-0 is rare.
 */
export const OPP_EDGE = { quick: 0, franchise: 8, category: 15, slots: 19, boss: 3, perRound: 1 };
/** Streak pressure: every 10 straight wins, everyone is gunning for you (+1, up to +4). A loss resets it. */
export const STREAK_STEP = 10, STREAK_MAX = 4;
export const currentStreak = (run: Pick<PerfectRun, 'games' | 'playoffs'>) => {
  const all = [...run.games, ...run.playoffs.flatMap(x => x.games)];
  let n = 0;
  for (let i = all.length - 1; i >= 0 && all[i].won; i--) n++;
  return n;
};
export const streakPressure = (run: Pick<PerfectRun, 'games' | 'playoffs'>) => Math.min(STREAK_MAX, Math.floor(currentStreak(run) / STREAK_STEP));
/** Difficulty: how much better (or worse) every opponent plays. */
export const LEVEL_EDGE: Record<Level, number> = { rookie: -4, pro: 0, legend: 4 };
export const oppEdge = (run: Pick<PerfectRun, 'mode' | 'games' | 'playoffs' | 'level'>, boss: boolean, round = -1) =>
  OPP_EDGE[run.mode] + LEVEL_EDGE[run.level ?? 'pro'] + (boss ? OPP_EDGE.boss : 0) + Math.max(0, round) * OPP_EDGE.perRound + streakPressure(run);

/**
 * Coach style against the opponent's era (overall points for your team that game). With the ratings hidden, the
 * style is the thing to reason about: run-and-gun beats the slow half-court eras, the triangle wins grinders, and so on.
 */
const STYLE_ERAS: Record<CoachStyle, { good: string[]; bad: string[] }> = {
  pace: { good: ['90s', '00s'], bad: ['60s'] },
  threes: { good: ['80s', '90s'], bad: ['60s', '70s'] },
  defense: { good: ['60s', '70s', '20s'], bad: ['90s'] },
  triangle: { good: ['90s', '00s'], bad: ['10s', '20s'] },
  balanced: { good: [], bad: [] },
};
export const COACH_MATCHUP = 2;
export function coachMatchup(style: CoachStyle | undefined, eraId: string): number {
  if (!style) return 0;
  const m = STYLE_ERAS[style];
  return m.good.includes(eraId) ? COACH_MATCHUP : m.bad.includes(eraId) ? -COACH_MATCHUP : 0;
}
/** "Best against the 1990s and 2000s · worst against the 1960s". */
export function coachMatchupText(style: CoachStyle): string {
  const name = (ids: string[]) => ids.map(id => ERAS.find(e => e.id === id)?.label.replace(/^The /, '') ?? id).join(', ');
  const m = STYLE_ERAS[style];
  if (!m.good.length) return 'No era edge either way';
  return `Best vs ${name(m.good)}${m.bad.length ? ` · worst vs ${name(m.bad)}` : ''}`;
}

function playGame(h: NbaHistory, run: PerfectRun, oppId: string, salt: number, boss = false, round = -1): { game: PerfectGame; box: Record<string, PlayerStatLine>; vs: string } {
  const team = teamById(h)(oppId)!;
  const era = eraOf(team.end);
  const coach = run.coach ? COACH_BY_ID.get(run.coach) : undefined;
  const matchup = coachMatchup(coach?.style, era.id);
  const bonus = new Map([...squadBonuses(h, run)].map(([id, b]) => [id, b + matchup]));
  const pool = cardPool(h);
  const base = eraCoach(era);
  let ourCoach = base;
  if (coach?.style === 'pace') ourCoach = { ...ourCoach, paceTendency: Math.min(99, base.paceTendency + 22), threePointFrequency: era.threes === 'none' ? 2 : Math.max(base.threePointFrequency, 60) };
  if (coach?.style === 'threes' && era.threes !== 'none') ourCoach = { ...ourCoach, threePointFrequency: Math.min(95, base.threePointFrequency + 20) };
  if (coach?.style === 'triangle') ourCoach = { ...ourCoach, offensiveSystem: 'motion', starUsage: 38 };
  const defense = coach?.style === 'defense' ? 4 : 0;
  const up = (v: number) => Math.min(99, v + defense);
  const order = lineupOf(run);
  const players = (order ?? run.squad).map(id => {
    const p = underEra(cardPlayer(h, card(h, id), 'P820', bonus.get(id) ?? 0), era);
    if (!defense) return p;
    const d = p.attributes.defense;
    return { ...p, attributes: { ...p.attributes, defense: { ...d, perimeterDefense: up(d.perimeterDefense), interiorDefense: up(d.interiorDefense), helpDefense: up(d.helpDefense), contest: up(d.contest) } } };
  });
  // Your lineup as you set it; otherwise the coach starts his best five.
  const mine = order
    ? players.map((p, i) => ({ ...p, rotationRole: i < 5 ? 'starter' as const : 'bench' as const, minutes: { mode: 'TARGET' as const, target: ROTATION_MINUTES[i] ?? 8 } }))
    : withRotation(players);
  const mineIds = new Set(run.squad.map(id => card(h, id).playerId));
  const oppAbbr = team.abbr === 'P820' ? 'OPP' : team.abbr;
  const theirs = withRotation(team.roster.map(id => pool.byId.get(id)!).filter(c => c && !mineIds.has(c.playerId)).map(c => underEra(cardPlayer(h, c, oppAbbr, oppEdge(run, boss, round)), era)));
  const decade = `${Math.floor(Math.min(2020, Math.max(1960, team.end - 1)) / 10) * 10}s` as keyof typeof ERA_PRESETS;
  const result = simulateGame({
    home: { teamId: 'P820', seasons: mine, coach: { ...ourCoach, rotationDepth: SQUAD }, chemistry: 70 },
    away: { teamId: oppAbbr, seasons: theirs, coach: base, chemistry: 75 },
    rules: eraRules(era),
    settings: { ...DEFAULT_GAME_SETTINGS, era: ERA_PRESETS[decade] ?? DEFAULT_GAME_SETTINGS.era, seed: run.seed * 101 + salt * 7919, injuriesEnabled: false, teamChemistryEnabled: false },
  });
  let top = { name: '', pts: -1 };
  for (const [name, l] of Object.entries(result.homeBox.players)) if (l.minutes && l.points > top.pts) top = { name, pts: l.points };
  return { game: { opp: oppId, us: result.homeScore, them: result.awayScore, won: result.homeScore > result.awayScore, top: `${top.name} ${top.pts}`, ...(boss ? { boss: true } : {}) }, box: result.homeBox.players, vs: `${team.name} (${seasonLabel(team.end)})` };
}

/** Plays the next `n` games (regular season first, then the playoffs, one game at a time). */
export function playNext(h: NbaHistory, run: PerfectRun, n = 1): PerfectRun {
  let r = run;
  for (let i = 0; i < n; i++) {
    if (r.stage === 'season') {
      const g = r.games.length;
      const { game, box, vs } = playGame(h, r, r.schedule[g], g + 1, r.bosses.includes(g));
      const games = [...r.games, game];
      r = { ...r, games, lines: addBox(r.lines ?? {}, box), highs: addHighs(r.highs ?? {}, box, vs) };
      if (games.length >= SEASON_GAMES) r = { ...r, stage: 'playoffs', playoffs: [{ round: 0, opp: playoffOpponent(h, r, 0), games: [] }] };
    } else if (r.stage === 'playoffs') {
      const s = r.playoffs[r.playoffs.length - 1];
      const { game, box, vs } = playGame(h, r, s.opp, 1000 + s.round * 10 + s.games.length, false, s.round);
      const series = { ...s, games: [...s.games, game] };
      const playoffs = [...r.playoffs.slice(0, -1), series];
      const w = series.games.filter(x => x.won).length, l = series.games.length - w;
      r = { ...r, playoffs, playoffLines: addBox(r.playoffLines ?? {}, box), highs: addHighs(r.highs ?? {}, box, vs),
        ...(series.round === PLAYOFF_ROUNDS - 1 ? { finalsLines: addBox(r.finalsLines ?? {}, box) } : {}) };
      if (l >= WINS_NEEDED) r = { ...r, stage: 'done', result: 'eliminated' };
      else if (w >= WINS_NEEDED) {
        if (series.round + 1 >= PLAYOFF_ROUNDS) r = { ...r, stage: 'done', result: 'champion' };
        else r = { ...r, playoffs: [...playoffs, { round: series.round + 1, opp: playoffOpponent(h, r, series.round + 1), games: [] }] };
      }
    } else break;
  }
  return r;
}

/** Plays straight to the end of the regular season, or of the playoffs. */
export function playToEnd(h: NbaHistory, run: PerfectRun, stage: 'season' | 'playoffs'): PerfectRun {
  let r = run;
  while (r.stage === stage) r = playNext(h, r);
  return r;
}

// ---------------------------------------------------------------- results and score

export interface PerfectSummary { w: number; l: number; pw: number; pl: number; bossWins: number; bosses: number; rounds: number; champion: boolean; perfectSeason: boolean; perfectPlayoffs: boolean; score: number; /** The challenge multiplier already in `score`. */ multiplier: number; streak: number; firstLoss: number | null }

export function summary(run: PerfectRun): PerfectSummary {
  const w = run.games.filter(g => g.won).length, l = run.games.length - w;
  const pgames = run.playoffs.flatMap(s => s.games);
  const pw = pgames.filter(g => g.won).length, pl = pgames.length - pw;
  const bossWins = run.games.filter(g => g.boss && g.won).length;
  const rounds = run.playoffs.filter(s => s.games.filter(g => g.won).length >= WINS_NEEDED).length;
  const champion = run.result === 'champion';
  const perfectSeason = run.games.length >= SEASON_GAMES && l === 0;
  const perfectPlayoffs = champion && pl === 0;
  let streak = 0;
  for (const g of run.games) streak = g.won ? streak + 1 : 0;
  const firstLossAt = run.games.findIndex(g => !g.won);
  let score = 0;
  for (const g of run.games) if (g.won) score += SCORE.win + Math.min(SCORE.marginCap, g.us - g.them) + (g.boss ? SCORE.boss : 0);
  score += pw * SCORE.playoffWin;
  score += run.playoffs.filter(s => s.games.length === WINS_NEEDED && s.games.every(g => g.won)).length * SCORE.sweep;
  if (champion) score += SCORE.title;
  if (perfectSeason) score += SCORE.perfectSeason;
  if (perfectPlayoffs) score += SCORE.perfectPlayoffs;
  // A self-imposed challenge (harder level, hidden colours) pays more; an easier one less. The Daily is always ×1.
  const multiplier = Math.round(challengeMultiplier(run.level, run.view) * categoryMultiplier(run) * 100) / 100;
  return { w, l, pw, pl, bossWins, bosses: run.bosses.length, rounds, champion, perfectSeason, perfectPlayoffs, score: Math.round(score * multiplier), multiplier, streak, firstLoss: firstLossAt < 0 ? null : firstLossAt };
}

/** A one-line verdict for the end screen. */
export function verdict(s: PerfectSummary): string {
  if (s.perfectSeason && s.perfectPlayoffs) return '98-0. Perfect. Nobody has ever done that.';
  if (s.perfectSeason) return s.champion ? '82-0 and a title. The playoffs cost you a game or two.' : '82-0... and then the playoffs happened.';
  if (s.champion && s.w >= 74) return 'Better than the 72-10 Bulls and a ring to prove it.';
  if (s.champion) return 'Champions. Not perfect, but champions.';
  if (s.w >= 70) return 'A 70-win team. History will remember the regular season.';
  if (s.w >= 60) return 'A contender that came up short.';
  if (s.w >= 45) return 'A playoff team, a long way from perfect.';
  return 'A long season. Spin again.';
}

export const ROUND_NAMES = ['First round', 'Second round', 'Conference finals', 'Finals'];
export { COACH_BY_ID, eraOf };
