import { localRead, type Read } from '../lib/kv';
import { HAIR_STYLES, BEARD_STYLES, HAT_STYLES } from '../visuals/playerSprite';
import type { Rule } from './cosmetics';
import { REAL_FRANCHISES } from './favorites';

/*
 * Your character: a pixel player everyone gets (random on the first visit) and can dress however they like on the
 * Profile tab. Ten categories: body colour, hair, hair colour, beard, outfit (50 of them), headwear, eyewear, neck and
 * back, shoes and aura. The everyday pieces are open to everyone; the rest open with levels and on the Trophy Road
 * (the anime-inspired outfits, wild colours and auras). Nothing here changes a result.
 *
 * The renderer is src/visuals/avatarSprite.ts; the Trophy Road lists its avatar stops in TROPHY_ROAD ('avatar').
 */

export type AvatarCategory = 'skin' | 'hair' | 'hairColor' | 'beard' | 'outfit' | 'hat' | 'eyes' | 'neck' | 'shoes' | 'aura';
export interface AvatarLook { skin: string; hair: string; hairColor: string; beard: string; outfit: string; hat: string; eyes: string; neck: string; shoes: string; aura: string;
  /** A jersey's team (a real franchise id: its colours) and number; leave out for the jersey's own. */
  kitTeam?: string; kitNumber?: number }
export interface AvatarItem { id: string; name: string; rule: Rule; /** Colour for colour items (#rrggbb, or 'rainbow'). */ hex?: string; tag?: string }

export const AVATAR_KEY = 'cv-avatar';
export const AVATAR_EVENT = 'courtvision:avatar';
export const RAINBOW = ['#ff4d4d', '#ff9d3d', '#ffd166', '#6fdc93', '#4fd6d6', '#6db8ff', '#b983ff', '#ff6fd8'];

