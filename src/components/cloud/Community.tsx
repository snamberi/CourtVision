import { hasOwnerAccess } from '../../profile/ownerAccess';
import { useEffect, useState } from 'react';
import { cloudEnabled, useAccount, signOut, deleteAccount, updateProfile } from '../../cloud/account';
import { syncNow } from '../../cloud/sync';
import { loadProfile, setFollow, report, achievementRarity, type BoardSpec } from '../../cloud/boards';
import { currentSeason, seasonLabel, tierFor, TIERS } from '../../cloud/ranked';
import { weekKey } from '../../retention/week';
import { weeklyRebuild, weeklyCareer } from '../../retention/weekly';
import { SCENARIOS } from '../../simulation/rebuildScenarios';
import { ACHIEVEMENT_BY_ID } from '../../simulation/frontOffice';
import { TITLES, levelFor, totalXp, rankTitles, equip } from '../../profile/profile';
import { usernameProblem } from '../../lib/names';
import { FindGm } from './FriendsPage';
import { BoardTable } from './BoardTable';
import { PvpArena } from './PvpArena';
import { openSignIn } from '../../cloud/signIn';
import { PixelIcon } from '../PixelIcon';
import { PlayerAvatar } from '../PlayerAvatar';
import { ProfileIcon, NameTag } from '../ProfileIcon';
import { HONORS } from '../../profile/cosmetics';
import { CodeAvatar } from '../AvatarFrame';
import { FriendlyMatch } from './FriendlyMatch';

/** The leaderboard honors on a public profile (server-granted, in its stats). */
const honorTitles = (s: Record<string, unknown>) => (Array.isArray(s.honors) ? s.honors : []).map(h => HONORS.find(x => x.id === h)?.title).filter((t): t is string => !!t);
import '../hunt/hunt.css';
import '../locker/locker.css';

type Tab = 'boards' | 'ranked' | 'pvp' | 'friends' | 'me';
type BoardId = 'gms' | 'players' | 'whunt' | 'w820' | 'wrebuild' | 'wcareer' | 'wguess' | 'whilo' | 'wbracket' | 'daily' | 'rebuild' | 'friends';
const BOARDS: { id: BoardId; label: string; icon: string; group: 'All time' | 'This week' | 'Today' }[] = [
  { id: 'gms', label: 'GMs', icon: 'trophy', group: 'All time' }, { id: 'players', label: 'Created players', icon: 'jersey', group: 'All time' },
  { id: 'rebuild', label: 'Rebuild records', icon: 'chart', group: 'All time' }, { id: 'friends', label: 'Friends', icon: 'team', group: 'All time' },
  { id: 'whunt', label: 'Weekly Hunt', icon: 'crown', group: 'This week' }, { id: 'w820', label: 'Daily 82-0', icon: 'star', group: 'This week' },
  { id: 'wrebuild', label: 'Rebuild of the Week', icon: 'shuffle', group: 'This week' }, { id: 'wcareer', label: 'Career of the Week', icon: 'up', group: 'This week' },
  { id: 'wguess', label: 'Guess the Player', icon: 'search', group: 'This week' }, { id: 'whilo', label: 'Higher or Lower', icon: 'down', group: 'This week' },
  { id: 'wbracket', label: 'Bracket Challenge', icon: 'list', group: 'This week' },
  { id: 'daily', label: 'Daily Legend', icon: 'calendar', group: 'Today' },
];
const BOARD_GROUPS = ['All time', 'This week', 'Today'] as const;
const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

