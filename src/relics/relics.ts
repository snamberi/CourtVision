import { localRead, type Read } from '../lib/kv';

/*
 * Relics: a collection that belongs to you, the player, across every mode. You earn Relic Spins by finishing things
 * (winning a League Hunt, a title in the 82-0 Challenge, a long Survival run, finishing Story Mode, a Career, a
 * Franchise title) and by unlocking achievements. Each spin lands on a relic:
 *
 *   Common 54.87% (+1% luck) · Rare 28% (+2%) · Epic 12.43% (+3%) · Legendary 4.5% (+4%) · Mythic 0.2% (+5%)
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
  common: { name: 'Common', odds: 0.5487, luck: 1, coins: 50 },
  rare: { name: 'Rare', odds: 0.28, luck: 2, coins: 100 },
  epic: { name: 'Epic', odds: 0.1243, luck: 3, coins: 250 },
  legendary: { name: 'Legendary', odds: 0.045, luck: 4, coins: 600 },
  mythic: { name: 'Mythic', odds: 0.002, luck: 5, coins: 3000 },
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
export interface SecretRelic { id: SecretId; name: string; mode: string; ability: string; /** Shown while it's still hidden. */ hint: string; /** A feat that uncovers it (besides luck). */ feat?: string }
export const SECRET_RELICS: SecretRelic[] = [
  { id: 'eternalSpin', name: 'The Eternal Spin', mode: 'Career Mode', ability: 'Always +1 respin on the Career wheel.', hint: 'Voted in on the first ballot, the wheel turns once more.', feat: 'Retire a first-ballot Hall of Famer in Career Mode.' },
  { id: 'secondWind', name: 'Second Wind', mode: 'League Hunt', ability: 'Start every hunt with one extra life.', hint: 'Survive the hardest road and you breathe twice.', feat: 'Win a League Hunt on Legend.' },
  { id: 'goldenTouch', name: 'Golden Touch', mode: 'League Hunt', ability: 'Start every hunt with 30 extra coins.', hint: 'Only luck finds the hand that turns leather to gold.' },
  { id: 'ironWill', name: 'Iron Will', mode: 'Survival', ability: 'Start every Survival run with one extra Shield.', hint: 'Fifteen times they came for your best. Fifteen times you stood.', feat: 'Win 15 rounds in one Survival run.' },
  { id: 'extraPick', name: 'The Extra Pick', mode: '82-0 Challenge', ability: 'One extra reroll in every 82-0 run.', hint: 'Eighty-two up, none down, and a pick to spare.', feat: 'Finish an 82-0 regular season.' },
  { id: 'clutchGene', name: 'The Clutch Gene', mode: 'Story Mode', ability: 'Your story player starts with +2 grit.', hint: 'From the park with no nets to a legend\'s ending.', feat: 'Reach the legend ending in Story Mode.' },
  { id: 'ownersFavorite', name: 'Owner\'s Favorite', mode: 'Franchise', ability: 'The owner\'s demands ask for one fewer win.', hint: 'Luck alone gets you a seat in the owner\'s box.' },
  { id: 'lastLook', name: 'The Last Look', mode: 'Daily Grid', ability: 'One extra guess on Endless grids.', hint: 'Luck alone gives you one more look at the board.' },
];
export const SECRET_BY_ID = new Map(SECRET_RELICS.map(r => [r.id, r]));
/** The chance any spin uncovers a secret relic you don't have yet (rarer than a Mythic: a secret is a permanent ability). */
export const SECRET_CHANCE = 0.0007;
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
  /** Relics in your slots: only these add luck. */
  equipped: string[];
  /** Extra slots bought with coins (0 to EXTRA_SLOTS). */
  slotsBought: number;
  /** Spins since the last Epic, Legendary and Mythic (or better), and Lucky Spins bought. */
  pity: { epic: number; legendary: number; mythic: number; lucky: number };
  /** Spins opened, ever. */
  opens: number;
  /** The one-time hidden secret guarantee has been used. */
  secretPityDone?: boolean;
  /** Where coins came from and went. Newest last. */
  ledger: { at: number; amount: number; why: string }[];
  /** Earned before relics existed: paid as coins once, spins after that. */
  achSeeded?: boolean;
  /** The last day the daily coins were collected. */
  dailyCoins?: string;
  /** Rewards from finished runs, for the end screens. */
  rewards: { key: string; spins: number; coins: number; secret?: SecretId }[];
}

