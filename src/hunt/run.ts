import type { NbaHistory } from '../history/nbaHistoryData';
import { RNG } from '../simulation/engine/rng';
import { simulateGame } from '../simulation/engine/game';
import type { PlayerSeason } from '../simulation/types';
import { DEFAULT_GAME_SETTINGS, ERA_PRESETS } from '../simulation/types';
import { calculateOverall } from '../simulation/engine/overall';
import { cardPool, cardPlayer, type HuntCard, type Rarity } from './cards';
import type { CategoryInfo } from '../perfect/categories';
import { huntTeams, type HuntTeam } from './teams';
import { ERAS, eraCoach, eraOf, eraRules, underEra, type HuntEra } from './eras';
import { chemistry, chemistryBonus, type ChemistryBond } from './chemistry';
import { ITEMS, ITEM_IDS, MAX_ITEMS, type ItemId } from './items';
import { BOOST_IDS, type BoostId } from './boosts';
import { BUFFS, BUFF_IDS, type BuffId } from './buffs';
import { luckMultiplier } from '../relics/relics';
import { COACHES, COACH_BY_ID, coachRarity, type HuntCoach } from './coaches';
import { addBox, addHighs, type RunLine, type GameHighs } from './statLines';
import { STANDARD_VIEW, type RunView } from '../retention/challenge';
import { rosterRating, bonusToReach } from './rating';
import { FAV_BOOST } from '../profile/favorites';

/*
 * A League Hunt run.
 *
 *  1. The spins: a slot machine. All seven slots (PG, SG, SF, PF, C, sixth man and coach) spin at once; STOP freezes
 *     them, you lock one, and the rest spin again, until every slot is locked. Early rounds are richer than late ones,
 *     and one early round is guaranteed a Star (Legendary) on the reels, another a Great (Epic).
 *  2. The focus: what the team works on during the hunt (the star, the sixth man, chemistry or the coach's system).
 *     It is set once, at training camp, and can't be changed.
 *  3. The road: ten best-of-seven series against real teams from history, each under its era's rules. Series 5 is a
 *     semi-boss, series 10 the boss, a 100-rated all-time great. Teams bring buffs from series 3 on.
 *  4. Between series: after every win you pick a boost; before series 1, 3, 5, 7 and 9 there is a shop. Losing a series
 *     costs a life and you replay it.
 *
 * Everything is seeded, so a run replays the same way.
 */

export type Slot = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | '6TH';
export const SLOTS: Slot[] = ['PG', 'SG', 'SF', 'PF', 'C', '6TH'];
export type SpinKind = Slot | 'COACH';
export const SPINS: SpinKind[] = ['PG', 'SG', 'SF', 'PF', 'C', 'COACH', '6TH'];
export const SQUAD_SIZE = 6;
export const SERIES_COUNT = 10;
export const SEMI_BOSS = 4;
export const WINS_NEEDED = 4;
export const START_COINS = 40;
export const LIFE_PRICE = 50;
export const TRAIN_PRICE = 60;
export const TRAIN_STEP = 2;
export const MAX_TRAINING = 2;
export const MIN_OFFER_OVR = 45;
/** Boosts a hunt can hold: after three, series wins bring no more picks. */
export const MAX_BOOSTS = 3;
export const CARD_PRICE: Record<Rarity, number> = { common: 25, rare: 45, epic: 80, legendary: 130 };
export const coachPrice = (x: HuntCoach) => Math.max(15, 20 + x.bonus * 15);

export type Focus = 'star' | 'sixth' | 'chemistry' | 'coach';
export const FOCUS: Record<Focus, { name: string; blurb: string }> = {
  star: { name: 'Develop the star', blurb: 'Your best player gets +1 overall for every series you win (up to +6).' },
  sixth: { name: 'Develop the sixth man', blurb: 'Your sixth man gets +2 overall for every series you win (up to +10).' },
  chemistry: { name: 'Team chemistry', blurb: 'Every chemistry bond is worth 1 more, and everyone gets +1 for every 3 series you win.' },
  coach: { name: "The coach's rules", blurb: 'Your coach is worth 1 more to everyone for every 3 series you win, and his style hits harder.' },
};
export const FOCUS_IDS = Object.keys(FOCUS) as Focus[];

export type HuntStage = 'draft' | 'focus' | 'shop' | 'series' | 'boost' | 'won' | 'lost';
export type SeriesKind = 'normal' | 'semi' | 'boss';
export interface HuntSeries { teamId: string; eraId: string; kind: SeriesKind; buffs: BuffId[]; /** A flat bonus for all their players (the semi-boss and boss reach their rating). */ lift: number;
  /** The secret 11th series: the greatest team ever, only for a hunt won without losing a series. */
  secret?: boolean }
export interface SeriesGame { us: number; them: number; won: boolean; top: string }
export interface SeriesResult { index: number; teamId: string; games: SeriesGame[]; won: boolean; coins: number }
export interface HuntShop { cards: { id: string; slot: number }[]; coach?: string; items: ItemId[]; sold: string[]; lifeBought?: boolean }

export interface HuntRun {
  version: 3;
  seed: number;
  stage: HuntStage;
  /** Card ids by slot: PG, SG, SF, PF, C, sixth man ('' while a slot is still spinning). */
  squad: string[];
  coach?: string;
  /** The draft round (slots locked so far). `offer` is left over from the old three-card spins and stays empty. */
  spin: number;
  offer: string[];
  /** The frozen reels waiting for you to lock one (null while everything spins). */
  reels?: Partial<Record<SpinKind, string>> | null;
  /** Reels whose rarity relic luck bumped up on the last stop (the "lucky" sparkle). */
  luckyReels?: SpinKind[];
  /** Which rounds are guaranteed a Star and a Great on the reels. */
  guarantees: { star: number; great: number };
  lives: number;
  coins: number;
  items: ItemId[];
  boosts: BoostId[];
  boostOffer?: BoostId[];
  focus?: Focus;
  /** Series won under each focus. */
  growth: Record<Focus, number>;
  /** Shop training per card id. */
  training: Record<string, number>;
  series: HuntSeries[];
  seriesIndex: number;
  attempts: number;
  results: SeriesResult[];
  shop?: HuntShop;
  note?: string;
  deck?: DeckId;
  difficulty?: Difficulty;
  daily?: string;
  /** The Weekly Hunt's week ("2026-W40"): the same hunt for everyone that week, best attempt counts. */
  weekly?: string;
  lines?: Record<string, RunLine>;
  /** The best single games of the run (the record book). */
  highs?: GameHighs;
  /** Relic luck when the hunt began (relics.ts). */
  luck?: number;
  /** Beat the secret 11th series. */
  immortal?: boolean;
  /** A same-spin duel: the challenger's code (retention/duel.ts), compared at the end. */
  duel?: string;
  /** How the spins are shown (retention/challenge.ts); absent = ratings hidden until you lock, colours on. */
  view?: RunView;
  /** The blind spins: what you took and the best on the table, per spin (overall; the coach's bonus on the coach spin). */
  picks?: { spin: number; got: number; best: number }[];
  /** Your favourite player: a reel landing on his rarity is him FAV_BOOST more often, until you lock him. */
  fav?: string;
}

