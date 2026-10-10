import { localRead, type Read } from '../lib/kv';

/*
 * Relics: a collection that belongs to you, the player, across every mode. You earn Relic Spins by finishing things
 * (winning a League Hunt, a title in the 82-0 Challenge, a long Survival run, finishing Story Mode, a Career, a
 * Franchise title) and by unlocking achievements. Each spin lands on a relic:
 *
 *   Common 55% (+1% luck) · Rare 28% (+2%) · Epic 12.43% (+3%) · Legendary 4.5% (+4%) · Mythic 0.07% (+5%)
 *
 * Every relic you own adds its luck once; luck makes the good outcomes of a spin more likely in every spin-based mode
 * (League Hunt reels, 82-0 spins, the Career wheel, the Survival deal). A relic you already own pays out coins instead
 * (more for rarer relics). Eight secret relics are hidden behind a tiny chance on any spin; each unlocks a permanent
 * ability somewhere in the game.
 *
 * Fairness: Dailies, Weeklies, duels and other shared-seed runs ignore luck and abilities, so boards stay fair.
 */

export type RelicRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const RARITY_ORDER: RelicRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
export const RELIC_RARITY: Record<RelicRarity, { name: string; odds: number; luck: number; coins: number }> = {
  common: { name: 'Common', odds: 0.55, luck: 1, coins: 10 },
  rare: { name: 'Rare', odds: 0.28, luck: 2, coins: 25 },
  epic: { name: 'Epic', odds: 0.1243, luck: 3, coins: 60 },
  legendary: { name: 'Legendary', odds: 0.045, luck: 4, coins: 150 },
  mythic: { name: 'Mythic', odds: 0.0007, luck: 5, coins: 1000 },
};

export interface Relic { id: string; name: string; rarity: RelicRarity; blurb: string; icon: string }
export const RELICS: Relic[] = [
  { id: 'netScrap', name: 'Torn Net Scrap', rarity: 'common', blurb: 'Cut down after a pickup game nobody remembers.', icon: 'court' },
  { id: 'chalkBag', name: 'Chalk Bag', rarity: 'common', blurb: 'One clap and the arena knows.', icon: 'star' },
  { id: 'rookieCard', name: 'Creased Rookie Card', rarity: 'common', blurb: 'Worth nothing. Priceless to you.', icon: 'list' },
  { id: 'wristband', name: 'Sweat-Soaked Wristband', rarity: 'common', blurb: 'Still damp. Somehow.', icon: 'heart' },
  { id: 'ticketStub', name: 'Nosebleed Ticket Stub', rarity: 'common', blurb: 'Row ZZ. Best seat in the house.', icon: 'calendar' },
  { id: 'whistle', name: 'Referee\'s Whistle', rarity: 'rare', blurb: 'Every call goes your way. Allegedly.', icon: 'warning' },
  { id: 'clipboard', name: 'Coach\'s Clipboard', rarity: 'rare', blurb: 'The last play is still drawn on it.', icon: 'chart' },
  { id: 'gameBall', name: 'Game-Winner Ball', rarity: 'rare', blurb: 'Signed by everyone on the floor that night.', icon: 'play' },
  { id: 'warmups', name: 'Throwback Warm-ups', rarity: 'rare', blurb: 'Tear-away snaps still work.', icon: 'jersey' },
  { id: 'floorboard', name: 'Old Arena Floorboard', rarity: 'rare', blurb: 'From a building they tore down years ago.', icon: 'court' },
  { id: 'goldShoes', name: 'Gold Sneakers', rarity: 'epic', blurb: 'Laced for a Finals game. Never washed.', icon: 'shoe' },
  { id: 'banner', name: 'Rafters Banner', rarity: 'epic', blurb: 'A number nobody will ever wear again.', icon: 'trophy' },
  { id: 'champagne', name: 'Locker-Room Champagne', rarity: 'epic', blurb: 'The cork is still in your pocket.', icon: 'flame' },
  { id: 'scoutNotes', name: 'Legendary Scout\'s Notebook', rarity: 'epic', blurb: 'He saw them all coming.', icon: 'search' },
  { id: 'ring', name: 'Championship Ring', rarity: 'legendary', blurb: 'Heavy. In the best way.', icon: 'crown' },
  { id: 'trophy', name: 'The Larry O\'Brien Replica', rarity: 'legendary', blurb: 'Gold, and it knows it.', icon: 'trophy' },
  { id: 'mvpBall', name: 'MVP Game Ball', rarity: 'legendary', blurb: 'From the night the league crowned him.', icon: 'star' },
  { id: 'firstBall', name: 'The First Basketball', rarity: 'mythic', blurb: 'Leather, laces and 1891.', icon: 'crown' },
  { id: 'peachBasket', name: 'The Peach Basket', rarity: 'mythic', blurb: 'Before nets. Before everything.', icon: 'trophy' },
];
export const RELIC_BY_ID = new Map(RELICS.map(r => [r.id, r]));