const FREE: Rule = { level: 1 };
/** Game Owner only (see ownerAccess.ts): hidden from everyone else. */
const OWNER: Rule = { staff: true };
const lv = (level: number): Rule => ({ level });
/** Trophy Road stops for the character (see TROPHY_ROAD in trophyRoad.ts: the two lists are kept in step by a test). */
export const AVATAR_TROPHY_ROAD: [number, AvatarCategory, string][] = [
  [5_000, 'outfit', 'gi'], [10_000, 'hat', 'ninjaBand'], [15_000, 'outfit', 'ninja'], [20_000, 'aura', 'fire'],
  [25_000, 'hat', 'strawHat'], [30_000, 'outfit', 'pirate'], [35_000, 'skin', 'green'], [40_000, 'hair', 'superSpikes'],
  [45_000, 'outfit', 'scout'], [50_000, 'aura', 'golden'], [55_000, 'outfit', 'haori'], [60_000, 'eyes', 'scouter'],
  [65_000, 'outfit', 'gakuran'], [70_000, 'skin', 'red'], [75_000, 'outfit', 'hero'], [80_000, 'neck', 'scarf'],
  [85_000, 'outfit', 'plugsuit'], [90_000, 'aura', 'lightning'], [95_000, 'outfit', 'cloudrobe'], [100_000, 'hairColor', 'rainbow'],
  [105_000, 'outfit', 'kimono'], [110_000, 'skin', 'blue'], [115_000, 'outfit', 'sailor'], [120_000, 'eyes', 'glowRed'],
  [125_000, 'outfit', 'captain'], [130_000, 'aura', 'shadow'], [135_000, 'outfit', 'flamecloak'], [140_000, 'neck', 'angelWings'],
  [145_000, 'outfit', 'royal'], [150_000, 'skin', 'gold'], [155_000, 'outfit', 'wizard'], [160_000, 'aura', 'cosmic'],
  [165_000, 'shoes', 'rocket'], [170_000, 'neck', 'batWings'], [175_000, 'hat', 'halo'], [180_000, 'aura', 'rainbow'],
  [185_000, 'eyes', 'sparkle'], [190_000, 'hair', 'flowingLong'], [195_000, 'neck', 'jetpack'], [200_000, 'skin', 'rainbow'],
  // Past 200,000: a stop every 50,000.
  [250_000, 'hair', 'spikyWarrior'], [300_000, 'outfit', 'warriorArmor'], [350_000, 'neck', 'tail'], [400_000, 'hair', 'flameWarrior'],
  [450_000, 'neck', 'weightedCape'], [550_000, 'shoes', 'warriorBoots'], [650_000, 'hairColor', 'superBlue'], [750_000, 'aura', 'superWarrior'],
  // Anime and TV-inspired pieces, sharing stops with the rewards above.
  [10_000, 'hair', 'spikyNinja'], [25_000, 'outfit', 'trainer'], [40_000, 'eyes', 'starEyes'], [55_000, 'outfit', 'arcade80s'],
  [70_000, 'hat', 'foxMask'], [85_000, 'outfit', 'contestant'], [100_000, 'hat', 'guardMask'], [105_000, 'outfit', 'guard'],
  [120_000, 'outfit', 'demonHunter'], [125_000, 'neck', 'katana'], [140_000, 'eyes', 'sharingan'], [160_000, 'outfit', 'webHero'],
  [180_000, 'aura', 'sakura'], [200_000, 'outfit', 'soulReaper'], [500_000, 'hair', 'sorcererSpikes'], [600_000, 'eyes', 'blindfold'],
  [700_000, 'aura', 'cursed'],
];
/** Level Road stops for the character, past level 250 (LEVEL_ROAD in cosmetics.ts lists them). */
export const AVATAR_LEVEL_ROAD: [number, AvatarCategory, string][] = [
  [350, 'outfit', 'gi-blue'], [450, 'hairColor', 'ember'], [500, 'aura', 'storm'], [550, 'neck', 'capeGold'],
  [600, 'outfit', 'gi-black'], [650, 'hairColor', 'platinumGlow'], [750, 'skin', 'diamond'],
];
const road = (cat: AvatarCategory, id: string): Rule | undefined => {
  const hit = AVATAR_TROPHY_ROAD.find(([, c, i]) => c === cat && i === id);
  if (hit) return { trophies: hit[0] };
  const lvl = AVATAR_LEVEL_ROAD.find(([, c, i]) => c === cat && i === id);
  return lvl ? { level: lvl[0] } : undefined;
};
const item = (cat: AvatarCategory, id: string, name: string, rule: Rule = FREE, extra: Partial<AvatarItem> = {}): AvatarItem => ({ id, name, rule: road(cat, id) ?? rule, ...extra });

// ---------------------------------------------------------------- body and hair colours

export const SKINS: AvatarItem[] = [
  ...[['s1', 'Light', '#f2c9a0'], ['s2', 'Fair', '#ffe0bd'], ['s3', 'Tan', '#d9a066'], ['s4', 'Golden', '#c68a5a'], ['s5', 'Brown', '#a86b3c'],
    ['s6', 'Deep brown', '#8d5a34'], ['s7', 'Dark', '#5c3a21'], ['s8', 'Deepest', '#3d2616']].map(([id, name, hex]) => item('skin', id, name, FREE, { hex })),
  item('skin', 'pink', 'Bubblegum', lv(20), { hex: '#ff9fc8' }), item('skin', 'purple', 'Violet', lv(40), { hex: '#9a6bff' }),
  item('skin', 'zombie', 'Zombie', lv(60), { hex: '#8fbf6a' }), item('skin', 'ghost', 'Ghost white', lv(80), { hex: '#eef2f8' }),
  item('skin', 'shadow', 'Shadow', lv(100), { hex: '#3a3450' }), item('skin', 'teal', 'Alien teal', lv(125), { hex: '#3fc1c9' }),
  item('skin', 'silver', 'Chrome', lv(150), { hex: '#c9d1dc' }), item('skin', 'lava', 'Lava', lv(175), { hex: '#ff6b2d' }),
  item('skin', 'green', 'Green', FREE, { hex: '#4fbf5f' }), item('skin', 'red', 'Red', FREE, { hex: '#e04848' }),
  item('skin', 'blue', 'Blue', FREE, { hex: '#4a86e8' }), item('skin', 'gold', 'Solid gold', FREE, { hex: '#f2c230' }),
  item('skin', 'rainbow', 'Rainbow', FREE, { hex: 'rainbow' }),
  item('skin', 'diamond', 'Diamond', FREE, { hex: '#bfe9ff' }),
  item('skin', 'abyss', 'Abyss blue', OWNER, { hex: '#1a2a78' }),
];

