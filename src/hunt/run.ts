import type { NbaHistory } from '../history/nbaHistoryData';
import { RNG } from '../simulation/engine/rng';
import { simulateGame, type LiveCoachingCommand } from '../simulation/engine/game';
import type { GameResult } from '../simulation/boxscore';
import type { PlayerSeason } from '../simulation/types';
import { DEFAULT_GAME_SETTINGS, ERA_PRESETS } from '../simulation/types';
import { calculateOverall } from '../simulation/engine/overall';
import { cardPool, cardPlayer, type HuntCard, type Rarity } from './cards';
import { huntTeams, type HuntTeam } from './teams';
import { ERAS, eraCoach, eraOf, underEra, type HuntEra } from './eras';
import { chemistry, chemistryBonus, type ChemistryBond } from './chemistry';
import { ITEMS, ITEM_IDS, MAX_ITEMS, type ItemId } from './items';
import { EVENT_IDS, type EventId } from './events';

/*
 * A League Hunt run. Draft a squad of eight player-season cards under a Legacy Points cap, then travel through
 * the eras: five real teams, each tougher than the last and each played under its own era's rules, then a boss,
 * one of the greatest teams ever. Every win raises the cap, pays coins and brings a new card; every loss costs a
 * life. Between games you reach a crossroads: the shop (cards, items, a life), an event (a story with a choice)
 * or a rest stop (a life back, or training). Chemistry between the cards and items lift players during games.
 * Everything is seeded, so a run replays the same way.
 */

export const SQUAD_SIZE = 8;
export const SQUAD_MAX = 10;
export const START_CAP = 72;
export const CAP_PER_WIN = 8;
export const START_LIVES = 3;
export const START_COINS = 30;
export const MIN_OFFER_OVR = 45;
export const MAX_TRAINING = 6;
export const CARD_PRICE: Record<Rarity, number> = { common: 20, rare: 35, epic: 60, legendary: 95 };
export const LIFE_PRICE = 45;

export type NodeKind = 'shop' | 'event' | 'rest';
export interface HuntStop { eraId: string; teamId: string; boss?: boolean }
export interface HuntStopResult { stop: number; teamId: string; us: number; them: number; won: boolean }
export type HuntStage = 'draft' | 'stop' | 'reward' | 'crossroads' | 'shop' | 'event' | 'rest' | 'won' | 'lost';
export interface HuntShop { cards: string[]; items: ItemId[]; sold: string[]; lifeBought?: boolean }
export interface HuntRun {
  version: 2;
  seed: number;
  stage: HuntStage;
  squad: string[];
  cap: number;
  lives: number;
  coins: number;
  items: ItemId[];
  /** Lasting overall bonuses per card (training, camps, contract moods). */
  boosts: Record<string, number>;
  /** A one-game bonus or penalty for a card (the flu game). */
  nextGame?: { cardId: string; bonus: number };
  stops: HuntStop[];
  stopIndex: number;
  /** Cards on the table: the draft pick or the reward after a win. */
  offer: string[];
  draftRound: number;
  attempts: number;
  results: HuntStopResult[];
  /** The two roads at a crossroads, the shop's shelves, or the event being played. */
  crossroads?: NodeKind[];
  shop?: HuntShop;
  eventId?: EventId;
  /** What the last event or purchase did, for the screen. */
  note?: string;
  deck?: DeckId;
  difficulty?: Difficulty;
  /** The Daily Legend date (YYYY-MM-DD) when this is the day's hunt. */
  daily?: string;
  /** Your players' totals over the hunt (box-score names), for the summary. */
  lines?: Record<string, { g: number; pts: number; reb: number; ast: number }>;
}

const TIERS = [58.5, 61.5, 64, 66, 67.5];

