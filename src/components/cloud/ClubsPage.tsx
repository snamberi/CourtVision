import { useCallback, useEffect, useState } from 'react';
import { cloudEnabled, useAccount } from '../../cloud/account';
import { openSignIn } from '../../cloud/signIn';
import { myClub, findClubs, clubMembers, clubBoard, clubClash, createClub, joinClub, leaveClub, challengeClub, CLUB_MAX, type Club, type ClubMember, type ClubWeekRow, type Clash } from '../../cloud/clubs';
import { weekKey, weekEndsAt } from '../../retention/week';
import { ICONS, NAME_COLORS } from '../../profile/cosmetics';
import { ProfileIcon, NameTag, Tinted } from '../ProfileIcon';
import { PixelIcon } from '../PixelIcon';
import '../hunt/hunt.css';
import '../locker/locker.css';

/*
 * Clubs (#/clubs): your club (members, this week's club points, the clash), the club board, and finding or making a club.
 */

// Club badges: everyday icons (no animated, owner-only or Supporter ones).
const BADGES = ICONS.filter(i => !i.anim && !('staff' in i.rule) && !('supporter' in i.rule) && !('owner' in i.rule)).slice(0, 18);
const COLORS = NAME_COLORS.filter(c => !c.anim && !c.css.startsWith('linear')).slice(0, 12);
const colorCss = (id: string) => NAME_COLORS.find(c => c.id === id)?.css ?? '#ff9d3d';

function ClubBadge({ club, size = 32 }: { club: { badge: string; color: string; tag: string }; size?: number }) {
  return <span className="club-badge" style={{ borderColor: colorCss(club.color) }}><ProfileIcon id={club.badge} size={size} /><Tinted css={colorCss(club.color)}>{club.tag}</Tinted></span>;
}

export function ClubsPage({ onExit, onUser }: { onExit: () => void; onUser: (username: string) => void }) {
  const acct = useAccount();
  const signedIn = acct.status === 'signedIn';
  const [club, setClub] = useState<Club | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);
  useEffect(() => {
    if (!cloudEnabled || !signedIn) { setClub(null); return; }
    let live = true;
    myClub().then(c => { if (live) { setClub(c); setError(null); } }, (e: Error) => { if (live) { setClub(null); setError(e.message); } });
    return () => { live = false; };
  }, [signedIn, tick]);
  return <div className="hunt locker clubs-page">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">PLAY TOGETHER</span><h1>Clubs</h1></div>
    </header>
    {!cloudEnabled ? <p className="empty-state">Accounts and clubs are not switched on for this site yet.</p> : <div className="clubs-grid">
      {error && <p className="empty-state" role="alert">{error}</p>}
      {!signedIn && <section className="locker-bay">
        <h2><PixelIcon name="team" size={18} /> Start a club with your friends</h2>
        <p>A club is up to {CLUB_MAX} GMs with a name, a tag and a badge. Every weekly board you play adds club points, and club owners can challenge another club to a one-week clash.</p>
        <button className="primary" onClick={openSignIn}>Sign in</button>
      </section>}
      {signedIn && club && <MyClub club={club} onUser={onUser} onChange={refresh} />}
      {signedIn && club === null && !error && <CreateClub onDone={refresh} />}
      <ClubBoard mine={club ?? null} onJoined={refresh} canJoin={signedIn && club === null && !error} />
      <section className="locker-bay clubs-how">
        <h2><PixelIcon name="check" size={18} /> How club points work</h2>
        <ul>
          <li>Each weekly board (Weekly Hunt, Rebuild and Career of the Week, 82-0, Guess the Player, Higher or Lower, the Bracket) scores each member 0-100 against that board's best result that week.</li>
          <li>The club's points are its members' points added up. More boards played, more points.</li>
          <li>A clash runs for the current week (Monday to Sunday, UTC). The club with more points when the week ends wins it.</li>
        </ul>
      </section>
    </div>}
  </div>;
}

