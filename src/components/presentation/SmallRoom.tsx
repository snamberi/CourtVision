import { ModeEmblem } from '../ModeIcon';
import './nextLevel.css';

/** Compact, local pixel dioramas for the supporting screens. */
export function SmallRoom({ kind, title, detail }: { kind: 'settings' | 'shop' | 'challenge' | 'archive'; title: string; detail: string }) {
  const color = kind === 'settings' ? '#76becd' : kind === 'shop' ? '#be98f7' : kind === 'challenge' ? '#e9b955' : '#80bea3';
  const icon = kind === 'settings' ? 'perfect-custom' : kind === 'shop' ? 'hunt-album' : kind === 'challenge' ? 'tour' : 'league-history';
  return <div className={`small-room small-room-${kind}`}>
    <svg viewBox="0 0 420 144" shapeRendering="crispEdges" aria-hidden="true">
      <rect width="420" height="144" fill="#111c2a" /><path d="M0 112H420V144H0Z" fill="#2d2b31" />
      {[18, 58, 98].map(y => <path key={y} d={`M0 ${y}H420`} stroke="#223247" strokeWidth="3" />)}
      <path d="M12 14H408V119H12Z" fill="none" stroke={color} strokeWidth="2" opacity=".35" />
      {kind === 'settings' ? <g><path d="M44 30H166V108H44ZM259 30H377V108H259Z" fill="#314458" stroke="#080e19" strokeWidth="4" /><path d="M55 40H154V79H55ZM270 40H365V79H270Z" fill="#081923" />{[64, 87, 110, 133, 280, 304, 328, 350].map((x, i) => <g key={x}><rect x={x} y={51 + i % 3 * 6} width="8" height={24 - i % 3 * 6} fill={color} /><rect x={x} y="91" width="8" height="6" fill="#efd195" /></g>)}</g>
        : kind === 'shop' ? <g><path d="M20 18H400V32H20Z" fill="#492c58" />{Array.from({ length: 19 }, (_, i) => <rect key={i} x={20 + i * 20} y="18" width="10" height="17" fill={color} />)}<path d="M36 104H384V134H36Z" fill="#49342f" stroke="#9a744a" strokeWidth="3" /><path d="M36 115H384" stroke="#221c27" strokeWidth="3" />{[62, 105, 290, 337].map((x, i) => <g key={x}><path d={`M${x} 54H${x + 18}V84H${x}Z`} fill={i % 2 ? '#dbaa48' : '#8d6aba'} stroke="#e6d4b4" strokeWidth="2" /><path d={`M${x - 6} 91H${x + 24}`} stroke="#a47e52" strokeWidth="4" /></g>)}</g>
        : kind === 'challenge' ? <g>{[45, 110, 285, 350].map((x, i) => <g key={x}><path d={`M${x - 20} 20H${x + 20}V84L${x} 99L${x - 20} 84Z`} fill={i % 2 ? '#4e3041' : '#233f59'} stroke={color} strokeWidth="2" /><path d={`M${x - 9} 36H${x + 9}V51L${x} 62L${x - 9} 51Z`} fill={color} /><path d={`M${x - 1} 60V72M${x - 9} 73H${x + 9}`} stroke={color} strokeWidth="3" /></g>)}</g>
        : <g>{[42, 107, 282, 347].map((x, i) => <g key={x}><rect x={x - 22} y="29" width="44" height="79" fill="#304551" stroke="#77928d" strokeWidth="2" /><path d={`M${x - 17} 65H${x + 17}`} stroke="#111c2a" strokeWidth="3" /><rect x={x - 10} y="43" width="20" height="8" fill={i % 2 ? '#dcb773' : color} /><rect x={x - 8} y="80" width="16" height="4" fill="#d9dfcf" /></g>)}</g>}
      <g transform="translate(154 13) scale(1.75)"><ModeEmblem mode={icon} /></g>
      <path d="M0 139H420" stroke={color} strokeWidth="2" opacity=".7" />
    </svg>
    <div><b>{title}</b><p>{detail}</p></div>
  </div>;
}
