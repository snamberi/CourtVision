import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPlayerSprite, buildPlayerGrid, playerTraits, detailedSpritePaths, HAIR_STYLES, BEARD_STYLES, HAT_STYLES } from '../visuals/playerSprite';
import { PlayerAvatar } from '../components/PlayerAvatar';

const player = { playerId: 'Damon Cross', primary: '#552583', secondary: '#fdb927', jerseyNumber: 1 };

describe('pixel player identity and rendering', () => {
  it('keeps all character detail on the original pixel grid', () => {
    const paths = detailedSpritePaths([['#123456', '#123456'], ['#123456', '#123456']]);
    expect(paths).toEqual([{ fill: '#123456', d: 'M0 0h2v1h-2zM0 1h2v1h-2z' }]);
    expect(buildPlayerSprite(player).every(path => !/\d+\.\d/.test(path.d))).toBe(true);
  });

  it('draws every saved hair, beard and headwear option into a native 44px bitmap', () => {
    const looks = [
      ...HAIR_STYLES.map(hairStyle => ({ hairStyle })),
      ...BEARD_STYLES.map(beardStyle => ({ beardStyle })),
      ...HAT_STYLES.map(hatStyle => ({ hatStyle })),
    ];
    for (const appearance of looks) {
      const grid = buildPlayerGrid({ ...player, appearance });
      expect(grid).toHaveLength(44);
      expect(grid.every(row => row.length === 44)).toBe(true);
      expect(grid.flat().every(c => c === null || /^#[\da-f]{6}$/i.test(c))).toBe(true);
      expect(grid.flat().filter(Boolean).length).toBeGreaterThan(400);
    }
  });

  it('keeps the existing identity choices for a known saved player', () => {
    expect(playerTraits('Damon Cross')).toMatchObject({
      skin: '#5c3a21', hair: '#2b1a10', hairStyle: 'shortWide',
      beardStyle: 'fullWide', hatStyle: 'headband', hatColor: '#6b21a8',
    });
    expect(buildPlayerSprite(player)).toEqual(buildPlayerSprite({ ...player }));
  });

  it('changes the kit after a trade while retaining identity colors', () => {
    const original = buildPlayerSprite(player);
    const traded = buildPlayerSprite({ ...player, primary: '#003da5', secondary: '#f2a900' });
    expect(traded).not.toEqual(original);
    for (const color of ['#5c3a21', '#2b1a10', '#6b21a8']) {
      expect(traded.find((path) => path.fill === color)).toEqual(original.find((path) => path.fill === color));
    }
    expect(traded.some((path) => path.fill === '#003da5')).toBe(true);
  });

  it('handles missing numbers and imported colors without invalid SVG', () => {
    for (const jerseyNumber of [undefined, null, NaN, Infinity, -1, 123, 30]) {
      const paths = buildPlayerSprite({ ...player, primary: 'bad-color', secondary: '#abc', jerseyNumber });
      expect(paths.length).toBeGreaterThan(10);
      for (const path of paths) {
        expect(path.fill).toMatch(/^#[\da-f]{6}$/i);
        expect(path.d).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });

  it('keeps SVG node counts small and uses matching art in both crops', () => {
    const props = { playerId: 'Damon Cross', teamId: 'test', jerseyNumber: 30 };
    const full = renderToStaticMarkup(<PlayerAvatar {...props} mode="full" size={160} />);
    const portrait = renderToStaticMarkup(<PlayerAvatar {...props} mode="portrait" size={24} />);
    expect(full).toContain('viewBox="0 0 44 44"');
    expect(portrait).toContain('viewBox="8 0 28 28"');
    expect(full).toContain('Damon Cross avatar');
    expect((full.match(/<path/g) ?? []).length).toBeLessThan(50);
    const artPaths = portrait.match(/<path[^>]*>/g)!;
    expect(artPaths.every((path) => full.includes(path))).toBe(true);
  });
});