export type DeckId = 'classic' | 'bigMen' | 'oldSchool' | 'paceSpace' | 'dynasty';
export type Difficulty = 'rookie' | 'pro' | 'legend';
export interface HuntDeck { id: DeckId; name: string; blurb: string; capBonus: number; items: ItemId[]; opener?: (c: HuntCard) => boolean; draft?: (c: HuntCard) => boolean; unlock: string }
/** Starting decks: how the draft opens. All but Classic are unlocked by playing (see unlocks.ts). */
export const DECKS: Record<DeckId, HuntDeck> = {
  classic: { id: 'classic', name: 'Classic', blurb: 'A star to start, then anyone from any era.', capBonus: 0, items: [], unlock: 'Always open.' },
  bigMen: { id: 'bigMen', name: 'Big Man Era', blurb: 'Your first pick is a star big man, and you start with the Bad Boys Rulebook.', capBonus: 0, items: ['badBoys'], opener: c => c.pos === 'C' || c.pos === 'PF', unlock: 'Reach stop 3 in any hunt.' },
  oldSchool: { id: 'oldSchool', name: 'Old School', blurb: 'Draft only players from before 1980, with 8 more Legacy Points.', capBonus: 8, items: [], draft: c => c.end < 1980, unlock: 'Play 3 hunts.' },
  paceSpace: { id: 'paceSpace', name: 'Pace & Space', blurb: 'Draft only players from 2010 on, and start with Seven Seconds or Less.', capBonus: 0, items: ['sevenSeconds'], draft: c => c.end >= 2010, unlock: 'Reach stop 5 in any hunt.' },
  dynasty: { id: 'dynasty', name: 'Dynasty', blurb: 'Start with two real teammates from a champion, then draft the rest.', capBonus: 0, items: [], unlock: 'Win a hunt.' },
};
export interface HuntDifficulty { id: Difficulty; name: string; blurb: string; tierShift: number; lives: number; bossPool: number; coinShift: number; unlock: string }
export const DIFFICULTIES: Record<Difficulty, HuntDifficulty> = {
  rookie: { id: 'rookie', name: 'Rookie', blurb: 'Softer opponents and four lives.', tierShift: -2, lives: 4, bossPool: 12, coinShift: 10, unlock: 'Always open.' },
  pro: { id: 'pro', name: 'Pro', blurb: 'The hunt as it was meant to be.', tierShift: 0, lives: 3, bossPool: 8, coinShift: 0, unlock: 'Always open.' },
  legend: { id: 'legend', name: 'Legend', blurb: 'Tougher teams, two lives, and the boss is one of the four best teams ever.', tierShift: 2, lives: 2, bossPool: 4, coinShift: -10, unlock: 'Win a hunt.' },
};

function pickTeam(teams: HuntTeam[], era: HuntEra, target: number, rng: RNG, used: Set<string>): HuntTeam {
  const inEra = teams.filter(t => t.end >= era.from && t.end <= era.to && !used.has(t.id));
  const pool = (inEra.length ? inEra : teams).filter(t => !used.has(t.id));
  // Any team within a couple of points of the target, so the same stop rarely repeats from run to run.
  const close = pool.filter(t => Math.abs(t.strength - target) <= 2);
  const near = close.length >= 3 ? close : [...pool].sort((a, b) => Math.abs(a.strength - target) - Math.abs(b.strength - target)).slice(0, 8);
  return near[rng.nextInt(near.length)];
}

/** A new run: five stops in five different eras, then the boss. */
export interface NewRunOptions { deck?: DeckId; difficulty?: Difficulty; daily?: string }

