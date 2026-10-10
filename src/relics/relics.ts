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
 * (more for rarer relics). Stacking relics are the exception: each copy adds +1%, up to five copies. Coins buy spins,
 * Lucky Spins (no Commons, double odds on Epic and up), the three relics in the daily shop, and upgrades (+50% luck
 * for a relic that doesn't stack). Eight secret relics are hidden behind a tiny chance on any spin; each unlocks a
 * permanent ability somewhere in the game.
 *
 * Fairness: Dailies, Weeklies, duels and other shared-seed runs ignore luck and abilities, so boards stay fair.
 */

export type RelicRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const RARITY_ORDER: RelicRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
export const RELIC_RARITY: Record<RelicRarity, { name: string; odds: number; luck: number; coins: number }> = {
  common: { name: 'Common', odds: 0.55, luck: 1, coins: 50 },
  rare: { name: 'Rare', odds: 0.28, luck: 2, coins: 100 },
  epic: { name: 'Epic', odds: 0.1243, luck: 3, coins: 250 },
  legendary: { name: 'Legendary', odds: 0.045, luck: 4, coins: 600 },
  mythic: { name: 'Mythic', odds: 0.0007, luck: 5, coins: 3000 },
};

/** Stacking relics: +1% luck per copy, up to this many copies. */
export const STACK_MAX = 5;
export const STACK_LUCK = 1;

export interface Relic { id: string; name: string; rarity: RelicRarity; blurb: string; icon: string; /** Stacks (+1% a copy, up to STACK_MAX) instead of paying coins for duplicates. */ stack?: true }
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
  // Commons
  { id: 'benchTowel', name: 'Bench Towel', rarity: 'common', blurb: 'Waved for every three from the corner.', icon: 'jersey' },
  { id: 'headband', name: 'Terry Headband', rarity: 'common', blurb: 'Pulled low for the fourth quarter.', icon: 'heart' },
  { id: 'gameProgram', name: 'Game Program', rarity: 'common', blurb: 'The starting lineups, circled in pen.', icon: 'list' },
  { id: 'foamFinger', name: 'Foam Finger', rarity: 'common', blurb: 'We\'re number one. Probably.', icon: 'up' },
  { id: 'bobblehead', name: 'Giveaway Bobblehead', rarity: 'common', blurb: 'First 10,000 fans. You were 9,998.', icon: 'team' },
  { id: 'mouthguard', name: 'Chewed Mouthguard', rarity: 'common', blurb: 'Hanging out of a mouth on a game-winner.', icon: 'check' },
  { id: 'scoreSheet', name: 'Scorer\'s Sheet', rarity: 'common', blurb: 'Every point, by hand.', icon: 'chart' },
  { id: 'clockBulb', name: 'Shot Clock Bulb', rarity: 'common', blurb: 'Burned out at 0.4 seconds.', icon: 'clock' },
  { id: 'luckyPenny', name: 'Lucky Penny', rarity: 'common', blurb: 'Heads up, found at center court.', icon: 'star', stack: true },
  { id: 'luckySocks', name: 'Lucky Socks', rarity: 'common', blurb: 'Unwashed since the streak began.', icon: 'shoe', stack: true },
  { id: 'paradeConfetti', name: 'Parade Confetti', rarity: 'common', blurb: 'Still finding it in your coat.', icon: 'flame', stack: true },
  { id: 'fanAutograph', name: 'Fan Autograph', rarity: 'common', blurb: 'On a napkin. Still counts.', icon: 'list', stack: true },
  // Rares
  { id: 'pressPass', name: 'Press Pass', rarity: 'rare', blurb: 'Access all areas, one night only.', icon: 'phone' },
  { id: 'lockerPlate', name: 'Locker Nameplate', rarity: 'rare', blurb: 'Pried off when the old arena closed.', icon: 'lock' },
  { id: 'playbook', name: 'Dog-Eared Playbook', rarity: 'rare', blurb: 'Page 42: the play that won it.', icon: 'menu' },
  { id: 'draftCap', name: 'Draft Night Cap', rarity: 'rare', blurb: 'The sticker\'s still on the brim.', icon: 'calendar' },
  { id: 'allStarJersey', name: 'All-Star Jersey', rarity: 'rare', blurb: 'Worn for one weekend, framed forever.', icon: 'jersey' },
  { id: 'tunnelSign', name: 'Tunnel Sign', rarity: 'rare', blurb: 'Touched by every player, every night.', icon: 'warning' },
  { id: 'tipoffBall', name: 'Opening Tip Ball', rarity: 'rare', blurb: 'The first ball of a dynasty season.', icon: 'play' },
  { id: 'signedSneaker', name: 'Signed Sneaker', rarity: 'rare', blurb: 'Just the left one.', icon: 'shoe' },
  { id: 'rookiePack', name: 'Unopened Card Pack', rarity: 'rare', blurb: 'Could be anything in there.', icon: 'list', stack: true },
  { id: 'seasonTicket', name: 'Season Ticket', rarity: 'rare', blurb: 'Forty-one home games of hope.', icon: 'calendar', stack: true },
  { id: 'benchChain', name: 'Bench Mob Chain', rarity: 'rare', blurb: 'Passed down the bench after every big play.', icon: 'team', stack: true },
  // Epics
  { id: 'bentRim', name: 'Bent Dunk Rim', rarity: 'epic', blurb: 'They had to stop the game.', icon: 'court' },
  { id: 'buzzerClock', name: 'Buzzer-Beater Clock', rarity: 'epic', blurb: 'Frozen at 0.0, forever.', icon: 'clock' },
  { id: 'coachTie', name: 'Coach\'s Lucky Tie', rarity: 'epic', blurb: 'Worn for every Game 7.', icon: 'settings' },
  { id: 'allStarMvp', name: 'All-Star MVP Trophy', rarity: 'epic', blurb: 'A Sunday night to remember.', icon: 'trophy' },
  { id: 'streakBall', name: 'Win Streak Ball', rarity: 'epic', blurb: 'Signed after win number 33.', icon: 'flame' },
  { id: 'iceBag', name: 'Ice Veins Bag', rarity: 'epic', blurb: 'Kept the closer cool.', icon: 'ice' },
  { id: 'bannerThread', name: 'Banner Thread', rarity: 'epic', blurb: 'A loose thread from a title banner.', icon: 'trophy', stack: true },
  { id: 'hofBallot', name: 'Hall of Fame Ballot', rarity: 'epic', blurb: 'One vote. It counted.', icon: 'check', stack: true },
  // Legendaries
  { id: 'game7Ball', name: 'Game 7 Ball', rarity: 'legendary', blurb: 'The last ball of the last game.', icon: 'play' },
  { id: 'retiredJersey', name: 'Retired Jersey', rarity: 'legendary', blurb: 'Lowered from the rafters for one night.', icon: 'jersey' },
  { id: 'dynastyRing', name: 'Dynasty Ring', rarity: 'legendary', blurb: 'The third one in a row.', icon: 'crown' },
  { id: 'fluSneakers', name: 'Flu Game Sneakers', rarity: 'legendary', blurb: 'He could barely stand. He scored 38.', icon: 'shoe' },
  { id: 'lastWhiteboard', name: 'Last-Shot Whiteboard', rarity: 'legendary', blurb: 'The X\'s and O\'s of a miracle.', icon: 'chart' },
  { id: 'hofJacket', name: 'Hall of Fame Jacket', rarity: 'legendary', blurb: 'Orange, and earned.', icon: 'jersey', stack: true },
  // Mythics
  { id: 'goldenNet', name: 'The Golden Net', rarity: 'mythic', blurb: 'Every shot through it went in.', icon: 'court' },
  { id: 'firstJumpBall', name: 'The First Jump Ball', rarity: 'mythic', blurb: 'Tossed up before there was a league.', icon: 'up' },
  { id: 'gavel', name: 'The Commissioner\'s Gavel', rarity: 'mythic', blurb: 'It decides everything.', icon: 'settings' },
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
export const MAX_LUCK = 50;

export interface SpinResult { kind: 'relic' | 'secret'; id: string; rarity: RelicRarity | 'secret'; duplicate: boolean; coins: number; /** A stacking relic: copies now held (capped at STACK_MAX). */ stack?: number; /** From a Lucky Spin. */ lucky?: boolean }
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
  /** Upgraded relics (+50% luck). */
  upgraded: string[];
  /** Today's shop: three relics, each bought at most once. */
  shop?: { day: string; offers: string[]; bought: string[] };
  /** Makes your daily shop different from everyone else's. */
  salt?: number;
}

