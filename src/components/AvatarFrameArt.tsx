/* oxlint-disable react/only-export-components -- Pure SVG drawing helpers, not a Fast Refresh component boundary. */
import type { CSSProperties, ReactNode } from 'react';
import type { AvatarFrameId } from '../profile/avatarFrames';
import { pixelTextPath, pixelTextWidth } from '../visuals/pixelFont';

// All artwork stays inside the 100×100 box, with a clear 62×62 portrait aperture.
// Asset colours are deliberately independent of the application's theme palette.
const INK = '#080e19';
type Metal = { base: string; dark: string; light: string; gem: string };
const copper: Metal = { base: '#d48643', dark: '#693c22', light: '#ffe1a3', gem: '#ff963f' };
const silver: Metal = { base: '#b2cddd', dark: '#435a78', light: '#f1fcff', gem: '#68d8ff' };
const gold: Metal = { base: '#edbd49', dark: '#865624', light: '#fff3b5', gem: '#ee5670' };
const jade: Metal = { base: '#41ba89', dark: '#164b48', light: '#c4ffe1', gem: '#ffc96b' };
const violet: Metal = { base: '#ab84ee', dark: '#40316e', light: '#e9deff', gem: '#7fe9ff' };
const blue: Metal = { base: '#4b9eff', dark: '#1c315f', light: '#dcf7ff', gem: '#f3cf78' };
const polar = (a: number, r: number) => [50 + Math.sin(a * Math.PI / 180) * r, 50 - Math.cos(a * Math.PI / 180) * r];
const polygon = (r: number, n = 32, offset = 0) => Array.from({ length: n }, (_, i) => polar(i * 360 / n + offset, r).map(v => Math.round(v)).join(',')).join(' ');
const around = (n: number, r: number, draw: (x: number, y: number, i: number) => ReactNode, offset = 0) => Array.from({ length: n }, (_, i) => { const [x, y] = polar(i * 360 / n + offset, r); return <g key={i}>{draw(x, y, i)}</g>; });