export type DeckId = 'classic' | 'bigMen' | 'oldSchool' | 'paceSpace' | 'dynasty' | 'category';
export type Difficulty = 'rookie' | 'pro' | 'legend';
export interface HuntDeck { id: DeckId; name: string; blurb: string; coins: number; items: ItemId[]; draft?: (c: HuntCard) => boolean; unlock: string }
export const DECKS: Record<DeckId, HuntDeck> = {
  classic: { id: 'classic', name: 'Classic', blurb: 'Anyone from any era.', coins: 0, items: [], unlock: 'Always open.' },
  bigMen: { id: 'bigMen', name: 'Big Man Era', blurb: 'Your PF and C spins always show a Great or better, and you start with the Bad Boys Rulebook.', coins: 0, items: ['badBoys'], unlock: 'Reach series 3 in any hunt.' },
  oldSchool: { id: 'oldSchool', name: 'Old School', blurb: 'Only players from before 1980, and 50 more coins to start.', coins: 50, items: [], draft: c => c.end < 1980, unlock: 'Play 3 hunts.' },
  paceSpace: { id: 'paceSpace', name: 'Pace & Space', blurb: 'Only players from 2010 on, and you start with Seven Seconds or Less.', coins: 0, items: ['sevenSeconds'], draft: c => c.end >= 2010, unlock: 'Reach series 5 in any hunt.' },
  dynasty: { id: 'dynasty', name: 'Dynasty', blurb: 'Every spin after the first shows a real teammate of someone you drafted.', coins: 0, items: [], unlock: 'Win a hunt.' },
  category: { id: 'category', name: 'Category Draft', blurb: 'Every round of spins rolls a category ("MVPs", "Lakers", "Duke"...) and the reels only show players from it, at their prime unless the category is about a season. 30 more coins to start.', coins: 30, items: [], unlock: 'Always open.' },
};
export interface HuntDifficulty { id: Difficulty; name: string; blurb: string; shift: number; /** Buffs each team brings beyond Pro's. */ buffs: number; lives: number; bossPool: number; bossRating: number; coinShift: number; unlock: string }
export const DIFFICULTIES: Record<Difficulty, HuntDifficulty> = {
  rookie: { id: 'rookie', name: 'Rookie', blurb: 'Softer teams with fewer buffs, four lives (and lives in the shop), and a 96-rated boss.', shift: -3, buffs: -1, lives: 4, bossPool: 12, bossRating: 96, coinShift: 20, unlock: 'Always open.' },
  pro: { id: 'pro', name: 'Pro', blurb: 'The hunt as it was meant to be. No lives for sale.', shift: 2, buffs: 0, lives: 3, bossPool: 8, bossRating: 100, coinShift: 0, unlock: 'Always open.' },
  legend: { id: 'legend', name: 'Legend', blurb: 'Tougher teams with an extra buff each, two lives, no lives for sale, and the boss is one of the four best teams ever.', shift: 5, buffs: 1, lives: 2, bossPool: 4, bossRating: 100, coinShift: -10, unlock: 'Win a hunt.' },
};

/** Target ratings of the ten series (Pro); the semi-boss and boss get lifted to theirs. */
const TARGETS = [72, 77, 82, 87, 97, 91, 94, 96, 98, 100];

export const maxLives = (run: HuntRun) => DIFFICULTIES[run.difficulty ?? 'pro'].lives;
const rngFor = (run: HuntRun, salt: number) => new RNG(run.seed * 31 + run.seriesIndex * 977 + run.attempts * 13 + salt);
const card = (h: NbaHistory, id: string) => cardPool(h).byId.get(id)!;

// ---------------------------------------------------------------- team ratings

const baseRatings = new WeakMap<NbaHistory, Map<string, number>>();
/** A real team's rating without buffs. */
export function teamBaseRating(h: NbaHistory, t: HuntTeam): number {
  let m = baseRatings.get(h);
  if (!m) { m = new Map(); baseRatings.set(h, m); }
  let r = m.get(t.id);
  if (r == null) { r = rosterRating(h, t.roster.map(id => card(h, id).ovr)); m.set(t.id, r); }
  return r;
}

/** A buff's strength: the semi-boss's are 1.25 times as strong, the boss's 1.5 times; the scout takes a point off. */
export const buffValue = (run: HuntRun, b: BuffId, kind: SeriesKind = 'normal') =>
  Math.max(0, Math.round(BUFFS[b].value * (kind === 'boss' ? 1.5 : kind === 'semi' ? 1.25 : 1)) - (run.items.includes('scout') ? 1 : 0));

/** Their players' overalls with the buffs that hold every game (for the rating shown). */
function theirStaticOvrs(h: NbaHistory, run: HuntRun, s: HuntSeries, liftOverride?: number): number[] {
  const team = huntTeams(h).find(t => t.id === s.teamId)!;
  const cards = team.roster.map(id => card(h, id));
  const lift = liftOverride ?? s.lift;
  return cards.map((c, i) => {
    let v = c.ovr + lift;
    for (const b of s.buffs) {
      const bv = buffValue(run, b, s.kind);
      if (b === 'swagger' || b === 'runGun') v += bv;
      if (b === 'superstar' && i === 0) v += bv;
      if (b === 'depth' && i === 5) v += bv;
    }
    return v;
  });
}

/** The rating of a series' opponent, buffs included. */
export const opponentRating = (h: NbaHistory, run: HuntRun, s: HuntSeries) => rosterRating(h, theirStaticOvrs(h, run, s));

// ---------------------------------------------------------------- a new run

export interface NewRunOptions { /** Relic luck (0-0.3) and secret relics; ignored by the Daily and the Weekly Hunt. */ luck?: number; secondWind?: boolean; goldenTouch?: boolean; deck?: DeckId; difficulty?: Difficulty; daily?: string; weekly?: string; /** Your favourite player (Profile); ignored in the Daily Legend. */ fav?: string; /** Ratings / rarity colours on the spins (the Daily and the Weekly Hunt always use the standard view). */ view?: RunView }