export const RELICS_KEY = 'cv-relics';
export const RELICS_EVENT = 'cv-relics-changed';
const empty = (): RelicState => ({ v: 1, spins: 0, coins: 0, owned: {}, secrets: [], granted: [], history: [], upgraded: [] });

export function loadRelics(read: Read = localRead): RelicState {
  try {
    const r = JSON.parse(read(RELICS_KEY) ?? 'null') as RelicState | null;
    if (r && r.v === 1) return { ...empty(), ...r, owned: r.owned ?? {}, secrets: (r.secrets ?? []).filter(s => SECRET_BY_ID.has(s)), granted: r.granted ?? [], history: r.history ?? [], upgraded: (r.upgraded ?? []).filter(id => RELIC_BY_ID.has(id)) };
  } catch { /* fall through */ }
  return empty();
}
export function saveRelics(s: RelicState): void {
  try { localStorage.setItem(RELICS_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new Event(RELICS_EVENT)); } catch { /* no window (tests) */ }
}

/** Luck from one relic: its rarity's luck (+50% upgraded), or +1% a copy for a stacking relic. */
export function relicLuck(relic: Relic, count: number, upgraded = false): number {
  if (count <= 0) return 0;
  if (relic.stack) return Math.min(count, STACK_MAX) * STACK_LUCK;
  return RELIC_RARITY[relic.rarity].luck * (upgraded ? 1.5 : 1);
}
/** Total luck in percent: each relic counts once (stacking relics per copy, up to five). */
export function luckPercent(s: Pick<RelicState, 'owned'> & { upgraded?: string[] }): number {
  const up = new Set(s.upgraded ?? []);
  const total = Object.entries(s.owned).reduce((n, [id, c]) => { const r = RELIC_BY_ID.get(id); return n + (r ? relicLuck(r, c, up.has(id)) : 0); }, 0);
  return Math.round(Math.min(MAX_LUCK, total) * 10) / 10;
}
/** Can another copy of this relic still add luck? */
export const canGain = (s: Pick<RelicState, 'owned'>, r: Relic) => (s.owned[r.id] ?? 0) < (r.stack ? STACK_MAX : 1);
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