function Gem({ x, y, color, size = 3 }: { x: number; y: number; color: string; size?: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <path d={`M0 ${-size-1}L${size+1} 0L0 ${size+1}L${-size-1} 0Z`} fill={INK} />
    <path d={`M0 ${-size}L${size} 0L0 ${size}L${-size} 0Z`} fill={color} />
    <path d={`M0 ${-size}L0 0H${-size}Z`} fill="#fff" opacity=".7" />
    <path d={`M0 0H${size}L0 ${size}Z`} fill={INK} opacity=".38" />
  </g>;
}

function Spark({ x, y, color = '#fff5cd', delay = 0, size = 1 }: { x: number; y: number; color?: string; delay?: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`} className="avf-detail">
    <path className="avf-spark" style={{ animationDelay: `${delay}s` }} d="M-1-4H1V-1H4V1H1V4H-1V1H-4V-1H-1Z" fill={color} />
  </g>;
}

function Ring({ metal, r = 34, rivets = false }: { metal: Metal; r?: number; rivets?: boolean }) {
  return <g fill="none">
    <polygon points={polygon(r)} stroke={INK} strokeWidth="9" />
    <polygon points={polygon(r)} stroke={metal.dark} strokeWidth="7" />
    <polygon points={polygon(r - .6)} stroke={metal.base} strokeWidth="4.2" />
    <path d={`M${50-r} 50A${r} ${r} 0 0 1 ${50+r} 50`} stroke={metal.light} strokeWidth="1.4" />
    <circle cx="50" cy="50" r="30.9" stroke={INK} strokeWidth="1.4" />
    <circle cx="50" cy="50" r={r+2.8} stroke={metal.light} strokeWidth=".6" opacity=".55" />
    {rivets && around(12, r, (x, y) => <g><rect x={x-1} y={y-1} width="2" height="2" fill={metal.dark} /><rect x={x-1} y={y-1} width="1" height="1" fill={metal.light} /></g>, 15)}
  </g>;
}

/** Layered, stepped feathers. A mirrored group keeps both wings within the art box. */
function Wings({ metal, count = 6, dragon = false }: { metal: Metal; count?: number; dragon?: boolean }) {
  return <g>{[-1, 1].map(side => <g key={side} transform={side === 1 ? 'translate(100 0) scale(-1 1)' : undefined}>
    {Array.from({ length: count }, (_, i) => {
      const y = 22 + i*6, tip = 2 + i*1.2, end = 27 - i*.4;
      return <g key={i}>
        <path d={`M${end} ${y+7}H${tip+8}V${y+3}H${tip+4}V${y-1}H${tip}V${y-8}L${end+3} ${y+1}Z`} fill={metal.dark} stroke={INK} strokeWidth="1" />
        <path d={`M${tip+2} ${y-6}L${end+1} ${y+2}L${end-1} ${y+4}H${tip+9}V${y}H${tip+5}V${y-2}H${tip+2}Z`} fill={i%2 ? metal.base : metal.light} opacity={dragon ? .85 : 1} />
        <path d={`M${tip+6} ${y-2}L${end-1} ${y+3}`} fill="none" stroke={metal.dark} strokeWidth=".7" />
        {dragon && <rect x={tip+8} y={y} width="2" height="2" fill={metal.gem} opacity=".5" />}
      </g>;
    })}
    <path d="M21 28L30 35L22 66L17 72L18 60Z" fill={metal.base} stroke={INK} strokeWidth="1" />
    <path d="M22 34L25 37L21 58" stroke={metal.light} fill="none" />
  </g>)}</g>;
}

function Crown({ metal = gold, sapphire = false }: { metal?: Metal; sapphire?: boolean }) {
  return <g>
    <path d="M33 18V6H36V8H39V11H43V7H46V3H48V1H52V3H54V7H57V11H61V8H64V6H67V18L64 22H36Z" fill={metal.dark} stroke={INK} strokeWidth="1.6" />
    <path d="M36 9L43 14L50 4L57 14L64 9V17H36Z" fill={metal.base} />
    <path d="M38 12L43 15L50 7L57 15L62 12" stroke={metal.light} strokeWidth="1.2" fill="none" />
    <path d="M36 18H64V21H36Z" fill={metal.light} /><path d="M36 21H64" stroke={metal.dark} />
    <Gem x={50} y={13} color={sapphire ? '#6bceff' : metal.gem} size={3} />
    {[40,60].map(x => <rect key={x} x={x-1} y="18" width="2" height="2" fill={sapphire ? '#3e7dea' : metal.gem} />)}
  </g>;
}

function Label({ text, metal, dark = false }: { text: string; metal: Metal; dark?: boolean }) {
  const px = text.length > 5 ? .95 : 1.55, width = pixelTextWidth(text)*px;
  return <g>
    <path d="M23 81H77V86H81L77 91L81 96H67V93H33V96H19L23 91L19 86H23Z" fill={metal.dark} stroke={INK} strokeWidth="1" />
    <path d="M25 81H75V93H25Z" fill={dark ? '#111c2b' : metal.base} stroke={INK} strokeWidth="1" />
    <path d="M26 82H74M26 82V91" stroke={metal.light} strokeWidth="1" />
    <path d={pixelTextPath(text, px)} transform={`translate(${50-width/2} ${text.length>5?84:82})`} fill={dark ? metal.light : INK} />
  </g>;
}

function Rank({ rank, metal }: { rank: number; metal: Metal }) {
  return <g><path d="M40 79H60V92L50 98L40 92Z" fill={metal.dark} stroke={INK} strokeWidth="1.4" />
    <path d="M42 81H58V91L50 95L42 91Z" fill={metal.base} />
    <path d="M43 82H57" stroke={metal.light} />
    <path d={pixelTextPath(String(rank),1.35)} transform={`translate(${50-pixelTextWidth(String(rank))*1.35/2} 84)`} fill={INK} />
  </g>;
}

function Ball({ x, y, r = 5 }: { x: number; y: number; r?: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <circle r={r+1} fill={INK} /><circle r={r} fill="#cb601e" />
    <path d={`M${-r} 0A${r} ${r} 0 0 1 ${r} 0Z`} fill="#ffae53" />
    <path d={`M${-r} 0H${r}M0 ${-r}V${r}M${-r*.65} ${-r*.75}Q0 0 ${-r*.65} ${r*.75}M${r*.65} ${-r*.75}Q0 0 ${r*.65} ${r*.75}`} stroke="#642d1e" strokeWidth=".8" fill="none" />
    <path d={`M-2 ${-r+1}H0`} stroke="#ffe2b5" strokeWidth="1" />
  </g>;
}

function Flames({ blueFire = false }: { blueFire?: boolean }) {
  const colors = blueFire ? ['#2149b1','#4a9cff','#c2f5ff'] : ['#b82a35','#fc7028','#ffe085'];
  return <g>{Array.from({length:16},(_,i) => <g key={i} transform={`rotate(${i*22.5} 50 50)`}>
    <g className={`avf-flame avf-flame-${i%3}`} style={{ animationDelay: `${-i*.13}s` }}>
      <path d="M44 20L43 15L47 16L46 10L50 3L50 10L54 13L55 20Z" fill={colors[0]} stroke={INK} strokeWidth=".7" />
      <path d="M46 20L46 16L49 17L49 12L50 9L52 15L53 20Z" fill={colors[1]} />
      <path d="M48 20L50 15L52 20Z" fill={colors[2]} />
    </g>
  </g>)}</g>;
}

function Laurels({ metal }: { metal: Metal }) {
  return <g>{[-1,1].map(side => <g key={side} transform={side===1?'translate(100 0) scale(-1 1)':undefined}>
    <path d="M38 90Q2 70 14 34" stroke={metal.dark} strokeWidth="3" fill="none" />
    {Array.from({length:7},(_,i) => <g key={i} transform={`translate(${10+i*i*.46} ${35+i*7.5}) rotate(${-25+i*8})`}>
      <path d="M0 8L-7 3V-5L0-1L2 4L7-2L9-4V4L4 10Z" fill={metal.base} stroke={INK} strokeWidth=".8" />
      <path d="M-5-2L0 4M3 7L7 2" stroke={metal.light} fill="none" />
    </g>)}
  </g>)}</g>;
}

export function frameArtwork(id: AvatarFrameId): { under?: ReactNode; over: ReactNode } {
  switch (id) {
    case 'rookie': return { over: <><Ring metal={copper} rivets /><circle cx="50" cy="50" r="37.5" fill="none" stroke="#efc184" strokeDasharray="1 3" strokeWidth="1" />{around(4,35,(x,y)=><Ball x={x} y={y} />)}</> };
    case 'courtside': return { under: <>
      <polygon points={polygon(44,8,22.5)} fill="#503122" stroke={INK} strokeWidth="2" />
      <polygon points={polygon(41,8,22.5)} fill="#bf884c" stroke="#eaca88" strokeWidth="1" />
      {Array.from({length:9},(_,i)=><path key={i} d={`M${24+(i%3)*2} ${14+i*9}h${50-(i%3)*2}m-39 2h24`} stroke={i%2?'#704923':'#e7b976'} strokeWidth=".9" opacity=".65" />)}
    </>, over: <><Ring metal={copper} />{around(8,40,(x,y)=><g><rect x={x-2} y={y-2} width="4" height="4" fill="#61432d" /><rect x={x-1.5} y={y-1.5} width="3" height="3" fill="#f2d088" /><path d={`M${x-1} ${y}h2`} stroke="#68472c" strokeWidth=".7" /></g>,22.5)}<Label text="CV" metal={copper} dark /></> };
    case 'neon': return { under: <><circle cx="50" cy="50" r="41" fill="#111731" stroke="#28365a" strokeWidth="1" />{around(4,42,(x,y,i)=><g transform={`rotate(${i*90+45} ${x} ${y})`}><rect x={x-5} y={y-3} width="10" height="6" fill="#132844" stroke="#459ba9" /><path d={`M${x-3} ${y}h6`} stroke="#ff81dd" strokeWidth="2" /></g>,45)}</>, over: <>
      <Ring metal={{base:'#49d6e5',dark:'#244779',light:'#d4ffff',gem:'#ef7edc'}} />
      <circle className="avf-pulse" cx="50" cy="50" r="40" fill="none" stroke="#ff69d6" strokeWidth="1.5" strokeDasharray="36 5 7 5" />
      <g className="avf-orbit"><circle cx="50" cy="50" r="38" fill="none" stroke="#9af7ff" strokeWidth="1.5" strokeDasharray="18 100" /><rect x="48" y="10" width="4" height="3" fill="#edffff" /></g>
    </> };
    case 'blaze': return { under:<Flames />, over:<><Ring metal={{base:'#ee7840',dark:'#79313a',light:'#ffce78',gem:'#ffefba'}} rivets />{[[-1,0],[1,1]].map(([s,i])=><g key={i} className="avf-embers" style={{animationDelay:`${-i*1.4}s`}}><rect x={50+s*41} y="24" width="2" height="3" fill="#ffd281" /><rect x={50+s*39} y="64" width="2" height="2" fill="#f49a3f" /></g>)}<Gem x={50} y={85} color="#ffd281" size={4} /></> };
    case 'dragon': return { under:<Wings metal={jade} dragon />, over:<>
      <Ring metal={jade} rivets />{around(12,35,(x,y)=><path d={`M${x-2} ${y-1}l2 3l2-3`} fill="none" stroke="#c4ffe1" strokeWidth=".8" />,15)}
      <path d="M38 13L35 4H39L44 9L50 4L56 9L61 4H65L62 13L59 21L53 24H47L41 21Z" fill="#276c5b" stroke={INK} strokeWidth="1.4" />
      <path d="M38 5L43 11L39 11ZM62 5L57 11H61Z" fill="#f1d18a" />
      <path d="M42 12L50 7L58 12L55 17H45Z" fill="#61cb94" />
      <path d="M43 15H47V17H43ZM53 15H57V17H53Z" fill="#ffe7a5" /><path d="M44 15H45V17H44ZM55 15H56V17H55Z" fill={INK} />
      <path d="M47 20H53L50 23Z" fill="#b0f7b2" /><Gem x={50} y={87} color="#93e9c6" size={5} /><Spark x={12} y={32} color="#c0ffe2" delay={.8} size={.6} />
    </> };
    case 'celestial': return { under:<><circle cx="50" cy="50" r="43" fill="#1d1637" stroke="#443568" /><circle cx="50" cy="50" r="40" fill="none" stroke="#7963ad" strokeDasharray="1 5" />{around(12,42,(x,y,i)=><rect x={x} y={y} width="1" height="1" fill={i%2?'#f7d5ff':'#66bff2'} />)}</>, over:<>
      <Ring metal={violet} /><g className="avf-orbit avf-orbit-slow"><circle cx="50" cy="50" r="42" fill="none" stroke="#76bddf" strokeWidth=".8" strokeDasharray="26 62" />{around(3,42,(x,y,i)=><Spark x={x} y={y} size={.85} delay={i} />)}</g>
      <Gem x={50} y={14} color="#bcacff" size={5} /><Gem x={50} y={86} color="#82e8ff" size={4} /><Spark x={18} y={24} color="#91e9ff" delay={1.2} size={.6} />
    </> };
    case 'bronzeCrest': return { under:<><path d="M20 17L50 11L80 17V57L70 77L50 96L30 77L20 57Z" fill="#573831" stroke={INK} strokeWidth="2" /><path d="M24 20L50 15L76 20V55L66 74L50 89L34 74L24 55Z" fill="#8b5435" stroke="#d59961" /><Wings metal={copper} count={4} /></>, over:<><Ring metal={copper} rivets /><Gem x={50} y={14} color="#f8c389" size={4} /><Rank rank={3} metal={copper} /></> };
    case 'silverWings': return { under:<Wings metal={silver} />, over:<><Ring metal={silver} rivets /><path d="M50 2L54 9L62 10L56 16L57 23L50 19L43 23L44 16L38 10L46 9Z" fill={silver.base} stroke={INK} strokeWidth="1.5" /><path d="M50 5L50 16L42 11L47 11Z" fill={silver.light} /><Rank rank={2} metal={silver} /><Spark x={24} y={28} color="#e1fcff" delay={.9} size={.7} /></> };
    case 'goldCrown': return { under:<Wings metal={gold} count={7} />, over:<><Ring metal={gold} rivets />{around(4,34,(x,y,i)=><Gem x={x} y={y} color={i%2?'#87d1f4':'#ee5670'} size={2.5} />,45)}<Crown /><Rank rank={1} metal={gold} /><Spark x={17} y={27} size={.7} /><Spark x={79} y={62} delay={1.5} size={.65} /></> };
    case 'undefeated': return { under:<><circle cx="50" cy="50" r="39" fill="#253348" />{[-1,1].map(s=><path key={s} transform={s===1?'translate(100 0) scale(-1 1)':undefined} d="M15 28H9V35H5V65H9V72H15V65H19V35H15Z" fill="#708ca1" stroke={INK} strokeWidth="1.4" />)}</>, over:<><Ring metal={silver} rivets /><path d="M50 3L54 10H62L56 16L58 23L50 19L42 23L44 16L38 10H46Z" fill="#def1fc" stroke={INK} strokeWidth="1.2" /><Gem x={50} y={14} color="#5c92b4" size={2.5} /><Label text="82-0" metal={silver} dark /></> };
    case 'perfectGold': return { under:<Laurels metal={gold} />, over:<><Ring metal={gold} rivets />{around(6,34,(x,y)=><Gem x={x} y={y} color="#d9f5ff" size={2} />,30)}<Crown /><Label text="98-0" metal={gold} /><Spark x={21} y={28} size={.7} delay={1} /><Spark x={83} y={63} size={.6} delay={2} /></> };
    case 'founding': return { under:<><path d="M50 8L80 19L90 50L77 80L50 95L23 80L10 50L20 19Z" fill="#693926" stroke={INK} strokeWidth="1.5" /><path d="M50 12L77 22L86 50L74 77L50 91L26 77L14 50L23 22Z" fill="#a2512b" stroke="#e7ba88" strokeDasharray="2 2" /></>, over:<><Ring metal={copper} rivets /><Ball x={50} y={11} r={8} /><Label text="FOUNDER" metal={{...copper,base:'#f9ddb0',light:'#fff3de'}} /></> };
    case 'sovereign': return { under:<><Wings metal={{base:'#38435f',dark:'#111d35',light:'#687b98',gem:'#6dcfff'}} count={7} /><Flames blueFire /></>, over:<><Ring metal={blue} rivets />{around(4,34,(x,y)=><Gem x={x} y={y} color="#80deff" size={2.5} />,45)}<Crown sapphire /><Label text="GM" metal={gold} dark /><Spark x={13} y={28} color="#a2eaff" size={.65} /><Spark x={86} y={58} color="#a2eaff" delay={1.5} size={.65} /></> };
    default: return { over:<circle cx="50" cy="50" r="32" fill="none" stroke="#3a4a5f" strokeWidth="1.5" /> };
  }
}

export const frameAccent = (id: string): CSSProperties => ({ '--frame-accent': ({ rookie:'#e79857', courtside:'#dabb83', neon:'#6fe3ee', blaze:'#ff935c', dragon:'#7ae0ae', celestial:'#b8a0f4', bronzeCrest:'#d7a277', silverWings:'#c0deef', goldCrown:'#f7d278', undefeated:'#b8d4e5', perfectGold:'#f7d278', founding:'#efb57e', sovereign:'#79c9ff' } as Record<string,string>)[id] ?? '#8797ac' } as CSSProperties);
