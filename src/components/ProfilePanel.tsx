import { useEffect, useState } from 'react';
import { xpParts, totalXp, levelFor, equipped, equip, rankTitles, localName, setLocalName, FRAMES, FLOORS, TITLES, PROFILE_EVENT, type Unlock } from '../profile/profile';
import { ALBUM_TITLES, ICONS, NAME_COLORS, HONORS, MODE_TITLES, SUPPORTER_TITLE, unlockContext, isOpen, earnedExtraTitles, type UnlockContext } from '../profile/cosmetics';
import { DAILY_EVENT } from '../profile/dailyGoals';
import { LEGACY_EVENT } from '../storage/gmLegacy';
import { PixelIcon } from './PixelIcon';
import { ProfileIcon, NameTag } from './ProfileIcon';
import { useAccount } from '../cloud/account';
import { passesOnSale } from '../billing/billing';
import { ThemeSection } from './ThemePicker';
import { TITLE_COLORS, TROPHY_TITLES, trophyNeed } from '../profile/trophyRoad';

function useProfile() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    const events = [PROFILE_EVENT, DAILY_EVENT, LEGACY_EVENT, 'courtvision:progress', 'storage'];
    for (const e of events) window.addEventListener(e, bump);
    return () => { for (const e of events) window.removeEventListener(e, bump); };
  }, []);
  const parts = xpParts();
  const xp = totalXp(parts);
  return { tick, parts, xp, ...levelFor(xp) };
}

/** The level chip in the main menu masthead, with your icon. */
export function ProfileChip({ onOpen }: { onOpen?: () => void }) {
  const p = useProfile();
  const eq = equipped(p.level);
  return <button className="profile-chip" onClick={onOpen} title={`${p.xp.toLocaleString()} XP · ${p.need ? `${p.need - p.into} to level ${p.level + 1}` : 'max level'}`}>
    <ProfileIcon id={eq.icon} size={18} title="" /><b>LV {p.level}</b><NameTag name="" icon={null} title={eq.title} titleColor={eq.titleColor} className="profile-chip-title" /><i style={{ width: `${p.need ? p.into / p.need * 100 : 100}%` }} aria-hidden="true" />
  </button>;
}

function Picker<T extends string>({ label, list, level, value, onPick }: { label: string; list: Unlock<T>[]; level: number; value: string; onPick: (v: T) => void }) {
  return <div className="profile-picker"><h3 className="hunt-subhead">{label}</h3>
    <div role="radiogroup" aria-label={label}>{list.map(u => { const open = u.level <= level; return <button key={u.id} role="radio" aria-checked={value === u.id} disabled={!open}
      className={`profile-unlock ${value === u.id ? 'selected' : ''} ${open ? '' : 'locked'} unlock-${u.id.replace(/\s+/g, '-').toLowerCase()}`} onClick={() => onPick(u.id)}>
      <b>{u.name}</b><small>{open ? u.blurb || 'Unlocked' : `Level ${u.level}`}</small></button>; })}</div></div>;
}

/** Supporter cosmetics are listed only while the pass is on sale (or already owned). */
const showSupporter = (c: UnlockContext) => c.supporter || passesOnSale();
const listed = <T extends { rule: object }>(list: T[], c: UnlockContext) => list.filter(x => !('supporter' in x.rule) || showSupporter(c));

/** Every title and where it comes from: levels, ranked seasons, leaderboards and the modes. */
function titleGroups(c: UnlockContext) {
  const ranked = rankTitles();
  return [
    { label: 'Levels', items: TITLES.map(t => ({ title: t.name, open: t.level <= c.level, how: `Level ${t.level}` })) },
    { label: 'Ranked', items: ['Gold GM', 'Platinum GM', 'Diamond GM', 'Legend GM'].map((t, i) => ({ title: t, open: ranked.includes(t), how: `Reach ${['Gold', 'Platinum', 'Diamond', 'Legend'][i]} in a ranked season` })) },
    { label: 'Leaderboards', items: HONORS.map(h => ({ title: h.title, open: c.honors.includes(h.id), how: h.how })) },
    { label: 'Achievements', items: MODE_TITLES.map(m => ({ title: m.title, open: c.modes.includes(m.mode), how: m.how })) },
    { label: 'Supporter', items: [{ title: SUPPORTER_TITLE, open: c.supporter, how: 'Supporter pass' }] },
    { label: 'Trophy Road', items: TROPHY_TITLES.map(t => ({ title: t.id, open: c.trophies >= t.trophies, how: `${t.trophies.toLocaleString()} trophies` })) },
    { label: 'Card album', items: ALBUM_TITLES.map(t => ({ title: t.title, open: ((t.kind === 'sets' ? c.album?.sets : c.album?.legendary) ?? 0) >= t.n, how: t.kind === 'sets' ? `Complete ${t.n} team card set${t.n === 1 ? '' : 's'}` : `Collect ${t.n} legendary cards` })) },
  ].filter(g => g.label !== 'Supporter' || showSupporter(c));
}