function pickTeam(h: NbaHistory, teams: HuntTeam[], era: HuntEra, target: number, rng: RNG, used: Set<string>): HuntTeam {
  const free = teams.filter(t => !used.has(t.id));
  const inEra = free.filter(t => t.end >= era.from && t.end <= era.to);
  const near = (pool: HuntTeam[], d: number) => pool.filter(t => Math.abs(teamBaseRating(h, t) - target) <= d);
  const choices = [near(inEra, 2), near(inEra, 4), near(free, 2)].find(l => l.length >= 2)
    ?? [...free].sort((a, b) => Math.abs(teamBaseRating(h, a) - target) - Math.abs(teamBaseRating(h, b) - target)).slice(0, 6);
  return choices[rng.nextInt(choices.length)];
}

/** A new run: the spins, then ten series (the fifth a semi-boss, the tenth the boss). */
export function newRun(h: NbaHistory, seed: number, opts: NewRunOptions = {}): HuntRun {
  const deck = DECKS[opts.deck ?? 'classic'], diff = DIFFICULTIES[opts.difficulty ?? 'pro'];
  // Shared-seed hunts (the Daily and the Weekly) are the same for everyone: no relics.
  const shared = !!opts.daily || !!opts.weekly;
  const rng = new RNG(seed);
  const teams = huntTeams(h);
  const used = new Set<string>();
  // The boss first (so no earlier series takes it): one of the best teams ever.
  const greats = teams.filter(t => t.champion).sort((a, b) => b.w / (b.w + b.l) - a.w / (a.w + a.l)).slice(0, diff.bossPool);
  const bossTeam = greats[rng.nextInt(greats.length)];
  used.add(bossTeam.id);
  // Eras cycle so the road visits all of history.
  const eraOrder = [...ERAS].sort(() => rng.next() - 0.5);
  const series: HuntSeries[] = [];
  const buffPool = (n: number) => [...BUFF_IDS].sort(() => rng.next() - 0.5).slice(0, Math.max(0, n + diff.buffs));
  for (let i = 0; i < SERIES_COUNT - 1; i++) {
    const semi = i === SEMI_BOSS;
    const target = TARGETS[i] + diff.shift;
    let t: HuntTeam;
    if (semi) {
      const strong = teams.filter(x => !used.has(x.id) && (x.champion || x.w / (x.w + x.l) >= 0.68)).sort((a, b) => teamBaseRating(h, b) - teamBaseRating(h, a)).slice(0, 40);
      t = strong[rng.nextInt(strong.length)];
    } else t = pickTeam(h, teams, eraOrder[i % eraOrder.length], target - (i >= 2 ? 2 : 0), rng, used);
    used.add(t.id);
    series.push({ teamId: t.id, eraId: eraOf(t.end).id, kind: semi ? 'semi' : 'normal', buffs: buffPool(semi || i >= 5 ? 2 : i >= 1 ? 1 : 0), lift: 0 });
  }
  series.push({ teamId: bossTeam.id, eraId: eraOf(bossTeam.end).id, kind: 'boss', buffs: buffPool(3), lift: 0 });
  let run: HuntRun = { version: 3, seed, stage: 'draft', squad: SLOTS.map(() => ''), spin: 0, offer: [], reels: null, guarantees: { star: 0, great: 1 },
    lives: diff.lives + (shared ? 0 : opts.secondWind ? 1 : 0), coins: START_COINS + diff.coinShift + deck.coins + (shared ? 0 : opts.goldenTouch ? 30 : 0), ...(!shared && opts.luck ? { luck: opts.luck } : {}), items: [...deck.items], boosts: [], growth: { star: 0, sixth: 0, chemistry: 0, coach: 0 }, training: {},
    series, seriesIndex: 0, attempts: 0, results: [], deck: deck.id, difficulty: diff.id, ...(opts.daily ? { daily: opts.daily } : opts.weekly ? { weekly: opts.weekly } : opts.fav ? { fav: opts.fav } : {}),
    ...(!opts.daily && !opts.weekly && opts.view && (opts.view.numbers !== STANDARD_VIEW.numbers || opts.view.colors !== STANDARD_VIEW.colors) ? { view: opts.view } : {}) };
  // Lift every team that falls short of its series' rating (buffs count, so the lift is what is left).
  run = { ...run, series: run.series.map((s, i) => {
    const target = s.kind === 'boss' ? diff.bossRating : Math.min(99, TARGETS[i] + diff.shift);
    // Bosses land on their rating exactly (a lift can be negative when their buffs already carry them past it).
    const exact = s.kind !== 'normal';
    // Then every team gets ENEMY_EDGE on top: the hunt is meant to be hard.
    return { ...s, lift: bonusToReach(h, theirStaticOvrs(h, run, s, 0), target, exact) + ENEMY_EDGE };
  }) };
  // Guaranteed Star and Great on the reels of two different early rounds.
  const star = rng.nextInt(3);
  const rest = [0, 1, 2, 3].filter(i => i !== star);
  return { ...run, guarantees: { star, great: rest[rng.nextInt(rest.length)] } };
}

/** Every team you face plays this much above the rating of its series. */
export const ENEMY_EDGE = 5;
/** Every player on your squad plays this much above his card in every game (the hunt was too hard without it). */
export const SQUAD_EDGE = 3;

// ---------------------------------------------------------------- the spins

const fitsSlot = (c: HuntCard, s: SpinKind) => s === '6TH' || c.pos === s || (c.pos === 'G' && (s === 'PG' || s === 'SG')) || (c.pos === 'F' && (s === 'SF' || s === 'PF'));

/** Rarity odds for spin `i`: every spin is a little poorer than the one before. */
export function spinWeights(i: number, luck = 0): Record<Rarity, number> {
  // Seven points more on the good cards than before (Star +1, Great +2, Good +4), every round. Relic luck (relics.ts)
  // makes Stars and Greats that much more likely.
  const lucky = luckMultiplier(luck);
  const legendary = (Math.max(0.2, 1.5 - 0.2 * i) + 1) * lucky, epic = (Math.max(1.5, 6 - 0.8 * i) + 2) * lucky, rare = Math.max(10, 20 - 1.8 * i) + 4;
  return { legendary, epic, rare, common: Math.max(10, 100 - legendary - epic - rare) };
}

const ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/** A player from the round's category for this reel: the rarity asked for when the category has one, else the nearest. */
function drawFromCategory(cat: CategoryInfo, taken: Set<string>, rng: RNG, fits: (c: HuntCard) => boolean, want: Rarity): string | undefined {
  const open = cat.pool.filter(c => c.ovr >= MIN_OFFER_OVR && fits(c) && !taken.has(c.playerId));
  if (!open.length) return undefined;
  const at = ORDER.indexOf(want);
  const byDistance = [...ORDER].sort((a, b) => Math.abs(ORDER.indexOf(a) - at) - Math.abs(ORDER.indexOf(b) - at));
  for (const r of byDistance) { const list = open.filter(c => c.rarity === r); if (list.length) return list[rng.nextInt(list.length)].id; }
  return undefined;
}

