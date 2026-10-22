import { syncNow } from '../cloud/sync';
import { readPublicProfile, setPublicProfile, bioProblem, BIO_MAX, PUBLIC_PROFILE_EVENT } from '../profile/publicProfile';
import { REAL_FRANCHISES } from '../profile/favorites';
import { readLegacy } from '../storage/gmLegacy';
import { ACHIEVEMENT_BY_ID } from '../simulation/frontOffice';
import { earnedModeAchievements, MODE_ACHIEVEMENT_BY_ID } from '../profile/modeAchievements';
import { PlayTimeBar } from './cloud/ProfileExtras';
import { readPlayTime, formatPlayTime, topArea, AREA_LABEL, type PlayArea } from '../retention/playTime';
import { eventPieceHidden } from '../retention/holiday';
import { PLAY_TIME_EVENT } from '../retention/usePlayClock';
import { useEffect, useState, type ReactNode } from 'react';
import { xpParts, totalXp, levelFor, equipped, equip, rankTitles, localName, setLocalName, unlockOpen, unlockHow, listedFor, FRAMES, FLOORS, PHONES, TITLES, PROFILE_EVENT, type Unlock } from '../profile/profile';
import { OWNER_TITLE, SOVEREIGN_TITLE } from '../profile/ownerAccess';
import { FOUNDING_TITLE } from '../profile/founding';
import { ALBUM_TITLES, EVENT_TITLES, ICONS, NAME_COLORS, HONORS, MODE_TITLES, SUPPORTER_TITLE, unlockContext, isOpen, earnedExtraTitles, type UnlockContext } from '../profile/cosmetics';
import { DAILY_EVENT } from '../profile/dailyGoals';
import { LEGACY_EVENT } from '../storage/gmLegacy';
import { PixelIcon } from './PixelIcon';
import { ProfileIcon, NameTag, Tinted } from './ProfileIcon';
import { MyFramedAvatar } from './AvatarFrame';
import { CourtFloorPreview, ShareFramePreview, PhonePreview } from './ProfilePreviews';
import { FramePicker } from './FramePicker';
import { STREAK_REWARDS } from '../retention/streak';
import { PASS_REWARDS } from '../retention/pass';
import { MISSION_TITLES } from '../retention/missions';
import { useAccount } from '../cloud/account';
import { passesOnSale } from '../billing/billing';
import { ThemeSection } from './ThemePicker';
import { PetSprite } from './locker/PetSprite';
import './locker/playerPets.css';
import { activePet, loadPets, lookOf } from '../profile/pets';
import { seasonHow, SEASON_REWARDS } from '../retention/season';
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
  const openCount = list.filter(u => unlockOpen(u, level, trophies)).length;
  return <div className="profile-picker" id={pickerId(label)}><h3 className="hunt-subhead">{label} <PickCount n={openCount} of={list.length} /></h3>
    {preview && <div className="profile-preview">{preview(shown)}<small>{shownDef?.name}{peek && peek !== value ? (shownDef && unlockOpen(shownDef, level, trophies) ? ' · preview' : ` · preview (${shownDef ? unlockHow(shownDef).toLowerCase() : ''})`) : ' · equipped'}</small></div>}
    <div role="radiogroup" aria-label={label}>{list.map(u => { const open = unlockOpen(u, level, trophies); return <button key={u.id} role="radio" aria-checked={value === u.id} aria-disabled={!open}
      className={`profile-unlock ${value === u.id ? 'selected' : ''} ${open ? '' : 'locked'} ${peek === u.id ? 'peeking' : ''} unlock-${u.id.replace(/\s+/g, '-').toLowerCase()}`} onMouseEnter={() => preview && setHover(u.id)} onFocus={() => preview && setHover(u.id)} onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)} onClick={() => { if (open) { onPick(u.id); setPinned(null); setHover(null); } else setPinned(u.id); }}>
      <b>{u.name}</b><small>{open ? u.blurb || 'Unlocked' : unlockHow(u)}</small></button>; })}</div></div>;
}

/** "4 of 21 unlocked", next to a picker's heading. */
function PickCount({ n, of }: { n: number; of: number }) {
  return <small className="pick-count"><b>{n}</b> of {of} unlocked<i aria-hidden="true"><i style={{ width: `${of ? Math.round(n / of * 100) : 0}%` }} /></i></small>;
}
const pickerId = (label: string) => `pick-${label.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-+$/, '')}`;

