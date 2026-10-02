import { syncNow } from '../cloud/sync';
import { readPlayTime, formatPlayTime, topArea, AREA_LABEL, type PlayArea } from '../retention/playTime';
import { PLAY_TIME_EVENT } from '../retention/usePlayClock';
import { useEffect, useState, type ReactNode } from 'react';
import { xpParts, totalXp, levelFor, equipped, equip, rankTitles, localName, setLocalName, unlockOpen, listedFor, FRAMES, FLOORS, TITLES, PROFILE_EVENT, type Unlock } from '../profile/profile';
import { OWNER_TITLE, SOVEREIGN_TITLE } from '../profile/ownerAccess';
import { FOUNDING_TITLE } from '../profile/founding';
import { ALBUM_TITLES, ICONS, NAME_COLORS, HONORS, MODE_TITLES, SUPPORTER_TITLE, unlockContext, isOpen, earnedExtraTitles, type UnlockContext } from '../profile/cosmetics';
import { DAILY_EVENT } from '../profile/dailyGoals';
import { LEGACY_EVENT } from '../storage/gmLegacy';
import { PixelIcon } from './PixelIcon';
import { ProfileIcon, NameTag } from './ProfileIcon';
import { MyFramedAvatar } from './AvatarFrame';
import { CourtFloorPreview, ShareFramePreview } from './ProfilePreviews';
import { AVATAR_FRAMES, avatarFrameOpen, avatarFrameHow } from '../profile/avatarFrames';
import { STREAK_REWARDS } from '../retention/streak';
import { PASS_REWARDS } from '../retention/pass';
import { useAccount } from '../cloud/account';
import { passesOnSale } from '../billing/billing';
import { ThemeSection } from './ThemePicker';
import { TITLE_COLORS, TROPHY_TITLES, trophyNeed, titleColorOpen } from '../profile/trophyRoad';

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
    <MyFramedAvatar size={30} title="" /><b>LV {p.level}</b><NameTag name="" icon={null} title={eq.title} titleColor={eq.titleColor} className="profile-chip-title" /><i style={{ width: `${p.need ? p.into / p.need * 100 : 100}%` }} aria-hidden="true" />
  </button>;
}

function Picker<T extends string>({ label, list, level, trophies = 0, value, onPick, preview }: { label: string; list: Unlock<T>[]; level: number; trophies?: number; value: string; onPick: (v: T) => void; preview?: (id: T) => ReactNode }) {
  // A locked one can still be tried: clicking it shows the preview without equipping it.
  const [hover, setHover] = useState<T | null>(null);
  const [pinned, setPinned] = useState<T | null>(null);
  const peek = hover ?? pinned;
  const shown = (peek ?? value) as T, shownDef = list.find(u => u.id === shown);
  return <div className="profile-picker"><h3 className="hunt-subhead">{label}</h3>
    {preview && <div className="profile-preview">{preview(shown)}<small>{shownDef?.name}{peek && peek !== value ? (shownDef && unlockOpen(shownDef, level, trophies) ? ' · preview' : ` · preview (${shownDef?.trophies != null ? `${shownDef.trophies.toLocaleString()} trophies` : `level ${shownDef?.level}`})`) : ' · equipped'}</small></div>}
    <div role="radiogroup" aria-label={label}>{list.map(u => { const open = unlockOpen(u, level, trophies); return <button key={u.id} role="radio" aria-checked={value === u.id} aria-disabled={!open}
      className={`profile-unlock ${value === u.id ? 'selected' : ''} ${open ? '' : 'locked'} ${peek === u.id ? 'peeking' : ''} unlock-${u.id.replace(/\s+/g, '-').toLowerCase()}`} onMouseEnter={() => preview && setHover(u.id)} onFocus={() => preview && setHover(u.id)} onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)} onClick={() => { if (open) { onPick(u.id); setPinned(null); setHover(null); } else setPinned(u.id); }}>
      <b>{u.name}</b><small>{open ? u.blurb || 'Unlocked' : u.trophies != null ? `${u.trophies.toLocaleString()} trophies` : `Level ${u.level}`}</small></button>; })}</div></div>;
}