/** Secret relics: each one is a permanent ability. */
export type SecretId = 'eternalSpin' | 'secondWind' | 'goldenTouch' | 'ironWill' | 'extraPick' | 'clutchGene' | 'ownersFavorite' | 'lastLook';
export interface SecretRelic { id: SecretId; name: string; mode: string; ability: string }
export const SECRET_RELICS: SecretRelic[] = [
  { id: 'eternalSpin', name: 'The Eternal Spin', mode: 'Career Mode', ability: 'Always +1 respin on the Career wheel.' },
  { id: 'secondWind', name: 'Second Wind', mode: 'League Hunt', ability: 'Start every hunt with one extra life.' },
  { id: 'goldenTouch', name: 'Golden Touch', mode: 'League Hunt', ability: 'Start every hunt with 30 extra coins.' },
  { id: 'ironWill', name: 'Iron Will', mode: 'Survival', ability: 'Start every Survival run with one extra Shield.' },
  { id: 'extraPick', name: 'The Extra Pick', mode: '82-0 Challenge', ability: 'One extra reroll in every 82-0 run.' },
  { id: 'clutchGene', name: 'The Clutch Gene', mode: 'Story Mode', ability: 'Your story player starts with +2 grit.' },
  { id: 'ownersFavorite', name: 'Owner\'s Favorite', mode: 'Franchise', ability: 'The owner\'s demands ask for one fewer win.' },
  { id: 'lastLook', name: 'The Last Look', mode: 'Daily Grid', ability: 'One extra guess on Endless grids.' },
];
export const SECRET_BY_ID = new Map(SECRET_RELICS.map(r => [r.id, r]));
/** The chance any spin uncovers a secret relic you don't have yet. */
export const SECRET_CHANCE = 0.002;
/** Luck tops out here, however many relics you hold. */
export const MAX_LUCK = 30;

export interface SpinResult { kind: 'relic' | 'secret'; id: string; rarity: RelicRarity | 'secret'; duplicate: boolean; coins: number }
export interface RelicState {
  v: 1;
  spins: number;
  coins: number;
  /** Relic id -> how many times you've landed it. */
  owned: Record<string, number>;
  secrets: SecretId[];
  /** Rewards already granted (so a result pays out once). */
  granted: string[];
  history: (SpinResult & { at: number })[];
}

export const RELICS_KEY = 'cv-relics';
export const RELICS_EVENT = 'cv-relics-changed';
const empty = (): RelicState => ({ v: 1, spins: 0, coins: 0, owned: {}, secrets: [], granted: [], history: [] });

export function loadRelics(read: Read = localRead): RelicState {
  try {
    const r = JSON.parse(read(RELICS_KEY) ?? 'null') as RelicState | null;
    if (r && r.v === 1) return { ...empty(), ...r, owned: r.owned ?? {}, secrets: (r.secrets ?? []).filter(s => SECRET_BY_ID.has(s)), granted: r.granted ?? [], history: r.history ?? [] };
  } catch { /* fall through */ }
  return empty();
}
export function saveRelics(s: RelicState): void {
  try { localStorage.setItem(RELICS_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new Event(RELICS_EVENT)); } catch { /* no window (tests) */ }
}