/** Community: the online leaderboards, ranked seasons, League Hunt PvP, friends, your account and public profiles. */
export function Community({ onExit, user, onUser, initialTab = 'boards' }: { onExit: () => void; user: string | null; onUser: (username: string | null) => void; initialTab?: Tab }) {
  const acct = useAccount();
  const [tab, setTab] = useState<Tab>(initialTab);
  const tabs: [Tab, string][] = [['boards', 'Leaderboards'], ['ranked', 'Ranked'], ['pvp', 'Hunt PvP'], ['friends', 'Friends'], ['me', acct.status === 'signedIn' ? 'Your account' : 'Sign in']];
  return <div className="hunt locker community">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={user ? () => onUser(null) : onExit}><PixelIcon name="exit" size={16} /> {user ? 'Back' : 'Main Menu'}</button>
      <div className="hunt-title"><span className="pixel-eyebrow">PLAY AGAINST EVERYONE</span><h1>{user ? `@${user}` : 'Community'}</h1></div>
    </header>
    {!cloudEnabled ? <><p className="empty-state">Accounts and online leaderboards are not switched on for this site yet.</p></>
      : user ? <ProfileView username={user} onUser={onUser} />
        : <>
          <div className="stats-view-toggle community-tabs" role="tablist" aria-label="Community">
            {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
          </div>
          {acct.status !== 'signedIn' && tab !== 'me' && <SignInStrip />}
          {tab === 'boards' && <Boards onUser={onUser} />}
          {tab === 'ranked' && <Ranked onUser={onUser} />}
          {tab === 'pvp' && <PvpArena onUser={onUser} />}
          {tab === 'friends' && <Friends onUser={onUser} />}
          {tab === 'me' && <Me onUser={onUser} />}
        </>}
  </div>;
}

function SignInStrip() {
  return <div className="signin-strip"><span>Sign in to appear on the boards, play ranked and PvP, and keep your progress on every device.</span><button className="primary" onClick={openSignIn}>Sign in</button></div>;
}

// ---------------------------------------------------------------- leaderboards

function Boards({ onUser }: { onUser: (u: string) => void }) {
  const [board, setBoard] = useState<BoardId>('gms');
  const [lastWeek, setLastWeek] = useState(false);
  const [weeklyPlayers, setWeeklyPlayers] = useState(false);
  const [yesterday, setYesterday] = useState(false);
  const [scenario, setScenario] = useState(SCENARIOS[0].id);
  const [weeks] = useState(() => ({ now: weekKey(), last: weekKey(new Date(Date.now() - 7 * 86_400_000)) }));
  const week = lastWeek ? weeks.last : weeks.now;
  let spec: BoardSpec, label: string, blurb: string;
  switch (board) {
    case 'gms': spec = { kind: 'gms' }; label = 'XP'; blurb = 'Every GM by profile XP: seasons, titles, careers, hunts, rebuilds, weekly challenges and daily goals, in every mode.'; break;
    case 'players': spec = { kind: 'players', week: weeklyPlayers ? weeks.now : null }; label = 'Legacy'; blurb = weeklyPlayers ? `Career of the Week (${weeklyCareer().draftYear ?? 2026} draft): the best careers this week.` : 'The greatest created players from every GM, by Legacy Score (the same scale as the all-time Top 100).'; break;
    case 'whunt': spec = { kind: 'weekly', board: 'hunt', week }; label = 'Score'; blurb = 'The same hunt for everyone this week, as many tries as you like: your best counts. The top 10% when the week ends win the Weekly Hunter title and aura.'; break;
    case 'w820': spec = { kind: 'weekly', board: 'perfect', week }; label = 'Score'; blurb = 'Everyone gets the same 82-0 spins each day. Your best day of the week counts: wins, margins, bosses beaten and the playoffs.'; break;
    case 'wrebuild': spec = { kind: 'weekly', board: 'rebuild', week }; label = 'Score'; blurb = `${weeklyRebuild(week).scenario.title} · ${weeklyRebuild(week).twist.label}. Scored from your season records.`; break;
    case 'wcareer': spec = { kind: 'weekly', board: 'career', week }; label = 'Legacy'; blurb = 'The same wheel and draft class for everyone this week.'; break;
    case 'wguess': spec = { kind: 'weekly', board: 'guess', week }; label = 'Points'; blurb = 'The daily Guess the Player, added up over the week: 600 for a first-guess solve, 100 less for each extra guess.'; break;
    case 'whilo': spec = { kind: 'weekly', board: 'hilo', week }; label = 'Streak'; blurb = 'Your best Higher or Lower streak this week.'; break;
    case 'wbracket': spec = { kind: 'weekly', board: 'bracket', week }; label = 'Points'; blurb = 'The same sixteen all-time teams for everyone this week. 10, 20, 40 and 80 points a right pick by round; 320 is perfect.'; break;
    case 'daily': spec = { kind: 'daily', day: yesterday ? day(1) : day(0) }; label = 'Score'; blurb = 'Everyone plays the same hunt each day. Winning it beats everything; then how far you got.'; break;
    case 'rebuild': spec = { kind: 'rebuild', scenario }; label = 'Best'; blurb = 'Best score ever in each Rebuild scenario.'; break;
    case 'friends': spec = { kind: 'friends' }; label = 'XP'; blurb = 'You and the GMs you follow.'; break;
  }
  const current = BOARDS.find(b => b.id === board)!;
  return <section className="locker-bay boards-layout">
    <nav className="board-nav" role="radiogroup" aria-label="Leaderboard">{BOARD_GROUPS.map(g => <div key={g} className="board-nav-group">
      <small>{g.toUpperCase()}</small>
      {BOARDS.filter(b => b.group === g).map(b => <button key={b.id} role="radio" aria-checked={board === b.id} className={board === b.id ? 'selected' : ''} onClick={() => setBoard(b.id)}><PixelIcon name={b.icon} size={14} /><span>{b.label}</span></button>)}
    </div>)}</nav>
    <div className="board-main">
    <header className="board-head"><span className="board-head-icon"><PixelIcon name={current.icon} size={22} /></span><div><span className="pixel-eyebrow">{current.group.toUpperCase()} · RANKED BY {label.toUpperCase()}</span><h2>{current.label}</h2></div>
    <div className="board-options">
      {(board === 'wrebuild' || board === 'wcareer' || board === 'whunt' || board === 'w820' || board === 'wguess' || board === 'whilo' || board === 'wbracket') && <button aria-pressed={lastWeek} onClick={() => setLastWeek(v => !v)}>{lastWeek ? `Last week (${weeks.last})` : `This week (${weeks.now})`}</button>}
      {board === 'players' && <button aria-pressed={weeklyPlayers} onClick={() => setWeeklyPlayers(v => !v)}>{weeklyPlayers ? 'This week' : 'All time'}</button>}
      {board === 'daily' && <button aria-pressed={yesterday} onClick={() => setYesterday(v => !v)}>{yesterday ? 'Yesterday' : 'Today'}</button>}
      {board === 'rebuild' && <select className="year-input" value={scenario} onChange={e => setScenario(e.target.value)} aria-label="Scenario">{SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.title} ({s.team} {s.startYear})</option>)}</select>}
    </div></header>
    <p className="board-blurb">{blurb}</p>
    <BoardTable spec={spec} scoreLabel={label} onUser={onUser} empty={board === 'friends' ? 'Follow GMs from their profile or the Friends tab to fill this board.' : 'No one on this board yet. Be the first.'} />
    </div>
  </section>;
}