export const HAIR_COLORS: AvatarItem[] = [
  ...[['black', 'Black', '#0b0b0b'], ['dark', 'Dark brown', '#2b1a10'], ['brown', 'Brown', '#5a3a1a'], ['blonde', 'Blonde', '#d8b25a'],
    ['gray', 'Gray', '#8a8a8a'], ['auburn', 'Auburn', '#8a3a1a'], ['platinum', 'Platinum', '#e8e4d8'], ['white', 'White', '#f4f4f4']].map(([id, name, hex]) => item('hairColor', id, name, FREE, { hex })),
  item('hairColor', 'red', 'Fire red', lv(10), { hex: '#e8322e' }), item('hairColor', 'orange', 'Orange', lv(15), { hex: '#ff8a1f' }),
  item('hairColor', 'pink', 'Pink', lv(25), { hex: '#ff6fb8' }), item('hairColor', 'blue', 'Blue', lv(35), { hex: '#3f7bff' }),
  item('hairColor', 'green', 'Green', lv(45), { hex: '#36c25a' }), item('hairColor', 'purple', 'Purple', lv(55), { hex: '#8e4fe0' }),
  item('hairColor', 'cyan', 'Cyan', lv(70), { hex: '#2fd6e6' }), item('hairColor', 'super', 'Super gold', lv(90), { hex: '#ffe14d' }),
  item('hairColor', 'silver', 'Silver', lv(110), { hex: '#c9d1dc' }), item('hairColor', 'rainbow', 'Rainbow', FREE, { hex: 'rainbow' }),
  item('hairColor', 'superBlue', 'Super blue', FREE, { hex: '#3fc8ff' }), item('hairColor', 'ember', 'Ember', FREE, { hex: '#ff5a1f' }), item('hairColor', 'platinumGlow', 'Platinum glow', FREE, { hex: '#fff4c9' }),
  item('hairColor', 'blueFire', 'Blue fire', OWNER, { hex: '#3fa9ff' }),
];

// ---------------------------------------------------------------- hair and beards

const LABEL = (id: string) => id.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).replace(/X L$/, 'XL');
/** The new styles the character adds to the 25 every player can have. */
export const NEW_HAIR = ['spikyWarrior', 'flameWarrior', 'superSpikes', 'wildSpikes', 'longStraight', 'ponytail', 'topknot', 'spaceBuns', 'twinTails', 'sideSwept', 'pompadour', 'bowlCut', 'punkSpikes', 'flowingLong', 'spikyNinja', 'sorcererSpikes'] as const;
const HAIR_NAMES: Record<string, string> = { superSpikes: 'Super spikes', spikyWarrior: 'Spiky warrior hair', flameWarrior: "Prince's flame hair", spikyNinja: 'Spiky ninja hair', sorcererSpikes: 'Sorcerer spikes' };
const HAIR_LEVELS: Record<string, number> = { wildSpikes: 30, longStraight: 20, ponytail: 12, topknot: 65, spaceBuns: 50, twinTails: 75, sideSwept: 8, pompadour: 40, bowlCut: 5, punkSpikes: 85 };
export const HAIRS: AvatarItem[] = [
  ...HAIR_STYLES.map(id => item('hair', id, LABEL(id))),
  ...NEW_HAIR.map(id => item('hair', id, HAIR_NAMES[id] ?? LABEL(id), lv(HAIR_LEVELS[id] ?? 1))),
  item('hair', 'sovereignFlame', 'Sovereign flame', OWNER),
];
export const NEW_BEARDS = ['wizard', 'viking', 'handlebar', 'sideburns', 'flameBeard'] as const;
const BEARD_LEVELS: Record<string, number> = { wizard: 120, viking: 95, handlebar: 35, sideburns: 18, flameBeard: 140 };
export const BEARDS: AvatarItem[] = [
  ...BEARD_STYLES.map(id => item('beard', id, id === 'none' ? 'Clean shaven' : LABEL(id))),
  ...NEW_BEARDS.map(id => item('beard', id, id === 'flameBeard' ? 'Flame beard' : id === 'wizard' ? 'Wizard beard' : id === 'viking' ? 'Viking braids' : LABEL(id), lv(BEARD_LEVELS[id]))),
  item('beard', 'stardust', 'Stardust', OWNER),
];

