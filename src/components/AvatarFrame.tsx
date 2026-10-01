import { memo, useEffect, useState, type ReactNode } from 'react';
import type { AvatarLook } from '../profile/avatar';
import { avatarFrameDef, type AvatarFrameId } from '../profile/avatarFrames';
import { decodeAvatar } from '../profile/avatarCode';
import { equipped, PROFILE_EVENT } from '../profile/profile';
import { UserAvatar, useAvatar } from './UserAvatar';

/*
 * Profile-picture frames (see src/profile/avatarFrames.ts): your character's portrait in a ring, with the frame's art
 * around it. Drawn on a 100 x 100 box; the portrait fills the middle circle (radius 31).
 */

const C = 50, R = 31;
const polar = (deg: number, r: number): [number, number] => [C + Math.cos((deg - 90) * Math.PI / 180) * r, C + Math.sin((deg - 90) * Math.PI / 180) * r];
const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** A fan of feathers out of one side of the ring (side -1 = left, 1 = right). */
function Wing({ side, light, dark, n = 5, reach = 20 }: { side: -1 | 1; light: string; dark: string; n?: number; reach?: number }) {
  const feathers: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), y = 30 + t * 34, len = reach * (1 - Math.abs(t - .35) * .7);
    const bx = C + side * (R + 1), tip: [number, number] = [bx + side * len, y - 8 + t * 6];
    feathers.push(<polygon key={i} points={pts([[bx, y - 4], tip, [bx + side * len * .55, y + 4], [bx, y + 3]])} fill={i % 2 ? dark : light} stroke="#0b1018" strokeWidth=".8" />);
  }
  return <g>{feathers}</g>;
}
const Ring = ({ color, width = 4, r = R + 2, dash }: { color: string; width?: number; r?: number; dash?: string }) => <circle cx={C} cy={C} r={r} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} />;
const Badge = ({ n, fill, text = '#0b1018' }: { n: number; fill: string; text?: string }) => <g><rect x={C - 8} y={84} width={16} height={12} rx={2} fill={fill} stroke="#0b1018" strokeWidth="1.2" /><text x={C} y={93.5} textAnchor="middle" fontSize="10" fontWeight="900" fill={text} fontFamily="'Press Start 2P', monospace">{n}</text></g>;
const Gem = ({ x, y, c, s = 3.2 }: { x: number; y: number; c: string; s?: number }) => <polygon points={pts([[x, y - s], [x + s, y], [x, y + s], [x - s, y]])} fill={c} stroke="#0b1018" strokeWidth=".7" />;

