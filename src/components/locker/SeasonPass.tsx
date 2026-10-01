import { useEffect, useState } from 'react';
import { totalXp, PROFILE_EVENT } from '../../profile/profile';
import { notePass, readPass, passMonth, PASS_REWARDS, PASS_TIERS, PASS_TIER_XP } from '../../retention/pass';
import { readStreak, STREAK_REWARDS } from '../../retention/streak';
import { PixelIcon } from '../PixelIcon';

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The free Season Pass (XP earned this month fills 30 tiers) and the daily streak. */
export function SeasonPass() {
  const [, setTick] = useState(0);
  useEffect(() => { const bump = () => setTick(t => t + 1); window.addEventListener(PROFILE_EVENT, bump); window.addEventListener('courtvision:progress', bump); return () => { window.removeEventListener(PROFILE_EVENT, bump); window.removeEventListener('courtvision:progress', bump); }; }, []);
  const now = new Date();
  const pass = notePass(totalXp(), now);
  const into = pass.tier >= PASS_TIERS ? PASS_TIER_XP : pass.xp - pass.tier * PASS_TIER_XP;
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const days = Math.max(1, Math.ceil((end - now.getTime()) / 86_400_000));
  const streak = readStreak();
  const past = Object.entries(readPass().months).filter(([m]) => m !== passMonth(now)).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  return <>
    <section className="locker-bay level-road season-pass">
      <h2><PixelIcon name="star" size={18} /> Season Pass · {monthLabel(pass.month)}</h2>
      <div className="road-head">
        <div className="profile-level"><small>TIER</small><b>{pass.tier}</b></div>
        <div className="profile-progress"><strong>{pass.tier >= PASS_TIERS ? 'Pass complete: every tier is yours' : `${PASS_TIER_XP - into} XP to tier ${pass.tier + 1}`}</strong>
          <div className="hunt-cap-bar"><i style={{ width: `${Math.min(100, into / PASS_TIER_XP * 100)}%` }} /></div>
          <small>{pass.xp.toLocaleString()} XP this month · free for everyone · resets in {days} day{days === 1 ? '' : 's'}</small></div>
      </div>
      <p className="hint-text">Every XP you earn this month, in any mode, fills the pass. Each tier pays trophies for the Trophy Road; tiers 10, 20 and 30 also unlock titles for good. A new pass starts on the 1st.</p>
      <ol className="pass-track">{PASS_REWARDS.map(r => <li key={r.tier} className={`${r.tier <= pass.tier ? 'got' : ''} ${r.title ? 'big' : ''} ${r.tier === pass.tier + 1 ? 'next' : ''}`}>
        <small>{r.tier}</small><b>{r.title ?? `+${r.trophies.toLocaleString()}`}</b><span>{r.title ? `title · +${r.trophies.toLocaleString()}` : 'trophies'}</span></li>)}</ol>
      {past.length > 0 && <p className="hint-text">Past passes: {past.map(([m, v]) => `${monthLabel(m)} tier ${v.tier}`).join(' · ')}</p>}
    </section>
    <section className="locker-bay level-road daily-streak">
      <h2><PixelIcon name="flame" size={18} /> Daily streak</h2>
      <div className="road-head">
        <div className="profile-level"><small>DAYS</small><b>{streak.current}</b></div>
        <div className="profile-progress"><strong>{streak.current > 1 ? `${streak.current} days in a row` : 'Come back tomorrow to start a streak'}</strong><small>Best streak: {streak.best} day{streak.best === 1 ? '' : 's'}. Open Court Vision once a day (UTC) to keep it going; a missed day starts it again, but what your best streak earned stays yours.</small></div>
      </div>
      <ol className="pass-track streak-track">{STREAK_REWARDS.map(r => <li key={r.days} className={`${streak.best >= r.days ? 'got' : ''} ${r.title ? 'big' : ''}`}><small>DAY {r.days}</small><b>{r.title ?? `+${r.trophies.toLocaleString()}`}</b><span>{r.title ? `title · +${r.trophies.toLocaleString()}` : 'trophies'}</span></li>)}</ol>
    </section>
  </>;
}