/** Supporter cosmetics are listed only while the pass is on sale (or already owned). */
const showSupporter = (c: UnlockContext) => c.supporter || passesOnSale();
const listed = <T extends { rule: object }>(list: T[], c: UnlockContext) => list.filter(x => (!('supporter' in x.rule) || showSupporter(c)) && (!('staff' in x.rule) || !!c.staff) && !eventPieceHidden('shop' in x.rule ? (x.rule as { shop: string }).shop : null, c.shop ?? []));

/** Every title and where it comes from: levels, ranked seasons, leaderboards and the modes. */
function titleGroups(c: UnlockContext) {
  const ranked = rankTitles();
  return [
    { label: 'Levels', items: TITLES.map(t => ({ title: t.name, open: t.level <= c.level, how: `Level ${t.level}`, progress: c.level / t.level })) },
    { label: 'Ranked', items: ['Gold GM', 'Platinum GM', 'Diamond GM', 'Legend GM'].map((t, i) => ({ title: t, open: ranked.includes(t), how: `Reach ${['Gold', 'Platinum', 'Diamond', 'Legend'][i]} in a ranked season` })) },
    { label: 'Leaderboards', items: HONORS.map(h => ({ title: h.title, open: c.honors.includes(h.id), how: h.how })) },
    { label: 'Achievements', items: MODE_TITLES.map(m => ({ title: m.title, open: c.modes.includes(m.mode), how: m.how })) },
    { label: 'Supporter', items: [{ title: SUPPORTER_TITLE, open: c.supporter, how: 'Supporter pass' }] },
    { label: 'Trophy Road', items: TROPHY_TITLES.map(t => ({ title: t.id, open: c.trophies >= t.trophies, how: `${t.trophies.toLocaleString()} trophies`, progress: c.trophies / t.trophies })) },
    { label: 'Daily streak', items: STREAK_REWARDS.filter(r => r.title).map(r => ({ title: r.title!, open: (c.streak ?? 0) >= r.days, how: `Visit ${r.days} days in a row`, progress: (c.streak ?? 0) / r.days })) },
    { label: 'Season Pass', items: [
      ...Object.entries(SEASON_REWARDS).flatMap(([id, list]) => list.filter(r => r.kind === 'title').map(r => ({ title: r.id, open: (c.seasons?.[id] ?? 0) >= r.tier, how: seasonHow({ season: id, tier: r.tier }), progress: (c.seasons?.[id] ?? 0) / r.tier }))),
      ...PASS_REWARDS.filter(r => r.title).map(r => ({ title: r.title!, open: (c.pass ?? 0) >= r.tier, how: `Reach tier ${r.tier} of a monthly pass`, progress: (c.pass ?? 0) / r.tier })),
    ] },
    { label: 'Missions', items: MISSION_TITLES.map(t => ({ title: t.title, open: (c.missions ?? 0) >= t.n, how: `Finish ${t.n} weekly missions`, progress: (c.missions ?? 0) / t.n })) },
    { label: 'Card album', items: ALBUM_TITLES.map(t => { const have = (t.kind === 'sets' ? c.album?.sets : c.album?.legendary) ?? 0; return { title: t.title, open: have >= t.n, how: t.kind === 'sets' ? `Complete ${t.n} team card set${t.n === 1 ? '' : 's'}` : `Collect ${t.n} legendary cards`, progress: have / t.n }; }) },
    { label: 'Account', items: [{ title: FOUNDING_TITLE, open: !!c.account, how: 'Create a free account' }] },
    { label: 'Events', items: EVENT_TITLES.filter(t => !eventPieceHidden(t.key, c.shop ?? [])).map(t => ({ title: t.title, open: (c.shop ?? []).includes(t.key), how: t.how })) },
    ...(c.staff ? [{ label: 'Owner', items: [{ title: OWNER_TITLE, open: true, how: 'The game owner' }, { title: SOVEREIGN_TITLE, open: true, how: 'The game owner' }] }] : []),
  ].filter(g => (g.label !== 'Supporter' || showSupporter(c)) && g.items.length > 0) as TitleGroup[];
}
interface TitleGroup { label: string; items: { title: string; open: boolean; how: string; progress?: number }[] }
const GROUP_ICON: Record<string, string> = {
  Levels: 'up', Ranked: 'crown', Leaderboards: 'chart', Achievements: 'check', Supporter: 'heart', 'Trophy Road': 'trophy',
  'Daily streak': 'flame', 'Season Pass': 'calendar', Missions: 'check', 'Card album': 'list', Account: 'team', Owner: 'crown', Events: 'star',
};