export function newRun(h: NbaHistory, seed: number, opts: NewRunOptions = {}): HuntRun {
  const deck = DECKS[opts.deck ?? 'classic'], diff = DIFFICULTIES[opts.difficulty ?? 'pro'];
  const rng = new RNG(seed);
  const teams = huntTeams(h);
  const eras = [...ERAS].sort(() => rng.next() - 0.5).slice(0, TIERS.length).sort((a, b) => a.from - b.from);
  const used = new Set<string>();
  const stops: HuntStop[] = eras.map((era, i) => { const t = pickTeam(teams, era, TIERS[i] + diff.tierShift, rng, used); used.add(t.id); return { eraId: era.id, teamId: t.id }; });
  // The boss: one of the best champions ever, played under its own era's rules.
  const greats = teams.filter(t => t.champion && !used.has(t.id)).sort((a, b) => b.strength - a.strength).slice(0, diff.bossPool);
  const boss = greats[rng.nextInt(greats.length)];
  stops.push({ eraId: eraOf(boss.end).id, teamId: boss.id, boss: true });
  let run: HuntRun = { version: 2, seed, stage: 'draft', squad: [], cap: START_CAP + deck.capBonus, lives: diff.lives, coins: START_COINS + diff.coinShift, items: [...deck.items], boosts: {}, stops, stopIndex: 0, offer: [], draftRound: 0, attempts: 0, results: [],
    deck: opts.deck ?? 'classic', difficulty: opts.difficulty ?? 'pro', ...(opts.daily ? { daily: opts.daily } : {}) };
  // Dynasty: two real teammates from one great team-season start the squad.
  if (deck.id === 'dynasty') {
    const pool = cardPool(h);
    const champs = teams.filter(t => t.champion && t.id !== boss.id && !used.has(t.id));
    const t = champs[rng.nextInt(champs.length)];
    const pair = t.roster.map(id => pool.byId.get(id)!).filter(c => c.cost <= 16).slice(0, 2);
    if (pair.length === 2) run = { ...run, squad: pair.map(c => c.id), draftRound: 2 };
  }
  return { ...run, offer: offer(h, run, 'draft') };
}

export const maxLives = (run: HuntRun) => DIFFICULTIES[run.difficulty ?? 'pro'].lives;

/** Older saved runs (stage 1) continue with the new fields at their defaults. */
export function upgradeRun(run: HuntRun | (Omit<HuntRun, 'version' | 'coins' | 'items' | 'boosts'> & { version: 1 })): HuntRun {
  if (run.version === 2) return run;
  return { ...run, version: 2, coins: START_COINS, items: [], boosts: {} } as HuntRun;
}

export const spent = (h: NbaHistory, ids: string[]) => ids.reduce((n, id) => n + (cardPool(h).byId.get(id)?.cost ?? 0), 0);
const rngFor = (run: HuntRun, salt: number) => new RNG(run.seed * 31 + run.stopIndex * 977 + run.attempts * 13 + salt);

/** Rarity odds for an offer: the draft opens with one star, rewards and the shop get better as the run goes on. */
function rarityWeights(run: HuntRun, kind: 'draft' | 'reward' | 'shop'): Record<Rarity, number> {
  if (kind === 'draft') return run.draftRound === 0 ? { common: 0, rare: 0, epic: 6, legendary: 4 } : { common: 55, rare: 32, epic: 11, legendary: 2 };
  const s = run.stopIndex;
  return { common: Math.max(10, 45 - s * 8), rare: 35, epic: 15 + s * 4, legendary: 5 + s * 3 };
}

function drawCards(h: NbaHistory, run: HuntRun, rng: RNG, weights: Record<Rarity, number>, count: number, exclude: string[] = [], fits: (c: HuntCard) => boolean = () => true): string[] {
  const pool = cardPool(h);
  const order: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
  const taken = new Set([...run.squad, ...exclude].map(id => pool.byId.get(id)?.playerId));
  const out: HuntCard[] = [];
  for (let tries = 0; out.length < count && tries < 3000; tries++) {
    const rarity = order[rng.weightedPick(order.map(r => weights[r]))];
    const list = pool.byRarity[rarity];
    const c = list[rng.nextInt(list.length)];
    if (c.ovr < MIN_OFFER_OVR || taken.has(c.playerId) || out.some(o => o.playerId === c.playerId) || !fits(c)) continue;
    out.push(c);
  }
  return out.map(c => c.id);
}