/** A Lucky Spin's odds: no Commons, and Epic, Legendary and Mythic twice as likely (then scaled to 100%). */
export const LUCKY_ODDS: Record<RelicRarity, number> = (() => {
  const raw = { common: 0, rare: RELIC_RARITY.rare.odds, epic: RELIC_RARITY.epic.odds * 2, legendary: RELIC_RARITY.legendary.odds * 2, mythic: RELIC_RARITY.mythic.odds * 2 };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / sum])) as Record<RelicRarity, number>;
})();

/** The rarity a roll lands on (roll in [0, 1)). */
export function rarityFor(roll: number, lucky = false): RelicRarity {
  let acc = 0;
  for (const r of [...RARITY_ORDER].reverse()) { acc += lucky ? LUCKY_ODDS[r] : RELIC_RARITY[r].odds; if (roll < acc) return r; }
  return lucky ? 'rare' : 'common';
}

/** Spends a spin. `rand` is called for the secret check, the rarity and the relic. */
export function spinRelic(state: RelicState, rand: () => number = Math.random): { state: RelicState; result: SpinResult } | null {
  if (state.spins <= 0) return null;
  return roll({ ...state, spins: state.spins - 1 }, rand, false);
}

function roll(state: RelicState, rand: () => number, lucky: boolean): { state: RelicState; result: SpinResult } {
  const lockedSecrets = SECRET_RELICS.filter(r => !state.secrets.includes(r.id));
  let result: SpinResult;
  let next: RelicState = state;
  if (lockedSecrets.length && rand() < SECRET_CHANCE * (lucky ? 2 : 1)) {
    const sec = lockedSecrets[Math.floor(rand() * lockedSecrets.length)];
    result = { kind: 'secret', id: sec.id, rarity: 'secret', duplicate: false, coins: 0 };
    next = { ...next, secrets: [...next.secrets, sec.id] };
  } else {
    const rarity = rarityFor(rand(), lucky);
    const pool = RELICS.filter(r => r.rarity === rarity);
    const relic = pool[Math.floor(rand() * pool.length)] ?? pool[0];
    const duplicate = !canGain(state, relic);
    const coins = duplicate ? RELIC_RARITY[rarity].coins : 0;
    const count = (state.owned[relic.id] ?? 0) + 1;
    result = { kind: 'relic', id: relic.id, rarity, duplicate, coins, ...(relic.stack ? { stack: Math.min(count, STACK_MAX) } : {}) };
    next = { ...next, coins: next.coins + coins, owned: { ...next.owned, [relic.id]: count } };
  }
  if (lucky) result = { ...result, lucky: true };
  next = { ...next, history: [...next.history, { ...result, at: Date.now() }].slice(-50) };
  return { state: next, result };
}

