import { useEffect, useState } from 'react';
import { PixelIcon } from './PixelIcon';
import { MyAvatar } from './UserAvatar';
import { totalXp, levelFor } from '../profile/profile';

/*
 * The menu phone: a small pixel phone in the bottom-left corner of the main menu with four apps (Leaderboards,
 * Friends, your Profile and your daily Streak). On phones it sits in the page instead of floating.
 */

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export function MenuPhone({ onBoards, onFriends, onProfile, streak }: {
  onBoards?: () => void; onFriends?: () => void; onProfile?: () => void; streak: { current: number; best: number };
}) {
  const [time, setTime] = useState(clock);
  useEffect(() => { const t = window.setInterval(() => setTime(clock()), 30_000); return () => window.clearInterval(t); }, []);
  const [level] = useState(() => levelFor(totalXp()).level);
  const days = streak.current;
  return <aside className="menu-phone" aria-label="Your phone">
    <div className="menu-phone-body">
      <div className="menu-phone-status" aria-hidden="true"><span>{time}</span><i className="menu-phone-notch" /><span className="menu-phone-icons"><i className="sig" /><i className="bat" /></span></div>
      <div className="menu-phone-apps">
        {onBoards && <button className="menu-phone-app" onClick={onBoards}><span className="app-tile boards"><PixelIcon name="trophy" size={20} /></span><small>Boards</small></button>}
        {onFriends && <button className="menu-phone-app" onClick={onFriends}><span className="app-tile friends"><PixelIcon name="team" size={20} /></span><small>Friends</small></button>}
        {onProfile && <button className="menu-phone-app" onClick={onProfile} aria-label={`Profile, level ${level}`}><span className="app-tile profile"><MyAvatar size={26} mode="portrait" animate={false} title="" /><em>{level}</em></span><small>Profile</small></button>}
        <button className="menu-phone-app" onClick={onProfile} aria-label={`Daily streak: ${days} day${days === 1 ? '' : 's'}, best ${streak.best}`} title={`Daily streak: ${days} day${days === 1 ? '' : 's'} in a row (best ${streak.best})`}>
          <span className="app-tile streak"><PixelIcon name="flame" size={18} /><em>{days}</em></span><small>{days === 1 ? '1 day' : `${days} days`}</small>
        </button>
      </div>
      <i className="menu-phone-home" aria-hidden="true" />
    </div>
  </aside>;
}