export const RELICS_KEY = 'cv-relics';
export const RELICS_EVENT = 'cv-relics-changed';
/** Set before opening the vault to land on a section (read once, from sessionStorage). */
export const RELICS_FOCUS_KEY = 'cv-relics-focus';
/** The day the vault (and its daily shop) was last opened: the phone's Shop dot. */
export const SHOP_SEEN_KEY = 'cv-shop-seen';
const empty = (): RelicState => ({ v: 1, spins: 0, coins: 0, owned: {}, secrets: [], granted: [], history: [], upgraded: [], equipped: [], slotsBought: 0, pity: { epic: 0, legendary: 0, mythic: 0, lucky: 0 }, opens: 0, ledger: [], rewards: [] });

export function loadRelics(read: Read = localRead): RelicState {
  try {
    const r = JSON.parse(read(RELICS_KEY) ?? 'null') as RelicState | null;
    if (r && r.v === 1) {
      const base: RelicState = { ...empty(), ...r, owned: r.owned ?? {}, secrets: (r.secrets ?? []).filter(s => SECRET_BY_ID.has(s)), granted: r.granted ?? [], history: r.history ?? [],
        upgraded: (r.upgraded ?? []).filter(id => RELIC_BY_ID.has(id)), pity: { ...empty().pity, ...r.pity }, ledger: r.ledger ?? [], rewards: r.rewards ?? [], slotsBought: Math.max(0, Math.min(EXTRA_SLOTS, r.slotsBought ?? 0)), opens: r.opens ?? 0, equipped: [] };
      // Saves from before slots: the best relics you own go in.
      return { ...base, equipped: Array.isArray(r.equipped) ? r.equipped.filter(id => (base.owned[id] ?? 0) > 0 && RELIC_BY_ID.has(id)).slice(0, slotCount(base)) : autoEquip(base) };
    }
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
/* ---- Slots: only the relics in your slots add luck. Ten to start, five more to buy. ---- */

export const BASE_SLOTS = 10;
export const EXTRA_SLOTS = 5;
/** Prices of the 11th to 15th slots. */
export const SLOT_PRICES = [1000, 2000, 3500, 5000, 8000];
export const slotCount = (s: Pick<RelicState, 'slotsBought'>) => BASE_SLOTS + Math.max(0, Math.min(EXTRA_SLOTS, s.slotsBought ?? 0));
type LuckView = Pick<RelicState, 'owned'> & { upgraded?: string[]; equipped?: string[]; slotsBought?: number };
const luckOf = (s: LuckView, id: string) => { const r = RELIC_BY_ID.get(id); return r ? relicLuck(r, s.owned[id] ?? 0, (s.upgraded ?? []).includes(id)) : 0; };
/** The best relics you own, as many as fit. */
export function autoEquip(s: LuckView): string[] {
  return Object.keys(s.owned).filter(id => (s.owned[id] ?? 0) > 0 && RELIC_BY_ID.has(id)).sort((a, b) => luckOf(s, b) - luckOf(s, a)).slice(0, slotCount({ slotsBought: s.slotsBought ?? 0 }));
}
export function buySlot(state: RelicState): RelicState | null {
  if (state.slotsBought >= EXTRA_SLOTS) return null;
  const price = SLOT_PRICES[state.slotsBought];
  if (state.coins < price) return null;
  const next = spend({ ...state, slotsBought: state.slotsBought + 1 }, price, `Relic slot ${BASE_SLOTS + state.slotsBought + 1}`);
  // The new slot takes your best relic that isn't in one yet.
  const spare = autoEquip({ ...next, slotsBought: EXTRA_SLOTS }).find(id => !next.equipped.includes(id));
  return spare ? { ...next, equipped: [...next.equipped, spare] } : next;
}
export function equipRelic(state: RelicState, id: string): RelicState | null {
  if (!(state.owned[id] > 0) || state.equipped.includes(id) || state.equipped.length >= slotCount(state)) return null;
  return { ...state, equipped: [...state.equipped, id] };
}
export const unequipRelic = (state: RelicState, id: string): RelicState => ({ ...state, equipped: state.equipped.filter(x => x !== id) });
/** Puts a newly found relic in a free slot. */
const fillSlot = (s: RelicState, id: string): RelicState => (s.equipped.includes(id) || s.equipped.length >= slotCount(s) ? s : { ...s, equipped: [...s.equipped, id] });

/* ---- Sets: hold every relic in a set for bonus luck. ---- */

export interface RelicSet { id: string; name: string; relics: string[]; bonus: number }
export const RELIC_SETS: RelicSet[] = [
  { id: 'finalsNight', name: 'Finals Night', relics: ['game7Ball', 'champagne', 'buzzerClock', 'paradeConfetti'], bonus: 2 },
  { id: 'streetBall', name: 'Street Ball', relics: ['netScrap', 'chalkBag', 'wristband', 'mouthguard', 'luckySocks'], bonus: 2 },
  { id: 'oldArena', name: 'The Old Arena', relics: ['floorboard', 'lockerPlate', 'tunnelSign', 'clockBulb', 'ticketStub'], bonus: 2 },
  { id: 'draftDay', name: 'Draft Day', relics: ['draftCap', 'rookieCard', 'rookiePack', 'scoutNotes'], bonus: 2 },
  { id: 'coachesRoom', name: 'The Coaches\' Room', relics: ['clipboard', 'playbook', 'coachTie', 'lastWhiteboard', 'whistle'], bonus: 2 },
  { id: 'hallOfFame', name: 'Hall of Fame', relics: ['hofBallot', 'hofJacket', 'retiredJersey', 'banner', 'mvpBall'], bonus: 3 },
  { id: 'origins', name: 'Origins', relics: ['firstBall', 'peachBasket', 'firstJumpBall'], bonus: 5 },
];
export const setComplete = (s: Pick<RelicState, 'owned'>, set: RelicSet) => set.relics.every(id => (s.owned[id] ?? 0) > 0);
export const setBonus = (s: Pick<RelicState, 'owned'>) => RELIC_SETS.reduce((n, set) => n + (setComplete(s, set) ? set.bonus : 0), 0);

/** Total luck in percent: the relics in your slots (stacking relics per copy, up to five), plus complete sets. */
export function luckPercent(s: LuckView): number {
  const active = s.equipped ?? autoEquip(s);
  const total = active.reduce((n, id) => n + luckOf(s, id), 0) + setBonus(s);
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
/** Grants and saves in one go. */
export function awardSpins(key: string, n = 1, read: Read = localRead): number {
  const before = loadRelics(read);
  const after = grantSpins(before, key, n);
  if (after !== before) saveRelics(after);
  return after.spins - before.spins;
}

/** A finished run's reward: spins, coins and maybe a secret relic for a feat. Pays once per key. */
export function grantReward(state: RelicState, key: string, r: { spins: number; coins: number; secret?: SecretId; why?: string }): RelicState {
  if (state.granted.includes(key)) return state;
  const secret = r.secret && !state.secrets.includes(r.secret) ? r.secret : undefined;
  let s: RelicState = { ...state, spins: state.spins + Math.max(0, r.spins), granted: [...state.granted, key].slice(-2000) };
  s = earn(s, r.coins, r.why ?? 'Run reward');
  if (secret) s = { ...s, secrets: [...s.secrets, secret] };
  return { ...s, rewards: [...s.rewards, { key, spins: Math.max(0, r.spins), coins: r.coins, ...(secret ? { secret } : {}) }].slice(-20) };
}
/** What a run paid (for its end screen). */
export const rewardOf = (s: RelicState, key: string) => s.rewards.find(r => r.key === key);

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

/* ---- Coins ---- */

const LEDGER_MAX = 40;
export const earn = (s: RelicState, amount: number, why: string): RelicState => (amount <= 0 ? s : { ...s, coins: s.coins + amount, ledger: [...s.ledger, { at: Date.now(), amount, why }].slice(-LEDGER_MAX) });
const spend = (s: RelicState, amount: number, why: string): RelicState => ({ ...s, coins: s.coins - amount, ledger: [...s.ledger, { at: Date.now(), amount: -amount, why }].slice(-LEDGER_MAX) });
export const DAILY_COINS = 25;
/** The daily coins, once a day. */
export function collectDailyCoins(state: RelicState, day = new Date().toISOString().slice(0, 10)): RelicState {
  if (state.dailyCoins === day) return state;
  return { ...earn(state, DAILY_COINS, 'Daily visit'), dailyCoins: day };
}

/* ---- Pity: unlucky streaks end. ---- */

/** A spin that hasn't landed this rarity (or better) in this many spins lands it. */
export const PITY: { epic: number; legendary: number; mythic: number } = { epic: 10, legendary: 50, mythic: 200 };
/** Every this-many-th Lucky Spin lands Legendary or better. */
export const LUCKY_PITY = 10;
/** The one-time hidden guarantee: the 50th spin you ever open uncovers a secret relic. Not shown anywhere. */
const SECRET_PITY_AT = 50;
const RANK: Record<RelicRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
function withPity(state: RelicState, rarity: RelicRarity, lucky: boolean): RelicRarity {
  const p = state.pity;
  if (p.mythic + 1 >= PITY.mythic) return 'mythic';
  let r = rarity;
  if (lucky && (p.lucky + 1) % LUCKY_PITY === 0 && RANK[r] < RANK.legendary) r = 'legendary';
  if (p.legendary + 1 >= PITY.legendary && RANK[r] < RANK.legendary) r = 'legendary';
  if (p.epic + 1 >= PITY.epic && RANK[r] < RANK.epic) r = 'epic';
  return r;
}
const nextPity = (p: RelicState['pity'], landed: RelicRarity | null, lucky: boolean): RelicState['pity'] => {
  const k = landed ? RANK[landed] : -1;
  return { epic: k >= RANK.epic ? 0 : p.epic + 1, legendary: k >= RANK.legendary ? 0 : p.legendary + 1, mythic: k >= RANK.mythic ? 0 : p.mythic + 1, lucky: p.lucky + (lucky ? 1 : 0) };
};

/** Spends a spin. `rand` is called for the secret check, the rarity and the relic. */
export function spinRelic(state: RelicState, rand: () => number = Math.random): { state: RelicState; result: SpinResult } | null {
  if (state.spins <= 0) return null;
  return roll({ ...state, spins: state.spins - 1 }, rand, false);
}

function roll(state: RelicState, rand: () => number, lucky: boolean): { state: RelicState; result: SpinResult } {
  const lockedSecrets = SECRET_RELICS.filter(r => !state.secrets.includes(r.id));
  const opens = state.opens + 1;
  const secretPity = !state.secretPityDone && opens >= SECRET_PITY_AT && lockedSecrets.length > 0;
  let result: SpinResult;
  let next: RelicState = { ...state, opens, ...(secretPity ? { secretPityDone: true } : {}) };
  if (lockedSecrets.length && (secretPity || rand() < SECRET_CHANCE * (lucky ? 2 : 1))) {
    const sec = lockedSecrets[Math.floor(rand() * lockedSecrets.length)] ?? lockedSecrets[0];
    result = { kind: 'secret', id: sec.id, rarity: 'secret', duplicate: false, coins: 0 };
    next = { ...next, secrets: [...next.secrets, sec.id], pity: nextPity(next.pity, null, lucky) };
  } else {
    const rarity = withPity(state, rarityFor(rand(), lucky), lucky);
    const pool = RELICS.filter(r => r.rarity === rarity);
    const relic = pool[Math.floor(rand() * pool.length)] ?? pool[0];
    const duplicate = !canGain(state, relic);
    const coins = duplicate ? RELIC_RARITY[rarity].coins : 0;
    const count = (state.owned[relic.id] ?? 0) + 1;
    result = { kind: 'relic', id: relic.id, rarity, duplicate, coins, ...(relic.stack ? { stack: Math.min(count, STACK_MAX) } : {}) };
    next = fillSlot({ ...earn(next, coins, `Duplicate ${relic.name}`), owned: { ...next.owned, [relic.id]: count }, pity: nextPity(next.pity, rarity, lucky) }, relic.id);
  }
  if (lucky) result = { ...result, lucky: true };
  next = { ...next, history: [...next.history, { ...result, at: Date.now() }].slice(-50) };
  return { state: next, result };
}

/** Opens up to `n` spins in a row. */
export function spinMany(state: RelicState, n: number, rand: () => number = Math.random): { state: RelicState; results: SpinResult[] } {
  let s = state; const results: SpinResult[] = [];
  for (let i = 0; i < n; i++) { const out = spinRelic(s, rand); if (!out) break; s = out.state; results.push(out.result); }
  return { state: s, results };
}

/* ---- The shop: coins buy spins, Lucky Spins, the daily relics and upgrades. ---- */

export const SPIN_PRICE = 200;
export const LUCKY_SPIN_PRICE = 500;
/** Daily-shop prices, Common first and rising with rarity. */
export const RELIC_PRICE: Record<RelicRarity, number> = { common: 750, rare: 1500, epic: 3000, legendary: 6000, mythic: 12000 };
/** Upgrading a relic that doesn't stack: +50% of its luck. */
export const UPGRADE_PRICE: Record<RelicRarity, number> = { common: 150, rare: 600, epic: 1200, legendary: 2500, mythic: 5000 };
export const SHOP_SIZE = 3;
/** How often each rarity shows up in the daily shop. */
const SHOP_WEIGHTS: Record<RelicRarity, number> = { common: 45, rare: 30, epic: 15, legendary: 8, mythic: 2 };

export function buySpin(state: RelicState): RelicState | null {
  if (state.coins < SPIN_PRICE) return null;
  return spend({ ...state, spins: state.spins + 1 }, SPIN_PRICE, 'Relic Spin');
}
/** Pays for a Lucky Spin and spins it straight away. */
export function luckySpin(state: RelicState, rand: () => number = Math.random): { state: RelicState; result: SpinResult } | null {
  if (state.coins < LUCKY_SPIN_PRICE) return null;
  return roll(spend(state, LUCKY_SPIN_PRICE, 'Lucky Spin'), rand, true);
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
  return fillSlot({ ...spend(state, price, relic.name), owned: { ...state.owned, [id]: (state.owned[id] ?? 0) + 1 }, shop: { ...state.shop, bought: [...state.shop.bought, id] } }, id);
}
export const canUpgrade = (state: RelicState, relic: Relic) => !relic.stack && (state.owned[relic.id] ?? 0) > 0 && !state.upgraded.includes(relic.id);
/** Upgrades a relic you own that doesn't stack: +50% luck. */
export function upgradeRelic(state: RelicState, id: string): RelicState | null {
  const relic = RELIC_BY_ID.get(id);
  if (!relic || !canUpgrade(state, relic) || state.coins < UPGRADE_PRICE[relic.rarity]) return null;
  return { ...spend(state, UPGRADE_PRICE[relic.rarity], `Upgrade ${relic.name}`), upgraded: [...state.upgraded, id] };
}

/**
 * Two copies of the vault (this device and the cloud): the collection is a union (the most copies of each relic,
 * every secret, upgrade and paid reward), while spins, coins, slots, pity and the shop come from the copy that has
 * done more, so nothing can be spent twice.
 */
export function mergeRelics(a: RelicState, b: RelicState): RelicState {
  const progress = (s: RelicState) => s.opens * 4 + s.granted.length * 2 + s.ledger.length;
  const [base, other] = progress(b) > progress(a) ? [b, a] : [a, b];
  const owned: Record<string, number> = { ...other.owned };
  for (const [id, n] of Object.entries(base.owned)) owned[id] = Math.max(n, owned[id] ?? 0);
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  const merged: RelicState = { ...base, owned, secrets: uniq([...base.secrets, ...other.secrets]), granted: uniq([...base.granted, ...other.granted]).slice(-2000),
    upgraded: uniq([...base.upgraded, ...other.upgraded]), opens: Math.max(a.opens, b.opens), secretPityDone: !!(a.secretPityDone || b.secretPityDone), achSeeded: !!(a.achSeeded || b.achSeeded) };
  return { ...merged, equipped: merged.equipped.filter(id => (owned[id] ?? 0) > 0).slice(0, slotCount(merged)) };
}

/** How much of the collection you hold. */
export function collectionProgress(s: RelicState): { owned: number; total: number; secrets: number } {
  return { owned: RELICS.filter(r => (s.owned[r.id] ?? 0) > 0).length, total: RELICS.length, secrets: s.secrets.length };
}

/** Good-outcome weight multiplier for spins (1 = no luck): the better rarities get this much more weight. */
export const luckMultiplier = (luck: number | undefined) => 1 + Math.max(0, Math.min(MAX_LUCK / 100, luck ?? 0));
