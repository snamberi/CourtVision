import { memo } from 'react';
import { PixelIcon } from './PixelIcon';
import { pixelIconPath } from './pixelIconData';
import type { ModeEntry } from '../menu/modeCatalog';
import './modeCards.css';

const hash = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const mix = (a: string, b: string, t: number) => {
  const p = (x: string) => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};

/**
 * A mode's card art, all pixels: a banded sky in the mode's colours, a hardwood floor with its paint and arc, a hoop,
 * a few sparkles placed by the mode's id, and the mode's icon big in the middle.
 */
export const ModeArt = memo(function ModeArt({ entry, className }: { entry: ModeEntry; className?: string }) {
  const [sky, floor, accent] = entry.art;
  const h = hash(entry.id);
  const icon = pixelIconPath(entry.icon);
  const sparkles = Array.from({ length: 6 }, (_, i) => ({ x: 4 + ((h >>> (i * 5)) % 88), y: 3 + ((h >>> (i * 3 + 7)) % 22) }));
  return <svg className={`mode-art ${className ?? ''}`} viewBox="0 0 96 48" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" aria-hidden="true">
    {[0, 1, 2, 3].map(i => <rect key={i} x="0" y={i * 8} width="96" height="8" fill={mix(sky, '#0b1018', i / 5)} />)}
    {sparkles.map((s, i) => <rect key={i} className="ma-spark" style={{ animationDelay: `${(i * 0.37) % 2}s` }} x={s.x} y={s.y} width={i % 3 ? 1 : 2} height={i % 3 ? 1 : 2} fill={accent} opacity={0.75} />)}
    <rect x="0" y="32" width="96" height="16" fill={floor} />
    {[34, 38, 42, 46].map(y => <rect key={y} x="0" y={y} width="96" height="1" fill="#000" opacity=".12" />)}
    <rect x="0" y="32" width="96" height="1" fill="#fff" opacity=".35" />
    <rect x="66" y="36" width="30" height="12" fill={accent} opacity=".35" />
    <rect x="66" y="36" width="1" height="12" fill="#fff" opacity=".6" />
    <rect x="86" y="12" width="2" height="22" fill="#d9d9d9" />
    <rect x="80" y="10" width="12" height="9" fill="#f4f0e6" /><rect x="83" y="13" width="6" height="4" fill="none" stroke={accent} strokeWidth="1" />
    <rect x="76" y="19" width="8" height="1" fill={accent} />
    <svg className="ma-icon" x="22" y="2" width="44" height="44" viewBox="0 0 16 16"><path d={icon.d} fillRule="evenodd" fill="#000" opacity=".35" transform="translate(.6 .6)" /><path d={icon.d} fillRule="evenodd" fill={accent} />{icon.shine && <path d={icon.shine} fill="#fff" opacity=".35" />}</svg>
  </svg>;
});

/** A card for one way to play: artwork on top, then the icon, title and a one-line description. */
export function ModeCard({ entry, onOpen, selected, badge, compact }: { entry: ModeEntry; onOpen: (e: ModeEntry) => void; selected?: boolean; badge?: string; compact?: boolean }) {
  return <button className={`mode-tile ${selected ? 'selected' : ''} ${compact ? 'compact' : ''}`} onClick={() => onOpen(entry)} aria-pressed={selected}>
    <ModeArt entry={entry} />
    <span className="mode-tile-body">
      <b><PixelIcon name={entry.icon} size={16} /> {entry.title}</b>
      <small>{entry.desc}</small>
    </span>
    {badge && <em className="mode-tile-badge">{badge}</em>}
  </button>;
}
