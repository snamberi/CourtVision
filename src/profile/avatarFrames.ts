import { trophyNeed } from './trophyRoad';
import { roadLevel } from './cosmetics';

/*
 * Profile-picture frames: an ornate border around your character's portrait, wherever it shows (your profile chip,
 * the boards, your public profile). Three are won on the ranked ladder (finish a season #1, #2 or #3); six are on
 * the Level Road and the Trophy Road. The art is in src/components/AvatarFrame.tsx.
 *
 * The list is append-only: a frame's place in it is part of the look code (avatarCode.ts).
 */

export type AvatarFrameId = 'none' | 'rookie' | 'courtside' | 'neon' | 'blaze' | 'dragon' | 'celestial' | 'bronzeCrest' | 'silverWings' | 'goldCrown' | 'undefeated' | 'perfectGold';
export interface AvatarFrameDef {
  id: AvatarFrameId; name: string; blurb: string;
  /** How it opens: a level, trophies, or one of these leaderboard honors. */
  level?: number; trophies?: number; honors?: string[];
  /** Or one of these mode achievements (modeAchievements.ts). */
  modes?: string[];
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
];
export const avatarFrameDef = (id: string | null | undefined) => AVATAR_FRAMES.find(f => f.id === id) ?? AVATAR_FRAMES[0];

export function avatarFrameOpen(f: AvatarFrameDef, ctx: { level: number; trophies: number; honors: string[]; modes?: string[]; staff?: boolean }): boolean {
  if (ctx.staff) return true;
  if (f.modes) return f.modes.some(m => ctx.modes?.includes(m));
  if (f.honors) return f.honors.some(h => ctx.honors.includes(h));
  if (f.trophies != null) return ctx.trophies >= f.trophies;
  return ctx.level >= (f.level ?? 1);
}
export const avatarFrameHow = (f: AvatarFrameDef) => f.modes ? (f.id === 'perfectGold' ? 'Go 98-0' : 'Go 82-0') : f.honors ? f.blurb.split(': ')[1] ?? 'Ranked' : f.trophies != null ? `${f.trophies.toLocaleString()} trophies` : f.level && f.level > 1 ? `Level ${f.level}` : 'Everyone';
