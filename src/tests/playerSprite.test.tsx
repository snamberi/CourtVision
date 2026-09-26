import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPlayerSprite, playerTraits } from '../visuals/playerSprite';
import { PlayerAvatar } from '../components/PlayerAvatar';

const player = { playerId: 'Damon Cross', primary: '#552583', secondary: '#fdb927', jerseyNumber: 1 };

describe('pixel player identity and rendering', () => {
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
    expect(full).toContain('viewBox="0 0 40 52"');
    expect(portrait).toContain('viewBox="8 1 24 30"');
    expect(full).toContain('Damon Cross avatar');
    expect((full.match(/<path/g) ?? []).length).toBeLessThan(50);
    const artPaths = portrait.match(/<path[^>]*>/g)!;
    expect(artPaths.every((path) => full.includes(path))).toBe(true);
  });
});