/** Total luck in percent: each relic you own counts once. */
export function luckPercent(s: Pick<RelicState, 'owned'>): number {
  const total = Object.keys(s.owned).reduce((n, id) => n + (RELIC_BY_ID.get(id) ? RELIC_RARITY[RELIC_BY_ID.get(id)!.rarity].luck : 0), 0);
  return Math.min(MAX_LUCK, total);
}
/** Luck as a fraction (0.12 = +12%), for the modes. */
export const luckFactor = (read: Read = localRead) => luckPercent(loadRelics(read)) / 100;
export const hasSecret = (id: SecretId, read: Read = localRead) => loadRelics(read).secrets.includes(id);

/** Adds `n` spins for a result, once per `key` (e.g. "hunt-won:12345"). Returns the new state. */
export function grantSpins(state: RelicState, key: string, n = 1): RelicState {
  if (n <= 0 || state.granted.includes(key)) return state;
  return { ...state, spins: state.spins + n, granted: [...state.granted, key].slice(-2000) };
}
/** Grants and saves in one go (what the modes call when a run ends). */
export function awardSpins(key: string, n = 1, read: Read = localRead): number {
  const before = loadRelics(read);
  const after = grantSpins(before, key, n);
  if (after !== before) saveRelics(after);
  return after.spins - before.spins;
}

/** The rarity a roll lands on (roll in [0, 1)). */
export function rarityFor(roll: number): RelicRarity {
  let acc = 0;
  for (const r of [...RARITY_ORDER].reverse()) { acc += RELIC_RARITY[r].odds; if (roll < acc) return r; }
  return 'common';
}

/** Spends a spin. `rand` is called for the secret check, the rarity and the relic. */
export function spinRelic(state: RelicState, rand: () => number = Math.random): { state: RelicState; result: SpinResult } | null {
  if (state.spins <= 0) return null;
  const lockedSecrets = SECRET_RELICS.filter(r => !state.secrets.includes(r.id));
  let result: SpinResult;
  let next: RelicState = { ...state, spins: state.spins - 1 };
  if (lockedSecrets.length && rand() < SECRET_CHANCE) {
    const sec = lockedSecrets[Math.floor(rand() * lockedSecrets.length)];
    result = { kind: 'secret', id: sec.id, rarity: 'secret', duplicate: false, coins: 0 };
    next = { ...next, secrets: [...next.secrets, sec.id] };
  } else {
    const rarity = rarityFor(rand());
    const pool = RELICS.filter(r => r.rarity === rarity);
    const relic = pool[Math.floor(rand() * pool.length)] ?? pool[0];
    const duplicate = (state.owned[relic.id] ?? 0) > 0;
    const coins = duplicate ? RELIC_RARITY[rarity].coins : 0;
    result = { kind: 'relic', id: relic.id, rarity, duplicate, coins };
    next = { ...next, coins: next.coins + coins, owned: { ...next.owned, [relic.id]: (next.owned[relic.id] ?? 0) + 1 } };
  }
  next = { ...next, history: [...next.history, { ...result, at: Date.now() }].slice(-50) };
  return { state: next, result };
}

/** How much of the collection you hold. */
export function collectionProgress(s: RelicState): { owned: number; total: number; secrets: number } {
  return { owned: RELICS.filter(r => (s.owned[r.id] ?? 0) > 0).length, total: RELICS.length, secrets: s.secrets.length };
}

/** Good-outcome weight multiplier for spins (1 = no luck): the better rarities get this much more weight. */
export const luckMultiplier = (luck: number | undefined) => 1 + Math.max(0, Math.min(MAX_LUCK / 100, luck ?? 0));
