import { memo, useEffect, useMemo, useState } from 'react';
import { readAvatar, avatarItem, AVATAR_EVENT, type AvatarLook, type AvatarCategory } from '../profile/avatar';
import { readFavorites, FAVORITES_EVENT } from '../profile/favorites';
import { teamColors } from '../simulation/teamColors';
import { buildAvatarSprite, AVATAR_W, AVATAR_H, AVATAR_PORTRAIT_VIEWBOX } from '../visuals/avatarSprite';

/** Your character as saved, kept current when you change it (or your favourite team) anywhere. */
export function useAvatar(): { look: AvatarLook; team: { primary: string; secondary: string } | null } {
  const [state, setState] = useState(() => ({ look: readAvatar(), fav: readFavorites().team }));
  useEffect(() => {
    const bump = () => setState({ look: readAvatar(), fav: readFavorites().team });
    for (const e of [AVATAR_EVENT, FAVORITES_EVENT, 'storage']) window.addEventListener(e, bump);
    return () => { for (const e of [AVATAR_EVENT, FAVORITES_EVENT, 'storage']) window.removeEventListener(e, bump); };
  }, []);
  return { look: state.look, team: state.fav ? teamColors(state.fav) : null };
}

interface Props { look: AvatarLook; team?: { primary: string; secondary: string } | null; size?: number; mode?: 'full' | 'portrait'; className?: string; title?: string; /** Aura animation (off for the small tiles). */ animate?: boolean }

/** The profile character (see src/profile/avatar.ts). */
export const UserAvatar = memo(function UserAvatar({ look, team = null, size = 96, mode = 'full', className, title = 'Your character', animate = true }: Props) {
  // By value: a new object with the same pieces doesn't redraw.
  const key = JSON.stringify({ look, team });
  const sprite = useMemo(() => buildAvatarSprite(JSON.parse(key) as { look: AvatarLook; team: Props['team'] }), [key]);
  const portrait = mode === 'portrait';
  const height = Math.round(size * (portrait ? 32 / 28 : AVATAR_H / AVATAR_W));
  return <svg className={`user-avatar user-avatar--${mode}${className ? ` ${className}` : ''}`} width={size} height={height}
    viewBox={portrait ? AVATAR_PORTRAIT_VIEWBOX : `0 0 ${AVATAR_W} ${AVATAR_H}`} shapeRendering="crispEdges" role="img" aria-label={title}>
    {sprite.aura.length > 0 && <g className={`avatar-aura aura-${sprite.auraKind}${animate ? ' animated' : ''}`}>{sprite.aura.map(p => <path key={p.fill} fill={p.fill} d={p.d} />)}</g>}
    {!portrait && <path d="M13 52h21v1h3v1H10v-1h3z" fill="#070d1a" opacity=".45" />}
    {sprite.paths.map(p => <path key={p.fill} fill={p.fill} d={p.d} />)}
  </svg>;
});

/** Your own character, as saved. */
export function MyAvatar(props: Omit<Props, 'look' | 'team'>) {
  const { look, team } = useAvatar();
  return <UserAvatar look={look} team={team} {...props} />;
}

/** A Trophy Road piece ("category:piece") tried on your own character. */
export function AvatarPiece({ piece, size = 44 }: { piece: string; size?: number }) {
  const { look, team } = useAvatar();
  const [cat, id] = piece.split(':') as [AvatarCategory, string];
  const item = avatarItem(cat, id);
  return <><UserAvatar look={{ ...look, [cat]: id }} team={team} size={size} mode={cat === 'hat' || cat === 'eyes' || cat === 'hair' || cat === 'hairColor' ? 'portrait' : 'full'} title={item?.name ?? id} /><small>{item?.name ?? id} · character</small></>;
}
