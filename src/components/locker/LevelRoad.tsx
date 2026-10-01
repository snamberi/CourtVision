import { useEffect, useRef, useState } from 'react';
import { LEVEL_ROAD, NAME_COLORS, iconDef, type RewardKind } from '../../profile/cosmetics';
import { THEME_BY_ID, type ThemeId } from '../../theme/themes';
import { FRAMES, FLOORS, MAX_LEVEL, levelFor, totalXp, PROFILE_EVENT } from '../../profile/profile';
import { ProfileIcon, NameTag } from '../ProfileIcon';
import { PixelIcon } from '../PixelIcon';
import { AvatarPiece } from '../UserAvatar';
import { FrameReward } from '../AvatarFrame';

/** One reward as it looks on the road. */
function Reward({ kind, id }: { kind: RewardKind; id: string }) {
  if (kind === 'icon') return <span className="road-reward"><ProfileIcon id={id} size={30} /><small>{iconDef(id).name} icon</small></span>;
  if (kind === 'color') return <span className="road-reward"><NameTag name={NAME_COLORS.find(c => c.id === id)?.name ?? id} icon={null} color={id} /><small>Name colour</small></span>;
  if (kind === 'title') return <span className="road-reward"><b className="road-title">{id}</b><small>Title</small></span>;
  if (kind === 'avatar') return <span className="road-reward road-avatar-reward"><AvatarPiece piece={id} /></span>;
  if (kind === 'avatarFrame') return <span className="road-reward road-avatar-reward"><FrameReward id={id} /></span>;
  if (kind === 'look') {
    const t = THEME_BY_ID.get(id as ThemeId);
    const p = t?.preview;
    return <span className="road-reward road-look-reward">{p && <i className="road-look" aria-hidden="true" style={{ background: p.bg, borderColor: p.line }}><i style={{ background: p.panel, borderColor: p.line }} /><i style={{ background: p.accent }} /></i>}<small>{t?.name ?? id} app look</small></span>;
  }
  if (kind === 'frame') return <span className="road-reward"><i className={`road-frame frame-${id}`} aria-hidden="true" /><small>{FRAMES.find(f => f.id === id)?.name ?? id} card frame</small></span>;
  return <span className="road-reward"><i className={`road-floor floor-${id}`} aria-hidden="true" /><small>{FLOORS.find(f => f.id === id)?.name ?? id} court</small></span>;
}

/** The level road: a reward every 5 levels up to 250 and every 50 after that up to 750, where you are on it, and what comes next. */
export function LevelRoad() {
  const [, setTick] = useState(0);
  useEffect(() => { const bump = () => setTick(t => t + 1); window.addEventListener(PROFILE_EVENT, bump); return () => window.removeEventListener(PROFILE_EVENT, bump); }, []);
  const xp = totalXp();
  const { level, into, need } = levelFor(xp);
  const stops = [...new Set(LEVEL_ROAD.map(([l]) => l))];
  const next = stops.find(l => l > level);
  const nextRef = useRef<HTMLLIElement>(null);
  useEffect(() => { nextRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' }); }, []);
  const opened = LEVEL_ROAD.filter(([l]) => l <= level).length;
  return <section className="locker-bay level-road">
    <h2><PixelIcon name="chart" size={18} /> Level road</h2>
    <div className="road-head">
      <div className="profile-level"><small>LEVEL</small><b>{level}</b></div>
      <div className="profile-progress"><strong>{next ? `Next reward at level ${next}` : 'The whole road is yours'}</strong>
        <div className="hunt-cap-bar"><i style={{ width: `${need ? into / need * 100 : 100}%` }} /></div>
        <small>{xp.toLocaleString()} XP{need ? ` · ${(need - into).toLocaleString()} to level ${level + 1}` : ''} · {opened} of {LEVEL_ROAD.length} rewards · max level {MAX_LEVEL}</small></div>
    </div>
    <ol className="road-stops">{stops.map(l => {
      const got = l <= level, isNext = l === next;
      return <li key={l} ref={isNext ? nextRef : undefined} className={`road-stop ${got ? 'got' : ''} ${isNext ? 'next' : ''} ${l % 50 === 0 ? 'major' : ''}`}>
        <span className="road-level">LV {l}</span>
        {LEVEL_ROAD.filter(([lv]) => lv === l).map(([, k, id]) => <Reward key={`${k}-${id}`} kind={k} id={id} />)}
        {got && <span className="road-check" aria-label="Unlocked">✓</span>}
      </li>;
    })}</ol>
    <p className="hint-text">XP comes from everything you finish in every mode. Equip what you unlock on the Profile tab. Ranked tiers, leaderboards and achievements unlock more on top of the road.</p>
  </section>;
}