// ---------------------------------------------------------------- outfits (50)

export type OutfitKind = 'warriorArmor' | 'jersey' | 'tee' | 'hoodie' | 'track' | 'suit' | 'tux' | 'varsity' | 'overalls' | 'labcoat' | 'chef' | 'referee' | 'hawaiian' | 'santa' | 'astronaut' | 'armor'
  | 'contestant' | 'guard' | 'webHero' | 'capedHero' | 'soulReaper' | 'demonHunter' | 'sorcerer' | 'airNomad' | 'arcade80s' | 'trainer'
  | 'gi' | 'ninja' | 'pirate' | 'scout' | 'haori' | 'gakuran' | 'hero' | 'plugsuit' | 'cloudrobe' | 'kimono' | 'sailor' | 'captain' | 'flamecloak' | 'royal' | 'wizard';
export interface Outfit extends AvatarItem { kind: OutfitKind; main: string; trim: string; number?: number; style?: 'classic' | 'stripe' | 'split' }
const fit = (id: string, name: string, kind: OutfitKind, main: string, trim: string, rule: Rule = FREE, extra: Partial<Outfit> = {}): Outfit => ({ ...item('outfit', id, name, rule), kind, main, trim, ...extra });
export const OUTFITS: Outfit[] = [
  // Jerseys: "Your team" wears your favourite team's colours.
  fit('jersey-fav', 'Your team jersey', 'jersey', '#f47b20', '#f4f0e6', FREE, { number: 23 }),
  fit('jersey-red', 'Red jersey', 'jersey', '#c8102e', '#f4f0e6', FREE, { number: 1 }), fit('jersey-blue', 'Blue jersey', 'jersey', '#1d428a', '#ffc72c', FREE, { number: 30, style: 'stripe' }),
  fit('jersey-green', 'Green jersey', 'jersey', '#007a33', '#f4f0e6', FREE, { number: 33 }), fit('jersey-purple', 'Purple jersey', 'jersey', '#552583', '#fdb927', FREE, { number: 24, style: 'split' }),
  fit('jersey-black', 'Black jersey', 'jersey', '#1a1f2a', '#e85d5d', FREE, { number: 0 }), fit('jersey-white', 'Home whites', 'jersey', '#f4f0e6', '#1d428a', FREE, { number: 11 }),
  fit('jersey-gold', 'Gold jersey', 'jersey', '#ffd166', '#1a1f2a', lv(100), { number: 99, style: 'stripe' }),
  // Everyday.
  fit('tee-white', 'White tee', 'tee', '#f4f0e6', '#3b5b8f'), fit('tee-black', 'Black tee', 'tee', '#1f2430', '#3b5b8f'), fit('tee-red', 'Red tee', 'tee', '#d33a3a', '#2b2f3a'),
  fit('tee-blue', 'Blue tee', 'tee', '#3f7bd9', '#2b2f3a'), fit('tee-green', 'Green tee', 'tee', '#3fae5f', '#3b5b8f'),
  fit('hoodie-gray', 'Gray hoodie', 'hoodie', '#8a93a3', '#2b2f3a'), fit('hoodie-black', 'Black hoodie', 'hoodie', '#22262f', '#2b2f3a'), fit('hoodie-orange', 'Orange hoodie', 'hoodie', '#f47b20', '#2b2f3a'),
  fit('hoodie-navy', 'Navy hoodie', 'hoodie', '#1f3566', '#8a93a3'), fit('hoodie-pink', 'Pink hoodie', 'hoodie', '#ff8fc8', '#2b2f3a'),
  fit('track-red', 'Red tracksuit', 'track', '#c8102e', '#f4f0e6'), fit('track-blue', 'Blue tracksuit', 'track', '#1d428a', '#f4f0e6'), fit('track-black', 'Black tracksuit', 'track', '#1a1f2a', '#ffd166'),
  // Levels.
  fit('suit-navy', 'Navy suit', 'suit', '#1f2f55', '#c8102e', lv(10)), fit('suit-charcoal', 'Charcoal suit', 'suit', '#3a3f4a', '#ffd166', lv(30)), fit('tux', 'Tuxedo', 'tux', '#12151c', '#f4f0e6', lv(60)),
  fit('varsity-red', 'Red varsity jacket', 'varsity', '#b0122a', '#f4f0e6', lv(15)), fit('varsity-blue', 'Blue varsity jacket', 'varsity', '#1d428a', '#f4f0e6', lv(25)), fit('varsity-green', 'Green varsity jacket', 'varsity', '#0b6b3a', '#f2d27a', lv(45)),
  fit('overalls', 'Overalls', 'overalls', '#3b6db3', '#d33a3a', lv(20)), fit('labcoat', 'Lab coat', 'labcoat', '#f4f6fa', '#3f7bd9', lv(35)),
  fit('chef', 'Chef whites', 'chef', '#f4f6fa', '#22262f', lv(50)), fit('referee', 'Referee stripes', 'referee', '#f4f6fa', '#12151c', lv(55)),
  fit('hawaiian', 'Island shirt', 'hawaiian', '#2fb3a8', '#d9c08a', lv(70)), fit('santa', 'Holiday suit', 'santa', '#c8102e', '#f4f6fa', lv(80)),
  fit('astronaut', 'Space suit', 'astronaut', '#eef1f6', '#8a93a3', lv(150)), fit('armor', 'Knight armour', 'armor', '#b8c0cc', '#5b6b82', lv(200)),
  // The Trophy Road: anime-inspired.
  fit('gi', 'Martial arts gi', 'gi', '#f47b20', '#1d4fa0'), fit('ninja', 'Ninja jumpsuit', 'ninja', '#ff8a1f', '#1a1f2a'),
  fit('pirate', 'Pirate captain vest', 'pirate', '#d0202e', '#ffd166'), fit('scout', 'Scout cloak', 'scout', '#2f6b3f', '#8a5a2b'),
  fit('haori', 'Checkered haori', 'haori', '#1f7a4a', '#12151c'), fit('gakuran', 'School uniform', 'gakuran', '#161a24', '#ffd166'),
  fit('hero', 'Hero suit', 'hero', '#2f6fd9', '#e8322e'), fit('plugsuit', 'Mech pilot suit', 'plugsuit', '#6a3fb5', '#6fdc93'),
  fit('cloudrobe', 'Red cloud cloak', 'cloudrobe', '#14161c', '#d0202e'), fit('kimono', 'White kimono', 'kimono', '#f4f0e6', '#c8102e'),
  fit('sailor', 'Sailor uniform', 'sailor', '#f4f6fa', '#1f3566'), fit('captain', "Admiral's coat", 'captain', '#f4f6fa', '#ffd166'),
  fit('flamecloak', 'Flame cloak', 'flamecloak', '#f4f0e6', '#e8322e'), fit('royal', 'Royal robe', 'royal', '#5a2d91', '#ffd166'),
  fit('wizard', 'Starry wizard robe', 'wizard', '#1f2f6b', '#ffd166'),
  fit('warriorArmor', 'Warrior battle armour', 'warriorArmor', '#f4f6fa', '#e8b84a'),
  fit('gi-blue', 'Blue training gi', 'gi', '#2f5fb3', '#f47b20'), fit('gi-black', 'Black training gi', 'gi', '#22262f', '#e8322e'),
  // Anime and TV-inspired.
  fit('trainer', 'Monster trainer outfit', 'trainer', '#2f6fd9', '#1a1f2a'), fit('arcade80s', "'80s arcade ringer tee", 'arcade80s', '#f4f0e6', '#d0202e'),
  fit('contestant', 'Survival game tracksuit', 'contestant', '#2f8a6b', '#f4f6fa'), fit('guard', 'Pink guard jumpsuit', 'guard', '#e8508a', '#161a24'),
  fit('demonHunter', 'Demon hunter uniform', 'demonHunter', '#161a24', '#f4f6fa'), fit('webHero', 'Web hero suit', 'webHero', '#d0202e', '#1f4fa0'),
  fit('soulReaper', 'Soul reaper robe', 'soulReaper', '#14161c', '#f4f6fa'), fit('capedHero', 'One-punch hero suit', 'capedHero', '#ffd84a', '#e8322e', lv(120)),
  fit('sorcerer', 'Sorcerer school uniform', 'sorcerer', '#1c2440', '#ffd166', lv(180)), fit('airNomad', 'Air monk robes', 'airNomad', '#f2b632', '#e8742a', lv(75)),
  // The game owner's.
  fit('sovereign', 'Sovereign robe', 'royal', '#0e1a5a', '#6fd3ff', OWNER),
];

