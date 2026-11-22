// Run `node scripts/menu-art/generate.mjs` with ImageMagick 7 to export all menu sprites.
// Drawing happens on integer grids. The encoder only packages their exact RGBA pixels.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { palettes } from './pixels.mjs';
import { poster, playNames } from './posters.mjs';
import { minigame, miniNames } from './minigames.mjs';
import { equipment, equipmentNames, chrome } from './equipment.mjs';
import { railInks, sideline } from './sidelines.mjs';

const out = fileURLToPath(new URL('../../src/assets/menu/', import.meta.url));

function write(grid, colors, path) {
  execFileSync('magick', [
    '-size', `${grid.width}x${grid.height}`, '-depth', '8', 'rgba:-',
    '-strip', '-define', 'webp:lossless=true', '-define', 'webp:exact=true', path,
  ], { input: grid.rgba(colors) });
}

for (const [style,palette] of Object.entries(palettes)) {
  const dir = join(out,style);
  mkdirSync(dir,{recursive:true});
  for (const name of playNames) write(poster(style,name),palette,join(dir,name+'.webp'));
  for (const name of miniNames) write(minigame(style,name),palette,join(dir,'mini-'+name+'.webp'));
  for (const name of equipmentNames) write(equipment(style,name),palette,join(dir,name+'.webp'));
  for (const name of ['coin','gem','hoop']) {
    write(chrome(style,name),{...palette,p:'#ab73c7',v:'#724774',a:'#efc5dc'},join(dir,name+'.webp'));
  }
  write(sideline(style),railInks[style],join(dir,'sideline.webp'));
}