/** Supporter cosmetics are listed only while the pass is on sale (or already owned). */
const showSupporter = (c: UnlockContext) => c.supporter || passesOnSale();
const listed = <T extends { rule: object }>(list: T[], c: UnlockContext) => list.filter(x => (!('supporter' in x.rule) || showSupporter(c)) && (!('staff' in x.rule) || !!c.staff));

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
    { label: 'Daily streak', items: STREAK_REWARDS.filter(r => r.title).map(r => ({ title: r.title!, open: (c.streak ?? 0) >= r.days, how: `Visit ${r.days} days in a row` })) },
    { label: 'Season Pass', items: PASS_REWARDS.filter(r => r.title).map(r => ({ title: r.title!, open: (c.pass ?? 0) >= r.tier, how: `Reach tier ${r.tier} of a Season Pass` })) },
    { label: 'Card album', items: ALBUM_TITLES.map(t => ({ title: t.title, open: ((t.kind === 'sets' ? c.album?.sets : c.album?.legendary) ?? 0) >= t.n, how: t.kind === 'sets' ? `Complete ${t.n} team card set${t.n === 1 ? '' : 's'}` : `Collect ${t.n} legendary cards` })) },
    { label: 'Account', items: [{ title: FOUNDING_TITLE, open: !!c.account, how: 'Create a free account' }] },
    ...(c.staff ? [{ label: 'Owner', items: [{ title: OWNER_TITLE, open: true, how: 'The game owner' }, { title: SOVEREIGN_TITLE, open: true, how: 'The game owner' }] }] : []),
  ].filter(g => g.label !== 'Supporter' || showSupporter(c));
}

const kb = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
const ago = (at: number) => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };

/** Your account's sync (it used to sit in the header): the state, when it last went up, how big it is, and Sync now. */
function SyncPanel() {
  const a = useAccount(), s = a.sync;
  const label = s.state === 'syncing' ? 'Syncing…' : s.state === 'error' ? 'Sync problem' : s.at ? `Synced ${ago(s.at)}` : 'Not synced yet';
  return <div className={`sync-panel ${s.state}`} role="status">
    <span className={`sync-dot ${s.state}`} aria-hidden="true" />
    <div><b>{label}</b><small>Your level, records, character and finished careers are saved to @{a.profile?.username ?? '…'} and follow you to any device.{s.size ? ` Last upload ${kb(s.size.raw)} (${kb(s.size.wire)} sent, careers ${kb(s.size.careers)}).` : ''}</small>
      {s.state === 'error' && s.message && <small className="sync-error">{s.message}</small>}</div>
    <button onClick={() => void syncNow()} disabled={s.state === 'syncing'}>Sync now</button>
  </div>;
}