function offer(h: NbaHistory, run: HuntRun, kind: 'draft' | 'reward'): string[] {
  const rng = new RNG(run.seed * 31 + (kind === 'draft' ? run.draftRound : 100 + run.stopIndex * 7 + run.attempts));
  const deck = DECKS[run.deck ?? 'classic'];
  const fits = kind !== 'draft' ? undefined : run.draftRound === 0 && deck.opener ? deck.opener : deck.draft;
  return drawCards(h, run, rng, rarityWeights(run, kind), 3, [], fits);
}

/** Whether a card fits the cap (leaving room to fill the squad with the cheapest cards), optionally replacing one. */
export function affordable(h: NbaHistory, run: HuntRun, cardId: string, replacing?: string): boolean {
  const pool = cardPool(h);
  const card = pool.byId.get(cardId);
  if (!card) return false;
  const squad = run.squad.filter(id => id !== replacing);
  const openAfter = run.stage === 'draft' ? Math.max(0, SQUAD_SIZE - squad.length - 1) : 0;
  return spent(h, squad) + card.cost + openAfter * 6 <= run.cap;
}

export function draftPick(h: NbaHistory, run: HuntRun, cardId: string): HuntRun {
  if (run.stage !== 'draft' || !run.offer.includes(cardId) || !affordable(h, run, cardId)) return run;
  const next: HuntRun = { ...run, squad: [...run.squad, cardId], draftRound: run.draftRound + 1 };
  if (next.squad.length >= SQUAD_SIZE) return { ...next, stage: 'stop', offer: [] };
  const o = offer(h, next, 'draft');
  // Nothing affordable on the table: swap in the cheapest commons that fit.
  if (!o.some(id => affordable(h, next, id))) {
    const fits = DECKS[run.deck ?? 'classic'].draft ?? (() => true);
    const cheap = cardPool(h).byRarity.common.filter(c => c.ovr >= MIN_OFFER_OVR && fits(c) && !next.squad.some(s => cardPool(h).byId.get(s)?.playerId === c.playerId));
    const rng = new RNG(run.seed + next.draftRound * 13);
    return { ...next, offer: [0, 1, 2].map(() => cheap[rng.nextInt(cheap.length)].id) };
  }
  return { ...next, offer: o };
}

// ---------------------------------------------------------------- strength, chemistry and items in games

/** Squad strength on the same scale as a team's: its best eight, starters weighted more. */
export function strengthOf(cards: { ovr: number }[]): number {
  const best = [...cards].sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  const w = best.reduce((n, _, i) => n + (i < 5 ? 1.2 : 0.7), 0);
  return w ? Math.round(best.reduce((n, c, i) => n + c.ovr * (i < 5 ? 1.2 : 0.7), 0) / w * 10) / 10 : 0;
}

export interface CardBonus { card: HuntCard; bonus: number; parts: string[] }

/** Every card's overall bonus for a game in `era`: chemistry, training, items and one-game effects. */
export function squadBonuses(h: NbaHistory, run: HuntRun, era?: HuntEra): { cards: CardBonus[]; bonds: ChemistryBond[] } {
  const pool = cardPool(h);
  const cards = run.squad.map(id => pool.byId.get(id)!).filter(Boolean);
  const bonds = chemistry(cards, era);
  const chem = chemistryBonus(bonds);
  const ranked = [...cards].sort((a, b) => b.ovr - a.ovr);
  const has = (i: ItemId) => run.items.includes(i);
  return { bonds, cards: cards.map(card => {
    const rank = ranked.indexOf(card), parts: string[] = [];
    let bonus = 0;
    const add = (v: number, label: string) => { if (v) { bonus += v; parts.push(`${v > 0 ? '+' : ''}${v} ${label}`); } };
    add(chem.get(card.id) ?? 0, 'chemistry');
    add(run.boosts[card.id] ?? 0, 'training & morale');
    if (has('triangle')) add(1, 'Triangle');
    if (has('homeCourt') && rank < 5) add(2, 'home court');
    if (has('sixthMan') && rank >= 5) add(3, 'Sixth Man');
    if (has('clutch') && rank === 0) add(3, 'Clutch Gene');
    if (run.nextGame?.cardId === card.id) add(run.nextGame.bonus, 'this game');
    return { card, bonus, parts };
  }) };
}