// ---------------------------------------------------------------- headwear, eyewear, neck and back, shoes, aura

export const NEW_HATS = ['crown', 'halo', 'ninjaBand', 'strawHat', 'foxMask', 'guardMask', 'catEars', 'devilHorns', 'bunnyEars', 'wizardHat', 'topHat', 'vikingHelmet', 'partyHat', 'chefHat', 'propeller', 'santaHat'] as const;
const HAT_LEVELS: Record<string, number> = { crown: 200, catEars: 22, devilHorns: 66, bunnyEars: 44, wizardHat: 130, topHat: 75, vikingHelmet: 105, partyHat: 12, chefHat: 50, propeller: 28, santaHat: 80 };
export const HATS: AvatarItem[] = [
  item('hat', 'none', 'Nothing'),
  ...HAT_STYLES.map(id => item('hat', id, LABEL(id))),
  ...NEW_HATS.map(id => item('hat', id, ({ ninjaBand: 'Ninja headband', strawHat: 'Straw hat', foxMask: 'Fox spirit mask', guardMask: 'Guard mask' } as Record<string, string>)[id] ?? LABEL(id), lv(HAT_LEVELS[id] ?? 1))),
  item('hat', 'blueCrown', "Sovereign's blue crown", OWNER),
];
export const EYES: AvatarItem[] = [
  item('eyes', 'none', 'Nothing'), item('eyes', 'glasses', 'Glasses'), item('eyes', 'shades', 'Shades'),
  item('eyes', 'goggles', 'Sport goggles', lv(8)), item('eyes', 'threeD', '3D glasses', lv(24)), item('eyes', 'heartShades', 'Heart shades', lv(38)),
  item('eyes', 'monocle', 'Monocle', lv(52)), item('eyes', 'eyepatch', 'Eye patch', lv(68)), item('eyes', 'skiGoggles', 'Ski goggles', lv(88)),
  item('eyes', 'cyberVisor', 'Cyber visor', lv(160)), item('eyes', 'scouter', 'Power scouter'), item('eyes', 'glowRed', 'Crimson eyes'), item('eyes', 'sparkle', 'Sparkle eyes'),
  item('eyes', 'starEyes', 'Idol star eyes'), item('eyes', 'sharingan', 'Spinning red eyes'), item('eyes', 'blindfold', 'Sorcerer blindfold'),
  item('eyes', 'voidFace', 'Faceless void', OWNER),
];
export const NECKS: AvatarItem[] = [
  item('neck', 'none', 'Nothing'), item('neck', 'goldChain', 'Gold chain'), item('neck', 'headphones', 'Headphones'),
  item('neck', 'whistle', 'Coach whistle', lv(6)), item('neck', 'silverChain', 'Silver chain', lv(14)), item('neck', 'bowtie', 'Bow tie', lv(26)),
  item('neck', 'medal', 'Gold medal', lv(42)), item('neck', 'backpack', 'Backpack', lv(58)), item('neck', 'capeRed', 'Red cape', lv(72)),
  item('neck', 'capeBlack', 'Black cape', lv(115)), item('neck', 'scarf', 'Hero scarf'), item('neck', 'angelWings', 'Angel wings'),
  item('neck', 'batWings', 'Bat wings'), item('neck', 'jetpack', 'Jetpack'),
  item('neck', 'weightedCape', 'Weighted cape'), item('neck', 'tail', 'Warrior tail'), item('neck', 'capeGold', 'Gold cape'), item('neck', 'katana', 'Katana'),
  item('neck', 'blackWings', 'Black angel wings', OWNER),
];
export const SHOES: AvatarItem[] = [
  item('shoes', 'team', 'Match the outfit'), item('shoes', 'white', 'White', FREE, { hex: '#f4f6fa' }), item('shoes', 'black', 'Black', FREE, { hex: '#1a1f2a' }),
  item('shoes', 'red', 'Red', FREE, { hex: '#d33a3a' }), item('shoes', 'blue', 'Blue', FREE, { hex: '#3f7bd9' }), item('shoes', 'green', 'Green', lv(16), { hex: '#3fae5f' }),
  item('shoes', 'gold', 'Gold', lv(90), { hex: '#ffd166' }), item('shoes', 'neon', 'Neon', lv(62), { hex: '#7dff5a' }), item('shoes', 'boots', 'Boots', lv(34)),
  item('shoes', 'sandals', 'Wooden sandals', lv(48)), item('shoes', 'heroBoots', 'Hero boots', lv(135)), item('shoes', 'rocket', 'Rocket boots'), item('shoes', 'warriorBoots', 'Warrior boots'),
  item('shoes', 'cosmicBoots', 'Blue fire boots', OWNER),
];
export const AURAS: AvatarItem[] = [
  item('aura', 'none', 'Nothing'), item('aura', 'sparkles', 'Sparkles', lv(32)), item('aura', 'hearts', 'Hearts', lv(64)), item('aura', 'ice', 'Frost', lv(96)),
  item('aura', 'toxic', 'Toxic', lv(180)), item('aura', 'fire', 'Fire'), item('aura', 'golden', 'Super golden'), item('aura', 'lightning', 'Lightning'),
  item('aura', 'shadow', 'Shadow'), item('aura', 'cosmic', 'Cosmic'), item('aura', 'rainbow', 'Rainbow'), item('aura', 'superWarrior', 'Super warrior aura'), item('aura', 'storm', 'Storm'),
  item('aura', 'sakura', 'Cherry blossoms'), item('aura', 'cursed', 'Cursed energy'),
  item('aura', 'hunter', "Hunter's flames", { honor: 'hunt-week-10' }),
  item('aura', 'cosmicFire', 'Cosmic blue fire', OWNER),
];

