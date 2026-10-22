import { trophyNeed } from './trophyRoad';
import { roadLevel } from './cosmetics';
import { seasonTier, seasonRule, seasonHow } from '../retention/season';

/*
 * Profile-picture frames: an ornate border around your character's portrait, wherever it shows (your profile chip,
 * the boards, your public profile). Three are won on the ranked ladder (finish a season #1, #2 or #3); six are on
 * the Level Road and the Trophy Road; four come with hours played. The art is in src/components/AvatarFrame.tsx.
 *
 * The list is append-only: a frame's place in it is part of the look code (avatarCode.ts).
 */

export type AvatarFrameId = 'none' | 'rookie' | 'courtside' | 'neon' | 'blaze' | 'dragon' | 'celestial' | 'bronzeCrest' | 'silverWings' | 'goldCrown' | 'undefeated' | 'perfectGold' | 'sovereign' | 'founding' | 'glitch' | 'frozen' | 'inferno' | 'cobweb' | 'giftWrap' | 'clock10' | 'clock50' | 'clock100' | 'clock500';
export interface AvatarFrameDef {
  id: AvatarFrameId; name: string; blurb: string;
  /** How it opens: a level, trophies, or one of these leaderboard honors. */
  level?: number; trophies?: number; honors?: string[];
  /** Or one of these mode achievements (modeAchievements.ts). */
  modes?: string[];
  /** Game Owner only. */
  staff?: boolean;
  /** Anyone with a free account (the Founding GM reward). */
  account?: boolean;
  /** A Season Pass tier (season.ts). */
  season?: { season: string; tier: number };
  /** Bought in a shop (its key in the relic save's cosmetics: a holiday event piece). */
  shop?: string;
  /** Hours played (src/retention/playTime.ts). */
  hours?: number;
}

const lvl = (id: AvatarFrameId) => roadLevel('avatarFrame', id) ?? 750;
const tro = (id: AvatarFrameId) => trophyNeed('avatarFrame', id) ?? 750_000;
export const AVATAR_FRAMES: AvatarFrameDef[] = [
  { id: 'none', name: 'No frame', blurb: 'Just your character.' },
  { id: 'rookie', name: 'Rookie Ring', blurb: 'An orange ring studded with basketballs.', level: lvl('rookie') },
  { id: 'courtside', name: 'Courtside Crest', blurb: 'A hardwood crest with brass rivets.', level: lvl('courtside') },
  { id: 'neon', name: 'Neon Pulse', blurb: 'Two arcade rings that pulse.', level: lvl('neon') },
  { id: 'blaze', name: 'Blaze', blurb: 'A ring of fire that never goes out.', trophies: tro('blaze') },
  { id: 'dragon', name: 'Jade Dragon', blurb: 'Jade wings and a dragon crest.', trophies: tro('dragon') },
  { id: 'celestial', name: 'Celestial', blurb: 'Stars orbiting a cosmic halo.', trophies: tro('celestial') },
  { id: 'bronzeCrest', name: 'Season Podium', blurb: 'Bronze shield and wings: a top-3 ranked season.', honors: ['ranked-1', 'ranked-2', 'ranked-3'] },
  { id: 'silverWings', name: 'Season Runner-up', blurb: 'Silver wings: a top-2 ranked season.', honors: ['ranked-1', 'ranked-2'] },
  { id: 'goldCrown', name: 'Season Champion', blurb: 'Gold wings and a crown: #1 when a ranked season ended.', honors: ['ranked-1'] },
  { id: 'undefeated', name: 'Undefeated', blurb: 'A steel banner reading 82-0: an undefeated 82-0 Challenge season.', modes: ['perfect-82', 'perfect-98'] },
  { id: 'perfectGold', name: 'Perfection', blurb: 'Gold laurels and 98-0: 82-0, then 16-0 in the playoffs.', modes: ['perfect-98'] },
  { id: 'sovereign', name: 'Sovereign', blurb: 'Black wings, blue fire and a royal crown. Game Owner only.', staff: true },
  { id: 'founding', name: 'Founding GM', blurb: 'An orange-and-cream crest with the Founder banner: for making a free account.', account: true },
  { id: 'glitch', name: 'Glitch', blurb: 'A corrupted ring that splits into cyan and magenta and tears apart. Season 1.', season: seasonRule('avatarFrame', 'glitch') },
  { id: 'frozen', name: 'Frozen', blurb: 'A ring of ice with icicles and drifting snow. Season 2.', season: seasonRule('avatarFrame', 'frozen', 'frozen') },
  { id: 'inferno', name: 'Inferno', blurb: 'A ring of molten rock with flames licking up and embers rising. Season 3.', season: seasonRule('avatarFrame', 'inferno', 'inferno') },
  { id: 'cobweb', name: 'Cobweb', blurb: 'A haunted ring of cobwebs, a dangling spider and pumpkins. Spooky Season.', shop: 'evt-halloween-frame' },
  { id: 'giftWrap', name: 'Gift Wrap', blurb: 'Wrapped up in red ribbon with a bow and holly on top. Winter Wonderland.', shop: 'evt-christmas-frame' },
  { id: 'clock10', name: 'Ten Hours', blurb: 'A copper clock ring with a stopwatch crown: 10 hours played.', hours: 10 },
  { id: 'clock50', name: 'Fifty Hours', blurb: 'A silver clock ring: 50 hours played.', hours: 50 },
  { id: 'clock100', name: 'Hundred Hours', blurb: 'A gold clock ring set with gems: 100 hours played.', hours: 100 },
  { id: 'clock500', name: 'Five Hundred Hours', blurb: 'A sapphire clock ring under a crown: 500 hours played.', hours: 500 },
];
export const avatarFrameDef = (id: string | null | undefined) => AVATAR_FRAMES.find(f => f.id === id) ?? AVATAR_FRAMES[0];

export function avatarFrameOpen(f: AvatarFrameDef, ctx: { level: number; trophies: number; honors: string[]; modes?: string[]; staff?: boolean; account?: boolean; shop?: string[]; hours?: number }): boolean {
  if (ctx.staff) return true;
  if (f.staff) return false;
  if (f.shop) return (ctx.shop ?? []).includes(f.shop);
  if (f.hours != null) return (ctx.hours ?? 0) >= f.hours;
  if (f.account) return !!ctx.account;
  if (f.season) return seasonTier(f.season.season) >= f.season.tier;
  if (f.modes) return f.modes.some(m => ctx.modes?.includes(m));
  if (f.honors) return f.honors.some(h => ctx.honors.includes(h));
  if (f.trophies != null) return ctx.trophies >= f.trophies;
  return ctx.level >= (f.level ?? 1);
}
export const avatarFrameHow = (f: AvatarFrameDef) => f.hours != null ? `Play ${f.hours} hours` : f.shop ? (f.shop.startsWith('evt-halloween-') ? 'Spooky Season event shop' : 'Winter Wonderland event shop') : f.season ? seasonHow(f.season) : f.staff ? 'Game Owner only' : f.account ? 'Create a free account' : f.modes ? (f.id === 'perfectGold' ? 'Go 98-0' : 'Go 82-0') : f.honors ? f.blurb.split(': ')[1] ?? 'Ranked' : f.trophies != null ? `${f.trophies.toLocaleString()} trophies` : f.level && f.level > 1 ? `Level ${f.level}` : 'Everyone';
