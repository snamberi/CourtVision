import { equip, type Equipped } from '../profile/profile';
import { readAvatar, saveAvatar } from '../profile/avatar';
import type { ShopCosmetic } from './shopCosmetics';

/** Puts a bought shop cosmetic on straight away. */
export function wear(c: ShopCosmetic): void {
  if (c.kind === 'avatar' && c.category) saveAvatar({ ...readAvatar(), [c.category]: c.id });
  else equip({ [c.kind]: c.id } as Partial<Equipped>);
}
export const reward = (c: ShopCosmetic) => (c.kind === 'avatar' ? { kind: 'avatar' as const, id: `${c.category}:${c.id}` } : { kind: c.kind, id: c.id });