function MyClub({ club, onUser, onChange }: { club: Club; onUser: (u: string) => void; onChange: () => void }) {
  const acct = useAccount();
  const me = acct.userId;
  const [members, setMembers] = useState<ClubMember[] | null>(null);
  const [clash, setClash] = useState<Clash | null | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void clubMembers(club).then(m => { if (live) setMembers(m); }, () => { if (live) setMembers([]); });
    void clubClash(club).then(c => { if (live) setClash(c); }, () => { if (live) setClash(null); });
    return () => { live = false; };
  }, [club]);
  const total = (members ?? []).reduce((n, m) => n + m.points, 0);
  const owner = me === club.owner;
  const days = Math.max(1, Math.ceil((weekEndsAt() - Date.now()) / 86_400_000));
  const leave = async () => {
    if (!window.confirm(owner ? 'Leave your club? The longest-standing member becomes the owner (or the club closes if you are the last one).' : 'Leave this club?')) return;
    setBusy(true);
    try { await leaveClub(); onChange(); } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };
  const mine = clash ? (clash.a.clubId === club.id ? clash.a : clash.b) : null, theirs = clash ? (clash.a.clubId === club.id ? clash.b : clash.a) : null;
  return <section className="locker-bay club-home">
    <div className="club-head">
      <ClubBadge club={club} size={40} />
      <div><h2>{club.name}</h2>{club.motto && <p className="club-motto">"{club.motto}"</p>}<small>{club.members}/{CLUB_MAX} GMs · {club.xp.toLocaleString()} XP in all</small></div>
      <div className="club-points"><small>THIS WEEK</small><b>{total.toLocaleString()}</b><small>club points</small></div>
    </div>
    {clash === undefined ? null : clash && mine && theirs
      ? <div className={`club-clash ${mine.points > theirs.points ? 'ahead' : mine.points < theirs.points ? 'behind' : ''}`}>
        <span className="pixel-eyebrow">CLUB CLASH · {days} DAY{days === 1 ? '' : 'S'} LEFT</span>
        <div><b>{mine.name}</b><strong>{mine.points}</strong><i>vs</i><strong>{theirs.points}</strong><b>{theirs.name}</b></div>
        <small>{mine.points > theirs.points ? 'You are ahead. Keep playing the weekly boards.' : mine.points < theirs.points ? 'You are behind: every weekly board you play adds points.' : 'All square.'}</small>
      </div>
      : <p className="hint-text">No clash this week. {owner ? 'Challenge a club from the board below.' : 'Your club owner can challenge another club.'}</p>}
    <h3 className="hunt-subhead">Members</h3>
    {members == null ? <p className="hint-text">Loading the members…</p> : <ol className="club-members">{members.map(m => <li key={m.userId} className={m.userId === me ? 'you' : ''}>
      <button className="link-button" onClick={() => onUser(m.username)}><NameTag name={`@${m.username}`} icon={m.icon} color={m.color} title={m.title} /></button>
      <small>LV {m.level}{m.owner ? ' · owner' : ''}</small><b>{m.points}</b>
    </li>)}</ol>}
    <div className="club-actions">
      <button onClick={() => { void navigator.clipboard?.writeText(`Join my Court Vision club "${club.name}" [${club.tag}]: open Clubs and search for it.`).then(() => setMsg('Invite copied: send it to your friends.'), () => setMsg(`Tell your friends to search for "${club.name}" in Clubs.`)); }}>Copy an invite</button>
      <button disabled={busy} onClick={() => void leave()}>Leave the club</button>
    </div>
    {msg && <p className="hint-text" role="status">{msg}</p>}
  </section>;
}