export const AVATAR_CATEGORIES: { id: AvatarCategory; label: string; items: AvatarItem[] }[] = [
  { id: 'skin', label: 'Body colour', items: SKINS }, { id: 'hair', label: 'Hair', items: HAIRS }, { id: 'hairColor', label: 'Hair colour', items: HAIR_COLORS },
  { id: 'beard', label: 'Beard', items: BEARDS }, { id: 'outfit', label: 'Outfit', items: OUTFITS }, { id: 'hat', label: 'Headwear', items: HATS },
  { id: 'eyes', label: 'Eyewear', items: EYES }, { id: 'neck', label: 'Neck & back', items: NECKS }, { id: 'shoes', label: 'Shoes', items: SHOES },
  { id: 'aura', label: 'Aura', items: AURAS },
];
/** The game owner's character: abyss-blue skin, the sovereign flame hair, a blue crown, no face, black wings and cosmic blue fire. */
export const SOVEREIGN_LOOK: AvatarLook = { skin: 'abyss', hair: 'sovereignFlame', hairColor: 'blueFire', beard: 'none', outfit: 'sovereign', hat: 'blueCrown', eyes: 'voidFace', neck: 'blackWings', shoes: 'cosmicBoots', aura: 'cosmicFire' };
/** Owner-only pieces are listed only for the owner. */
export const isOwnerPiece = (i: AvatarItem) => 'staff' in i.rule;