/** Your card (the Profile tab of the Player Profile): the card others see, your level and XP, and everything to equip. */
export function ProfilePanel() {
  const p = useProfile();
  const account = useAccount();
  const eq = equipped(p.level);
  const ctx = unlockContext(p.level);
  const signedIn = account.status === 'signedIn' && !!account.profile?.username;
  const name = signedIn ? account.profile!.username! : localName();
  const extras = earnedExtraTitles(ctx).length + rankTitles().length;
  return <section className="locker-bay profile-panel">
    <h2><PixelIcon name="star" size={18} /> Your card</h2>
    <div className={`profile-card-big frame-${eq.frame}`}>
      <ProfileIcon id={eq.icon} size={72} title={`${name}'s icon`} />
      <div className="profile-card-id">
        <NameTag name={signedIn ? `@${name}` : name} icon={null} color={eq.color} title={eq.title} titleColor={eq.titleColor} className="profile-card-name" />
        <div className="hunt-cap-bar"><i style={{ width: `${p.need ? p.into / p.need * 100 : 100}%` }} /></div>
        <small>Level {p.level} · {p.xp.toLocaleString()} XP{p.need ? ` · ${(p.need - p.into).toLocaleString()} to level ${p.level + 1}` : ' · max level'}{extras ? ` · ${extras} special title${extras === 1 ? '' : 's'}` : ''}</small>
      </div>
      {!signedIn && <label className="profile-name-edit"><span>Profile name</span><input className="year-input" value={localName() === 'You' ? '' : localName()} placeholder="You" maxLength={18} onChange={e => setLocalName(e.target.value)} /><small>Sign in to claim a GM name on the boards.</small></label>}
    </div>

    <ThemeSection />

    <div className="profile-picker"><h3 className="hunt-subhead">Profile icon</h3>
      <div className="profile-icons" role="radiogroup" aria-label="Profile icon">{listed(ICONS, ctx).map(i => { const open = isOpen(i.rule, ctx); return <button key={i.id} role="radio" aria-checked={eq.icon === i.id} disabled={!open} title={`${i.name}${open ? '' : ` · ${i.how}`}`}
        className={`profile-icon-pick ${eq.icon === i.id ? 'selected' : ''} ${open ? '' : 'locked'}`} onClick={() => equip({ icon: i.id })}>
        <ProfileIcon id={i.id} size={36} title={i.name} /><small>{open ? i.name : i.how}</small></button>; })}</div></div>

    <div className="profile-picker"><h3 className="hunt-subhead">Name colour</h3>
      <div className="profile-colors" role="radiogroup" aria-label="Name colour">{listed(NAME_COLORS, ctx).map(c => { const open = isOpen(c.rule, ctx); return <button key={c.id} role="radio" aria-checked={eq.color === c.id} disabled={!open}
        className={`profile-color-pick ${eq.color === c.id ? 'selected' : ''} ${open ? '' : 'locked'}`} onClick={() => equip({ color: c.id })}>
        <i className={c.anim ? `anim-${c.anim}` : undefined} style={{ background: c.css, backgroundSize: c.anim ? '200% 100%' : undefined }} aria-hidden="true" /><b>{c.name}</b><small>{open ? 'Unlocked' : c.how}</small></button>; })}</div></div>

    <div className="profile-picker"><h3 className="hunt-subhead">Title colour <small>{ctx.trophies.toLocaleString()} trophies</small></h3>
      <div className="profile-colors" role="radiogroup" aria-label="Title colour">{TITLE_COLORS.map(c => { const need = c.id === 'plain' ? 0 : trophyNeed('titleColor', c.id) ?? Infinity, open = ctx.trophies >= need; return <button key={c.id} role="radio" aria-checked={eq.titleColor === c.id} disabled={!open}
        className={`profile-color-pick ${eq.titleColor === c.id ? 'selected' : ''} ${open ? '' : 'locked'}`} onClick={() => equip({ titleColor: c.id })}>
        <NameTag name="" icon={null} title={c.name} titleColor={c.id} /><small>{open ? 'Unlocked' : `${need.toLocaleString()} trophies`}</small></button>; })}</div></div>

    <div className="profile-picker"><h3 className="hunt-subhead">Title</h3>
      {titleGroups(ctx).map(g => <div key={g.label} className="profile-title-group"><small>{g.label.toUpperCase()}</small>
        <div role="radiogroup" aria-label={`${g.label} titles`}>{g.items.map(t => <button key={t.title} role="radio" aria-checked={eq.title === t.title} disabled={!t.open}
          className={`profile-unlock ${eq.title === t.title ? 'selected' : ''} ${t.open ? '' : 'locked'}`} onClick={() => equip({ title: t.title })}>
          <b>{t.title}</b><small>{t.open ? 'Unlocked' : t.how}</small></button>)}</div></div>)}
    </div>

    <table className="db-table profile-xp"><tbody>{p.parts.map(x => <tr key={x.id}><td className="col-name">{x.label}</td><td className="col-name">{x.detail}</td><td>{x.xp.toLocaleString()} XP</td></tr>)}</tbody></table>
    <p className="hint-text">XP comes from everything you finish: GM seasons, wins, titles and achievements (official leagues), careers, hunts, rebuilds, weekly challenges and daily goals. Icons, colours and titles are earned only by playing: levels, ranked seasons, achievements and leaderboard finishes (leaderboard titles arrive when you sync).</p>
    <Picker label="Share-card frame" list={FRAMES} level={p.level} value={eq.frame} onPick={v => equip({ frame: v })} />
    <Picker label="Court floor (Watch Game)" list={FLOORS} level={p.level} value={eq.floor} onPick={v => equip({ floor: v })} />
  </section>;
}