function drawPlayers(h: NbaHistory, taken: Set<string>, rng: RNG, count: number, fits: (c: HuntCard) => boolean, rarityFor: (k: number) => Rarity): string[] {
  const pool = cardPool(h);
  const out: HuntCard[] = [];
  for (let k = 0; out.length < count && k < count + 2; k++) {
    const want = rarityFor(out.length);
    let got: HuntCard | undefined;
    // Try the rarity asked for, then step down (a deck filter can empty a bucket), then anything that fits.
    for (const r of [want, ...[...ORDER].reverse().filter(x => x !== want)]) {
      const list = pool.byRarity[r];
      for (let tries = 0; tries < 2500 && !got; tries++) {
        const c = list[rng.nextInt(list.length)];
        if (c.ovr >= MIN_OFFER_OVR && fits(c) && !taken.has(c.playerId) && !out.some(o => o.playerId === c.playerId)) got = c;
      }
      if (got) break;
    }
    if (got) out.push(got);
  }
  return out.map(c => c.id);
}

/** The slots still spinning. */
export const openSpins = (run: Pick<HuntRun, 'squad' | 'coach'>): SpinKind[] =>
  SPINS.filter(k => (k === 'COACH' ? !run.coach : !run.squad[SLOTS.indexOf(k)]));

/** A hunt saved mid-draft under the old three-card spins carries on as a slot-machine draft (the squad already fills its slots in order). */
export function migrateDraft(run: HuntRun): HuntRun {
  if (run.stage !== 'draft' || run.reels !== undefined) return run;
  const squad = SLOTS.map((_, i) => run.squad[i] ?? '');
  return { ...run, squad, offer: [], reels: null, spin: SPINS.length - openSpins({ squad, coach: run.coach }).length };
}

/** A card of your favourite player at this rarity that fits this reel, while you haven't locked him yet. */
function favOnReel(h: NbaHistory, run: HuntRun, taken: Set<string>, fits: (c: HuntCard) => boolean, rarity: Rarity): HuntCard | undefined {
  if (!run.fav || run.daily || run.weekly) return undefined;
  const key = run.fav.toLowerCase();
  const pool = cardPool(h);
  if (run.squad.some(id => id && pool.byId.get(id)?.playerId.toLowerCase() === key)) return undefined;
  const mine = pool.byRarity[rarity].filter(c => (c.playerId.toLowerCase() === key || c.name.toLowerCase() === key) && fits(c) && !taken.has(c.playerId) && c.ovr >= MIN_OFFER_OVR);
  return mine.sort((a, b) => b.ovr - a.ovr)[0];
}

/**
 * STOP: every slot still spinning lands on a card (a coach on the coach reel). Seeded by the round, so a reload shows the same.
 * `cat` is the Category Draft deck's category for this round (hunt/categoryDeck.ts), kept out of here so the server
 * bundle doesn't carry the categories.
 */
export function stopReels(h: NbaHistory, run: HuntRun, cat: CategoryInfo | null = null): HuntRun {
  if (run.stage !== 'draft' || run.reels) return run;
  const open = openSpins(run);
  const round = run.spin;
  const rng = new RNG(run.seed * 31 + round * 7717 + 3);
  const weights = spinWeights(round, run.luck), plain = spinWeights(round);
  // The same draw as rng.weightedPick; also notes when relic luck turned it into a better rarity than it would have been.
  const at = (w: Record<Rarity, number>, u: number) => { const list = ORDER.map(r => Math.max(0, w[r])); let x = u * list.reduce((a, b) => a + b, 0); for (let i = 0; i < list.length; i++) { x -= list[i]; if (x <= 0) return i; } return list.length - 1; };
  const luckyReels: SpinKind[] = [];
  let reelNow: SpinKind | null = null;
  const pick = () => { const u = rng.next(), i = at(weights, u); if (run.luck && i > at(plain, u) && reelNow && !luckyReels.includes(reelNow)) luckyReels.push(reelNow); return ORDER[i]; };
  const deck = DECKS[run.deck ?? 'classic'];
  const pool = cardPool(h);
  const locked = run.squad.filter(Boolean);
  const taken = new Set(locked.map(id => pool.byId.get(id)!.playerId));
  const playerReels = open.filter(k => k !== 'COACH');
  const forced: Rarity | null = round === run.guarantees.star ? 'legendary' : round === run.guarantees.great ? 'epic' : null;
  const forcedAt = forced && playerReels.length ? playerReels[rng.nextInt(playerReels.length)] : null;
  // Dynasty: after the first lock, one reel shows a real teammate of someone you locked (when one fits there).
  const mateAt = deck.id === 'dynasty' && locked.length && playerReels.length ? playerReels[rng.nextInt(playerReels.length)] : null;
  const reels: Partial<Record<SpinKind, string>> = {};
  for (const k of open) {
    reelNow = k;
    if (k === 'COACH') {
      for (let tries = 0; !reels.COACH && tries < 50; tries++) {
        const list = COACHES.filter(x => coachRarity(x) === pick());
        if (list.length) reels.COACH = list[rng.nextInt(list.length)].id;
      }
      continue;
    }
    const fits = (c: HuntCard) => fitsSlot(c, k) && (deck.draft?.(c) ?? true);
    let id: string | undefined;
    if (k === mateAt && k !== forcedAt) {
      const mates = huntTeams(h).filter(t => t.roster.some(x => locked.includes(x))).flatMap(t => t.roster)
        .map(x => pool.byId.get(x)!).filter(c => c && fits(c) && !taken.has(c.playerId) && c.ovr >= MIN_OFFER_OVR);
      if (mates.length) id = mates[rng.nextInt(mates.length)].id;
    }
    if (!id) {
      const bigMen = deck.id === 'bigMen' && (k === 'PF' || k === 'C');
      const want = k === forcedAt ? forced! : bigMen ? (rng.next() < 0.25 ? 'legendary' : 'epic') : pick();
      // Category Draft: the round's category first; a reel it can't fill (no centers among the sharpshooters) draws from everyone.
      if (cat) id = drawFromCategory(cat, taken, rng, fits, want);
      id ??= drawPlayers(h, taken, rng, 1, fits, () => want)[0];
      // Your favourite player: on his rarity, a FAV_BOOST chance the reel shows him instead (until you lock him).
      const fav = cat ? undefined : favOnReel(h, run, taken, fits, want);
      if (fav && rng.next() < FAV_BOOST) id = fav.id;
    }
    if (id) { reels[k] = id; taken.add(pool.byId.get(id)!.playerId); }
  }
  return { ...run, reels, luckyReels: luckyReels.filter(k => reels[k]) };
}