export const avatarItem = (cat: AvatarCategory, id: string) => AVATAR_CATEGORIES.find(c => c.id === cat)!.items.find(i => i.id === id);
export const outfitDef = (id: string) => OUTFITS.find(o => o.id === id) ?? OUTFITS[0];
export const colorHex = (list: AvatarItem[], id: string) => (list.find(i => i.id === id) ?? list[0]).hex!;

// ---------------------------------------------------------------- your character

export const DEFAULT_AVATAR: AvatarLook = { skin: 's3', hair: 'short', hairColor: 'black', beard: 'none', outfit: 'jersey-fav', hat: 'none', eyes: 'none', neck: 'none', shoes: 'team', aura: 'none' };
const isFree = (i: AvatarItem) => 'level' in i.rule && i.rule.level <= 1;

/** A random character from the pieces everyone has (the first visit's character, and the Randomize button's base). */
export function randomAvatar(rand: () => number = Math.random, open: (cat: AvatarCategory, i: AvatarItem) => boolean = (_c, i) => isFree(i)): AvatarLook {
  const pick = (cat: AvatarCategory, chanceOfNone = 0) => {
    const list = AVATAR_CATEGORIES.find(c => c.id === cat)!.items.filter(i => open(cat, i));
    if (chanceOfNone && rand() < chanceOfNone) return list.find(i => i.id === 'none')?.id ?? list[0].id;
    return list[Math.floor(rand() * list.length)]?.id ?? DEFAULT_AVATAR[cat];
  };
  return {
    skin: pick('skin'), hair: pick('hair'), hairColor: pick('hairColor'), beard: pick('beard', 0.45), outfit: pick('outfit'),
    hat: pick('hat', 0.7), eyes: pick('eyes', 0.75), neck: pick('neck', 0.7), shoes: rand() < 0.5 ? 'team' : pick('shoes'), aura: pick('aura', 0.85),
  };
}