/** Titles a group shows before "Show all". */
const TITLES_SHOWN = 6;

/** Titles: your name with the one you are looking at, every group with its progress, and a filter. */
function TitlePicker({ ctx, name, eq }: { ctx: UnlockContext; name: string; eq: ReturnType<typeof equipped> }) {
  const [filter, setFilter] = useState<'all' | 'open' | 'locked'>('all');
  const [peek, setPeek] = useState<string | null>(null);
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const groups = titleGroups(ctx);
  const all = groups.flatMap(g => g.items), open = all.filter(t => t.open).length;
  const tc = TITLE_COLORS.find(c => c.id === eq.titleColor) ?? TITLE_COLORS[0];
  const shown = peek ?? eq.title;
  return <div className="profile-picker title-picker" id="pick-title">
    <h3 className="hunt-subhead">Title <PickCount n={open} of={all.length} /></h3>
    <div className="title-preview">
      <span className="pixel-eyebrow">{peek && peek !== eq.title ? 'PREVIEW' : 'EQUIPPED'}</span>
      <NameTag name={name} icon={eq.icon} color={eq.color} title={shown} titleColor={eq.titleColor} size={26} className="title-preview-tag" />
      <small>Shown under your name on the leaderboards, your profile card and your public profile. Hover a title to try it.</small>
    </div>
    <div className="title-filter" role="radiogroup" aria-label="Show titles">{([['all', 'All'], ['open', 'Unlocked'], ['locked', 'Locked']] as const).map(([id, l]) =>
      <button key={id} role="radio" aria-checked={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{l}</button>)}</div>
    {groups.map(g => {
      const matching = g.items.filter(t => filter === 'all' || (filter === 'open' ? t.open : !t.open));
      if (!matching.length) return null;
      // Long groups show the first few (always with the one you wear); "Show all" opens the rest.
      const full = opened.has(g.label) || matching.length <= TITLES_SHOWN;
      const items = full ? matching : matching.filter((t, i) => i < TITLES_SHOWN || t.title === eq.title);
      const n = g.items.filter(t => t.open).length;
      return <div key={g.label} className="profile-title-group">
        <div className="title-group-head"><PixelIcon name={GROUP_ICON[g.label] ?? 'star'} size={14} /><b>{g.label}</b><PickCount n={n} of={g.items.length} /></div>
        <div role="radiogroup" aria-label={`${g.label} titles`}>{items.map(t => <button key={t.title} role="radio" aria-checked={eq.title === t.title} aria-disabled={!t.open}
          className={`profile-unlock title-tile ${eq.title === t.title ? 'selected' : ''} ${t.open ? '' : 'locked'}`}
          onMouseEnter={() => setPeek(t.title)} onMouseLeave={() => setPeek(null)} onFocus={() => setPeek(t.title)} onBlur={() => setPeek(null)}
          onClick={() => { if (t.open) equip({ title: t.title }); }}>
          <span className="title-tile-icon"><PixelIcon name={t.open ? GROUP_ICON[g.label] ?? 'star' : 'lock'} size={14} /></span>
          <b>{t.open ? <Tinted css={tc.css} anim={tc.anim}>{t.title}</Tinted> : t.title}</b>
          <small>{eq.title === t.title ? 'Equipped' : t.open ? 'Unlocked · click to equip' : t.how}</small>
          {!t.open && t.progress != null && t.progress > 0 && <i className="title-tile-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.round(t.progress * 100))}%` }} /></i>}
          {eq.title === t.title && <em className="title-tile-on">ON</em>}
        </button>)}</div>
        {matching.length > TITLES_SHOWN && <button className="link-button title-more" onClick={() => setOpened(o => { const n = new Set(o); if (n.has(g.label)) n.delete(g.label); else n.add(g.label); return n; })}>{full ? 'Show fewer' : `Show all ${matching.length}`}</button>}
      </div>;
    })}
  </div>;
}

const kb = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
const ago = (at: number) => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };

/**
 * Your account's sync, as a small chip on your card: when it last went up, and Sync now. A failed sync is not shown
 * as an error: the progress is safe on this device and the next sync carries it up.
 */
function SyncChip() {
  const a = useAccount(), s = a.sync;
  const label = s.state === 'syncing' ? 'Syncing…' : s.state === 'error' ? 'Saved on this device' : s.at ? `Synced ${ago(s.at)}` : 'Not synced yet';
  const tip = `Your level, records, character and finished careers follow @${a.profile?.username ?? '…'} to any device.${s.size ? ` Last upload ${kb(s.size.raw)} (${kb(s.size.wire)} sent).` : ''}${s.state === 'error' ? ' It will sync again shortly.' : ''}`;
  return <div className={`sync-chip ${s.state === 'error' ? 'waiting' : s.state}`} role="status" title={tip}>
    <span className="sync-dot" aria-hidden="true" /><span>{label}</span>
    <button className="link-button" onClick={() => void syncNow()} disabled={s.state === 'syncing'}>Sync now</button>
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
    <PlayTimeBar areas={Object.fromEntries(areas)} /></div>;
}

/** What others see on your public profile: one featured trophy, a short bio and a banner behind your name. */
function PublicProfileEditor({ ctx, level, signedIn }: { ctx: UnlockContext; level: number; signedIn: boolean }) {
  const [pp, setPp] = useState(readPublicProfile);
  const [bio, setBio] = useState(pp.bio ?? '');
  useEffect(() => { const bump = () => setPp(readPublicProfile()); window.addEventListener(PUBLIC_PROFILE_EVENT, bump); return () => window.removeEventListener(PUBLIC_PROFILE_EVENT, bump); }, []);
  const save = (patch: Parameters<typeof setPublicProfile>[0]) => { setPublicProfile(patch); if (signedIn) void syncNow(); };
  const problem = bioProblem(bio);
  const titles = [...new Set([...TITLES.filter(t => t.level <= level).map(t => t.name), ...rankTitles(), ...earnedExtraTitles(ctx)])];
  const gm = Object.keys(readLegacy().achievements).filter(id => ACHIEVEMENT_BY_ID.has(id));
  const modes = earnedModeAchievements().filter(id => MODE_ACHIEVEMENT_BY_ID.has(id));
  return <div className="public-profile-editor">
    <h3 className="hunt-subhead">Your public profile</h3>
    <label><span>Featured trophy</span>
      <select className="year-input" value={pp.featured ?? ''} onChange={e => save({ featured: e.target.value || undefined })}>
        <option value="">None</option>
        {gm.length + modes.length > 0 && <optgroup label="Achievements">
          {gm.map(id => <option key={id} value={`ach:${id}`}>{ACHIEVEMENT_BY_ID.get(id)!.name}</option>)}
          {modes.map(id => <option key={id} value={`mode:${id}`}>{MODE_ACHIEVEMENT_BY_ID.get(id)!.name}</option>)}
        </optgroup>}
        <optgroup label="Titles">{titles.map(t => <option key={t} value={`title:${t}`}>{t}</option>)}</optgroup>
      </select></label>
    <label><span>Banner behind your name</span>
      <select className="year-input" value={pp.banner ?? 'none'} onChange={e => save({ banner: e.target.value })}>
        <option value="none">None</option>
        <option value="clan">My clan's flag</option>
        <optgroup label="Team colours">{REAL_FRANCHISES.map(t => <option key={t.id} value={`team:${t.id}`}>{t.city} ({t.id})</option>)}</optgroup>
      </select></label>
    <label className="public-bio"><span>Bio <small>{bio.trim().length}/{BIO_MAX}</small></span>
      <input className="year-input" value={bio} maxLength={BIO_MAX} placeholder="A line about you as a GM" onChange={e => setBio(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !problem) save({ bio: bio.trim() || undefined }); }} />
      <button onClick={() => save({ bio: bio.trim() || undefined })} disabled={!!problem || bio.trim() === (pp.bio ?? '')}>Save bio</button>
      {problem && <small className="public-bio-problem" role="alert">{problem}</small>}
    </label>
    <small className="hint-text">{signedIn ? 'Shows on your public profile once it syncs.' : 'Sign in to show these on your public profile.'}</small>
  </div>;
}


