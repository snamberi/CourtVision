import { useState } from 'react';
import { MyFramedAvatar } from './AvatarFrame';
import { frameAccent } from './AvatarFrameArt';
import { PixelIcon } from './PixelIcon';
import { AVATAR_FRAMES, avatarFrameDef, avatarFrameHow, avatarFrameOpen } from '../profile/avatarFrames';
import type { UnlockContext } from '../profile/cosmetics';
import { equip } from '../profile/profile';

/** Browsing is separate from equipping, so every earned and locked frame can be inspected. */
export function FramePicker({ value, ctx }: { value: string; ctx: UnlockContext }) {
  const [preview, setPreview] = useState<string | null>(null);
  const frames = AVATAR_FRAMES.filter(f => !f.staff || ctx.staff);
  const shown = frames.find(f => f.id === preview) ?? frames.find(f => f.id === value) ?? avatarFrameDef('none');
  const open = avatarFrameOpen(shown, ctx), active = value === shown.id;
  const n = frames.filter(f => avatarFrameOpen(f,ctx)).length;
  return <div className="profile-picker frame-collection" id="pick-frame">
    <h3 className="hunt-subhead">Profile picture frame <small className="pick-count"><b>{n}</b> of {frames.length} unlocked<i aria-hidden="true"><i style={{width:`${n/frames.length*100}%`}} /></i></small></h3>
    <div className="frame-showcase" style={frameAccent(shown.id)}>
      <div className="frame-showcase-art"><MyFramedAvatar frame={shown.id} size={172} title={`${shown.name} preview`} /></div>
      <div className="frame-showcase-info" aria-live="polite" aria-atomic="true">
        <span className="cosmetic-eyebrow">{active ? 'YOUR EQUIPPED FRAME' : 'FRAME PREVIEW'}</span>
        <h4>{shown.name}</h4><p>{shown.blurb}</p>
        <span className="frame-requirement"><PixelIcon name={open?'check':'lock'} size={13} />{open ? 'Unlocked' : avatarFrameHow(shown)}</span>
        <button type="button" className="frame-equip" disabled={!open || active} onClick={() => equip({avatarFrame:shown.id})}>{active ? 'Equipped' : open ? 'Equip frame' : 'Locked'}</button>
      </div>
      <div className="frame-small-preview" aria-label="Compact frame preview"><MyFramedAvatar frame={shown.id} size={38} title="Leaderboard size" /><small>Leaderboard size</small></div>
    </div>
    <p className="frame-browse-hint">Select any frame to preview it. Earn it to make it yours.</p>
    <div className="avf-picks" role="group" aria-label="Browse profile picture frames">{frames.map(f => {
      const unlocked = avatarFrameOpen(f,ctx), equipped = value===f.id;
      return <button type="button" key={f.id} aria-pressed={shown.id===f.id} aria-label={`${f.name}. ${equipped ? 'Equipped' : unlocked ? 'Unlocked' : avatarFrameHow(f)}. Preview frame.`}
        className={`avf-pick ${shown.id===f.id?'selected':''} ${unlocked?'':'locked'} ${equipped?'equipped':''}`} style={frameAccent(f.id)} onClick={() => setPreview(f.id)}>
        <span className="frame-tile-state" aria-hidden="true"><PixelIcon name={equipped?'check':unlocked?'star':'lock'} size={11} />{equipped?'Equipped':unlocked?'Unlocked':'Locked'}</span>
        <MyFramedAvatar frame={f.id} size={96} title="" /><b>{f.name}</b><small>{unlocked?'View frame':avatarFrameHow(f)}</small>
      </button>;
    })}</div>
  </div>;
}
