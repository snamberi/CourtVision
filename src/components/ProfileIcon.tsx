import { memo } from 'react';
import { SPRITES, PALETTE, colorDef, iconDef } from '../profile/cosmetics';
import { titleColorDef, unpackColors } from '../profile/trophyRoad';

/** A profile icon: a 10 x 10 pixel sprite on a dark tile (runs of one colour drawn as one rect). */
export const ProfileIcon = memo(function ProfileIcon({ id, size = 28, title }: { id: string | null | undefined; size?: number; title?: string }) {
  const def = iconDef(id);
  const rows = SPRITES[def.base] ?? SPRITES.ball;
  const palette = def.recolor ? { ...PALETTE, ...def.recolor } : PALETTE;
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      let w = 1;
      while (row[x + w] === ch) w++;
      if (ch !== '.') rects.push({ x, y, w, fill: palette[ch] });
      x += w;
    }
  });
  // Trophy Road icons move: the sprite flickers, spins, twinkles… and 'shine' sweeps a glint across it.
  return <svg className={`profile-icon${def.anim ? ` icon-anim icon-anim-${def.anim}` : ''}`} width={size} height={size} viewBox="-1 -1 12 12" shapeRendering="crispEdges" role="img" aria-label={title ?? def.name}>
    <rect x={-1} y={-1} width={12} height={12} fill="#121926" />
    <g className="icon-sprite">{rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />)}</g>
    {def.anim === 'shine' && <rect className="icon-glint" x={-4} y={-1} width={2} height={12} fill="#ffffff" opacity=".55" transform="skewX(-20)" />}
  </svg>;
});

/** Text in a cosmetic colour: flat, a gradient, or an animated gradient. */
function Tinted({ css, anim, className, children }: { css: string; anim?: string; className?: string; children: React.ReactNode }) {
  const gradient = css.startsWith('linear');
  return <span className={[className, gradient ? 'name-prism' : '', anim ? `anim-${anim}` : ''].filter(Boolean).join(' ') || undefined} style={gradient ? { backgroundImage: css } : { color: css }}>{children}</span>;
}

/**
 * A GM's name in their chosen colour, with their icon (`icon={null}` leaves the icon out) and, when given, their title
 * underneath in its own colour. `color` may carry the title colour too ("gold|fire", as the boards store it).
 */
export function NameTag({ name, icon, color, title, titleColor, size = 18, className }: { name: string; icon?: string | null; color?: string | null; title?: string | null; titleColor?: string | null; size?: number; className?: string }) {
  const packed = unpackColors(color);
  const c = colorDef(packed.color), tc = titleColorDef(titleColor ?? packed.titleColor);
  return <span className={`name-tag${title ? ' name-tag-titled' : ''}${className ? ` ${className}` : ''}`}>
    {icon !== null && <ProfileIcon id={icon} size={title ? Math.round(size * 1.35) : size} title="" />}
    {title ? <span className="name-tag-lines"><Tinted css={c.css} anim={c.anim}>{name}</Tinted><Tinted className="name-tag-title" css={tc.css} anim={tc.anim}>{title}</Tinted></span>
      : <Tinted css={c.css} anim={c.anim}>{name}</Tinted>}
  </span>;
}
