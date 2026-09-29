import { describe, it, expect } from 'vitest';
import { TROPHY_ROAD, TROPHY_STEP, TROPHY_MAX, TITLE_COLORS, trophyParts, packColors, unpackColors } from '../profile/trophyRoad';
import { ICONS, NAME_COLORS, SPRITES, colorCss } from '../profile/cosmetics';
import { THEME_BY_ID, type ThemeId } from '../theme/themes';

describe('Trophy Road', () => {
  it('has a reward at every 5,000 trophies up to 200,000, each one defined', () => {
    const stops = [...new Set(TROPHY_ROAD.map(([t]) => t))];
    expect(stops).toEqual(Array.from({ length: TROPHY_MAX / TROPHY_STEP }, (_, i) => (i + 1) * TROPHY_STEP));
    for (const [, kind, id] of TROPHY_ROAD) {
      if (kind === 'icon') { const d = ICONS.find(i => i.id === id); expect(d, id).toBeDefined(); expect(d!.anim, id).toBeDefined(); expect(SPRITES[d!.base], id).toBeDefined(); }
      if (kind === 'color') expect(NAME_COLORS.find(c => c.id === id)?.anim, id).toBeDefined();
      if (kind === 'titleColor') expect(TITLE_COLORS.find(c => c.id === id), id).toBeDefined();
      if (kind === 'look') expect(THEME_BY_ID.get(id as ThemeId), id).toBeDefined();
    }
  });
  it('packs the name and title colours into the 20-character profile field, and old values still read', () => {
    for (const c of NAME_COLORS) for (const t of TITLE_COLORS) expect(packColors(c.id, t.id).length, `${c.id}|${t.id}`).toBeLessThanOrEqual(20);
    expect(unpackColors('gold|fire')).toEqual({ color: 'gold', titleColor: 'fire' });
    expect(unpackColors('gold')).toEqual({ color: 'gold', titleColor: 'plain' });
    expect(colorCss('gold|fire')).toBe(colorCss('gold'));
    expect(packColors('gold', 'plain')).toBe('gold');
  });
  it('counts trophies from the records the modes keep', () => {
    const store: Record<string, string> = {
      'cv-hunt-records': JSON.stringify({ runs: 2, wins: 1, bestStop: 10 }),
      'cv-legend-records': JSON.stringify({ jazz98: { best: 1000, stars: 3, attempts: 1 } }),
    };
    const parts = trophyParts(k => store[k] ?? null);
    expect(parts.find(p => p.id === 'hunt')!.trophies).toBe(2 * 80 + 1800);
    expect(parts.find(p => p.id === 'legend')!.trophies).toBe(3 * 350);
  });
});