/** Time played, all told and by mode (src/retention/playTime.ts). */
function PlayTimeLine() {
  const [t, setT] = useState(() => readPlayTime());
  useEffect(() => { const bump = () => setT(readPlayTime()); window.addEventListener(PLAY_TIME_EVENT, bump); return () => window.removeEventListener(PLAY_TIME_EVENT, bump); }, []);
  if (t.total < 60) return null;
  const top = topArea(t);
  const areas = (Object.entries(t.areas) as [PlayArea, number][]).filter(([, v]) => v >= 60).sort((a, b) => b[1] - a[1]);
  return <div className="play-time"><PixelIcon name="calendar" size={16} /><b>{formatPlayTime(t.total)} played</b>{top && <span>· most in {AREA_LABEL[top]}</span>}
    <ul>{areas.map(([k, v]) => <li key={k}><small>{AREA_LABEL[k]}</small> {formatPlayTime(v)}</li>)}</ul></div>;
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
      <span className="profile-card-avatar"><MyFramedAvatar size={96} title={`${name}'s character`} /></span>
      <ProfileIcon id={eq.icon} size={40} title={`${name}'s icon`} />
      <div className="profile-card-id">
        <NameTag name={signedIn ? `@${name}` : name} icon={null} color={eq.color} title={eq.title} titleColor={eq.titleColor} className="profile-card-name" />
        <div className="hunt-cap-bar"><i style={{ width: `${p.need ? p.into / p.need * 100 : 100}%` }} /></div>
        <small>Level {p.level} · {p.xp.toLocaleString()} XP{p.need ? ` · ${(p.need - p.into).toLocaleString()} to level ${p.level + 1}` : ' · max level'}{extras ? ` · ${extras} special title${extras === 1 ? '' : 's'}` : ''}</small>
      </div>
      {!signedIn && <label className="profile-name-edit"><span>Profile name</span><input className="year-input" value={localName() === 'You' ? '' : localName()} placeholder="You" maxLength={18} onChange={e => setLocalName(e.target.value)} /><small>Sign in to claim a GM name on the boards.</small></label>}
    </div>
    {signedIn && <SyncPanel />}
    <PlayTimeLine />

    <div className="profile-picker"><h3 className="hunt-subhead">Profile picture frame</h3>
      <div className="avf-picks" role="radiogroup" aria-label="Profile picture frame">{AVATAR_FRAMES.filter(f => !f.staff || ctx.staff).map(f => { const open = avatarFrameOpen(f, ctx); return <button key={f.id} role="radio" aria-checked={eq.avatarFrame === f.id} disabled={!open} title={f.blurb}
        className={`avf-pick ${eq.avatarFrame === f.id ? 'selected' : ''} ${open ? '' : 'locked'}`} onClick={() => equip({ avatarFrame: f.id })}>
        <MyFramedAvatar frame={f.id} size={76} title={f.name} /><b>{f.name}</b><small>{open ? 'Unlocked' : avatarFrameHow(f)}</small></button>; })}</div></div>

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
      <div className="profile-colors" role="radiogroup" aria-label="Title colour">{TITLE_COLORS.filter(c => !c.staff || ctx.staff).map(c => { const open = titleColorOpen(c, ctx); return <button key={c.id} role="radio" aria-checked={eq.titleColor === c.id} disabled={!open}
        className={`profile-color-pick ${eq.titleColor === c.id ? 'selected' : ''} ${open ? '' : 'locked'}`} onClick={() => equip({ titleColor: c.id })}>
        <NameTag name="" icon={null} title={c.name} titleColor={c.id} /><small>{open ? 'Unlocked' : c.ownerLegacy != null ? `Owner legacy ${c.ownerLegacy}` : `${(trophyNeed('titleColor', c.id) ?? 0).toLocaleString()} trophies`}</small></button>; })}</div></div>

    <div className="profile-picker"><h3 className="hunt-subhead">Title</h3>
      {titleGroups(ctx).map(g => <div key={g.label} className="profile-title-group"><small>{g.label.toUpperCase()}</small>
        <div role="radiogroup" aria-label={`${g.label} titles`}>{g.items.map(t => <button key={t.title} role="radio" aria-checked={eq.title === t.title} disabled={!t.open}
          className={`profile-unlock ${eq.title === t.title ? 'selected' : ''} ${t.open ? '' : 'locked'}`} onClick={() => equip({ title: t.title })}>
          <b>{t.title}</b><small>{t.open ? 'Unlocked' : t.how}</small></button>)}</div></div>)}
    </div>

    <table className="db-table profile-xp"><tbody>{p.parts.map(x => <tr key={x.id}><td className="col-name">{x.label}</td><td className="col-name">{x.detail}</td><td>{x.xp.toLocaleString()} XP</td></tr>)}</tbody></table>
    <p className="hint-text">XP comes from everything you finish: GM seasons, wins, titles and achievements (official leagues), careers, hunts, rebuilds, weekly challenges and daily goals. Icons, colours and titles are earned only by playing: levels, ranked seasons, achievements and leaderboard finishes (leaderboard titles arrive when you sync).</p>
    <Picker label="Share-card frame" list={listedFor(FRAMES)} level={p.level} trophies={ctx.trophies} value={eq.frame} onPick={v => equip({ frame: v })} preview={id => <ShareFramePreview frame={id} />} />
    <Picker label="Court floor (Watch Game)" list={listedFor(FLOORS)} level={p.level} trophies={ctx.trophies} value={eq.floor} onPick={v => equip({ floor: v })} preview={id => <CourtFloorPreview floor={id} />} />
  </section>;
}