/** Squad strength with every bonus for the next game. */
export function effectiveStrength(h: NbaHistory, run: HuntRun, era?: HuntEra): number {
  return strengthOf(squadBonuses(h, run, era).cards.map(c => ({ ovr: c.card.ovr + c.bonus })));
}

/** Minutes by rank: the starters play most of the game. */
export function withRotation(players: PlayerSeason[]): PlayerSeason[] {
  const mins = [34, 33, 32, 31, 29, 21, 18, 15, 14, 13];
  return [...players].sort((a, b) => calculateOverall(b) - calculateOverall(a)).map((p, i) => ({ ...p, rotationRole: i < 5 ? 'starter' as const : 'bench' as const, minutes: { mode: 'TARGET' as const, target: mins[i] ?? 8 } }));
}

const defended = (p: PlayerSeason): PlayerSeason => {
  const d = p.attributes.defense, up = (v: number) => Math.min(99, v + 5);
  return { ...p, attributes: { ...p.attributes, defense: { ...d, perimeterDefense: up(d.perimeterDefense), interiorDefense: up(d.interiorDefense), helpDefense: up(d.helpDefense), contest: up(d.contest) } } };
};

export interface HuntGame { result: GameResult; home: { teamId: string; name: string; seasons: PlayerSeason[] }; away: { teamId: string; name: string; seasons: PlayerSeason[] }; won: boolean; era: HuntEra; coins: number; commands: LiveCoachingCommand[] }

/** Coins for a result: a win pays by the margin; a loss pays a little for the lesson. */
export function coinsFor(run: HuntRun, won: boolean, margin: number): number {
  if (!won) return 5;
  return 20 + Math.min(20, Math.floor(margin / 2)) + (run.items.includes('cigar') ? 15 : 0);
}

/** Coaching calls per game (timeouts, play calls, defenses, lineups); the clipboard adds two. */
export const COACH_CARDS = 3;
export const coachCards = (run: HuntRun) => COACH_CARDS + (run.items.includes('clipboard') ? 2 : 0);

/**
 * The current stop's game, with any live coaching calls (each applies from its possession on, so everything before
 * it replays exactly the same). Nothing is recorded until the game is committed.
 */
export function stopGame(h: NbaHistory, run: HuntRun, commands: LiveCoachingCommand[] = []): HuntGame | null {
  if (run.stage !== 'stop') return null;
  const stop = run.stops[run.stopIndex];
  const team = huntTeams(h).find(t => t.id === stop.teamId)!;
  const era = ERAS.find(e => e.id === stop.eraId) ?? eraOf(team.end);
  const pool = cardPool(h);
  const { cards } = squadBonuses(h, run, era);
  const mineIds = new Set(cards.map(c => c.card.playerId));
  const theirs = team.roster.map(id => pool.byId.get(id)!).filter(c => c && !mineIds.has(c.playerId));
  const mine = cards.map(({ card, bonus }) => {
    const p = underEra(cardPlayer(h, card, 'HUNT', bonus), era);
    return run.items.includes('badBoys') ? defended(p) : p;
  });
  const coach = run.items.includes('sevenSeconds') ? { ...eraCoach(era), paceTendency: 92, threePointFrequency: era.threes === 'none' ? 2 : 80 } : eraCoach(era);
  const home = { teamId: 'HUNT', name: 'Your squad', seasons: withRotation(mine), coach, chemistry: 70 };
  const away = { teamId: team.abbr === 'HUNT' ? 'OPP' : team.abbr, name: team.name, seasons: withRotation(theirs.map(c => underEra(cardPlayer(h, c, team.abbr), era))), coach: eraCoach(era), chemistry: 75 };
  const decade = `${Math.floor(Math.min(2020, Math.max(1960, team.end - 1)) / 10) * 10}s` as keyof typeof ERA_PRESETS;
  const result = simulateGame({ home, away, liveCoaching: commands.length ? commands : undefined,
    settings: { ...DEFAULT_GAME_SETTINGS, era: ERA_PRESETS[decade] ?? DEFAULT_GAME_SETTINGS.era, seed: run.seed * 101 + run.stopIndex * 7919 + run.attempts * 17, injuriesEnabled: false, teamChemistryEnabled: false } });
  const won = result.homeScore > result.awayScore;
  return { result, home, away, won, era, coins: coinsFor(run, won, Math.abs(result.homeScore - result.awayScore)), commands };
}

