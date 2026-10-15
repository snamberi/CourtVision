import { memo } from 'react';
import { PET_ART, PET_ANCHORS, type PetId, type PetLook } from '../../profile/pets';

/** Shades a #rrggbb colour toward black (k < 0) or white (k > 0). */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const out = c.map(v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return `#${out.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Accessory pixels as [x, y, colour] around the pet's anchors (rows above 0 are the hat space). */
function accessoryPixels(id: PetId, look: PetLook): [number, number, string][] {
  const a = PET_ANCHORS[id], out: [number, number, string][] = [];
  const [hx, hy] = a.head, [ex, ey, ew] = a.eyes, [nx, ny, nw] = a.neck, ink = '#101623', gold = '#ffd166';
  switch (look.accessory) {
    case 'collar': for (let x = nx; x < nx + nw; x++) out.push([x, ny, look.accent]); out.push([nx + Math.floor(nw / 2), ny + 1, gold]); break;
    case 'bandana': for (let x = nx; x < nx + nw; x++) out.push([x, ny, look.accent]); for (let x = nx + 1; x < nx + nw - 1; x++) out.push([x, ny + 1, look.accent]); out.push([nx + Math.floor(nw / 2), ny + 2, look.accent]); break;
    case 'bow': out.push([hx - 2, hy - 1, look.accent], [hx - 1, hy - 1, look.accent], [hx, hy - 1, shade(look.accent, -0.4)], [hx + 1, hy - 1, look.accent], [hx + 2, hy - 1, look.accent], [hx - 2, hy - 2, look.accent], [hx + 2, hy - 2, look.accent]); break;
    case 'partyHat': out.push([hx - 1, hy - 1, look.accent], [hx, hy - 1, gold], [hx + 1, hy - 1, look.accent], [hx - 1, hy - 2, gold], [hx, hy - 2, look.accent], [hx, hy - 3, '#f4f0e6']); break;
    case 'crown': for (let x = hx - 2; x <= hx + 2; x++) out.push([x, hy - 1, gold]); out.push([hx - 2, hy - 2, gold], [hx, hy - 2, gold], [hx + 2, hy - 2, gold], [hx, hy - 1, '#e85d5d']); break;
    case 'shades': for (let x = ex; x < ex + ew; x++) out.push([x, ey, ink]); out.push([ex, ey - 1, ink], [ex + ew - 1, ey - 1, ink], [ex + 1, ey, '#4da3ff']); break;
  }
  return out;
}

/** A pet in pixel art, in its colour and accessory. */
export const PetSprite = memo(function PetSprite({ id, look, size = 64, title }: { id: PetId; look: PetLook; size?: number; title?: string }) {
  const pal: Record<string, string> = {
    o: '#101623', b: look.color, d: shade(look.color, -0.3), s: shade(look.color, -0.45), l: shade(look.color, 0.55),
    e: '#101623', w: '#ffffff', n: id === 'parrot' || id === 'owl' ? '#ffd166' : id === 'goldfish' ? shade(look.color, 0.35) : id === 'dragon' ? '#ffd166' : '#e8743b', p: '#ff9fb0',
  };
  const cells: [number, number, string][] = [];
  PET_ART[id].forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) cells.push([x, y, pal[ch]]); }));
  cells.push(...accessoryPixels(id, look));
  return <svg className="pet-sprite" width={size} height={size * 17 / 14} viewBox="0 -3 14 17" shapeRendering="crispEdges" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
    {cells.map(([x, y, c], i) => <rect key={i} x={x} y={y} width="1" height="1" fill={c} />)}
  </svg>;
});