/** Unknown ids (an old or edited save) fall back to the default piece. */
export function cleanAvatar(raw: Partial<AvatarLook> | null | undefined): AvatarLook {
  const out = { ...DEFAULT_AVATAR };
  for (const c of AVATAR_CATEGORIES) { const v = raw?.[c.id]; if (typeof v === 'string' && c.items.some(i => i.id === v)) out[c.id] = v; }
  if (typeof raw?.kitTeam === 'string' && REAL_FRANCHISES.some(t => t.id === raw.kitTeam)) out.kitTeam = raw.kitTeam;
  if (typeof raw?.kitNumber === 'number' && Number.isInteger(raw.kitNumber) && raw.kitNumber >= 0 && raw.kitNumber <= 99) out.kitNumber = raw.kitNumber;
  return out;
}

/** Your character (the first read makes a random one and keeps it). */
export function readAvatar(read: Read = localRead): AvatarLook {
  const raw = read(AVATAR_KEY);
  if (raw) { try { return cleanAvatar(JSON.parse(raw) as Partial<AvatarLook>); } catch { /* made again below */ } }
  const made = randomAvatar();
  // "at: 0" marks a character nobody chose yet: the one saved to your account wins over it (cloud/merge.ts).
  if (read === localRead) { try { localStorage.setItem(AVATAR_KEY, JSON.stringify({ ...made, at: 0 })); } catch { /* storage blocked: random each visit */ } }
  return made;
}
/** When the character was last changed by hand (0 for the random first one). */
export function avatarSavedAt(raw: string | null | undefined): number {
  try { const at = (JSON.parse(raw ?? 'null') as { at?: unknown } | null)?.at; return typeof at === 'number' ? at : 0; } catch { return 0; }
}

export function saveAvatar(look: AvatarLook): void {
  try { localStorage.setItem(AVATAR_KEY, JSON.stringify({ ...cleanAvatar(look), at: Date.now() })); } catch { /* storage blocked */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AVATAR_EVENT));
}

/** How a piece opens, for the locked tiles. */
export function avatarHow(i: AvatarItem): string {
  const r = i.rule;
  if ('level' in r) return r.level <= 1 ? 'Everyone' : `Level ${r.level}`;
  if ('trophies' in r) return `${r.trophies.toLocaleString()} trophies`;
  if ('honor' in r && r.honor === 'hunt-week-10') return 'Top 10% of a Weekly Hunt';
  if ('staff' in r) return 'Game Owner only';
  return 'Special';
}
