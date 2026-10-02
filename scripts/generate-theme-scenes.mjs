// Deterministic, local pixel scenery. No network, raster screenshots, or text baked into the artwork.
// Run with Node 22.18+: npm run theme:assets. The checked-in SVG/CSS works on every build host.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THEME_SKINS } from '../src/theme/skins.ts';

const out = fileURLToPath(new URL('../src/assets/looks/scenes/', import.meta.url));
mkdirSync(out, { recursive: true });
const W = 480, H = 240;
let art = [], seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rect = (x, y, w, h, fill, opacity = 1) => art.push(`<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" fill="${fill}"${opacity === 1 ? '' : ` opacity="${opacity}"`}/>`);
const path = (d, fill, stroke, width = 1, opacity = 1) => art.push(`<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${width}"` : ''}${opacity === 1 ? '' : ` opacity="${opacity}"`}/>`);
const line = (x, y, a, b, color, opacity = 1) => path(`M${x} ${y}H${a}V${b}`, 'none', color, 1, opacity);
function dots(color, count, area = [0, 0, W, H], alpha = .25) {
  for (let i = 0; i < count; i++) rect(area[0] + rnd() * area[2], area[1] + rnd() * area[3], 1 + (rnd() > .9 ? 1 : 0), 1, color, alpha);
}
function stars(color, count = 70) {
  dots(color, count, [0, 0, W, 155], .65);
  for (const [x, y] of [[43, 23], [124, 74], [326, 28], [428, 91]]) {
    rect(x - 3, y, 7, 1, color, .7); rect(x, y - 3, 1, 7, color, .7);
  }
}
function floor(base, color, wood = false) {
  rect(0, 172, W, 68, base);
  if (wood) {
    for (let y = 176; y < H; y += 8) {
      rect(0, y, W, 1, color, .12);
      for (let x = ((y / 8) % 2) * 34; x < W; x += 70) rect(x, y - 7, 1, 8, color, .12);
    }
  }
  path('M18 231L90 181H390L462 231ZM240 181V231M92 181L53 212H121L139 181M388 181L427 212H359L341 181', 'none', color, 1, .5);
  path('M209 207L215 198H264L271 207L264 217H215Z', 'none', color, 1, .4);
  rect(0, 171, W, 1, color, .55);
}
function hoop(color, x = 426, y = 33) {
  path(`M${x - 18} ${y}h36v24h-36zM${x - 7} ${y + 13}h14v10h-14z`, 'none', color, 1, .75);
  rect(x - 9, y + 24, 19, 2, color, .9);
  path(`M${x - 8} ${y + 27}l3 12h10l3 -12M${x - 5} ${y + 30}h10M${x - 4} ${y + 34}h8`, 'none', color, 1, .5);
}
function arena(p, monochrome = false, quiet = false) {
  rect(0, 15, W, 140, p.panel);
  for (let row = 0; row < 6; row++) {
    const y = 51 + row * 18;
    rect(0, y + 12, W, 2, p.line, .6);
    for (let x = 5; x < W; x += 9) {
      rect(x, y + rnd() * 3, 3, 4, rnd() > .86 ? p.accent : p.edge, quiet ? .14 : .32);
      rect(x - 1, y + 5, 5, 6, p.raised, .75);
    }
  }
  for (const x of [22, 457]) {
    rect(x, 0, 3, 169, p.line, .7);
    for (let y = 0; y < 170; y += 22) path(`M${x} ${y}l14 16h-14`, 'none', p.edge, 1, .3);
  }
  for (const x of [52, 407]) {
    rect(x - 15, 17, 34, 5, p.edge, .4);
    for (let i = 0; i < 4; i++) rect(x - 12 + i * 8, 18, 5, 4, p.text, .9);
    path(`M${x - 10} 23L${x - 36} 155H${x + 50}L${x + 12} 23Z`, p.text, null, 1, quiet ? .02 : .035);
  }
  rect(0, 153, W, 19, p.page);
  floor(monochrome ? p.raised : quiet ? p.page : p.raised, p.edge, !monochrome);
  hoop(p.edge);
}
function skyline(p, accent = p.accent) {
  for (let x = -5; x < W; x += 19) {
    const width = 12 + Math.floor(rnd() * 11), h = 14 + Math.floor(rnd() * 67), y = 170 - h;
    rect(x, y, width, h, p.page); rect(x + 3, y - 4, width - 6, 4, p.page);
    for (let a = x + 3; a < x + width - 2; a += 5) for (let b = y + 8; b < 166; b += 9) if (rnd() > .55) rect(a, b, 2, 3, accent, .4);
  }
}
function fence(p) {
  for (let x = -90; x < W + 100; x += 10) {
    path(`M${x} 88l85 84M${x} 172l85 -84`, 'none', p.edge, 1, .16);
  }
  for (let x = 0; x < W; x += 80) rect(x, 79, 2, 94, p.line);
  rect(0, 85, W, 2, p.edge, .5);
}
function mountains(p, y, color, detail = false) {
  let d = `M0 ${y + 32}`;
  for (let x = 0; x <= W; x += 16) d += `H${x}V${Math.round(y + Math.sin(x / 41) * 16 + rnd() * 21)}`;
  path(`${d}H480V182H0Z`, color);
  if (detail) for (let x = 0; x < W; x += 27) {
    const yy = y + 34 + rnd() * 10;
    path(`M${x} ${yy}h5v-8h-3v-6h-2v-6h-2v6h-2v6h-3v8h5v15h5Z`, p.page);
  }
}
function columns(p, marble = false) {
  for (const x of [18, 81, 378, 441]) {
    rect(x, 11, 20, 167, p.raised); rect(x + 3, 17, 3, 148, p.edge, .28); rect(x + 13, 17, 3, 148, p.page, .4);
    rect(x - 4, 8, 28, 6, p.edge); rect(x - 2, 15, 24, 3, p.accent, .45);
    rect(x - 3, 168, 26, 5, p.edge); rect(x - 7, 175, 34, 6, p.raised);
    if (!marble) {
      const bx = x + (x < 200 ? 28 : -29);
      path(`M${bx} 31h19v64l-9 7l-10 -7z`, p.panel, p.edge, 1, .8);
      path(`M${bx + 4} 48l3 4l2 -6l2 6l3 -4v11h-10z`, p.accent);
    }
  }
}
function courtDiagram(p) {
  path('M15 17H465V223H15ZM240 17V223M15 77H98V163H15M465 77H382V163H465M15 46H54L137 83V158L54 195H15M465 46H426L343 83V158L426 195H465', 'none', p.edge, 1, .5);
  path('M218 104H262V138H218Z', 'none', p.edge, 1, .5);
}

for (const [id, p] of Object.entries(THEME_SKINS)) {
  seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 19); art = [];
  rect(0, 0, W, H, p.page);
  switch (id) {
    case 'original': case 'scoreboard': case 'broadcast': case 'immortal':
      arena(p, false, id === 'immortal'); break;
    case 'prodark':
      rect(0, 0, W, 172, p.panel); floor(p.page, p.line); hoop(p.edge); break;
    case 'cartridge':
      rect(4, 4, 472, 232, p.edge); rect(7, 7, 466, 226, p.raised); rect(16, 15, 448, 210, p.panel);
      courtDiagram(p); for (let y = 22; y < 54; y += 5) rect(420, y, 26, 2, p.line); break;
    case 'terminal':
      for (let y = 0; y < H; y += 4) rect(0, y, W, 1, p.line, .13);
      for (const x of [24, 356]) for (let y = 25; y < 148; y += 12) for (let k = 0; k < 16; k++) if (rnd() > .48) rect(x + k * 5, y, 2, 2, p.accent, .28);
      floor(p.page, p.edge); hoop(p.edge); break;
    case 'frontoffice':
      rect(0, 0, W, H, p.raised);
      for (let x = 0; x < W; x += 12) rect(x, 0, 1, H, p.line, .4);
      for (let y = 0; y < H; y += 12) rect(0, y, W, 1, p.line, .4);
      courtDiagram(p); break;
    case 'hardwood':
      rect(0, 0, W, H, '#c99c65');
      for (let y = 0; y < H; y += 12) { rect(0, y, W, 1, '#8f683b', .28); for (let x = (y % 24) * 4; x < W; x += 99) rect(x, y, 1, 12, '#8f683b', .28); }
      dots('#fff0ce', 470, [0, 0, W, H], .15); courtDiagram({ ...p, edge: '#fff3d4' }); break;
    case 'blacktop':
      rect(0, 0, W, 172, '#372a25'); skyline(p); fence(p); floor(p.panel, '#c4c4b0'); dots(p.edge, 500, [0, 172, W, 68], .15); hoop(p.edge); break;
    case 'playbook':
      rect(0, 0, W, H, p.panel); dots(p.text, 640, [0, 0, W, H], .08); courtDiagram(p);
      for (const [x, y] of [[80, 51], [192, 61], [282, 163], [400, 178]]) path(`M${x} ${y}l8 8m0 -8l-8 8M${x + 15} ${y + 5}h26v24m-4 -4l4 4l4 -4`, 'none', p.accent, 1, .8);
      break;
    case 'handheld':
      arena(p, true); break;
    case 'neongrid':
      for (let y = 40; y < 134; y += 5) {
        const r = Math.sqrt(Math.max(0, 48 ** 2 - (y - 87) ** 2));
        rect(240 - r, y, r * 2, y > 90 ? 3 : 5, y > 93 ? '#d779b3' : '#eca77e');
      }
      stars(p.secondary, 30); skyline(p, p.secondary); floor(p.page, p.secondary);
      for (let x = -220; x < 720; x += 70) path(`M240 167L${x} 240`, 'none', p.secondary, 1, .45);
      for (const y of [179, 190, 207, 232]) rect(0, y, W, 1, p.secondary, .5);
      break;
    case 'arcade':
      rect(0, 0, W, 172, '#54365d'); stars(p.accent, 35); skyline(p); fence(p); floor(p.panel, p.accent); hoop(p.accent);
      for (const x of [29, 446]) { rect(x, 30, 2, 142, p.edge); rect(x - 6, 28, 14, 4, p.accent); }
      break;
    case 'comicpop':
      rect(0, 0, W, H, '#e65035');
      for (let x = 0; x < W; x += 10) for (let y = 0; y < 175; y += 10) if (x < 125 || x > 355 || y < 65) rect(x, y, 2, 2, p.text, .25);
      for (const [x, y] of [[0,0],[120,0],[360,0],[480,0],[0,130],[480,100]]) path(`M${x} ${y}l${x < 240 ? 80 : -80} ${y < 100 ? 95 : 25}l${x < 240 ? -55 : 55} ${y < 100 ? -60 : -10}Z`, p.text);
      floor('#f4d45c', p.text); break;
    case 'championship':
      rect(0, 0, W, H, p.panel);
      for (const x of [65, 168, 312, 415]) { path(`M${x} 10L${x - 45} 172H${x + 45}Z`, p.accent, null, 1, .045); rect(x - 5, 8, 10, 2, p.accent); }
      floor(p.page, p.edge); hoop(p.edge); break;
    case 'aurora':
      for (let x = 0; x < W; x += 4) {
        const y = 20 + Math.sin(x / 39) * 19 + Math.cos(x / 73) * 12;
        rect(x, y, 4, 39 + rnd() * 34, x % 12 ? p.accent : p.secondary, .09 + rnd() * .24);
        rect(x, y + 39, 4, 4 + rnd() * 10, p.accent, .45);
      }
      stars(p.text, 70); mountains(p, 92, p.raised); mountains(p, 119, p.panel, true); floor(p.page, p.edge);
      for (let i = 0; i < 85; i++) rect(rnd() * W, 185 + rnd() * 55, 5 + rnd() * 22, 1, rnd() > .6 ? p.secondary : p.accent, .14);
      break;
    case 'royalcourt':
      rect(0, 0, W, H, p.panel);
      for (let x = 110; x < 380; x += 20) rect(x, 0, 7, 172, p.raised, .45);
      columns(p); floor(p.page, p.edge); break;
    case 'galaxy':
      for (let i = 0; i < 440; i++) {
        const x = 280 + rnd() * 185, y = 15 + (x - 280) * .28 + (rnd() - .5) * 70;
        rect(x, y, 2, 2, p.secondary, .02 + rnd() * .12);
      }
      stars(p.secondary, 135); stars(p.text, 70); floor(p.panel, p.line); hoop(p.edge); break;
    case 'hallowed':
      rect(0, 0, W, H, p.panel);
      for (let i = 0; i < 14; i++) { const x = Math.round(rnd() * W); path(`M${x} 0l-12 28l8 13l-21 17l5 24l-17 18l8 35l-12 30`, 'none', p.edge, 1, .1); }
      columns(p, true); floor(p.raised, p.edge); break;
    case 'eclipse':
      for (let i = 0; i < 144; i++) {
        const a = i * Math.PI / 72, x = 240 + Math.cos(a) * 59, y = 89 + Math.sin(a) * 59;
        rect(x - 3, y - 3, 6, 6, p.accent, .08); rect(x - 1, y - 1, 2, 2, p.accent, .7);
      }
      mountains(p, 127, p.raised); mountains(p, 143, p.panel); floor(p.page, p.line); hoop(p.edge); break;
    case 'sovereign':
      stars(p.accent, 60); stars(p.secondary, 70); mountains(p, 131, p.panel);
      columns(p); floor(p.panel, p.edge);
      for (const x of [124, 352]) for (let y = 111; y < 172; y += 5) rect(x + rnd() * 8, y, 3, 5, p.secondary, .08 + rnd() * .23);
      break;
  }
  writeFileSync(`${out}/${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="1440" height="720" shape-rendering="crispEdges">${art.join('')}</svg>\n`);
}

let css = '/* Generated by scripts/generate-theme-scenes.mjs from skins.ts. */\n';
for (const [id, p] of Object.entries(THEME_SKINS)) {
  const selector = id === 'original' ? ':root:not([data-cv-theme])' : `:root[data-cv-theme="${id}"]`;
  css += `${selector}, [data-theme-preview="${id}"] {\n`;
  for (const [key, val] of Object.entries(p)) css += `  --look-${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${val};\n`;
  css += `  --look-scene: url('../assets/looks/scenes/${id}.svg');\n  --look-veil: ${p.page}eb;\n  --look-page-wash: ${p.page}b8;\n}\n`;
}
writeFileSync(new URL('../src/theme/skins.css', import.meta.url), css);
console.log(`Generated ${Object.keys(THEME_SKINS).length} pixel scenes and their shared CSS tokens.`);