// ---------------------------------------------------------------- ranked

function Ranked({ onUser }: { onUser: (u: string) => void }) {
  const acct = useAccount();
  const [season] = useState(() => currentSeason());
  const [prev] = useState(() => currentSeason(new Date(Date.parse(`${currentSeason()}-01T00:00:00Z`) - 86_400_000)));
  const [showPrev, setShowPrev] = useState(false);
  const bySeason = (acct.profile?.stats?.ranked ?? {}) as Record<string, number>;
  const mine = bySeason[season] ?? 0;
  const t = tierFor(mine);
  const [now] = useState(() => Date.now());
  const end = Date.UTC(Number(season.slice(0, 4)), Number(season.slice(5)), 1);
  const days = Math.max(1, Math.ceil((end - now) / 86_400_000));
  return <section className="locker-bay">
    <h2><PixelIcon name="trophy" size={18} /> Ranked · {seasonLabel(season)}</h2>
    {acct.status === 'signedIn' && <div className="ranked-me">
      <div className="ranked-tier" style={{ borderColor: t.tier.color, color: t.tier.color }}><small>YOUR TIER</small><b>{t.tier.name}</b></div>
      <div className="profile-progress"><strong>{mine.toLocaleString()} rank points</strong>
        <div className="hunt-cap-bar"><i style={{ width: `${t.next ? t.into / (t.next.min - t.tier.min) * 100 : 100}%`, background: t.tier.color }} /></div>
        <small>{t.next ? `${(t.next.min - mine).toLocaleString()} to ${t.next.name}` : 'Top tier'} · season ends in {days} day{days === 1 ? '' : 's'}</small></div>
    </div>}
    <ol className="tier-ladder">{TIERS.map(x => <li key={x.id} style={{ borderColor: x.color }} className={acct.status === 'signedIn' && x.id === t.tier.id ? 'current' : ''}><b style={{ color: x.color }}>{x.name}</b><small>{x.min.toLocaleString()}+</small></li>)}</ol>
    <p className="hint-text">Earn rank points all month: Daily Legend (a win is 40), Rebuild of the Week (25 per star, 25 more for a title), Career of the Week (half the Legacy Score), and daily goals (5 each). Your best result per event counts. Reach Gold, Platinum, Diamond or Legend to unlock that GM title for good. A new season starts on the 1st.</p>
    <div className="board-options"><button aria-pressed={showPrev} onClick={() => setShowPrev(v => !v)}>{showPrev ? `Last season (${seasonLabel(prev)})` : `This season (${seasonLabel(season)})`}</button></div>
    <BoardTable spec={{ kind: 'ranked', season: showPrev ? prev : season }} scoreLabel="Points" onUser={onUser} empty="No ranked results yet this season." />
    {Object.keys(bySeason).length > 0 && <><h3 className="hunt-subhead">Your seasons</h3>
      <ul className="ranked-history">{Object.entries(bySeason).sort((a, b) => b[0].localeCompare(a[0])).map(([s, p]) => { const tt = tierFor(p).tier; return <li key={s}><span>{seasonLabel(s)}</span><b style={{ color: tt.color }}>{tt.name}</b><small>{p.toLocaleString()} pts</small></li>; })}</ul></>}
  </section>;
}

