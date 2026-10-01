import { memo, useId, useMemo } from 'react';
import { SPRITES, PALETTE, colorDef, iconDef } from '../profile/cosmetics';
import { titleColorDef, unpackColors } from '../profile/trophyRoad';
import { detailedSpritePaths, gridToPaths, type SpriteGrid, type SpritePath } from '../visuals/playerSprite';
import { iconFx } from '../visuals/iconFx';

/** A profile icon: a 10 x 10 pixel sprite on a dark tile (runs of one colour drawn as one rect). */
export const ProfileIcon = memo(function ProfileIcon({ id, size = 28, title }: { id: string | null | undefined; size?: number; title?: string }) {
  const def = iconDef(id);
  const clip = `icon-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { paths, fx } = useMemo(() => {
    const rows = SPRITES[def.base] ?? SPRITES.ball;
    const palette = def.recolor ? { ...PALETTE, ...def.recolor } : PALETTE;
    const grid = rows.map(row => [...row].map(ch => ch === '.' ? null : palette[ch] ?? null));
    const fxGrids = iconFx(grid, def.anim, def.fx ?? (def.base === 'crown' || def.base === 'goatcrown' ? 'gold' : 'fire'));
    const draw = (g?: SpriteGrid) => (g ? gridToPaths(g) : []);
    return { paths: detailedSpritePaths(grid), fx: { under: draw(fxGrids.under), a: draw(fxGrids.a), b: draw(fxGrids.b) } };
  }, [def]);
  const layer = (list: SpritePath[], className: string) => list.length > 0 && <g className={className} transform="translate(-1 -1)">{list.map(p => <path key={p.fill} d={p.d} fill={p.fill} />)}</g>;
  // Trophy Road icons move: flames lick round the fireball, a glint crosses the trophy, sparkles twinkle in turn…
  return <svg className={`profile-icon${def.anim ? ` icon-anim icon-anim-${def.anim}` : ''}`} width={size} height={size} viewBox="-1 -1 12 12" shapeRendering="crispEdges" role="img" aria-label={title ?? def.name}>
    <rect x={-1} y={-1} width={12} height={12} fill="#121926" />
    <path d="M-1 -1H11V0H-1ZM-1 0H0V11H-1Z" fill="#ffffff" opacity=".12" />
    {layer(fx.under, 'icon-fx-under')}
    <g className="icon-sprite">{paths.map(p => <path key={p.fill} d={p.d} fill={p.fill} />)}</g>
    {def.anim === 'shine' && <>
      <clipPath id={clip}>{paths.map(p => <path key={p.fill} d={p.d} />)}</clipPath>
      <g clipPath={`url(#${clip})`}><g className="icon-glint"><rect x={-3} y={-1} width={1} height={12} fill="#ffffff" opacity=".85" /><rect x={-2} y={-1} width={1} height={12} fill="#ffffff" opacity=".45" /></g></g>
    </>}
    {layer(fx.a, 'icon-fx-a')}
    {layer(fx.b, 'icon-fx-b')}
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