/** Records a finished game: coins, the player lines, then the reward, a lost life, or the end of the hunt. */
export function commitGame(h: NbaHistory, run: HuntRun, game: HuntGame): HuntRun {
  if (run.stage !== 'stop') return run;
  const stop = run.stops[run.stopIndex];
  const { result, won, coins } = game;
  const lines = { ...(run.lines ?? {}) };
  for (const [name, l] of Object.entries(result.homeBox.players)) {
    if (!l.minutes) continue;
    const cur = lines[name] ?? { g: 0, pts: 0, reb: 0, ast: 0 };
    lines[name] = { g: cur.g + 1, pts: cur.pts + l.points, reb: cur.reb + l.oreb + l.dreb, ast: cur.ast + l.ast };
  }
  const results = [...run.results, { stop: run.stopIndex, teamId: stop.teamId, us: result.homeScore, them: result.awayScore, won }];
  const base: HuntRun = { ...run, results, lines, coins: run.coins + coins, nextGame: undefined, note: undefined };
  if (won && stop.boss) return { ...base, stage: 'won', offer: [] };
  if (won) { const r = { ...base, stage: 'reward' as const, cap: run.cap + CAP_PER_WIN, attempts: 0 }; return { ...r, offer: offer(h, r, 'reward') }; }
  return run.lives - 1 <= 0 ? { ...base, lives: 0, stage: 'lost', offer: [] } : { ...base, lives: run.lives - 1, attempts: run.attempts + 1, nextGame: run.nextGame };
}

/** Plays and records the current stop in one step (a simulated game with no coaching). */
export function playStop(h: NbaHistory, run: HuntRun): { run: HuntRun; game: HuntGame } | null {
  const game = stopGame(h, run);
  return game ? { run: commitGame(h, run, game), game } : null;
}

// ---------------------------------------------------------------- after a win: reward, crossroads, nodes

/** The two roads after a win (the last one before the boss always offers the shop). */
function crossroadsFor(run: HuntRun): NodeKind[] {
  const rng = rngFor(run, 555);
  const kinds: NodeKind[] = ['shop', 'event', 'rest'];
  const first = run.stopIndex === run.stops.length - 2 ? 'shop' : kinds[rng.nextInt(3)];
  const rest = kinds.filter(k => k !== first);
  return [first, rest[rng.nextInt(2)]];
}

/** After a win: take the new card (into an open spot, or replacing one), or pass; then on to the crossroads. */
export function takeReward(h: NbaHistory, run: HuntRun, cardId: string | null, replacing?: string): HuntRun {
  if (run.stage !== 'reward') return run;
  const onward = (squad: string[]): HuntRun => ({ ...run, squad, offer: [], stage: 'crossroads', crossroads: crossroadsFor(run) });
  if (!cardId) return onward(run.squad);
  if (!run.offer.includes(cardId) || !affordable(h, run, cardId, replacing)) return run;
  if (!replacing && run.squad.length >= SQUAD_MAX) return run;
  return onward(replacing ? run.squad.map(id => (id === replacing ? cardId : id)) : [...run.squad, cardId]);
}

/** Leaves the crossroads or a node for the next stop. */
export function moveOn(run: HuntRun): HuntRun {
  if (!['crossroads', 'shop', 'event', 'rest'].includes(run.stage)) return run;
  return { ...run, stage: 'stop', stopIndex: run.stopIndex + 1, attempts: 0, crossroads: undefined, shop: undefined, eventId: undefined };
}