/** Locks one frozen reel; the others spin again. Once every slot is locked, on to training camp. */
export function lockReel(h: NbaHistory, run: HuntRun, kind: SpinKind): HuntRun {
  const id = run.reels?.[kind];
  if (run.stage !== 'draft' || !id) return run;
  // Ratings are hidden on the reels, so each lock is a read: a player is remembered against the best player on the reels.
  const players = Object.entries(run.reels!).filter(([k]) => k !== 'COACH').map(([, x]) => card(h, x!).ovr);
  const picks = kind === 'COACH' ? run.picks ?? [] : [...(run.picks ?? []), { spin: run.spin, got: card(h, id).ovr, best: Math.max(...players) }];
  const next: HuntRun = kind === 'COACH' ? { ...run, coach: id, picks, reels: null, spin: run.spin + 1 }
    : { ...run, squad: run.squad.map((x, i) => (SLOTS[i] === kind ? id : x)), picks, reels: null, spin: run.spin + 1 };
  return openSpins(next).length ? next : { ...next, reels: undefined, stage: 'focus' };
}

/** The whole draft in one go, locking the best-rated player (then the best coach) every round (tests and quick sims). */
export function draftBest(h: NbaHistory, run: HuntRun, worst = false): HuntRun {
  let r = run;
  for (let guard = 0; r.stage === 'draft' && guard < 20; guard++) {
    r = stopReels(h, r);
    const entries = Object.entries(r.reels ?? {}) as [SpinKind, string][];
    const players = entries.filter(([k]) => k !== 'COACH').sort((a, b) => (card(h, b[1]).ovr - card(h, a[1]).ovr) * (worst ? -1 : 1));
    r = lockReel(h, r, (players[0] ?? entries[0])[0]);
  }
  return r;
}

export type DraftGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
/** How well you read the blind reels: overall points left on the table (each lock against the best player on the reels).
 * The best card every round is an A+. */
export function draftGrade(run: Pick<HuntRun, 'picks'>): { grade: DraftGrade; missed: number; bestPicks: number; spins: number } | null {
  const picks = run.picks ?? [];
  if (!picks.length) return null;
  const missed = picks.reduce((n, p) => n + (p.best - p.got), 0);
  const grade: DraftGrade = missed === 0 ? 'A+' : missed <= 8 ? 'A' : missed <= 20 ? 'B' : missed <= 40 ? 'C' : missed <= 65 ? 'D' : 'F';
  return { grade, missed, bestPicks: picks.filter(p => p.got >= p.best).length, spins: picks.length };
}

/** Sets what the team works on, once, at training camp: it can't be changed afterwards. */
export function chooseFocus(h: NbaHistory, run: HuntRun, focus: Focus): HuntRun {
  return run.stage === 'focus' && !run.focus ? openShop(h, { ...run, focus }) : run;
}

// ---------------------------------------------------------------- bonuses in a game

export interface SeriesState { game: number; ourWins: number; theirWins: number; streak: number; lostLast: boolean }
export const SERIES_START: SeriesState = { game: 1, ourWins: 0, theirWins: 0, streak: 0, lostLast: false };
/** A game with nothing special about it (game 3 at 0-0): the state ratings are shown for. */
export const NEUTRAL_GAME: SeriesState = { game: 3, ourWins: 0, theirWins: 0, streak: 0, lostLast: false };
/** Boosts add at most this much to one player in one game. */
export const BOOST_CAP = 6;
export interface CardBonus { card: HuntCard; slot: number; bonus: number; parts: string[]; defense: number }

export const bestSlot = (h: NbaHistory, run: HuntRun) => run.squad.reduce((b, id, i) => (card(h, id).ovr > card(h, run.squad[b]).ovr ? i : b), 0);

/** The coach's overall bonus to everyone, with trust and the coach focus. */
export function coachBonus(run: HuntRun): number {
  const x = run.coach ? COACH_BY_ID.get(run.coach) : undefined;
  if (!x) return 0;
  return x.bonus + (run.boosts.includes('coachTrust') ? 2 : 0) + Math.floor(run.growth.coach / 3);
}

/** Every card's overall bonus for one game of a series. */
export function gameBonuses(h: NbaHistory, run: HuntRun, era: HuntEra | undefined, st: SeriesState, series?: HuntSeries): { cards: CardBonus[]; bonds: ChemistryBond[] } {
  const cards = run.squad.map(id => card(h, id));
  const bonds = chemistry(cards, era);
  if (run.focus === 'chemistry') for (const b of bonds) if (b.bonus > 0) b.bonus += 1;
  const chem = chemistryBonus(bonds);
  const best = bestSlot(h, run);
  const coach = run.coach ? COACH_BY_ID.get(run.coach) : undefined;
  const coachAll = coachBonus(run);
  const has = (i: ItemId) => run.items.includes(i), boost = (b: BoostId) => run.boosts.includes(b);
  const bigGame = series && series.kind !== 'normal';
  return { bonds, cards: cards.map((c, slot) => {
    const parts: string[] = [];
    let bonus = 0, defense = 0;
    const add = (v: number, label: string) => { if (v) { bonus += v; parts.push(`${v > 0 ? '+' : ''}${v} ${label}`); } };
    // Boosts stack up to BOOST_CAP per player per game.
    let fromBoosts = 0;
    const addBoost = (v: number, label: string) => { const room = Math.max(0, BOOST_CAP - fromBoosts), got = Math.min(v, room); fromBoosts += got; add(got, label); };
    const sixth = slot === 5, starter = slot < 5;
    add(SQUAD_EDGE, 'hunt edge');
    add(chem.get(c.id) ?? 0, 'chemistry');
    add(coachAll, 'coach');
    if (coach?.franchises.includes(c.franchise) || coach?.franchises.includes(c.team)) add(1, 'coach\'s old team');
    add(run.training[c.id] ?? 0, 'training');
    if (slot === best) add(Math.min(6, run.growth.star), 'star development');
    if (sixth) add(Math.min(10, run.growth.sixth * 2), 'sixth man development');
    add(Math.floor(run.growth.chemistry / 3), 'team growth');
    if (has('triangle')) add(1, 'Triangle');
    if (has('sixthMan') && sixth) add(4, 'Sixth Man Trophy');
    if (has('homeCourt') && [1, 2, 5, 7].includes(st.game)) add(3, 'home court');
    if (has('clutch') && slot === best && st.game >= 5) add(6, 'Clutch Gene');
    if (has('filmRoom') && st.lostLast) add(2, 'Film Room');
    if (boost('spark') && sixth) addBoost(3 * st.ourWins, 'Sixth Man Spark');
    if (boost('microwave') && sixth) addBoost(5, 'Microwave');
    if (boost('franchise') && slot === best) addBoost(4, 'Franchise Player');
    if (boost('closer') && st.game >= 5) addBoost(4, 'Closer');
    if (boost('backToWall') && st.theirWins > st.ourWins) addBoost(4, 'Back to the Wall');
    if (boost('momentum') && st.streak > 0) addBoost(2 * st.streak, 'Momentum');
    if (boost('fastStart') && st.game <= 2) addBoost(4, 'Fast Start');
    if (boost('backcourt') && slot <= 1) addBoost(4, 'Backcourt Bond');
    if (boost('twinTowers') && (slot === 3 || slot === 4)) addBoost(4, 'Twin Towers');
    if (boost('ironFive') && starter) addBoost(2, 'Iron Five');
    if (boost('giantKiller') && bigGame) addBoost(5, 'Giant Killer');
    if (boost('elimination') && st.theirWins === WINS_NEEDED - 1) addBoost(6, 'Elimination Mode');
    if (boost('wings') && (slot === 1 || slot === 2)) { addBoost(3, 'Wing Stoppers'); defense += 5; }
    if (boost('lockdown')) defense += 5;
    if (has('badBoys')) defense += 5;
    if (coach?.style === 'defense') defense += run.focus === 'coach' ? 6 : 4;
    return { card: c, slot, bonus, parts, defense };
  }) };
}

