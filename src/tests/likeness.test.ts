// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { likenessKey, likenessOf, likenessCode, readLikenessCode, setLikeness, LIKENESS_KEY } from '../visuals/likeness';
import { playerTraits, buildPlayerSprite } from '../visuals/playerSprite';

beforeEach(() => { localStorage.removeItem(LIKENESS_KEY); setLikeness('nobody', undefined); });

describe('real-player likeness', () => {
  it('matches names with accents, suffixes and year tags', () => {
    expect(likenessKey('Luka Dončić')).toBe('luka doncic');
    expect(likenessKey("Gary Payton '96")).toBe('gary payton');
    expect(likenessOf('LeBron James')?.hatStyle).toBe('headband');
  });
  it('real players look like themselves; a saved look still wins', () => {
    expect(playerTraits('Kareem Abdul-Jabbar').goggles).toBe(true);
    expect(playerTraits('Michael Jordan').hairStyle).toBe('bald');
    expect(playerTraits('Allen Iverson').sleeve).toBe(true);
    expect(playerTraits('Michael Jordan', { hairStyle: 'afroLarge' }).hairStyle).toBe('afroLarge');
    // Goggles draw: the sprite differs from the same player without them.
    const opts = { playerId: 'Kareem Abdul-Jabbar', primary: '#552583', secondary: '#fdb927' };
    expect(JSON.stringify(buildPlayerSprite(opts))).not.toBe(JSON.stringify(buildPlayerSprite({ ...opts, appearance: { goggles: false } })));
  });
  it('look codes round-trip, and a fix applies everywhere', () => {
    const look = { skin: 3, hairStyle: 'dreadsShort' as const, goggles: true };
    expect(readLikenessCode(likenessCode(look))).toEqual(look);
    expect(readLikenessCode('nope')).toBeNull();
    setLikeness('Stephen Curry', { hairStyle: 'afroLarge' });
    expect(playerTraits('Stephen Curry').hairStyle).toBe('afroLarge');
    setLikeness('Stephen Curry', undefined);
    expect(playerTraits('Stephen Curry').hairStyle).toBe('short');
  });
});
