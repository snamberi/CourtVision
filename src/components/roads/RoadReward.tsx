import { FRAMES, FLOORS, PHONES } from '../../profile/profile';
import { NAME_COLORS, iconDef } from '../../profile/cosmetics';
import { TITLE_COLORS, type TrophyRewardKind } from '../../profile/trophyRoad';
import { THEME_BY_ID, type ThemeId } from '../../theme/themes';
import { PhonePreview } from '../ProfilePreviews';
import { ProfileIcon, NameTag } from '../ProfileIcon';
import { AvatarPiece } from '../UserAvatar';
import { FrameReward } from '../AvatarFrame';

/** Any cosmetic, drawn as it looks (the Level Road, the Trophy Road and the Season Pass all use it). */
export function RoadReward({ kind, id, titleNote = 'Title' }: { kind: TrophyRewardKind; id: string; titleNote?: string }) {
  if (kind === 'icon') return <span className="road-reward"><ProfileIcon id={id} size={34} /><small>{iconDef(id).name} icon</small></span>;
  if (kind === 'color') return <span className="road-reward"><NameTag name={NAME_COLORS.find(c => c.id === id)?.name ?? id} icon={null} color={id} /><small>Name colour</small></span>;
  if (kind === 'titleColor') return <span className="road-reward"><NameTag name="Title colour" icon={null} title={TITLE_COLORS.find(c => c.id === id)?.name ?? id} titleColor={id} /><small>Title colour</small></span>;
  if (kind === 'avatar') return <span className="road-reward road-avatar-reward"><AvatarPiece piece={id} /></span>;
  if (kind === 'avatarFrame') return <span className="road-reward road-avatar-reward"><FrameReward id={id} /></span>;
  if (kind === 'phone') return <span className="road-reward"><PhonePreview phone={id} size={26} /><small>{PHONES.find(f => f.id === id)?.name ?? id} phone</small></span>;
  if (kind === 'frame' || kind === 'floor') return <span className="road-reward"><i className={`road-${kind} ${kind}-${id}`} aria-hidden="true" /><small>{(kind === 'frame' ? FRAMES : FLOORS).find(f => f.id === id)?.name ?? id} {kind === 'frame' ? 'card frame' : 'court'}</small></span>;
  if (kind === 'title') return <span className="road-reward"><b className="road-title">{id}</b><small>{titleNote}</small></span>;
  const t = THEME_BY_ID.get(id as ThemeId), p = t?.preview;
  return <span className="road-reward road-look-reward">{p && <i className="road-look" aria-hidden="true" style={{ background: p.bg, borderColor: p.line }}><i style={{ background: p.panel, borderColor: p.line }} /><i style={{ background: p.accent }} /></i>}<small>{t?.name ?? id} app look</small></span>;
}
