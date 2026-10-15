import { ModeScene, type SceneMode } from './presentation/ModeScene';
import { memo, type CSSProperties } from 'react';
import { ModeEmblem, ModeIcon } from './ModeIcon';
import type { ModeEntry } from '../menu/modeCatalog';
import './modeCards.css';

/** Arena banners use the same emblem as their setup screen. Entirely local SVG. */
export const ModeArt = memo(function ModeArt({ entry, className }: { entry: ModeEntry; className?: string }) {
  const scene = entry.parent ?? entry.id;
  if (['franchise', 'legends', 'career', 'survival'].includes(scene)) return <span className={`mode-art mode-art-scene ${className ?? ''}`} style={{ '--mode-art-accent': entry.art[2] } as CSSProperties} aria-hidden="true">
    <ModeScene mode={scene as SceneMode} />
    <span className="mode-art-emblem"><ModeIcon mode={entry.id} fallback={scene} size={128} /></span>
  </span>;
  const [sky, floor, accent] = entry.art;
  return <svg className={`mode-art ${className ?? ''}`} viewBox="0 0 160 72" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <rect width="160" height="72" fill="#0b1120" />
    <path d="M0 0H160V48H0Z" fill={sky} opacity=".72" />
    <path d="M0 4H160M0 12H160M0 20H160M0 28H160M0 36H160" stroke="#0b1120" strokeWidth="3" opacity=".3" />
    <path className="ma-beams" d="M20 0H27L65 53H4ZM133 0H140L156 53H95Z" fill={accent} opacity=".09" />
    <path d="M0 43H160V72H0Z" fill={floor} opacity=".28" />
    <path d="M0 44H160M0 56H160M0 69H160M22 44L10 72M55 44L50 72M105 44L110 72M138 44L150 72" stroke={accent} strokeWidth=".5" opacity=".3" />
    <path d="M5 60H35V71M155 60H125V71M77 47H83V50H77" fill="none" stroke="#fff0c8" opacity=".3" />
    {[12, 24, 36, 118, 130, 142].map((x, i) => <g key={x}><rect x={x} y={27 + i % 2 * 4} width="5" height="2" fill={accent} opacity=".45" /><rect x={x + 2} y="38" width="3" height="2" fill="#fff0c8" opacity=".3" /></g>)}
    <path d="M6 7H25M6 10H18M135 7H154M142 10H154" stroke={accent} strokeWidth="1" opacity=".65" />
    <path d="M8 18V21M6 19H11M148 33V37M146 35H151" stroke={accent} className="ma-spark" />
    <path d="M53 64H107V67H53Z" fill="#060b15" opacity=".65" />
    <g transform="translate(52 7) scale(.875)"><ModeEmblem mode={entry.id} /></g>
    <path d="M0 71H160" stroke={accent} opacity=".6" />
  </svg>;
});

/** A card for one way to play: artwork on top, then the icon, title and a one-line description. */
export function ModeCard({ entry, onOpen, selected, badge, compact }: { entry: ModeEntry; onOpen: (e: ModeEntry) => void; selected?: boolean; badge?: string; compact?: boolean }) {
  return <button className={`mode-tile ${selected ? 'selected' : ''} ${compact ? 'compact' : ''}`} onClick={() => onOpen(entry)} aria-pressed={selected}>
    <ModeArt entry={entry} />
    <span className="mode-tile-body">
      <b><ModeIcon mode={entry.id} size={28} /> {entry.title}</b>
      <small>{entry.desc}</small>
      <span className="mode-tile-play">Play <span aria-hidden="true">→</span></span>
    </span>
    {badge && <em className="mode-tile-badge">{badge}</em>}
  </button>;
}
