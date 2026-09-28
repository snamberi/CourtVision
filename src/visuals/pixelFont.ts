/*
 * A 5×7 bitmap font for team names painted on the floor, crests and banners. Drawing letters as pixels (rather
 * than relying on a web font) keeps them crisp at any zoom and identical on every machine.
 */
const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10011', '10101', '10101', '10101', '11001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  ' ': ['000', '000', '000', '000', '000', '000', '000'],
};

const r = (v: number) => Math.round(v * 100) / 100;
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** Width in font pixels (letters are 5 wide, a space 3, one pixel of tracking between characters). */
export function pixelTextWidth(text: string, tracking = 1): number {
  const chars = [...fold(text)].map(c => GLYPHS[c] ?? GLYPHS[' ']);
  return chars.reduce((w, g) => w + g[0].length, 0) + Math.max(0, chars.length - 1) * tracking;
}

/** An SVG path of the text's pixels, top-left at (0,0), one font pixel = `px` units. */
export function pixelTextPath(text: string, px = 1, tracking = 1): string {
  let x = 0;
  const out: string[] = [];
  for (const c of fold(text)) {
    const g = GLYPHS[c] ?? GLYPHS[' '];
    g.forEach((row, y) => {
      // Merge runs of lit pixels into one rectangle per run.
      let start = -1;
      for (let i = 0; i <= row.length; i++) {
        if (row[i] === '1') { if (start < 0) start = i; }
        else if (start >= 0) {
          // A hair of overlap so neighbouring runs don't show anti-aliased seams when scaled.
          const e = px * 0.06, w = (i - start) * px + e;
          out.push(`M${r((x + start) * px)} ${r(y * px)}h${r(w)}v${r(px + e)}h${r(-w)}z`);
          start = -1;
        }
      }
    });
    x += g[0].length + tracking;
  }
  return out.join('');
}

/** Splits a team name into city and nickname ("New York Empire" → New York / Empire). */
export function splitTeamName(name: string): { city: string; nickname: string } {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return { city: '', nickname: name.trim() };
  // Two-word nicknames that read as one ("Trail Blazers").
  const pair = words.slice(-2).join(' ');
  if (/^(trail blazers|red sox|golden knights|white sox|blue jays)$/i.test(pair) && words.length > 2) return { city: words.slice(0, -2).join(' '), nickname: pair };
  return { city: words.slice(0, -1).join(' '), nickname: words[words.length - 1] };
}
