// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { buyCosmetic, refreshCosmeticShop, loadRelics, mergeRelics, spinRelic, COSMETIC_SHOP_SIZE, RELICS_KEY, type RelicState } from '../relics/relics';
import { SHOP_COSMETICS, SHOP_COSMETIC_WEIGHTS, SECRET_COSMETICS, SHOP_COSMETIC_PRICE } from '../relics/shopCosmetics';
import { SECRET_COSMETIC_KEYS } from '../relics/secretCosmetics';
import { isOpen, unlockContext } from '../profile/cosmetics';
import { AVATAR_CATEGORIES, DEFAULT_AVATAR } from '../profile/avatar';
import { decodeAvatar, myAvatarCode } from '../profile/avatarCode';
import { lastSeenLabel } from '../cloud/lastSeen';
import { publicAvatar } from '../../server/derive';

const base = (over: Partial<RelicState> = {}): RelicState => ({ ...loadRelics(() => null), ...over });
const read = (store: Record<string, string>) => (k: string) => store[k] ?? null;

beforeEach(() => localStorage.clear());

describe('Relic Shop cosmetics', () => {
  it('has 30 shop-only pieces with unique keys, all expensive', () => {
    expect(SHOP_COSMETICS).toHaveLength(30);
    expect(new Set(SHOP_COSMETICS.map(c => c.key)).size).toBe(30);
    expect(SHOP_COSMETICS.every(c => c.price >= SHOP_COSMETIC_PRICE.rare && c.price >= 4000)).toBe(true);
    expect(new Set(SHOP_COSMETICS.map(c => c.kind))).toEqual(new Set(['avatar', 'icon', 'color', 'titleColor']));
  });
  it('offers 3 a day you do not own, the same all day', () => {
    const owned = SHOP_COSMETICS.slice(0, 25).map(c => c.key);
    const s = refreshCosmeticShop(base({ cosmetics: owned, salt: 7 }), SHOP_COSMETIC_WEIGHTS, '2026-10-11');
    expect(s.cosmeticShop!.offers).toHaveLength(COSMETIC_SHOP_SIZE);
    expect(new Set(s.cosmeticShop!.offers).size).toBe(3);
    expect(s.cosmeticShop!.offers.some(k => owned.includes(k))).toBe(false);
    expect(refreshCosmeticShop(s, SHOP_COSMETIC_WEIGHTS, '2026-10-11')).toBe(s);
    expect(refreshCosmeticShop(s, SHOP_COSMETIC_WEIGHTS, '2026-10-12').cosmeticShop!.day).toBe('2026-10-12');
  });
  it('buying costs coins, unlocks the piece for good, and only works for an offer', () => {
    const s = refreshCosmeticShop(base({ coins: 20_000, salt: 3 }), SHOP_COSMETIC_WEIGHTS, '2026-10-11');
    const c = SHOP_COSMETICS.find(x => x.key === s.cosmeticShop!.offers[0])!;
    const bought = buyCosmetic(s, c.key, c.price, c.name)!;
    expect(bought.coins).toBe(20_000 - c.price);
    expect(bought.cosmetics).toContain(c.key);
    expect(buyCosmetic(bought, c.key, c.price, c.name)).toBeNull();
    const notOffered = SHOP_COSMETICS.find(x => !s.cosmeticShop!.offers.includes(x.key))!;
    expect(buyCosmetic(s, notOffered.key, notOffered.price, notOffered.name)).toBeNull();
    expect(buyCosmetic({ ...s, coins: 10 }, c.key, c.price, c.name)).toBeNull();
    // Bought pieces open on the profile.
    const ctx = unlockContext(1, read({ [RELICS_KEY]: JSON.stringify(bought) }));
    expect(isOpen({ shop: c.key }, ctx)).toBe(true);
    expect(isOpen({ shop: notOffered.key }, ctx)).toBe(false);
  });
  it('merges bought cosmetics across devices', () => {
    const a = base({ cosmetics: ['shop-tc-void'] }), b = base({ cosmetics: ['shop-skin-jade'] });
    expect(new Set(mergeRelics(a, b).cosmetics)).toEqual(new Set(['shop-tc-void', 'shop-skin-jade']));
  });
});

describe('secret cosmetics', () => {
  it('are 8, none sold in the shop', () => {
    expect(SECRET_COSMETICS).toHaveLength(8);
    expect(new Set(SECRET_COSMETICS.map(c => c.key))).toEqual(new Set(SECRET_COSMETIC_KEYS));
    expect(SHOP_COSMETICS.some(c => c.key.startsWith('secret-'))).toBe(false);
  });
  it('a spin can drop one you do not have, and never a second copy', () => {
    const lucky = () => 0;
    const out = spinRelic(base({ spins: 1 }), lucky)!;
    expect(out.result.cosmetic).toBeDefined();
    expect(out.state.cosmetics).toEqual([out.result.cosmetic]);
    const all = spinRelic(base({ spins: 1, cosmetics: [...SECRET_COSMETIC_KEYS] }), lucky)!;
    expect(all.result.cosmetic).toBeUndefined();
    const none = spinRelic(base({ spins: 1 }), () => 0.99)!;
    expect(none.result.cosmetic).toBeUndefined();
  });
});

describe('leaderboard character and last seen', () => {
  it('your own code is your local character', () => {
    expect(decodeAvatar(myAvatarCode())).not.toBeNull();
  });
  it('the server drops shop pieces you have not bought', () => {
    const look = { ...DEFAULT_AVATAR, skin: 'jade' };
    const blob = (cosmetics: string[]) => ({ version: 1 as const, updatedAt: 0, careers: [], storage: { 'cv-avatar': JSON.stringify(look), [RELICS_KEY]: JSON.stringify(base({ cosmetics })) } });
    const skinOf = (code: string | null) => decodeAvatar(code)!.look.skin;
    expect(skinOf(publicAvatar(blob([]), 1, []))).toBe(DEFAULT_AVATAR.skin);
    expect(skinOf(publicAvatar(blob(['shop-skin-jade']), 1, []))).toBe('jade');
    expect(AVATAR_CATEGORIES.find(c => c.id === 'skin')!.items.some(i => i.id === 'jade')).toBe(true);
  });
  it('labels when a player was last seen', () => {
    const now = Date.parse('2026-10-11T12:00:00Z');
    expect(lastSeenLabel('2026-10-11T11:55:00Z', now)).toBe('Online now');
    expect(lastSeenLabel('2026-10-11T11:15:00Z', now)).toBe('45 minutes ago');
    expect(lastSeenLabel('2026-10-11T09:00:00Z', now)).toBe('3 hours ago');
    expect(lastSeenLabel('2026-10-10T12:00:00Z', now)).toBe('1 day ago');
    expect(lastSeenLabel(undefined, now)).toBeNull();
  });
});
