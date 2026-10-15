import { AVATAR_CATEGORIES, type AvatarCategory } from '../profile/avatar';
import { ICONS, NAME_COLORS, EVENT_TITLES } from '../profile/cosmetics';
import { TITLE_COLORS } from '../profile/trophyRoad';
import { AVATAR_FRAMES } from '../profile/avatarFrames';
import { THEMES } from '../theme/themes';
import { holidayOfKey, type HolidayId } from './holiday';

/*
 * The holiday event shops: every kind of cosmetic, bought with that event's coins (holiday.ts), only while it's on.
 * Prices run from 15 for a hair colour to 250 for the app theme. Each piece carries a { shop: "evt-…" } rule in its
 * own list (avatar.ts, cosmetics.ts, trophyRoad.ts, avatarFrames.ts, themes.ts); buying one adds that key to the relic
 * save's cosmetics, the same place Relic Shop pieces go, so it syncs and unlocks the same way.
 */

export type EventPieceKind = 'avatar' | 'icon' | 'color' | 'titleColor' | 'title' | 'frame' | 'theme';
export interface EventPiece { key: string; holiday: HolidayId; kind: EventPieceKind; id: string; name: string; label: string; category?: AvatarCategory; price: number; css?: string }

const PRICES: Record<string, number> = {
  'hairColor': 15, 'shoes': 20, titleColor: 30, color: 40, title: 45, 'skin': 50, icon: 60, 'neck': 110, frame: 130, 'aura': 200, theme: 250,
};
/** Outfits and headwear: two of each, the plainer one cheaper. */
const BY_ID: Record<string, number> = { pumpkinHoodie: 80, skeletonRobe: 140, uglySweater: 80, elfSuit: 140, witchHat: 90, pumpkinHead: 160, elfHat: 90, reindeerAntlers: 160 };
const priceOf = (kind: string, id: string) => BY_ID[id] ?? PRICES[kind] ?? 50;
const evtKey = (rule: object) => ('shop' in rule && (rule as { shop: string }).shop.startsWith('evt-') ? (rule as { shop: string }).shop : null);

export const EVENT_PIECES: EventPiece[] = [
  ...AVATAR_CATEGORIES.flatMap(cat => cat.items.flatMap(i => { const key = evtKey(i.rule); return key ? [{ key, holiday: holidayOfKey(key)!, kind: 'avatar' as const, id: i.id, name: i.name, label: cat.label, category: cat.id, price: priceOf(cat.id, i.id) }] : []; })),
  ...ICONS.flatMap(i => { const key = evtKey(i.rule); return key ? [{ key, holiday: holidayOfKey(key)!, kind: 'icon' as const, id: i.id, name: i.name, label: 'Profile icon', price: priceOf('icon', i.id) }] : []; }),
  ...NAME_COLORS.flatMap(c => { const key = evtKey(c.rule); return key ? [{ key, holiday: holidayOfKey(key)!, kind: 'color' as const, id: c.id, name: c.name, label: 'Name colour', price: priceOf('color', c.id), css: c.css }] : []; }),
  ...TITLE_COLORS.flatMap(c => (c.shop?.startsWith('evt-') ? [{ key: c.shop, holiday: holidayOfKey(c.shop)!, kind: 'titleColor' as const, id: c.id, name: c.name, label: 'Title colour', price: priceOf('titleColor', c.id), css: c.css }] : [])),
  ...EVENT_TITLES.map(t => ({ key: t.key, holiday: holidayOfKey(t.key)!, kind: 'title' as const, id: t.title, name: t.title, label: 'Title', price: priceOf('title', t.title) })),
  ...AVATAR_FRAMES.flatMap(f => (f.shop?.startsWith('evt-') ? [{ key: f.shop, holiday: holidayOfKey(f.shop)!, kind: 'frame' as const, id: f.id, name: f.name, label: 'Profile frame', price: priceOf('frame', f.id) }] : [])),
  ...THEMES.flatMap(t => (t.shop?.startsWith('evt-') ? [{ key: t.shop, holiday: holidayOfKey(t.shop)!, kind: 'theme' as const, id: t.id, name: t.name, label: 'App theme', price: priceOf('theme', t.id) }] : [])),
].sort((a, b) => a.price - b.price);
export const EVENT_PIECE_BY_KEY = new Map(EVENT_PIECES.map(p => [p.key, p]));
export const piecesFor = (id: HolidayId) => EVENT_PIECES.filter(p => p.holiday === id);