/** Takes one road at the crossroads. */
export function chooseRoad(h: NbaHistory, run: HuntRun, kind: NodeKind): HuntRun {
  if (run.stage !== 'crossroads' || !run.crossroads?.includes(kind)) return run;
  const base = { ...run, note: undefined };
  if (kind === 'shop') {
    const rng = rngFor(run, 777);
    const items = ITEM_IDS.filter(i => !run.items.includes(i)).sort(() => rng.next() - 0.5).slice(0, 3);
    return { ...base, stage: 'shop', shop: { cards: drawCards(h, run, rng, rarityWeights(run, 'shop'), 4), items, sold: [] } };
  }
  if (kind === 'event') return { ...base, stage: 'event', eventId: EVENT_IDS[rngFor(run, 999).nextInt(EVENT_IDS.length)] };
  return { ...base, stage: 'rest' };
}

export const cardPrice = (h: NbaHistory, id: string) => CARD_PRICE[cardPool(h).byId.get(id)?.rarity ?? 'common'];

/** Buys a card from the shop (into an open spot or replacing one; it must fit the cap). */
export function buyCard(h: NbaHistory, run: HuntRun, cardId: string, replacing?: string): HuntRun {
  const shop = run.shop;
  if (run.stage !== 'shop' || !shop || !shop.cards.includes(cardId) || shop.sold.includes(cardId)) return run;
  const price = cardPrice(h, cardId);
  if (run.coins < price || !affordable(h, run, cardId, replacing) || (!replacing && run.squad.length >= SQUAD_MAX)) return run;
  const squad = replacing ? run.squad.map(id => (id === replacing ? cardId : id)) : [...run.squad, cardId];
  const boosts = { ...run.boosts };
  if (replacing) delete boosts[replacing];
  return { ...run, squad, boosts, coins: run.coins - price, shop: { ...shop, sold: [...shop.sold, cardId] }, note: `Signed ${cardPool(h).byId.get(cardId)!.name}.` };
}

export function buyItem(run: HuntRun, item: ItemId): HuntRun {
  const shop = run.shop;
  if (run.stage !== 'shop' || !shop || !shop.items.includes(item) || shop.sold.includes(item) || run.items.includes(item) || run.items.length >= MAX_ITEMS) return run;
  const it = ITEMS[item];
  if (run.coins < it.price) return run;
  return { ...run, coins: run.coins - it.price, items: [...run.items, item], cap: run.cap + (item === 'legacyFund' ? 12 : 0), shop: { ...shop, sold: [...shop.sold, item] }, note: `Bought ${it.name}.` };
}

export function buyLife(run: HuntRun): HuntRun {
  if (run.stage !== 'shop' || !run.shop || run.shop.lifeBought || run.lives >= maxLives(run) || run.coins < LIFE_PRICE) return run;
  return { ...run, lives: run.lives + 1, coins: run.coins - LIFE_PRICE, shop: { ...run.shop, lifeBought: true }, note: 'A life back.' };
}

/** Rest stop: a life back, or two points of training for one card (up to +6 per card); then on the road. */
export function rest(run: HuntRun, choice: { heal: true } | { train: string }): HuntRun {
  if (run.stage !== 'rest') return run;
  if ('heal' in choice) return run.lives >= maxLives(run) ? run : moveOn({ ...run, lives: run.lives + 1 });
  const id = choice.train;
  if (!run.squad.includes(id) || (run.boosts[id] ?? 0) >= MAX_TRAINING) return run;
  return moveOn({ ...run, boosts: { ...run.boosts, [id]: Math.min(MAX_TRAINING, (run.boosts[id] ?? 0) + 2) } });
}

