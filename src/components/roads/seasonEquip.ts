import { equip, type Equipped } from '../../profile/profile';
import { readAvatar, saveAvatar, type AvatarCategory } from '../../profile/avatar';
import { setTheme, type ThemeId } from '../../theme/themes';
import type { SeasonCosmetic } from '../../retention/season';

const AVATAR: ReadonlySet<string> = new Set(['skin', 'hair', 'hairColor', 'beard', 'outfit', 'hat', 'eyes', 'neck', 'shoes', 'aura']);
const PROFILE: Partial<Record<SeasonCosmetic['kind'], keyof Equipped>> = { icon: 'icon', color: 'color', title: 'title', titleColor: 'titleColor', frame: 'frame', floor: 'floor', phone: 'phone', avatarFrame: 'avatarFrame' };

/** Puts a season cosmetic on straight away (the tier-up pop-up's Equip button). */
export function equipSeasonCosmetic(r: SeasonCosmetic): void {
  if (r.kind === 'look') { setTheme(r.id as ThemeId); return; }
  if (AVATAR.has(r.kind)) { saveAvatar({ ...readAvatar(), [r.kind as AvatarCategory]: r.id }); return; }
  const key = PROFILE[r.kind];
  if (key) equip({ [key]: r.id } as Partial<Equipped>);
}

const AVATAR_KINDS: ReadonlySet<string> = AVATAR;
/** A season cosmetic as a road reward (character pieces are "category:id"). */
export const asRoadReward = (r: SeasonCosmetic): { kind: import('../../profile/trophyRoad').TrophyRewardKind; id: string } =>
  AVATAR_KINDS.has(r.kind) ? { kind: 'avatar', id: `${r.kind}:${r.id}` } : { kind: r.kind as import('../../profile/trophyRoad').TrophyRewardKind, id: r.id };
