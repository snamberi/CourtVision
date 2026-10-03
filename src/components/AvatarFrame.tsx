import { memo, useEffect, useState, useMemo } from 'react';
import type { AvatarLook } from '../profile/avatar';
import { avatarFrameDef, type AvatarFrameId } from '../profile/avatarFrames';
import { decodeAvatar } from '../profile/avatarCode';
import { equipped, PROFILE_EVENT } from '../profile/profile';
import { UserAvatar, useAvatar } from './UserAvatar';

import { frameArtwork } from './AvatarFrameArt';

const R = 31;

/** Your character's portrait inside a profile-picture frame. */
export const FramedAvatar = memo(function FramedAvatar({ look, team = null, frame = 'none', size = 64, title }: { look: AvatarLook; team?: { primary: string; secondary: string } | null; frame?: AvatarFrameId | string; size?: number; title?: string }) {
  const a = useMemo(() => frameArtwork(frame as AvatarFrameId), [frame]);
  const pic = Math.round(size * (R * 2) / 100);
  return <span className={`avf avf-${frame}${size <= 40 ? ' avf-compact' : ''}`} style={{ width: size, height: size }} role="img" aria-label={title ?? 'Character'}>
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
