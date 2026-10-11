/*
 * Relic Shop cosmetics: 30 pieces you can only buy with coins (character pieces, profile icons, name colours and
 * title colours). Three are on offer each day, rolled from the ones you don't own yet, and they cost a lot: saving up
 * for one is the point. Each piece carries a { shop: key } rule in its own list; this file gives them a rarity and price.
 */
import { AVATAR_CATEGORIES, type AvatarCategory } from '../profile/avatar';
import { ICONS, NAME_COLORS } from '../profile/cosmetics';
import { TITLE_COLORS } from '../profile/trophyRoad';

export type ShopCosmeticKind = 'avatar' | 'icon' | 'color' | 'titleColor';
export type ShopRarity = 'rare' | 'epic' | 'legendary';
export interface ShopCosmetic { key: string; kind: ShopCosmeticKind; id: string; name: string; label: string; category?: AvatarCategory; rarity: ShopRarity; price: number }

export const SHOP_COSMETIC_PRICE: Record<ShopRarity, number> = { rare: 4000, epic: 7500, legendary: 12000 };
/** How often each rarity is on offer (rarer pieces turn up less). */
const WEIGHT: Record<ShopRarity, number> = { rare: 5, epic: 3, legendary: 1 };

const RARITY: Record<string, ShopRarity> = {
  'shop-skin-obsidian': 'epic', 'shop-skin-jade': 'rare', 'shop-skin-coral': 'rare',
  'shop-hairColor-sunset': 'rare', 'shop-hairColor-mint': 'rare', 'shop-hairColor-lilac': 'rare',
  'shop-shoes-lava': 'epic', 'shop-shoes-midnight': 'rare', 'shop-shoes-chrome': 'epic',
  'shop-outfit-royalTux': 'legendary', 'shop-outfit-neonTrack': 'epic', 'shop-outfit-crimsonSuit': 'epic', 'shop-outfit-oceanHoodie': 'rare', 'shop-outfit-goldVarsity': 'legendary',
  'shop-ball-obsidian': 'rare', 'shop-crown-emerald': 'legendary', 'shop-phoenix-ice': 'legendary', 'shop-star-sunset': 'rare', 'shop-trophy-ruby': 'epic', 'shop-fireball-violet': 'epic',
  'shop-aurora': 'legendary', 'shop-sunset': 'epic', 'shop-toxic': 'rare', 'shop-ruby': 'epic', 'shop-ocean': 'rare', 'shop-royal': 'legendary',
  'shop-tc-emerald': 'epic', 'shop-tc-magma': 'epic', 'shop-tc-candy': 'rare', 'shop-tc-void': 'legendary',
};
const keyOf = (rule: object) => ('shop' in rule && !(rule as { shop: string }).shop.startsWith('secret-') ? (rule as { shop: string }).shop : null);
const priced = (c: Omit<ShopCosmetic, 'rarity' | 'price'>): ShopCosmetic => { const rarity = RARITY[c.key] ?? 'rare'; return { ...c, rarity, price: SHOP_COSMETIC_PRICE[rarity] }; };

export const SHOP_COSMETICS: ShopCosmetic[] = [
  ...AVATAR_CATEGORIES.flatMap(cat => cat.items.flatMap(i => { const key = keyOf(i.rule); return key ? [priced({ key, kind: 'avatar', id: i.id, name: i.name, label: cat.label, category: cat.id })] : []; })),
  ...ICONS.flatMap(i => { const key = keyOf(i.rule); return key ? [priced({ key, kind: 'icon', id: i.id, name: i.name, label: 'Profile icon' })] : []; }),
  ...NAME_COLORS.flatMap(c => { const key = keyOf(c.rule); return key ? [priced({ key, kind: 'color', id: c.id, name: c.name, label: 'Name colour' })] : []; }),
  ...TITLE_COLORS.flatMap(c => (c.shop && !c.shop.startsWith('secret-') ? [priced({ key: c.shop, kind: 'titleColor', id: c.id, name: c.name, label: 'Title colour' })] : [])),
];
export const SHOP_COSMETIC_BY_KEY = new Map(SHOP_COSMETICS.map(c => [c.key, c]));
/** For the daily roll (relics.ts refreshCosmeticShop). */
export const SHOP_COSMETIC_WEIGHTS = SHOP_COSMETICS.map(c => ({ key: c.key, weight: WEIGHT[c.rarity] }));

/* ---- Secret cosmetics: the eight that only a spin drops (secretCosmetics.ts). ---- */
const secretKey = (rule: object) => ('shop' in rule && (rule as { shop: string }).shop.startsWith('secret-') ? (rule as { shop: string }).shop : null);
const secretPiece = (c: Omit<ShopCosmetic, 'rarity' | 'price'>): ShopCosmetic => ({ ...c, rarity: 'legendary', price: 0 });
export const SECRET_COSMETICS: ShopCosmetic[] = [
  ...AVATAR_CATEGORIES.flatMap(cat => cat.items.flatMap(i => { const key = secretKey(i.rule); return key ? [secretPiece({ key, kind: 'avatar', id: i.id, name: i.name, label: cat.label, category: cat.id })] : []; })),
  ...ICONS.flatMap(i => { const key = secretKey(i.rule); return key ? [secretPiece({ key, kind: 'icon', id: i.id, name: i.name, label: 'Profile icon' })] : []; }),
  ...NAME_COLORS.flatMap(c => { const key = secretKey(c.rule); return key ? [secretPiece({ key, kind: 'color', id: c.id, name: c.name, label: 'Name colour' })] : []; }),
  ...TITLE_COLORS.flatMap(c => (c.shop?.startsWith('secret-') ? [secretPiece({ key: c.shop, kind: 'titleColor', id: c.id, name: c.name, label: 'Title colour' })] : [])),
];
export const SECRET_COSMETIC_BY_KEY = new Map(SECRET_COSMETICS.map(c => [c.key, c]));