/** An event choice. Returns the run with what happened in `note`; the player then moves on. */
export function resolveEvent(h: NbaHistory, run: HuntRun, optionId: string): HuntRun {
  if (run.stage !== 'event' || !run.eventId) return run;
  const pool = cardPool(h);
  const ranked = run.squad.map(id => pool.byId.get(id)!).sort((a, b) => b.ovr - a.ovr);
  const rng = rngFor(run, 1234);
  const done = (patch: Partial<HuntRun>, note: string): HuntRun => ({ ...run, ...patch, stage: 'event', eventId: undefined, note });
  const boost = (id: string, v: number) => ({ ...run.boosts, [id]: (run.boosts[id] ?? 0) + v });
  switch (run.eventId) {
    case 'flu': return optionId === 'play'
      ? done({ coins: run.coins + 40, nextGame: { cardId: ranked[0].id, bonus: -4 } }, `${ranked[0].name} will play through it (−4 next game). +40 coins.`)
      : done({}, `${ranked[0].name} rests. He'll be fine.`);
    case 'holdout': {
      const who = ranked[1] ?? ranked[0];
      if (optionId === 'pay') return run.coins < 35 ? run : done({ coins: run.coins - 35, boosts: boost(who.id, 1) }, `${who.name} got paid: +1 for the rest of the hunt.`);
      return done({ boosts: boost(who.id, -2) }, `${who.name} is sulking: −2 for the rest of the hunt.`);
    }
    case 'tradeMachine': {
      if (optionId !== 'swap') return done({}, 'You hang up. The squad stays together.');
      const weakest = [...ranked].reverse()[0];
      const up: Rarity = weakest.rarity === 'common' ? 'rare' : weakest.rarity === 'rare' ? 'epic' : 'legendary';
      const tryCards = (r: Rarity) => pool.byRarity[r].filter(c => c.ovr >= MIN_OFFER_OVR && !run.squad.some(s => pool.byId.get(s)!.playerId === c.playerId));
      let candidates = tryCards(up).filter(c => spent(h, run.squad) - weakest.cost + c.cost <= run.cap);
      if (!candidates.length) candidates = tryCards(weakest.rarity);
      const got = candidates[rng.nextInt(candidates.length)];
      const boosts = { ...run.boosts }; delete boosts[weakest.id];
      return done({ squad: run.squad.map(id => (id === weakest.id ? got.id : id)), boosts }, `${weakest.name} goes back in time; ${got.name} (${got.end - 1}-${String(got.end).slice(2)}) arrives.`);
    }
    case 'camp': {
      if (optionId !== 'send' || run.coins < 30) return optionId === 'send' ? run : done({}, 'You keep your coins.');
      const starter = ranked.slice(0, 5).reverse()[0];
      return done({ coins: run.coins - 30, boosts: boost(starter.id, 3) }, `${starter.name} comes back from camp +3.`);
    }
    case 'envelope': {
      if (optionId === 'sell') return done({ coins: run.coins + 25 }, 'Sold unopened: +25 coins.');
      const [id] = drawCards(h, run, rng, { common: 0, rare: 60, epic: 30, legendary: 10 }, 1);
      const card = pool.byId.get(id);
      if (card && run.squad.length < SQUAD_MAX && spent(h, run.squad) + card.cost <= run.cap) return done({ squad: [...run.squad, id] }, `Inside: ${card.name} (${card.end - 1}-${String(card.end).slice(2)}) joins your squad!`);
      return done({ coins: run.coins + 50 }, `Inside: ${card?.name ?? 'a card'}, but there's no room. You sell it: +50 coins.`);
    }
    case 'charity':
      if (optionId === 'play') return run.lives < maxLives(run) ? done({ lives: run.lives + 1 }, 'The kids loved it. A life back.') : done({ coins: run.coins + 30 }, 'The kids loved it: +30 coins.');
      return done({ coins: run.coins + 10 }, 'Rest day: +10 coins.');
  }
  return run;
}

/** Between stops you can release a card to free Legacy Points (the squad never drops below five). */
export function releaseCard(run: HuntRun, cardId: string): HuntRun {
  if (!['stop', 'reward', 'crossroads', 'shop', 'rest'].includes(run.stage) || run.squad.length <= 5 || !run.squad.includes(cardId)) return run;
  const boosts = { ...run.boosts }; delete boosts[cardId];
  return { ...run, squad: run.squad.filter(id => id !== cardId), boosts };
}