function art(id: AvatarFrameId): { under?: ReactNode; over: ReactNode } {
  switch (id) {
    case 'rookie': return { over: <>
      <Ring color="#f47b20" width={5} /><Ring color="#ffb26b" width={1} r={R + 4} />
      {[0, 90, 180, 270].map(a => { const [x, y] = polar(a, R + 3); return <g key={a}><circle cx={x} cy={y} r={6} fill="#e8742a" stroke="#0b1018" strokeWidth="1" /><path d={`M${x - 6} ${y}h12M${x} ${y - 6}v12`} stroke="#5a2a0a" strokeWidth=".9" /></g>; })}
    </> };
    case 'courtside': {
      const oct = Array.from({ length: 8 }, (_, i) => polar(i * 45 + 22.5, R + 9));
      const inner = Array.from({ length: 8 }, (_, i) => polar(i * 45 + 22.5, R + 2));
      return { under: <polygon points={pts(oct)} fill="#b97a3e" stroke="#5a3a1a" strokeWidth="2" />, over: <>
        <polygon points={pts(inner)} fill="none" stroke="#7a4a20" strokeWidth="2" />
        {oct.map(([x, y], i) => <circle key={i} cx={x * .88 + C * .12} cy={y * .88 + C * .12} r={1.8} fill="#ffd166" stroke="#5a3a1a" strokeWidth=".6" />)}
        <path d={`M${C - 14} 12h28M${C - 14} 88h28`} stroke="#8a5a2b" strokeWidth="1" />
      </> };
    }
    case 'neon': return { over: <g className="avf-pulse">
      <Ring color="#4fd6d6" width={2.5} r={R + 2} /><Ring color="#ff6fd8" width={2.5} r={R + 7} />
      {[45, 135, 225, 315].map(a => { const [x, y] = polar(a, R + 7); return <rect key={a} x={x - 2} y={y - 2} width={4} height={4} fill="#fff" />; })}
    </g> };
    case 'blaze': {
      const tongues = Array.from({ length: 18 }, (_, i) => { const a = i * 20, h = i % 2 ? 9 : 14; return <polygon key={i} points={pts([polar(a - 8, R + 1), polar(a, R + h), polar(a + 8, R + 1)])} fill={i % 3 === 0 ? '#ffd166' : i % 3 === 1 ? '#ff9d3d' : '#e8322e'} />; });
      return { under: <g className="avf-flicker">{tongues}</g>, over: <Ring color="#e8322e" width={3.5} /> };
    }
    case 'dragon': return { under: <><Wing side={-1} light="#3fae7f" dark="#1f7a4a" /><Wing side={1} light="#3fae7f" dark="#1f7a4a" /></>, over: <>
      <Ring color="#1f7a4a" width={5} /><Ring color="#8fe3b8" width={1} r={R + 4.2} />
      <polygon points={pts([[C - 9, 13], [C, 2], [C + 9, 13], [C, 18]])} fill="#2f9a62" stroke="#0b1018" strokeWidth="1" />
      <circle cx={C - 3} cy={10} r={1.2} fill="#ffd166" /><circle cx={C + 3} cy={10} r={1.2} fill="#ffd166" /><Gem x={C} y={88} c="#6fdc93" s={4} />
    </> };
    case 'celestial': return { under: <circle cx={C} cy={C} r={R + 10} fill="#2a1450" opacity=".85" />, over: <>
      <Ring color="#b983ff" width={3} /><g className="avf-spin"><Ring color="#6fd3ff" width={1.2} r={R + 8} dash="3 4" />
        {[0, 120, 240].map(a => { const [x, y] = polar(a, R + 8); return <polygon key={a} points={pts([[x, y - 4], [x + 1.2, y - 1.2], [x + 4, y], [x + 1.2, y + 1.2], [x, y + 4], [x - 1.2, y + 1.2], [x - 4, y], [x - 1.2, y - 1.2]])} fill="#fff6c4" />; })}</g>
    </> };
    case 'bronzeCrest': return { under: <>
      <path d={`M${C - 36} 18h72v34c0 22-18 36-36 44c-18-8-36-22-36-44z`} fill="#8a5a2b" stroke="#0b1018" strokeWidth="1.5" />
      <Wing side={-1} light="#c07a45" dark="#8a4f24" n={4} reach={14} /><Wing side={1} light="#c07a45" dark="#8a4f24" n={4} reach={14} />
    </>, over: <><Ring color="#c07a45" width={4.5} /><Gem x={C} y={14} c="#ffb26b" /><Badge n={3} fill="#c07a45" /></> };
    case 'silverWings': return { under: <><Wing side={-1} light="#dfe6f0" dark="#9aa6b6" n={6} reach={22} /><Wing side={1} light="#dfe6f0" dark="#9aa6b6" n={6} reach={22} /></>, over: <>
      <Ring color="#b9c4d0" width={5} /><Ring color="#ffffff" width={1} r={R + 4.2} />
      <polygon points={pts([[C, 3], [C + 3, 11], [C + 11, 11], [C + 5, 16], [C + 7, 24], [C, 19], [C - 7, 24], [C - 5, 16], [C - 11, 11], [C - 3, 11]])} fill="#eef1f6" stroke="#0b1018" strokeWidth="1" />
      <Badge n={2} fill="#d7dde6" />
    </> };
    case 'goldCrown': return { under: <g className="avf-glow"><Wing side={-1} light="#ffe14d" dark="#c9971f" n={7} reach={24} /><Wing side={1} light="#ffe14d" dark="#c9971f" n={7} reach={24} /></g>, over: <>
      <Ring color="#ffd166" width={6} /><Ring color="#fff6c4" width={1.2} r={R + 5} /><Ring color="#9a6a10" width={1} r={R - 1} />
      {[45, 135, 225, 315].map((a, i) => { const [x, y] = polar(a, R + 2); return <Gem key={a} x={x} y={y} c={['#e8322e', '#4da3ff', '#6fdc93', '#b983ff'][i]} />; })}
      <path d={`M${C - 14} 16l-2-12l8 6l8-9l8 9l8-6l-2 12z`} fill="#ffd166" stroke="#0b1018" strokeWidth="1.2" />
      <Gem x={C} y={9} c="#e8322e" s={2.4} />
      <Badge n={1} fill="#ffd166" />
    </> };
    case 'undefeated': return { under: <circle cx={C} cy={C} r={R + 7} fill="#1b2230" />, over: <>
      <Ring color="#c9d1dc" width={5} /><Ring color="#6c7a8c" width={1} r={R + 5} dash="2 3" />
      <polygon points={pts([[C, 4], [C + 2.6, 10], [C + 9, 10], [C + 3.8, 14], [C + 5.6, 20], [C, 16.4], [C - 5.6, 20], [C - 3.8, 14], [C - 9, 10], [C - 2.6, 10]])} fill="#eef1f6" stroke="#0b1018" strokeWidth="1" />
      <path d={`M${C - 24} 80h48l-4 7l4 7h-48l4-7z`} fill="#0b1018" stroke="#c9d1dc" strokeWidth="1.4" />
      <text x={C} y={91} textAnchor="middle" fontSize="9" fontWeight="900" fill="#f4f0e6" fontFamily="'Press Start 2P', monospace">82-0</text>
    </> };
    case 'perfectGold': {
      const leaves = (side: -1 | 1) => Array.from({ length: 7 }, (_, i) => { const a = side * (115 + i * 17); const [x, y] = polar(a, R + 6); return <ellipse key={i} cx={x} cy={y} rx={5} ry={2.4} transform={`rotate(${a + (side > 0 ? 70 : 110)} ${x} ${y})`} fill={i % 2 ? '#c9971f' : '#ffe14d'} stroke="#0b1018" strokeWidth=".6" />; });
      return { under: <g className="avf-glow"><circle cx={C} cy={C} r={R + 9} fill="#3a2a06" opacity=".7" />{leaves(-1)}{leaves(1)}</g>, over: <>
        <Ring color="#ffd166" width={5.5} /><Ring color="#fff6c4" width={1.2} r={R + 4.6} />
        <path d={`M${C - 12} 15l-2-11l7 5l7-8l7 8l7-5l-2 11z`} fill="#ffd166" stroke="#0b1018" strokeWidth="1.2" /><Gem x={C} y={8} c="#fff6c4" s={2.2} />
        <path d={`M${C - 24} 80h48l-4 7l4 7h-48l4-7z`} fill="#ffd166" stroke="#0b1018" strokeWidth="1.4" />
        <text x={C} y={91} textAnchor="middle" fontSize="9" fontWeight="900" fill="#3a2a06" fontFamily="'Press Start 2P', monospace">98-0</text>
      </> };
    }
    case 'sovereign': {
      // Game owner: black angel wings, a ring of blue fire, a sapphire-and-gold king's crown.
      const tongues = Array.from({ length: 22 }, (_, i) => { const a = i * (360 / 22), h = i % 2 ? 8 : 13; return <polygon key={i} points={pts([polar(a - 7, R + 1), polar(a, R + h), polar(a + 7, R + 1)])} fill={i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#6fd3ff' : '#1f4fd9'} />; });
      return { under: <><g className="avf-glow"><circle cx={C} cy={C} r={R + 12} fill="#04081f" opacity=".9" />
          <Wing side={-1} light="#2a2f3f" dark="#0b0e16" n={8} reach={27} /><Wing side={1} light="#2a2f3f" dark="#0b0e16" n={8} reach={27} /></g>
        <g className="avf-flicker">{tongues}</g></>, over: <>
        <Ring color="#1f4fd9" width={5} /><Ring color="#9fe7ff" width={1.2} r={R + 4.5} /><Ring color="#ffd166" width={1} r={R - 1} />
        {[30, 150, 210, 330].map(a => { const [x, y] = polar(a, R + 2); return <Gem key={a} x={x} y={y} c="#6fd3ff" />; })}
        <path d={`M${C - 15} 17l-3-13l9 7l9-10l9 10l9-7l-3 13z`} fill="#ffd166" stroke="#0b1018" strokeWidth="1.2" />
        <path d={`M${C - 12} 15l-1.5-7l6 4.5l7.5-8l7.5 8l6-4.5l-1.5 7z`} fill="#4da3ff" opacity=".85" />
        <Gem x={C} y={8} c="#ffffff" s={2.4} /><Gem x={C - 8} y={12} c="#6fd3ff" s={1.8} /><Gem x={C + 8} y={12} c="#6fd3ff" s={1.8} />
        <rect x={C - 10} y={84} width={20} height={11} rx={2} fill="#0a1f6a" stroke="#ffd166" strokeWidth="1.2" />
        <text x={C} y={92.5} textAnchor="middle" fontSize="7" fontWeight="900" fill="#9fe7ff" fontFamily="'Press Start 2P', monospace">GM</text>
      </> };
    }
    default: return { over: <Ring color="#2a3546" width={2.5} /> };
  }
}

/** Your character's portrait inside a profile-picture frame. */
export const FramedAvatar = memo(function FramedAvatar({ look, team = null, frame = 'none', size = 64, title }: { look: AvatarLook; team?: { primary: string; secondary: string } | null; frame?: AvatarFrameId | string; size?: number; title?: string }) {
  const a = art(frame as AvatarFrameId);
  const pic = Math.round(size * (R * 2) / 100);
  return <span className={`avf avf-${frame}`} style={{ width: size, height: size }} role="img" aria-label={title ?? 'Character'}>
    <svg className="avf-art avf-under" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">{a.under}</svg>
    <span className="avf-pic" style={{ width: pic, height: pic }}><UserAvatar look={look} team={team} size={pic} mode="portrait" animate={false} title="" /></span>
    <svg className="avf-art" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">{a.over}</svg>
  </span>;
});

/** Your own character in a frame: the one you have equipped, or `frame` to try one on. */
export function MyFramedAvatar({ frame, size = 64, title }: { frame?: string; size?: number; title?: string }) {
  const { look, team } = useAvatar();
  const [equippedFrame, setEquippedFrame] = useState(() => equipped().avatarFrame);
  useEffect(() => { const bump = () => setEquippedFrame(equipped().avatarFrame); window.addEventListener(PROFILE_EVENT, bump); return () => window.removeEventListener(PROFILE_EVENT, bump); }, []);
  return <FramedAvatar look={look} team={team} frame={frame ?? equippedFrame} size={size} title={title} />;
}

/** A profile-picture frame as a road reward. */
export function FrameReward({ id, size = 44 }: { id: string; size?: number }) {
  return <><MyFramedAvatar frame={id} size={size} title={avatarFrameDef(id).name} /><small>{avatarFrameDef(id).name} · profile frame</small></>;
}

/** Someone's character from their look code (the boards and public profiles); nothing when they have none yet. */
export const CodeAvatar = memo(function CodeAvatar({ code, size = 28, framed = true, full = false, title }: { code?: string | null; size?: number; framed?: boolean; full?: boolean; title?: string }) {
  const d = decodeAvatar(code);
  if (!d) return null;
  if (full) return <UserAvatar look={d.look} size={size} title={title ?? 'Character'} />;
  return framed && d.frame !== 'none' ? <FramedAvatar look={d.look} frame={d.frame} size={size} title={title} />
    : <span className="avf avf-plain" style={{ width: size, height: size }}><span className="avf-pic" style={{ width: size, height: size }}><UserAvatar look={d.look} size={size} mode="portrait" animate={false} title={title ?? 'Character'} /></span></span>;
});
