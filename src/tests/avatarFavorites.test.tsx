import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { AVATAR_CATEGORIES, AVATAR_TROPHY_ROAD, OUTFITS, DEFAULT_AVATAR, randomAvatar, cleanAvatar, avatarItem, type AvatarLook } from '../profile/avatar';
import { buildAvatarGrid, outfitKit } from '../visuals/avatarSprite';
import { teamColors } from '../simulation/teamColors';
import { TROPHY_ROAD } from '../profile/trophyRoad';
import { isOpen, unlockContext } from '../profile/cosmetics';
import { favoriteTeamIn, defaultTeam, REAL_FRANCHISES, FAV_BOOST } from '../profile/favorites';
import { newWheel, spin, landed, favCard, wheelPool, type WheelState } from '../career/wheel';
import { newRun, stopReels } from '../hunt/run';
import { cardPool } from '../hunt/cards';
import { UserAvatar } from '../components/UserAvatar';

describe('your character', () => {
  it('has fifty-plus outfits and ten categories, every piece drawn without stand-in colours', () => {
    expect(OUTFITS.length).toBeGreaterThanOrEqual(50);
    expect(AVATAR_CATEGORIES).toHaveLength(10);
    for (const c of AVATAR_CATEGORIES) {
      expect(new Set(c.items.map(i => i.id)).size, c.id).toBe(c.items.length);
      for (const i of c.items) {
        const look: AvatarLook = { ...DEFAULT_AVATAR, [c.id]: i.id };
        const { grid } = buildAvatarGrid({ look });
        const colours = new Set(grid.flat().filter(Boolean));
        expect([...colours].some(x => /fe01fe|01fefe/i.test(x!)), `${c.id}:${i.id}`).toBe(false);
      }
    }
    // Rainbow body and hair come out in several colours, with nothing left of the stand-ins.
    const { grid } = buildAvatarGrid({ look: { ...DEFAULT_AVATAR, skin: 'rainbow', hairColor: 'rainbow', beard: 'stubbleFull' } });
    expect(grid.flat().some(x => x && /fe01fe|01fefe/i.test(x))).toBe(false);
  });

  it('a new player gets a random character from the free pieces; bad saves fall back', () => {
    const ctx = unlockContext(1, () => null);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 40; n++) {
      const look = randomAvatar(rand);
      for (const c of AVATAR_CATEGORIES) expect(isOpen(avatarItem(c.id, look[c.id])!.rule, ctx), `${c.id}:${look[c.id]}`).toBe(true);
    }
    expect(cleanAvatar({ outfit: 'nope', hat: 'crown' })).toEqual({ ...DEFAULT_AVATAR, hat: 'crown' });
  });

  it('the Trophy Road carries the character pieces, each one a real piece that opens there', () => {
    const road = TROPHY_ROAD.filter(([, k]) => k === 'avatar');
    expect(road).toHaveLength(AVATAR_TROPHY_ROAD.length);
    for (const [t, , ref] of road) {
      const [cat, id] = ref.split(':');
      const item = avatarItem(cat as Parameters<typeof avatarItem>[0], id);
      expect(item, ref).toBeDefined();
      expect(item!.rule, ref).toEqual({ trophies: t });
    }
    // Stops stay in order.
    expect(TROPHY_ROAD.map(([t]) => t)).toEqual([...TROPHY_ROAD.map(([t]) => t)].sort((a, b) => a - b));
  });

  it('a jersey takes any team colours and any number, and bad values fall away', () => {
    const look = cleanAvatar({ ...DEFAULT_AVATAR, outfit: 'jersey-red', kitTeam: 'LAL', kitNumber: 24 });
    expect(outfitKit(look)).toEqual({ ...teamColors('LAL'), number: 24 });
    expect(cleanAvatar({ ...look, kitTeam: 'XYZ', kitNumber: 140 })).not.toHaveProperty('kitTeam');
    expect(cleanAvatar({ ...look, kitNumber: 140 })).not.toHaveProperty('kitNumber');
    // Not a jersey: no number, the outfit's own colours.
    expect(outfitKit({ ...look, outfit: 'hoodie-gray' }).number).toBeNull();
    const html = renderToStaticMarkup(<UserAvatar look={look} />);
    expect(html).toContain(teamColors('LAL').primary);
  });

  it('renders with an aura and in portrait', () => {
    const html = renderToStaticMarkup(<UserAvatar look={{ ...DEFAULT_AVATAR, aura: 'fire', outfit: 'jersey-fav' }} team={{ primary: '#552583', secondary: '#fdb927' }} />);
    expect(html).toContain('aura-fire');
    expect(html).toContain('#552583');
    expect(renderToStaticMarkup(<UserAvatar look={DEFAULT_AVATAR} mode="portrait" />)).toContain('user-avatar--portrait');
  });
});

describe('favourites', () => {
  it('finds your team in any era of the league and picks it by default', () => {
    expect(REAL_FRANCHISES).toHaveLength(30);
    expect(favoriteTeamIn(['BOS', 'SEA', 'LAL'], 'OKC')).toBe('SEA');
    expect(favoriteTeamIn(['BOS', 'LAL'], 'OKC')).toBeUndefined();
    expect(favoriteTeamIn(['bos', 'lal'], 'LAL')).toBe('lal');
    expect(defaultTeam(['GEN0', 'GEN1'])).toBe('GEN0');
  });

  it('Career wheel: your favourite comes up more on his rarity, then the odds go back to normal', async () => {
    const h = await loadHistoryForTests();
    const fav = favCard(h, 'Stephen Curry')!;
    expect(fav).toBeDefined();
    const count = (withFav: boolean) => {
      let hits = 0, landedOnRarity = 0;
      for (let i = 0; i < 1500; i++) {
        const s = spin(h, newWheel(1000 + i, withFav ? fav.playerId : undefined));
        const c = cardPool(h).byId.get(landed(s.current![0]))!;
        if (c.rarity === fav.rarity) landedOnRarity++;
        if (c.playerId === fav.playerId) { hits++; if (withFav) expect(s.favLanded).toBe(true); }
      }
      return { hits, landedOnRarity };
    };
    const plain = count(false), boosted = count(true);
    expect(boosted.hits).toBeGreaterThan(plain.hits + boosted.landedOnRarity * FAV_BOOST * 0.5);
    // Once he has come up, no more boost in that run.
    const done: WheelState = { ...newWheel(5, fav.playerId), favLanded: true };
    let again = 0;
    for (let i = 0; i < 400; i++) if (landed(spin(h, { ...done, seed: 5000 + i }).current![0]) === fav.id) again++;
    expect(again).toBeLessThan(5);
    expect(wheelPool(h).some(c => c.id === fav.id)).toBe(true);
  }, 120_000);

  it('League Hunt: the reels show your favourite more until you lock him, never in the Daily Legend', async () => {
    const h = await loadHistoryForTests();
    const pool = cardPool(h);
    const name = 'Tim Duncan';
    const shown = (opts: { fav?: string; daily?: string }) => {
      let n = 0;
      for (let i = 0; i < 300; i++) {
        const r = stopReels(h, newRun(h, 700 + i, opts));
        if (Object.values(r.reels ?? {}).some(id => pool.byId.get(id!)?.name === name)) n++;
      }
      return n;
    };
    const favId = pool.cards.find(c => c.name === name)!.playerId;
    const plain = shown({}), boosted = shown({ fav: favId });
    expect(boosted).toBeGreaterThan(plain);
    expect(newRun(h, 1, { fav: favId, daily: '2026-01-01' }).fav).toBeUndefined();
  }, 120_000);
});
