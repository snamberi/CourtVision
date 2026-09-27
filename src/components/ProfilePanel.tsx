import { useEffect, useState } from 'react';
import { xpParts, totalXp, levelFor, equipped, equip, rankTitles, FRAMES, FLOORS, TITLES, PROFILE_EVENT, type Unlock } from '../profile/profile';
import { DAILY_EVENT } from '../profile/dailyGoals';
import { LEGACY_EVENT } from '../storage/gmLegacy';
import { PixelIcon } from './PixelIcon';

function useProfile() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    for (const e of [PROFILE_EVENT, DAILY_EVENT, LEGACY_EVENT, 'storage']) window.addEventListener(e, bump);
    return () => { for (const e of [PROFILE_EVENT, DAILY_EVENT, LEGACY_EVENT, 'storage']) window.removeEventListener(e, bump); };
  }, []);
  const parts = xpParts();
  const xp = totalXp(parts);
  return { tick, parts, xp, ...levelFor(xp) };
}

/** The level chip in the main menu masthead. */
export function ProfileChip({ onOpen }: { onOpen?: () => void }) {
  const p = useProfile();
  const title = equipped(p.level).title;
  return <button className="profile-chip" onClick={onOpen} title={`${p.xp.toLocaleString()} XP · ${p.need ? `${p.need - p.into} to level ${p.level + 1}` : 'max level'}`}>
    <b>LV {p.level}</b><span>{title}</span><i style={{ width: `${p.need ? p.into / p.need * 100 : 100}%` }} aria-hidden="true" />
  </button>;
}

function Picker<T extends string>({ label, list, level, value, onPick }: { label: string; list: Unlock<T>[]; level: number; value: string; onPick: (v: T) => void }) {
  return <div className="profile-picker"><h3 className="hunt-subhead">{label}</h3>
    <div role="radiogroup" aria-label={label}>{list.map(u => { const open = u.level <= level; return <button key={u.id} role="radio" aria-checked={value === u.id} disabled={!open}
      className={`profile-unlock ${value === u.id ? 'selected' : ''} ${open ? '' : 'locked'} unlock-${u.id.replace(/\s+/g, '-').toLowerCase()}`} onClick={() => onPick(u.id)}>
      <b>{u.name}</b><small>{open ? u.blurb || 'Unlocked' : `Level ${u.level}`}</small></button>; })}</div></div>;
}

/** GM Profile in the Locker: level, where the XP came from, and the cosmetics to equip. */
export function ProfilePanel() {
  const p = useProfile();
  const eq = equipped(p.level);
  return <section className="locker-bay profile-panel">
    <h2><PixelIcon name="star" size={18} /> GM Profile</h2>
    <div className="profile-head">
      <div className="profile-level"><small>LEVEL</small><b>{p.level}</b></div>
      <div className="profile-progress"><strong>{eq.title}</strong><div className="hunt-cap-bar"><i style={{ width: `${p.need ? p.into / p.need * 100 : 100}%` }} /></div>
        <small>{p.xp.toLocaleString()} XP{p.need ? ` · ${(p.need - p.into).toLocaleString()} to level ${p.level + 1}` : ' · max level'}</small></div>
    </div>
    <table className="db-table profile-xp"><tbody>{p.parts.map(x => <tr key={x.id}><td className="col-name">{x.label}</td><td className="col-name">{x.detail}</td><td>{x.xp.toLocaleString()} XP</td></tr>)}</tbody></table>
    <p className="hint-text">XP comes from everything you finish: GM seasons, wins, titles and achievements (official leagues), careers, hunts, rebuilds, weekly challenges and daily goals.</p>
    <Picker label="Share-card frame" list={FRAMES} level={p.level} value={eq.frame} onPick={v => equip({ frame: v })} />
    <Picker label="Court floor (Watch Game)" list={FLOORS} level={p.level} value={eq.floor} onPick={v => equip({ floor: v })} />
    <Picker label="Title" list={[...TITLES, ...rankTitles().map(id => ({ id, name: id, level: 1, blurb: 'Ranked reward' }))]} level={p.level} value={eq.title} onPick={v => equip({ title: v })} />
  </section>;
}