/* ---- The shop: coins buy spins, Lucky Spins, the daily relics and upgrades. ---- */

export const SPIN_PRICE = 200;
export const LUCKY_SPIN_PRICE = 500;
/** Daily-shop prices, Common first and rising with rarity. */
export const RELIC_PRICE: Record<RelicRarity, number> = { common: 750, rare: 1500, epic: 3000, legendary: 6000, mythic: 12000 };
/** Upgrading a relic that doesn't stack: +50% of its luck. */
export const UPGRADE_PRICE: Record<RelicRarity, number> = { common: 300, rare: 600, epic: 1200, legendary: 2500, mythic: 5000 };
export const SHOP_SIZE = 3;
/** How often each rarity shows up in the daily shop. */
const SHOP_WEIGHTS: Record<RelicRarity, number> = { common: 45, rare: 30, epic: 15, legendary: 8, mythic: 2 };

export function buySpin(state: RelicState): RelicState | null {
  if (state.coins < SPIN_PRICE) return null;
  return { ...state, coins: state.coins - SPIN_PRICE, spins: state.spins + 1 };
}
/** Pays for a Lucky Spin and spins it straight away. */
export function luckySpin(state: RelicState, rand: () => number = Math.random): { state: RelicState; result: SpinResult } | null {
  if (state.coins < LUCKY_SPIN_PRICE) return null;
  return roll({ ...state, coins: state.coins - LUCKY_SPIN_PRICE }, rand, true);
}

export const shopDay = (now = new Date()) => now.toISOString().slice(0, 10);
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/** Today's shop (rolled once a day, from relics that can still add luck for you). Returns the same state when current. */
export function refreshShop(state: RelicState, day = shopDay(), rand: () => number = Math.random): RelicState {
  if (state.shop?.day === day) return state;
  const salt = state.salt ?? Math.floor(rand() * 1e9);
  const r = seeded(hash(`${day}:${salt}`));
  const offers: string[] = [];
  for (let tries = 0; offers.length < SHOP_SIZE && tries < 60; tries++) {
    let x = r() * 100, rarity: RelicRarity = 'common';
    for (const k of RARITY_ORDER) { x -= SHOP_WEIGHTS[k]; if (x < 0) { rarity = k; break; } }
    const pool = RELICS.filter(p => p.rarity === rarity && canGain(state, p) && !offers.includes(p.id));
    if (pool.length) offers.push(pool[Math.floor(r() * pool.length)].id);
  }
  return { ...state, salt, shop: { day, offers, bought: [] } };
}
/** Buys one of today's relics. */
export function buyRelic(state: RelicState, id: string): RelicState | null {
  const relic = RELIC_BY_ID.get(id);
  if (!relic || !state.shop?.offers.includes(id) || state.shop.bought.includes(id) || !canGain(state, relic)) return null;
  const price = RELIC_PRICE[relic.rarity];
  if (state.coins < price) return null;
  return { ...state, coins: state.coins - price, owned: { ...state.owned, [id]: (state.owned[id] ?? 0) + 1 }, shop: { ...state.shop, bought: [...state.shop.bought, id] } };
}
export const canUpgrade = (state: RelicState, relic: Relic) => !relic.stack && (state.owned[relic.id] ?? 0) > 0 && !state.upgraded.includes(relic.id);
/** Upgrades a relic you own that doesn't stack: +50% luck. */
export function upgradeRelic(state: RelicState, id: string): RelicState | null {
  const relic = RELIC_BY_ID.get(id);
  if (!relic || !canUpgrade(state, relic) || state.coins < UPGRADE_PRICE[relic.rarity]) return null;
  return { ...state, coins: state.coins - UPGRADE_PRICE[relic.rarity], upgraded: [...state.upgraded, id] };
}

/** How much of the collection you hold. */
export function collectionProgress(s: RelicState): { owned: number; total: number; secrets: number } {
  return { owned: RELICS.filter(r => (s.owned[r.id] ?? 0) > 0).length, total: RELICS.length, secrets: s.secrets.length };
}

/** Good-outcome weight multiplier for spins (1 = no luck): the better rarities get this much more weight. */
export const luckMultiplier = (luck: number | undefined) => 1 + Math.max(0, Math.min(MAX_LUCK / 100, luck ?? 0));
