import { describe, it, expect } from 'vitest';
import { encodeFlag, decodeFlag, cleanFlag, randomFlag, patternCells, cellOf, emblemBox, DEFAULT_FLAG, FLAG_CELLS, FLAG_PATTERNS, EMBLEMS, type ClanFlag } from '../cloud/clanFlag';
import { clanLink, CLAN_CODE, CLAN_PRICE } from '../cloud/clubs';

describe('clan flags', () => {
  it('round-trips through its code, painted pixels included, and stays under 200 characters', () => {
    const f: ClanFlag = { pattern: 'nordic', colors: ['#ce1141', '#ffffff', '#0b1018'], emblem: 'crown', emblemColor: '#ffd166', place: 'tl', size: 3, paint: [] };
    expect(decodeFlag(encodeFlag(f))).toEqual(f);
    const painted = cleanFlag({ ...f, pattern: 'paint', paint: Array.from({ length: FLAG_CELLS }, (_, i) => i % 4) });
    const code = encodeFlag(painted);
    expect(code.length).toBeLessThanOrEqual(200);
    expect(decodeFlag(code)).toEqual(painted);
    for (let i = 0; i < 50; i++) { const r = randomFlag(); expect(decodeFlag(encodeFlag(r))).toEqual(r); }
  });
  it('draws the default flag from a bad code, and cleans bad values', () => {
    for (const bad of [null, '', 'nope', '2|h3', 'x'.repeat(300)]) expect(decodeFlag(bad)).toEqual(DEFAULT_FLAG);
    const f = decodeFlag('1|zigzag|zzzzzz,00ff00|dragon|12|middle|9|');
    expect(f).toMatchObject({ pattern: DEFAULT_FLAG.pattern, colors: [DEFAULT_FLAG.colors[0], '#00ff00', DEFAULT_FLAG.colors[2]], emblem: DEFAULT_FLAG.emblem, place: 'c', size: 2 });
    // A <script> or url() can never get into a colour: only #rrggbb passes.
    expect(cleanFlag({ colors: ['red;background:url(x)', '#12345', '#ABCDEF'] as never }).colors).toEqual([DEFAULT_FLAG.colors[0], DEFAULT_FLAG.colors[1], '#abcdef']);
    expect(cleanFlag({ pattern: 'paint', paint: [9, -1, 2.7] }).paint.slice(0, 3)).toEqual([0, 0, 2]);
  });
  it('every pattern colours every pixel with one of its three colours, and Paint starts from the pattern', () => {
    for (const p of FLAG_PATTERNS) for (let y = 0; y < 10; y++) for (let x = 0; x < 15; x++) expect([0, 1, 2]).toContain(cellOf(p, x + 0.5, y + 0.5));
    const cells = patternCells({ ...DEFAULT_FLAG, pattern: 'h3' });
    expect(cells).toHaveLength(FLAG_CELLS);
    expect([cells[0], cells[15 * 5], cells[FLAG_CELLS - 1]]).toEqual([0, 1, 2]);
  });
  it('emblems are 7 x 7 and fit on the flag', () => {
    for (const e of Object.values(EMBLEMS)) { expect(e.art).toHaveLength(7); for (const row of e.art) expect(row).toMatch(/^[.#]{7}$/); }
    for (const place of ['c', 'l', 'tl'] as const) for (const size of [1, 2, 3] as const) {
      const b = emblemBox({ ...DEFAULT_FLAG, place, size });
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + 7 * b.px).toBeLessThanOrEqual(15 + 1e-9); expect(b.y + 7 * b.px).toBeLessThanOrEqual(10 + 1e-9);
    }
  });
});

describe('clans', () => {
  it('cost 100,000 coins and share a link with a 12-character code', () => {
    expect(CLAN_PRICE).toBe(100_000);
    expect(clanLink('0123456789ab', 'https://courtvisiongame.com')).toBe('https://courtvisiongame.com/#/clans/join/0123456789ab');
    expect(CLAN_CODE.test('0123456789ab')).toBe(true);
    expect(CLAN_CODE.test('0123456789AB')).toBe(false);
    expect(CLAN_CODE.test("x' or 1=1")).toBe(false);
  });
});