/** Your card (the Profile tab of the Player Profile): the card others see, your level and XP, and everything to equip. */
export function ProfilePanel({ extras, onCloset }: { /** Shown right under your card (the GM legacy and favourites). */ extras?: ReactNode; /** Opens the Closet (your character and every cosmetic). */ onCloset?: () => void } = {}) {
  const p = useProfile();
  const account = useAccount();
  const eq = equipped(p.level);
  const ctx = unlockContext(p.level);
  const signedIn = account.status === 'signedIn' && !!account.profile?.username;
  const name = signedIn ? account.profile!.username! : localName();
  const specials = earnedExtraTitles(ctx).length + rankTitles().length;
  const pet = activePet(p.level);
  return <section className="locker-bay profile-panel">
    <h2><PixelIcon name="star" size={18} /> Your card</h2>
    <div className={`profile-card-big frame-${eq.frame}`}>
      <span className="profile-card-avatar"><MyFramedAvatar size={96} title={`${name}'s character`} />{pet && <span className="profile-card-pet"><PetSprite id={pet} look={lookOf(loadPets(), pet)} size={36} title={`${lookOf(loadPets(), pet).name}, ${name}'s pet`} /></span>}</span>
      <ProfileIcon id={eq.icon} size={40} title={`${name}'s icon`} />
      <div className="profile-card-id">
        <NameTag name={signedIn ? `@${name}` : name} icon={null} color={eq.color} title={eq.title} titleColor={eq.titleColor} className="profile-card-name" />
        <div className="hunt-cap-bar"><i style={{ width: `${p.need ? p.into / p.need * 100 : 100}%` }} /></div>
        <small>Level {p.level} · {p.xp.toLocaleString()} XP{p.need ? ` · ${(p.need - p.into).toLocaleString()} to level ${p.level + 1}` : ' · max level'}{specials ? ` · ${specials} special title${specials === 1 ? '' : 's'}` : ''}</small>
        <PlayTimeLine />
      </div>
      {signedIn && <SyncChip />}
      {!signedIn && <label className="profile-name-edit"><span>Profile name</span><input className="year-input" value={localName() === 'You' ? '' : localName()} placeholder="You" maxLength={18} onChange={e => setLocalName(e.target.value)} /><small>Sign in to claim a GM name on the boards.</small></label>}
    </div>
    <PublicProfileEditor ctx={ctx} level={p.level} signedIn={signedIn} />
    {extras}
    {onCloset && <p className="profile-closet-link"><button className="primary" onClick={onCloset}><PixelIcon name="star" size={14} /> Open your Closet</button> <small>Your character, picture frame, icon, colours, titles, card frame, court, phone and app look all live in the Closet.</small></p>}
    <table className="db-table profile-xp"><tbody>{p.parts.map(x => <tr key={x.id}><td className="col-name">{x.label}</td><td className="col-name">{x.detail}</td><td>{x.xp.toLocaleString()} XP</td></tr>)}</tbody></table>
    <p className="hint-text">XP comes from everything you finish: GM seasons, wins, titles and achievements (official leagues), careers, hunts, rebuilds, weekly challenges and daily goals. Icons, colours and titles are earned only by playing: levels, ranked seasons, achievements and leaderboard finishes (leaderboard titles arrive when you sync).</p>
  </section>;
}