function CreateClub({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [motto, setMotto] = useState('');
  const [badge, setBadge] = useState(BADGES[0]?.id ?? 'ball');
  const [color, setColor] = useState('orange');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setMsg(null);
    try { await createClub({ name, tag, badge, color, motto }); onDone(); } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };
  return <section className="locker-bay club-create">
    <h2><PixelIcon name="team" size={18} /> Start a club</h2>
    <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label>Club name<input className="year-input" value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="The Pixel Ballers" /></label>
      <label>Tag<input className="year-input" value={tag} maxLength={4} onChange={e => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="PXB" /></label>
      <label className="wide">Motto (optional)<input className="year-input" value={motto} maxLength={80} onChange={e => setMotto(e.target.value)} placeholder="Ball don't lie" /></label>
      <fieldset className="wide"><legend>Badge</legend><div className="club-picks">{BADGES.map(b => <button type="button" key={b.id} aria-pressed={badge === b.id} className={badge === b.id ? 'active' : ''} title={b.name} onClick={() => setBadge(b.id)}><ProfileIcon id={b.id} size={26} /></button>)}</div></fieldset>
      <fieldset className="wide"><legend>Colour</legend><div className="club-picks">{COLORS.map(c => <button type="button" key={c.id} aria-pressed={color === c.id} className={color === c.id ? 'active' : ''} title={c.name} onClick={() => setColor(c.id)}><i className="club-swatch" style={{ background: c.css }} /></button>)}</div></fieldset>
      <div className="wide club-preview"><ClubBadge club={{ badge, color, tag: tag || 'TAG' }} /> <b>{name || 'Your club'}</b></div>
      <button className="primary wide" disabled={busy || name.trim().length < 3 || tag.length < 2}>{busy ? 'Creating…' : 'Create the club'}</button>
    </form>
    {msg && <p className="empty-state" role="alert">{msg}</p>}
  </section>;
}

function ClubBoard({ mine, onJoined, canJoin }: { mine: Club | null; onJoined: () => void; canJoin: boolean }) {
  const acct = useAccount();
  const [rows, setRows] = useState<ClubWeekRow[] | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Club[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void clubBoard().then(r => { if (live) setRows(r); }, (e: Error) => { if (live) { setRows([]); setMsg(e.message); } });
    void findClubs().then(r => { if (live) setFound(r); }, () => { if (live) setFound([]); });
    return () => { live = false; };
  }, [mine?.id]);
  const search = async () => { try { setFound(await findClubs(q)); } catch (e) { setMsg((e as Error).message); } };
  const join = async (id: string) => { try { await joinClub(id); onJoined(); } catch (e) { setMsg((e as Error).message); } };
  const owner = !!mine && mine.owner === acct.userId;
  const challenge = async (id: string, name: string) => {
    if (!window.confirm(`Challenge ${name} to a clash this week?`)) return;
    try { await challengeClub(id); setMsg(`Clash on: you against ${name} until Sunday night (UTC).`); onJoined(); } catch (e) { setMsg((e as Error).message); }
  };
  return <section className="locker-bay club-board">
    <h2><PixelIcon name="trophy" size={18} /> Club board · {weekKey()}</h2>
    {rows == null ? <p className="hint-text">Loading the board…</p> : !rows.length ? <p className="hint-text">No club has points yet this week.</p>
      : <ol className="club-rank">{rows.map((r, i) => <li key={r.clubId} className={r.clubId === mine?.id ? 'you' : ''}>
        <span className="club-rank-n">{i + 1}</span><ClubBadge club={r} size={22} /><b>{r.name}</b><small>{r.players} playing</small><strong>{r.points}</strong>
        {owner && r.clubId !== mine?.id && <button onClick={() => void challenge(r.clubId, r.name)}>Clash</button>}
      </li>)}</ol>}
    <h3 className="hunt-subhead">Find a club</h3>
    <form className="signin-email" onSubmit={e => { e.preventDefault(); void search(); }}>
      <label htmlFor="club-search">Club name</label>
      <div><input id="club-search" className="year-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search clubs" autoComplete="off" /><button type="submit">Search</button></div>
    </form>
    {found && (found.length ? <ul className="club-found">{found.map(c => <li key={c.id}>
      <ClubBadge club={c} size={22} /><div><b>{c.name}</b><small>{c.members}/{CLUB_MAX} GMs{c.motto ? ` · "${c.motto}"` : ''}</small></div>
      {canJoin && <button className="primary" disabled={c.members >= CLUB_MAX} onClick={() => void join(c.id)}>{c.members >= CLUB_MAX ? 'Full' : 'Join'}</button>}
      {owner && c.id !== mine?.id && <button onClick={() => void challenge(c.id, c.name)}>Clash</button>}
    </li>)}</ul> : <p className="empty-state">No club by that name.</p>)}
    {msg && <p className="hint-text" role="status">{msg}</p>}
  </section>;
}