/** Your rating for an ordinary game of a series (boosts that depend on the game or the series score not counted). */
export function squadRating(h: NbaHistory, run: HuntRun, series?: HuntSeries): number {
  if (!run.squad.length) return 0;
  const era = series ? ERAS.find(e => e.id === series.eraId) : undefined;
  return rosterRating(h, gameBonuses(h, run, era, NEUTRAL_GAME, series).cards.map(c => c.card.ovr + c.bonus));
}
export const baseSquadRating = (h: NbaHistory, run: HuntRun) => rosterRating(h, run.squad.map(id => card(h, id).ovr));

/** Their overall bonus per roster spot for one game. */
function theirBonuses(run: HuntRun, s: HuntSeries, st: SeriesState, n: number): { bonus: number[]; defense: number } {
  const bonus = Array.from({ length: n }, () => s.lift);
  let defense = 0;
  for (const b of s.buffs) {
    const v = buffValue(run, b, s.kind);
    for (let i = 0; i < n; i++) {
      if (b === 'swagger' || b === 'runGun') bonus[i] += v;
      if (b === 'superstar' && i === 0) bonus[i] += v;
      if (b === 'depth' && i === 5) bonus[i] += v;
      if (b === 'crowd' && [3, 4, 6].includes(st.game)) bonus[i] += v;
      if (b === 'veterans' && st.game >= 5) bonus[i] += v;
    }
    if (b === 'lockdown') defense += v;
  }
  return { bonus, defense };
}

// ---------------------------------------------------------------- playing a series

/** Minutes by rank for a full rotation: the starters play most of the game. */
export function withRotation(players: PlayerSeason[]): PlayerSeason[] {
  const mins = [34, 33, 32, 31, 29, 21, 18, 15, 14, 13];
  return [...players].sort((a, b) => calculateOverall(b) - calculateOverall(a)).map((p, i) => ({ ...p, rotationRole: i < 5 ? 'starter' as const : 'bench' as const, minutes: { mode: 'TARGET' as const, target: mins[i] ?? 8 } }));
}

/** Six-man rotations (yours and theirs): five starters and the sixth man. */
const SIX_MINUTES = [38, 37, 37, 37, 37, 34];
export const sixRotation = (players: PlayerSeason[]) => players.map((p, i) => ({ ...p, rotationRole: i < 5 ? 'starter' as const : 'bench' as const, minutes: { mode: 'TARGET' as const, target: SIX_MINUTES[i] } }));

export const defended = (p: PlayerSeason, v: number): PlayerSeason => {
  if (!v) return p;
  const d = p.attributes.defense, up = (x: number) => Math.min(99, x + v);
  return { ...p, attributes: { ...p.attributes, defense: { ...d, perimeterDefense: up(d.perimeterDefense), interiorDefense: up(d.interiorDefense), helpDefense: up(d.helpDefense), contest: up(d.contest) } } };
};

export interface SeriesPlay { games: SeriesGame[]; won: boolean; coins: number; teamName: string; era: HuntEra; mvp?: { name: string; pts: number; reb: number; ast: number; g: number } }

/** Coins for a series: 3 per game won, 18 for the series (more with the cigar and bankroll), 5 for a loss. */
export function seriesCoins(run: HuntRun, won: boolean, gamesWon: number): number {
  return gamesWon * 3 + (won ? 18 + (run.items.includes('cigar') ? 20 : 0) + (run.boosts.includes('bankroll') ? 30 : 0) : 5);
}