// ---------------------------------------------------------------- friends

function Friends({ onUser }: { onUser: (u: string) => void }) {
  const acct = useAccount();
  return <><FindGm onUser={onUser} /><section className="locker-bay">
    <h2><PixelIcon name="team" size={18} /> Friends</h2>
    <h3 className="hunt-subhead">You and the GMs you follow</h3>
    {acct.status === 'signedIn' ? <BoardTable spec={{ kind: 'friends' }} scoreLabel="XP" onUser={onUser} empty="Follow GMs from their profile to see them here." /> : <p className="hint-text">Sign in to follow GMs.</p>}
    <p className="hint-text">Challenge a friend: every league shows a league code on its dashboard. Send it; when you both finish the first season, the result shows on the code's board, side by side.</p>
  </section></>;
}

// ---------------------------------------------------------------- your account

function Me({ onUser }: { onUser: (u: string) => void }) {
  const acct = useAccount();
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [sure, setSure] = useState(false);
  if (acct.status !== 'signedIn') return <section className="locker-bay"><h2>Sign in</h2><p className="hint-text">A free account keeps your level, trophies, records and retired careers on every device and puts you on the online leaderboards. Sign in with Discord, Google or an email link.</p><button className="primary" onClick={openSignIn}>Sign in</button></section>;
  const p = acct.profile;
  const level = levelFor(totalXp()).level;
  const titles = [...TITLES.filter(t => t.level <= level || hasOwnerAccess()).map(t => t.id), ...rankTitles()];
  const rename = async () => {
    const problem = usernameProblem(name);
    if (problem) { setMsg({ text: problem, ok: false }); return; }
    const e = await updateProfile({ username: name.trim() });
    setMsg(e ? { text: e, ok: false } : { text: 'Name changed.', ok: true });
  };
  return <section className="locker-bay">
    <h2><PixelIcon name="star" size={18} /> @{p?.username}</h2>
    <p className="hint-text">Signed in{acct.email ? ` as ${acct.email}` : ''}{acct.provider ? ` with ${acct.provider[0].toUpperCase()}${acct.provider.slice(1)}` : ''}. Level {p?.level ?? 1} · {(p?.xp ?? 0).toLocaleString()} XP online.</p>
    <div className="contest-actions">
      {p?.username && <button className="primary" onClick={() => onUser(p.username!)}>Your public profile</button>}
      {p?.username && <button onClick={() => void navigator.clipboard?.writeText(`${location.origin}/#/u/${p.username}`).then(() => setMsg({ text: 'Profile link copied.', ok: true }))}>Copy profile link</button>}
      <button onClick={() => void syncNow()} disabled={acct.sync.state === 'syncing'}>{acct.sync.state === 'syncing' ? 'Syncing…' : 'Sync now'}</button>
    </div>
    <p className={`hint-text sync-line ${acct.sync.state}`}>{acct.sync.state === 'error' ? `Sync problem: ${acct.sync.message}` : acct.sync.at ? `Synced ${new Date(acct.sync.at).toLocaleTimeString()}.` : 'Not synced yet this visit.'} GM leagues and careers in progress stay on each device; use Backup everything to move them.</p>
    <h3 className="hunt-subhead">Title on the boards</h3>
    <select className="year-input" value={p?.title ?? ''} onChange={e => { equip({ title: e.target.value }); void updateProfile({ title: e.target.value }); }} aria-label="Title">{titles.map(t => <option key={t} value={t}>{t}</option>)}</select>
    <h3 className="hunt-subhead">Change your GM name</h3>
    <form className="signin-email" onSubmit={e => { e.preventDefault(); void rename(); }}><div><input className="year-input" value={name} maxLength={18} onChange={e => setName(e.target.value)} placeholder={p?.username ?? ''} /><button type="submit" disabled={name.trim().length < 3}>Change</button></div></form>
    {msg && <p className={`backup-msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</p>}
    <div className="contest-actions account-danger">
      <button onClick={() => void signOut()}>Sign out</button>
      {!sure ? <button className="link-button" onClick={() => setSure(true)}>Delete account…</button>
        : <><button className="danger" onClick={() => void deleteAccount().then(e => setMsg(e ? { text: e, ok: false } : { text: 'Account deleted.', ok: true }))}>Delete my account and online data</button><button onClick={() => setSure(false)}>Cancel</button></>}
    </div>
    {sure && <p className="hint-text">Deletes your account, profile, cloud progress and every leaderboard entry. Progress on this device stays.</p>}
  </section>;
}

// ---------------------------------------------------------------- public profile

type Loaded = Awaited<ReturnType<typeof loadProfile>>;
function ProfileView({ username, onUser }: { username: string; onUser: (u: string) => void }) {
  const acct = useAccount();
  const [data, setData] = useState<{ key: string; p: Loaded } | null>(null);
  const [rarity, setRarity] = useState<Record<string, number>>({});
  const [following, setFollowing] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadProfile(username).then(p => { if (live) setData({ key: username, p }); }, () => { if (live) setData({ key: username, p: null }); });
    achievementRarity().then(r => { if (live) setRarity(r); }, () => {});
    return () => { live = false; };
  }, [username, acct.userId]);
  const d = data?.key === username ? data.p : undefined;
  if (d === undefined) return <p className="hint-text" role="status">Loading the profile…</p>;
  if (!d) return <p className="empty-state">No GM called @{username}.</p>;
  const s = d.profile.stats as Record<string, unknown> & { bestPlayer?: { name: string; legacy: number } | null; ranked?: Record<string, number> };
  const isMe = acct.userId === d.profile.id;
  const follows = following ?? d.following;
  const season = tierFor((s.ranked ?? {})[currentSeason()] ?? 0).tier;
  const followerCount = d.followers + (following == null || following === d.following ? 0 : following ? 1 : -1);
  const rarest = [...d.achievements].filter(id => rarity[id] != null).sort((a, b) => rarity[a] - rarity[b]).slice(0, 3);
  const huntBest = Number(s.huntBest ?? 0);
  return <>
    <section className="locker-bay profile-showcase">
      <div className="showcase-stage">
        {d.profile.avatar ? <><CodeAvatar code={d.profile.avatar} size={132} title={`${d.profile.username}'s portrait`} /><CodeAvatar code={d.profile.avatar} full size={150} title={`${d.profile.username}'s character`} /></>
          : <p className="hint-text">No character online yet.</p>}
      </div>
      <div className="showcase-facts">
        <span className="pixel-eyebrow">SHOWCASE</span>
        <h2><NameTag name={`@${d.profile.username}`} icon={d.profile.icon} color={d.profile.color} title={d.profile.title} /></h2>
        <ul className="showcase-list">
          <li><small>BEST LEAGUE HUNT</small><b>{Number(s.huntWins ?? 0) > 0 ? `Won ${Number(s.huntWins)} hunt${Number(s.huntWins) === 1 ? '' : 's'}` : huntBest > 0 ? `Reached series ${huntBest + 1}` : '—'}</b></li>
          <li><small>RANKED THIS MONTH</small><b style={{ color: season.color }}>{season.name}</b></li>
          <li><small>HUNT PVP</small><b>{d.pvp ? `${d.pvp.rating} (${d.pvp.wins}-${d.pvp.losses})` : '—'}</b></li>
          <li><small>GREATEST PLAYER</small><b>{s.bestPlayer ? `${s.bestPlayer.name} · ${s.bestPlayer.legacy}` : '—'}</b></li>
        </ul>
        {rarest.length > 0 && <><small className="showcase-sub">RAREST ACHIEVEMENTS</small><ul className="achievement-chips showcase-rare">{rarest.map(id => <li key={id}><b>{ACHIEVEMENT_BY_ID.get(id)?.name ?? id.replace(/^mode-/, '')}</b><small>{rarity[id]}% of GMs</small></li>)}</ul></>}
        {!isMe && d.pvp?.squad != null && <FriendlyMatch theirs={d.pvp.squad} username={d.profile.username} />}
      </div>
    </section>
    <section className="locker-bay profile-card">
      <div className="profile-head">
        <ProfileIcon id={d.profile.icon} size={56} title={`${d.profile.username}'s icon`} />
        <div className="profile-level"><small>LEVEL</small><b>{d.profile.level}</b></div>
        <div className="profile-progress"><strong><NameTag name={`@${d.profile.username}`} icon={null} color={d.profile.color} title={d.profile.title} /></strong>{honorTitles(s).length > 0 && <span className="profile-honors">{honorTitles(s).map(t => <em key={t}>{t}</em>)}</span>}<small>{d.profile.xp.toLocaleString()} XP · {followerCount} follower{followerCount === 1 ? '' : 's'} · ranked {season.name} this month</small></div>
      </div>
      <div className="hunt-over-stats locker-totals">
        <div><small>GM TITLES</small><b>{Number(s.titles ?? 0)}</b></div><div><small>SEASONS</small><b>{Number(s.seasons ?? 0)}</b></div><div><small>HALL OF FAMERS</small><b>{Number(s.hallOfFame ?? 0)}</b></div>
        <div><small>HUNTS WON</small><b>{Number(s.huntWins ?? 0)}</b></div><div><small>REBUILD STARS</small><b>{Number(s.rebuildStars ?? 0)}</b></div><div><small>PVP</small><b>{d.pvp ? d.pvp.rating : '—'}</b></div>
      </div>
      {!isMe && acct.status === 'signedIn' && <div className="contest-actions">
        <button className={follows ? '' : 'primary'} onClick={() => void setFollow(d.profile.id, !follows).then(() => setFollowing(!follows), e => setMsg(String(e.message ?? e)))}>{follows ? 'Following ✓' : 'Follow'}</button>
        <button className="link-button" onClick={() => void report(d.profile.id, 'Name or profile').then(() => setMsg('Reported. Thanks: we will take a look.'), e => setMsg(String(e.message ?? e)))}>Report name</button>
      </div>}
      {msg && <p className="hint-text" role="status">{msg}</p>}
    </section>
    <section className="locker-bay">
      <h2><PixelIcon name="star" size={18} /> Best created players</h2>
      {d.players.length ? <div className="feature-table-scroll"><table className="db-table"><thead><tr><th className="col-name">Player</th><th>Legacy</th><th>Seasons</th><th>PPG</th><th>RPG</th><th>APG</th><th>Titles</th><th>MVPs</th><th className="col-name">Hall of Fame</th></tr></thead>
        <tbody>{d.players.map(pl => <tr key={String(pl.career_id)}><td className="col-name"><span className="cv-inline-avatar"><PlayerAvatar playerId={String(pl.name)} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={24} /></span>{String(pl.name)}</td><td>{String(pl.legacy)}</td><td>{String(pl.seasons)}</td><td>{String(pl.ppg)}</td><td>{String(pl.rpg)}</td><td>{String(pl.apg)}</td><td>{String(pl.titles)}</td><td>{String(pl.mvps)}</td><td className="col-name">{pl.hall_of_fame === 'first-ballot' ? 'First ballot' : pl.hall_of_fame === 'yes' ? 'Yes' : '—'}</td></tr>)}</tbody></table></div>
        : <p className="empty-state">No retired careers yet.</p>}
    </section>
    <section className="locker-bay">
      <h2><PixelIcon name="trophy" size={18} /> Achievements ({d.achievements.length})</h2>
      {d.achievements.length ? <ul className="achievement-chips">{d.achievements.map(id => { const a = ACHIEVEMENT_BY_ID.get(id); return <li key={id} title={a?.description}><b>{a?.name ?? id}</b>{rarity[id] != null && <small>{rarity[id]}% of GMs</small>}</li>; })}</ul> : <p className="empty-state">None yet.</p>}
    </section>
    {d.rebuild.length > 0 && <section className="locker-bay"><h2><PixelIcon name="chart" size={18} /> Rebuilds</h2>
      <ul className="profile-rebuilds">{d.rebuild.map(r => { const sc = SCENARIOS.find(x => x.id === r.scenario); return <li key={r.scenario}><b>{sc?.title ?? r.scenario}</b><span className="rb-stars">{'★'.repeat(r.stars)}{'☆'.repeat(3 - r.stars)}</span><small>best {r.best.toLocaleString()}{r.title_in ? ` · title in year ${r.title_in}` : ''}</small></li>; })}</ul></section>}
    <p className="hint-text"><button className="link-button" onClick={() => void navigator.clipboard?.writeText(`${location.origin}/#/u/${d.profile.username}`).then(() => setMsg('Profile link copied.'))}>Copy profile link</button>{s.bestPlayer ? ` · Greatest player: ${s.bestPlayer.name} (Legacy ${s.bestPlayer.legacy})` : ''} {isMe ? '' : <button className="link-button" onClick={() => onUser('')}>All boards</button>}</p>
  </>;
}
