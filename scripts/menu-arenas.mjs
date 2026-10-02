// Draws the pixel arena sides behind the main menu for the Court Vision and Scoreboard looks:
// src/assets/looks/arena-<look>-<left|right>.svg. Seeded, so re-running gives the same pictures.
//   node scripts/menu-arenas.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'looks');
const W = 640, H = 900, P = 6; // a "pixel" is 6 px

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;

// A 5x7 pixel font for the banner lettering (a background image can't load the page's fonts).
const GLYPH = {
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'], V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
};
function pixelText(text, x, y, px, fill) {
  let s = '';
  [...text].forEach((ch, i) => GLYPH[ch]?.forEach((row, j) => [...row].forEach((b, k) => { if (b === '1') s += r(x + (i * 6 + k) * px, y + j * px, px, px, fill); })));
  return s;
}

/** The crowd: rows of pixel fans in the stands, darker towards the back. x0 is the side nearest the court. */
function crowd(rand, top, bottom, shirts, skin, dark) {
  let s = '';
  for (let y = top, row = 0; y < bottom; y += P * 4, row++) {
    s += r(0, y + P * 3, W, P, dark);
    for (let x = (row % 2) * P * 2; x < W; x += P * 4) {
      if (rand() < 0.12) continue;
      const shirt = shirts[Math.floor(rand() * shirts.length)], face = skin[Math.floor(rand() * skin.length)];
      s += r(x, y + P, P * 2, P * 2, shirt) + r(x + P / 2, y, P, P, face);
    }
  }
  return s;
}

/** A cluster of stadium lights. */
function lights(cx, cy, n, glow, bulb) {
  let s = `<circle cx="${cx + n * 9}" cy="${cy + 6}" r="${n * 22}" fill="url(#halo)"/>`;
  for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
    const x = cx + i * 18, y = cy + j * 16 - i * 4;
    s += `<circle cx="${x}" cy="${y}" r="7" fill="${glow}" opacity=".5"/><rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${bulb}"/>`;
  }
  return s;
}

/** The wooden floor, with planks running towards the court. */
function floor(top, wood, line, accent) {
  let s = r(0, top, W, H - top, wood[0]);
  for (let y = top, i = 0; y < H; y += P * 3, i++) s += r(0, y, W, P * 3, wood[i % wood.length]) + r(0, y + P * 3 - 2, W, 2, line);
  for (let x = (top % 7) * 3; x < W; x += 84) for (let y = top; y < H; y += P * 6) s += r(x + ((y / (P * 3)) % 2) * 42, y, 2, P * 3, line);
  return s + r(0, top, W, P, accent);
}

function svg(body, flip, halo) {
  const defs = `<defs><radialGradient id="halo"><stop offset="0" stop-color="${halo}" stop-opacity=".55"/><stop offset=".45" stop-color="${halo}" stop-opacity=".18"/><stop offset="1" stop-color="${halo}" stop-opacity="0"/></radialGradient></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">${defs}${flip ? `<g transform="translate(${W} 0) scale(-1 1)">${body}</g>` : body}</svg>\n`;
}

// ---- Court Vision (the original): navy stands, orange banners with basketballs, warm lights, maple floor.
function original(seed) {
  const rand = rng(seed);
  let s = r(0, 0, W, H, '#07142b');
  s += r(0, 0, W, 210, '#0a1a36');
  for (let x = 0; x < W; x += 48) s += r(x, 0, 6, 210, '#0d2246');
  s += r(0, 204, W, 6, '#16305c');
  s += crowd(rand, 220, 600, ['#1d3f7a', '#24508f', '#15336a', '#ff8a2a', '#e86a1a', '#f4f0e6', '#2a5fa8'], ['#f2c29a', '#c88a5c', '#8a5634', '#5a3420'], '#0a1a36');
  s += `<rect x="0" y="210" width="${W}" height="390" fill="url(#shade)"/>`;
  // Banners: navy cloth, orange trim, a pixel basketball.
  for (const [bx, by] of [[150, 110], [450, 70]]) {
    s += r(bx, by, 96, 150, '#0f2a5c') + r(bx, by, 96, 6, '#ff8a2a') + r(bx, by + 144, 96, 6, '#ff8a2a') + r(bx, by, 6, 150, '#ff8a2a') + r(bx + 90, by, 6, 150, '#ff8a2a');
    s += `<path d="M${bx} ${by + 150} l48 24 l48 -24 z" fill="#0f2a5c"/>`;
    const cx = bx + 48, cy = by + 78;
    s += `<circle cx="${cx}" cy="${cy}" r="24" fill="#f07a1e"/><rect x="${cx - 24}" y="${cy - 2}" width="48" height="4" fill="#3a1a08"/><rect x="${cx - 2}" y="${cy - 24}" width="4" height="48" fill="#3a1a08"/><path d="M${cx - 15} ${cy - 18} q10 18 0 36 M${cx + 15} ${cy - 18} q-10 18 0 36" stroke="#3a1a08" stroke-width="4" fill="none"/>`;
  }
  s += lights(40, 34, 4, '#ffb347', '#fff2c9') + lights(340, 18, 4, '#ffb347', '#fff2c9');
  s += r(0, 600, W, 12, '#1d3f7a') + r(0, 612, W, 6, '#ff8a2a');
  s += floor(618, ['#d4893c', '#c97d33', '#de9548', '#c4782f'], '#a85f22', '#f6b25e');
  // Sideline paint and the glow off the floor.
  s += r(0, 700, W, 6, '#fff1d6') + `<rect x="0" y="618" width="${W}" height="${H - 618}" fill="url(#g)" />`;
  return `<defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050d1f" stop-opacity=".65"/><stop offset="1" stop-color="#050d1f" stop-opacity=".2"/></linearGradient><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a3a" stop-opacity=".25"/><stop offset="1" stop-color="#07142b" stop-opacity=".1"/></linearGradient></defs>` + s;
}

