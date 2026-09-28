import { memo } from 'react';
import { ICON_PIXELS, PALETTE, colorCss, type IconId } from '../profile/cosmetics';

/** A profile icon: a 10 x 10 pixel sprite on a dark tile (runs of one colour drawn as one rect). */
export const ProfileIcon = memo(function ProfileIcon({ id, size = 28, title }: { id: string | null | undefined; size?: number; title?: string }) {
  const rows = ICON_PIXELS[(id && id in ICON_PIXELS ? id : 'ball') as IconId];
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      let w = 1;
      while (row[x + w] === ch) w++;
      if (ch !== '.') rects.push({ x, y, w, fill: PALETTE[ch] });
      x += w;
    }
  });
  return <svg className="profile-icon" width={size} height={size} viewBox="-1 -1 12 12" shapeRendering="crispEdges" role="img" aria-label={title ?? 'Profile icon'}>
    <rect x={-1} y={-1} width={12} height={12} fill="#121926" />
    {rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />)}
  </svg>;
});

/** A GM's name in their chosen colour, with their icon (`icon={null}` leaves the icon out). */
export function NameTag({ name, icon, color, size = 18, className }: { name: string; icon?: string | null; color?: string | null; size?: number; className?: string }) {
  const css = colorCss(color);
  const gradient = css.startsWith('linear');
  return <span className={`name-tag${className ? ` ${className}` : ''}`}>
    {icon !== null && <ProfileIcon id={icon} size={size} title="" />}
    <span className={gradient ? 'name-prism' : undefined} style={gradient ? { backgroundImage: css } : { color: css }}>{name}</span>
  </span>;
}