export type ClosetTab = 'character' | 'ratings' | 'pets' | 'name' | 'frames' | 'look';
export const CLOSET_TABS: { id: ClosetTab; label: string }[] = [
  { id: 'character', label: 'Character' }, { id: 'ratings', label: 'Ratings' }, { id: 'pets', label: 'Pets' }, { id: 'name', label: 'Icon, colours & title' }, { id: 'frames', label: 'Frames, court & phone' }, { id: 'look', label: 'App look' },
];

/** The Closet's cosmetic pickers (the character itself is the AvatarEditor). */
export function ClosetPickers({ tab }: { tab: Exclude<ClosetTab, 'character' | 'ratings' | 'pets'> }) {
  const p = useProfile();
  const account = useAccount();
  const eq = equipped(p.level);
  const ctx = unlockContext(p.level);
  const signedIn = account.status === 'signedIn' && !!account.profile?.username;
  const name = signedIn ? account.profile!.username! : localName();
  const titleColorList = TITLE_COLORS.filter(c => (!c.staff || ctx.staff) && !eventPieceHidden(c.shop, ctx.shop ?? []));
  const iconList = listed(ICONS, ctx), nameColorList = listed(NAME_COLORS, ctx);
  return <section className="locker-bay profile-panel closet-panel">
    {tab === 'name' && <>
      <div className="closet-preview"><NameTag name={signedIn ? `@${name}` : name} icon={eq.icon} color={eq.color} title={eq.title} titleColor={eq.titleColor} size={22} /></div>
    <div className="profile-picker" id="pick-icon"><h3 className="hunt-subhead">Profile icon <PickCount n={iconList.filter(i => isOpen(i.rule, ctx)).length} of={iconList.length} /></h3>
      <div className="profile-icons" role="radiogroup" aria-label="Profile icon">{iconList.map(i => { const open = isOpen(i.rule, ctx); return <button key={i.id} role="radio" aria-checked={eq.icon === i.id} disabled={!open} title={`${i.name}${open ? '' : ` · ${i.how}`}`}
        className={`profile-icon-pick ${eq.icon === i.id ? 'selected' : ''} ${open ? '' : 'locked'}`} onClick={() => equip({ icon: i.id })}>
        <ProfileIcon id={i.id} size={48} title={i.name} /><b>{i.name}</b><small>{open ? (eq.icon === i.id ? 'Equipped' : 'Unlocked') : i.how}</small></button>; })}</div></div>

    <div className="profile-picker" id="pick-name-colour"><h3 className="hunt-subhead">Name colour <PickCount n={nameColorList.filter(c => isOpen(c.rule, ctx)).length} of={nameColorList.length} /></h3>
      <div className="profile-colors" role="radiogroup" aria-label="Name colour">{nameColorList.map(c => { const open = isOpen(c.rule, ctx); return <button key={c.id} role="radio" aria-checked={eq.color === c.id} disabled={!open}
        className={`profile-color-pick ${eq.color === c.id ? 'selected' : ''} ${open ? '' : 'locked'}`} onClick={() => equip({ color: c.id })}>
        <i className={c.anim ? `anim-${c.anim}` : undefined} style={{ background: c.css, backgroundSize: c.anim ? '200% 100%' : undefined }} aria-hidden="true" /><b>{c.name}</b><span className="name-color-sample"><Tinted css={c.css} anim={c.anim}>{name}</Tinted></span><small>{open ? 'Unlocked' : c.how}</small></button>; })}</div></div>

    <div className="profile-picker" id="pick-title-colour"><h3 className="hunt-subhead">Title colour <PickCount n={titleColorList.filter(c => titleColorOpen(c, ctx)).length} of={titleColorList.length} /> <small className="pick-note">{ctx.trophies.toLocaleString()} trophies</small></h3>
      <div className="profile-colors title-colors" role="radiogroup" aria-label="Title colour">{titleColorList.map(c => { const open = titleColorOpen(c, ctx); return <button key={c.id} role="radio" aria-checked={eq.titleColor === c.id} disabled={!open}
        className={`profile-color-pick title-color-pick ${eq.titleColor === c.id ? 'selected' : ''} ${open ? '' : 'locked'}`} onClick={() => equip({ titleColor: c.id })}>
        <i className={c.anim ? `anim-${c.anim}` : undefined} style={{ background: c.css, backgroundSize: c.anim ? '200% 100%' : undefined }} aria-hidden="true" />
        <b><Tinted css={c.css} anim={c.anim}>{c.name}</Tinted></b>
        <em><Tinted css={c.css} anim={c.anim}>{eq.title}</Tinted></em>
        <small>{open ? (eq.titleColor === c.id ? 'Equipped' : 'Unlocked') : c.shop ? (c.shop.startsWith('secret-') ? 'Secret · from spins' : c.shop.startsWith('evt-') ? 'Holiday event shop' : 'Relic Shop') : c.season ? seasonHow(c.season) : c.ownerLegacy != null ? `Owner legacy ${c.ownerLegacy}` : `${(trophyNeed('titleColor', c.id) ?? 0).toLocaleString()} trophies`}</small></button>; })}</div></div>

    <TitlePicker ctx={ctx} name={signedIn ? `@${name}` : name} eq={eq} />

    </>}
    {tab === 'frames' && <>

    <FramePicker value={eq.avatarFrame} ctx={ctx} />

    <Picker label="Share-card frame" list={listedFor(FRAMES)} level={p.level} trophies={ctx.trophies} value={eq.frame} onPick={v => equip({ frame: v })} preview={id => <ShareFramePreview frame={id} />} />
    <Picker label="Menu phone" list={listedFor(PHONES)} level={p.level} trophies={ctx.trophies} value={eq.phone} onPick={v => equip({ phone: v })} preview={id => <PhonePreview phone={id} size={112} />} />
    <Picker label="Court floor (Watch Game)" list={listedFor(FLOORS)} level={p.level} trophies={ctx.trophies} value={eq.floor} onPick={v => equip({ floor: v })} preview={id => <CourtFloorPreview floor={id} />} />
    </>}
    {tab === 'look' && <>
    <div id="pick-look"><ThemeSection /></div>

    </>}
  </section>;
}