// ---- Scoreboard: steel trusses, white floodlights, black "COURT VISION" banners, dark crowd, a glossy floor with orange arcs.
function scoreboard(seed, flip = false) {
  const rand = rng(seed);
  let s = r(0, 0, W, H, '#07080a');
  s += crowd(rand, 230, 640, ['#1a1c22', '#23262d', '#2c2a26', '#3a2c18', '#1f2a3a', '#4a3a20'], ['#5a4636', '#3f3025', '#7a5c44'], '#050607');
  s += `<rect x="0" y="230" width="${W}" height="410" fill="#000" opacity=".35"/>`;
  // Trusses: two columns with X bracing, and a beam across the top.
  for (const tx of [40, 520]) {
    s += r(tx, 0, 10, H, '#2a2d33') + r(tx + 60, 0, 10, H, '#2a2d33');
    for (let y = 0; y < H; y += 70) s += `<path d="M${tx + 5} ${y} L${tx + 65} ${y + 70} M${tx + 65} ${y} L${tx + 5} ${y + 70}" stroke="#202328" stroke-width="5"/>` + r(tx, y, 70, 5, '#33373e');
  }
  s += r(0, 0, W, 34, '#1b1d21') + r(0, 34, W, 6, '#2c3036');
  for (let x = 0; x < W; x += 40) s += `<path d="M${x} 0 L${x + 20} 34 L${x + 40} 0" stroke="#2a2d33" stroke-width="4" fill="none"/>`;
  s += lights(420, 52, 4, '#fff7d6', '#ffffff') + lights(500, 470, 3, '#fff7d6', '#ffffff') + lights(150, 60, 3, '#fff7d6', '#ffffff');
  for (const [lx, ly] of [[150, 300], [600, 380], [330, 470], [80, 520]]) s += `<circle cx="${lx}" cy="${ly}" r="4" fill="#ffcf6b"/><circle cx="${lx}" cy="${ly}" r="10" fill="#ffcf6b" opacity=".25"/>`;
  // Banners: black cloth, orange trim, the logo and the name.
  for (const [bx, by] of [[140, 130], [370, 150]]) {
    s += r(bx, by, 124, 300, '#0b0b0c') + `<rect x="${bx + 6}" y="${by + 6}" width="112" height="288" fill="none" stroke="#c9822a" stroke-width="4"/>`;
    s += `<g transform="translate(${bx + 38} ${by + 40})" fill="none" stroke="#e39a3a" stroke-width="6"><path d="M4 4 h40 v18 h-40 z M10 22 v14 h28 v-14 M16 36 v12 M24 36 v12 M32 36 v12"/></g>`;
    s += `<g transform="${flip ? `translate(${2 * (bx + 62)} 0) scale(-1 1) ` : ''}rotate(-6 ${bx + 62} ${by + 190})">${pixelText('COURT', bx + 20, by + 150, 3, '#e39a3a')}${pixelText('VISION', bx + 9, by + 190, 3, '#e39a3a')}</g>`;
  }
  // Floor: dark glossy wood, lit orange arcs.
  s += r(0, 640, W, H - 640, '#2a1608');
  for (let y = 640, i = 0; y < H; y += 14, i++) s += r(0, y, W, 14, ['#3a200c', '#331c0a', '#40240e'][i % 3]) + r(0, y + 12, W, 2, '#1f1006');
  s += `<rect x="0" y="640" width="${W}" height="${H - 640}" fill="url(#sg)"/>`;
  s += `<ellipse cx="${W + 40}" cy="840" rx="420" ry="90" fill="none" stroke="#ff9a2a" stroke-width="7"/><ellipse cx="${W + 40}" cy="840" rx="420" ry="90" fill="none" stroke="#ff9a2a" stroke-width="22" opacity=".18"/>`;
  s += `<ellipse cx="-40" cy="700" rx="300" ry="40" fill="none" stroke="#ffb347" stroke-width="5" opacity=".7"/>`;
  return `<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347" stop-opacity=".35"/><stop offset=".4" stop-color="#ff8a1a" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient></defs>` + s;
}

mkdirSync(OUT, { recursive: true });
for (const [name, draw] of [['original', original], ['scoreboard', scoreboard]]) {
  // The left side faces the court on its right; the right side is drawn fresh (different fans) and mirrored.
  writeFileSync(join(OUT, `arena-${name}-left.svg`), svg(draw(name === 'original' ? 11 : 21), false, name === 'original' ? '#ffb347' : '#fff3c4'));
  writeFileSync(join(OUT, `arena-${name}-right.svg`), svg(draw(name === 'original' ? 12 : 22, true), true, name === 'original' ? '#ffb347' : '#fff3c4'));
}
console.log('menu arenas written to', OUT);