/** Plays the current best-of-seven, game by game (bonuses change with the series score), and records it. */
export function playSeries(h: NbaHistory, run: HuntRun): { run: HuntRun; play: SeriesPlay } | null {
  if (run.stage !== 'series') return null;
  const s = run.series[run.seriesIndex];
  const team = huntTeams(h).find(t => t.id === s.teamId)!;
  const era = ERAS.find(e => e.id === s.eraId) ?? eraOf(team.end);
  const pool = cardPool(h);
  const mineIds = new Set(run.squad.map(id => pool.byId.get(id)!.playerId));
  const theirCards = team.roster.map(id => pool.byId.get(id)!).filter(c => c && !mineIds.has(c.playerId)).slice(0, SQUAD_SIZE);
  const coach = run.coach ? COACH_BY_ID.get(run.coach) : undefined;
  const base = eraCoach(era);
  const strong = run.focus === 'coach';
  let ourCoach = base;
  if (coach?.style === 'pace' || run.items.includes('sevenSeconds')) ourCoach = { ...ourCoach, paceTendency: Math.min(99, base.paceTendency + (strong ? 30 : 22)), threePointFrequency: era.threes === 'none' ? 2 : Math.max(base.threePointFrequency, 60) };
  if (coach?.style === 'threes' && era.threes !== 'none') ourCoach = { ...ourCoach, threePointFrequency: Math.min(95, base.threePointFrequency + (strong ? 30 : 20)) };
  if (coach?.style === 'triangle') ourCoach = { ...ourCoach, offensiveSystem: 'motion', starUsage: strong ? 30 : 38 };
  ourCoach = { ...ourCoach, rotationDepth: SQUAD_SIZE };
  const theirCoach = s.buffs.includes('runGun') ? { ...base, paceTendency: Math.min(99, base.paceTendency + 20) } : base;
  const decade = `${Math.floor(Math.min(2020, Math.max(1960, team.end - 1)) / 10) * 10}s` as keyof typeof ERA_PRESETS;
  const games: SeriesGame[] = [];
  let lines = { ...(run.lines ?? {}) };
  let highs = { ...(run.highs ?? {}) };
  const seriesLines: Record<string, { g: number; pts: number; reb: number; ast: number }> = {};
  let st: SeriesState = { ...SERIES_START };
  while (st.ourWins < WINS_NEEDED && st.theirWins < WINS_NEEDED) {
    const { cards } = gameBonuses(h, run, era, st, s);
    const mine = sixRotation(cards.map(({ card: c, bonus, defense }) => defended(underEra(cardPlayer(h, c, 'HUNT', bonus), era), defense)));
    const tb = theirBonuses(run, s, st, theirCards.length);
    const theirs = sixRotation(theirCards.map((c, i) => defended(underEra(cardPlayer(h, c, team.abbr === 'HUNT' ? 'OPP' : team.abbr, tb.bonus[i]), era), tb.defense)));
    const result = simulateGame({ home: { teamId: 'HUNT', seasons: mine, coach: ourCoach, chemistry: 70 }, away: { teamId: team.abbr === 'HUNT' ? 'OPP' : team.abbr, seasons: theirs, coach: theirCoach, chemistry: 75 }, rules: eraRules(era),
      settings: { ...DEFAULT_GAME_SETTINGS, era: ERA_PRESETS[decade] ?? DEFAULT_GAME_SETTINGS.era, seed: run.seed * 101 + run.seriesIndex * 7919 + run.attempts * 104729 + st.game * 17, injuriesEnabled: false, teamChemistryEnabled: false } });
    const won = result.homeScore > result.awayScore;
    let top = { name: '', pts: -1 };
    for (const [name, l] of Object.entries(result.homeBox.players)) {
      if (!l.minutes) continue;
      if (l.points > top.pts) top = { name, pts: l.points };
      const cur = seriesLines[name] ?? { g: 0, pts: 0, reb: 0, ast: 0 };
      seriesLines[name] = { g: cur.g + 1, pts: cur.pts + l.points, reb: cur.reb + l.oreb + l.dreb, ast: cur.ast + l.ast };
    }
    lines = addBox(lines, result.homeBox.players);
    highs = addHighs(highs, result.homeBox.players, `${team.name} (${era.label.replace(/^The /, '')})`);
    games.push({ us: result.homeScore, them: result.awayScore, won, top: `${top.name} ${top.pts}` });
    st = { game: st.game + 1, ourWins: st.ourWins + (won ? 1 : 0), theirWins: st.theirWins + (won ? 0 : 1), streak: won ? st.streak + 1 : 0, lostLast: !won };
  }
  const won = st.ourWins === WINS_NEEDED;
  const coins = seriesCoins(run, won, st.ourWins);
  const mvp = Object.entries(seriesLines).map(([name, l]) => ({ name, ...l, score: l.pts + l.reb * 1.2 + l.ast * 1.5 })).sort((a, b) => b.score - a.score)[0];
  const play: SeriesPlay = { games, won, coins, teamName: team.name, era, mvp };
  const results = [...run.results, { index: run.seriesIndex, teamId: s.teamId, games, won, coins }];
  const next: HuntRun = { ...run, results, lines, highs, coins: run.coins + coins, note: undefined };
  if (won) {
    const growth = run.focus ? { ...run.growth, [run.focus]: run.growth[run.focus] + 1 } : run.growth;
    if (s.secret) return { run: { ...next, growth, stage: 'won', immortal: true, note: 'You beat the greatest team ever assembled. Nobody will believe you.' }, play };
    if (s.kind === 'boss') {
      // A flawless hunt (no series lost) opens the secret door: one more series, against the Immortals.
      const flawless = results.every(r => r.won);
      // Relic luck (never in a Daily or Weekly, which carry no luck): one lost series can still find the door, at a luck-sized chance.
      const luckyDoor = !flawless && results.filter(r => !r.won).length === 1 && !!run.luck && new RNG(run.seed * 13 + 777).next() < run.luck;
      const secret = (flawless || luckyDoor) && !run.series.some(x => x.secret) ? secretSeries(h, run) : null;
      if (secret) return { run: { ...next, growth, series: [...run.series, secret], seriesIndex: run.seriesIndex + 1, attempts: 0, stage: 'series', note: flawless
        ? 'A flawless hunt. A door you didn\'t know about opens: one more series, against the greatest team ever assembled. Win or lose, your hunt is already won.'
        : 'Your relics found a door you didn\'t know about: one more series, against the greatest team ever assembled. Win or lose, your hunt is already won.' }, play };
      return { run: { ...next, growth, stage: 'won' }, play };
    }
    // With the boost slots full, the road goes straight on.
    if (run.boosts.length >= MAX_BOOSTS) return { run: advance(h, { ...next, growth }), play };
    return { run: { ...next, growth, stage: 'boost', attempts: 0, boostOffer: boostOffer(run) }, play };
  }
  // The secret series is a bonus: losing it ends the hunt as a win.
  if (s.secret) return { run: { ...next, stage: 'won', note: 'The Immortals were too much. Your hunt still counts as won.' }, play };
  if (run.items.includes('insurance')) return { run: { ...next, items: run.items.filter(i => i !== 'insurance'), attempts: run.attempts + 1, note: 'Injury Insurance paid out: no life lost.' }, play };
  if (run.lives - 1 <= 0) return { run: { ...next, lives: 0, stage: 'lost' }, play };
  return { run: { ...next, lives: run.lives - 1, attempts: run.attempts + 1 }, play };
}

/** The secret series: the strongest champion in history not already faced, lifted past the boss. */
export function secretSeries(h: NbaHistory, run: HuntRun): HuntSeries {
  const faced = new Set(run.series.map(x => x.teamId));
  const team = huntTeams(h).filter(t => t.champion && !faced.has(t.id)).sort((a, b) => teamBaseRating(h, b) - teamBaseRating(h, a))[0];
  const diff = DIFFICULTIES[run.difficulty ?? 'pro'];
  const base: HuntSeries = { teamId: team.id, eraId: eraOf(team.end).id, kind: 'boss', buffs: [...BUFF_IDS].slice(0, 3), lift: 0, secret: true };
  return { ...base, lift: bonusToReach(h, theirStaticOvrs(h, run, base, 0), diff.bossRating + 3, true) + ENEMY_EDGE };
}

// ---------------------------------------------------------------- boosts and the shop

function boostOffer(run: HuntRun): BoostId[] {
  const rng = rngFor(run, 4242);
  return BOOST_IDS.filter(b => !run.boosts.includes(b)).sort(() => rng.next() - 0.5).slice(0, 3);
}

/** Shops come before series 1, 3, 5, 7 and 9. */
export const shopBefore = (index: number) => index % 2 === 0;

/** Takes a boost after a series win (or none), then on to the shop or the next series. A hunt holds three boosts. */
export function takeBoost(h: NbaHistory, run: HuntRun, boost: BoostId | null): HuntRun {
  if (run.stage !== 'boost') return run;
  if (boost && !run.boostOffer?.includes(boost)) return run;
  return advance(h, { ...run, boosts: boost ? [...run.boosts, boost] : run.boosts, boostOffer: undefined });
}

/** On to the next series, through a shop when one comes first. */
function advance(h: NbaHistory, run: HuntRun): HuntRun {
  const next: HuntRun = { ...run, seriesIndex: run.seriesIndex + 1, attempts: 0 };
  return shopBefore(next.seriesIndex) ? openShop(h, next) : { ...next, stage: 'series' };
}

function openShop(h: NbaHistory, run: HuntRun): HuntRun {
  const rng = rngFor(run, 777);
  const items = ITEM_IDS.filter(i => !run.items.includes(i)).sort(() => rng.next() - 0.5).slice(0, 3);
  // Players get better as the hunt goes on.
  const late = run.seriesIndex / SERIES_COUNT;
  const w: Record<Rarity, number> = { common: Math.max(8, 40 - late * 40), rare: 38, epic: 16 + late * 20, legendary: 6 + late * 14 };
  const slots = [0, 1, 2, 3, 4, 5].sort(() => rng.next() - 0.5).slice(0, 3);
  return { ...run, stage: 'shop', note: undefined, shop: { items, sold: [], coach: shopCoach(run, rng), cards: slots.map(slot => ({ slot, id: shopCard(h, run, slot, rng, w) })).filter(c => c.id) as { id: string; slot: number }[] } };
}

function shopCard(h: NbaHistory, run: HuntRun, slot: number, rng: RNG, w: Record<Rarity, number>): string | undefined {
  const pool = cardPool(h);
  const taken = new Set(run.squad.map(id => pool.byId.get(id)!.playerId));
  const deck = DECKS[run.deck ?? 'classic'];
  const fits = (c: HuntCard) => fitsSlot(c, SLOTS[slot]) && (deck.draft?.(c) ?? true);
  return drawPlayers(h, taken, rng, 1, fits, () => ORDER[rng.weightedPick(ORDER.map(r => w[r]))])[0];
}

function shopCoach(run: HuntRun, rng: RNG): string | undefined {
  const better = COACHES.filter(x => x.id !== run.coach && x.bonus >= 1);
  return better[rng.nextInt(better.length)]?.id;
}

export const cardPrice = (h: NbaHistory, id: string) => CARD_PRICE[cardPool(h).byId.get(id)?.rarity ?? 'common'];

/** Buys a player from the shop into his slot (the player there leaves). */
export function buyCard(h: NbaHistory, run: HuntRun, id: string): HuntRun {
  const shop = run.shop;
  const offer = shop?.cards.find(c => c.id === id);
  if (run.stage !== 'shop' || !shop || !offer || shop.sold.includes(id)) return run;
  const price = cardPrice(h, id);
  if (run.coins < price) return run;
  const out = run.squad[offer.slot];
  const training = { ...run.training }; delete training[out];
  return { ...run, squad: run.squad.map((x, i) => (i === offer.slot ? id : x)), training, coins: run.coins - price, shop: { ...shop, sold: [...shop.sold, id] },
    note: `Signed ${card(h, id).name} as your ${slotName(offer.slot)}; ${card(h, out).name} leaves.` };
}

export function buyCoach(run: HuntRun): HuntRun {
  const shop = run.shop;
  const x = shop?.coach ? COACH_BY_ID.get(shop.coach) : undefined;
  if (run.stage !== 'shop' || !shop || !x || shop.sold.includes(x.id) || run.coins < coachPrice(x)) return run;
  return { ...run, coach: x.id, coins: run.coins - coachPrice(x), shop: { ...shop, sold: [...shop.sold, x.id] }, note: `Hired ${x.name}.` };
}

/** Shop boosts held (the deck's starting item is a gift and doesn't take a slot). */
export const shopItems = (run: HuntRun) => run.items.filter(i => !DECKS[run.deck ?? 'classic'].items.includes(i));

export function buyItem(run: HuntRun, item: ItemId): HuntRun {
  const shop = run.shop;
  if (run.stage !== 'shop' || !shop || !shop.items.includes(item) || shop.sold.includes(item) || run.items.includes(item) || shopItems(run).length >= MAX_ITEMS) return run;
  const it = ITEMS[item];
  if (run.coins < it.price) return run;
  return { ...run, coins: run.coins - it.price, items: [...run.items, item], shop: { ...shop, sold: [...shop.sold, item] }, note: `Bought ${it.name}.` };
}

/** Lives are for sale only on Rookie. */
export const canBuyLife = (run: HuntRun) => run.difficulty === 'rookie';

export function buyLife(run: HuntRun): HuntRun {
  if (run.stage !== 'shop' || !canBuyLife(run) || !run.shop || run.shop.lifeBought || run.lives >= maxLives(run) || run.coins < LIFE_PRICE) return run;
  return { ...run, lives: run.lives + 1, coins: run.coins - LIFE_PRICE, shop: { ...run.shop, lifeBought: true }, note: 'A life back.' };
}

/** Training in the shop: +2 overall for one player, up to +6. */
export function train(h: NbaHistory, run: HuntRun, id: string): HuntRun {
  if (run.stage !== 'shop' || !run.squad.includes(id) || (run.training[id] ?? 0) >= MAX_TRAINING || run.coins < TRAIN_PRICE) return run;
  return { ...run, coins: run.coins - TRAIN_PRICE, training: { ...run.training, [id]: (run.training[id] ?? 0) + TRAIN_STEP }, note: `${card(h, id).name} trained: +${TRAIN_STEP}.` };
}

export function leaveShop(run: HuntRun): HuntRun {
  return run.stage === 'shop' ? { ...run, stage: 'series', shop: undefined, note: undefined } : run;
}

export const slotName = (slot: number) => (slot === 5 ? 'sixth man' : SLOTS[slot]);

export type { ChemistryBond };
