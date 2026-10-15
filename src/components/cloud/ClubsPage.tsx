import { useCallback, useEffect, useState } from 'react';
import { cloudEnabled, useAccount } from '../../cloud/account';
import { openSignIn } from '../../cloud/signIn';
import { myClub, findClubs, clubMembers, clubBoard, clubClash, isShowdownWeekend, showdownPair, showdownResult, createClub, updateClub, joinClub, leaveClub, challengeClub, kickMember, inviteMember, dropInvite, sentInvites, myInvites, clubCode, newClubCode, clanLink, clubByCode, joinByCode,
  CLUB_MAX, CLAN_PRICE, CLAN_DESCRIPTION_MAX, CLAN_CODE, CLAN_JOIN_KEY, type Club, type ClubMember, type ClubWeekRow, type Clash } from '../../cloud/clubs';
import { decodeFlag, encodeFlag, DEFAULT_FLAG, type ClanFlag } from '../../cloud/clanFlag';
import { FlagArt, FlagEditor } from './ClanFlag';
import { loadRelics, RELICS_EVENT } from '../../relics/relics';
import { weekKey, weekEndsAt } from '../../retention/week';
import { noteFeat } from '../../profile/feats';
import { ICONS, NAME_COLORS } from '../../profile/cosmetics';
import { ProfileIcon, NameTag, Tinted } from '../ProfileIcon';
import { PixelIcon } from '../PixelIcon';
import '../hunt/hunt.css';
import { clubPass, CLUB_BANNERS, CLUB_PASS_TIERS } from '../../cloud/clubs';
import '../locker/locker.css';

/*
 * Clans (#/clubs, and #/clans/join/<code> for an invite link): your clan (members, this week's clan points, the clash, the
 * leader's tools), clan invites, the clan board, and finding or founding a clan.
 */

// Club badges: everyday icons (no animated, owner-only or Supporter ones).
const BADGES = ICONS.filter(i => !i.anim && !('staff' in i.rule) && !('supporter' in i.rule) && !('owner' in i.rule)).slice(0, 18);
const COLORS = NAME_COLORS.filter(c => !c.anim && !c.css.startsWith('linear')).slice(0, 12);
const colorCss = (id: string) => NAME_COLORS.find(c => c.id === id)?.css ?? '#ff9d3d';

function ClubBadge({ club, size = 32 }: { club: { badge: string; color: string; tag: string; flag?: string }; size?: number }) {
  if (club.flag) return <span className="club-badge clan-mark" style={{ borderColor: colorCss(club.color) }}><FlagArt flag={decodeFlag(club.flag)} width={Math.round(size * 1.4)} /><Tinted css={colorCss(club.color)}>{club.tag}</Tinted></span>;
  return <span className="club-badge" style={{ borderColor: colorCss(club.color) }}><ProfileIcon id={club.badge} size={size} /><Tinted css={colorCss(club.color)}>{club.tag}</Tinted></span>;
}

const takeJoinCode = () => { try { const c = sessionStorage.getItem(CLAN_JOIN_KEY); sessionStorage.removeItem(CLAN_JOIN_KEY); return c && CLAN_CODE.test(c) ? c : null; } catch { return null; } };

export function ClubsPage({ onExit, onUser }: { onExit: () => void; onUser: (username: string) => void }) {
  const acct = useAccount();
  const signedIn = acct.status === 'signedIn';
  const [club, setClub] = useState<Club | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [joinCode, setJoinCode] = useState<string | null>(takeJoinCode);
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
      <div className="hunt-title"><span className="pixel-eyebrow">PLAY TOGETHER</span><h1>Clans</h1></div>
    </header>
    {!cloudEnabled ? <p className="empty-state">Accounts and clans are not switched on for this site yet.</p> : <div className="clubs-grid">
      {error && <p className="empty-state" role="alert">{error}</p>}
      {joinCode && <JoinLink code={joinCode} inClan={!!club} onDone={() => { setJoinCode(null); refresh(); }} />}
      {!signedIn && <section className="locker-bay">
        <h2><PixelIcon name="team" size={18} /> Start a clan with your friends</h2>
        <p>A clan is up to {CLUB_MAX} GMs with a name, a tag and a flag you design yourself. Every weekly board you play adds clan points, your clan's flag shows on your profile, and clan leaders can challenge another clan to a one-week clash.</p>
        <button className="primary" onClick={openSignIn}>Sign in</button>
      </section>}
      {signedIn && club && <MyClub club={club} onUser={onUser} onChange={refresh} />}
      {signedIn && club === null && !error && <MyInvites onJoined={refresh} />}
      {signedIn && club === null && !error && <ClanForm onDone={refresh} />}
      <ClubBoard mine={club ?? null} onJoined={refresh} canJoin={signedIn && club === null && !error} />
      <section className="locker-bay clubs-how">
        <h2><PixelIcon name="check" size={18} /> How clans work</h2>
        <ul>
          <li>Founding a clan costs {CLAN_PRICE.toLocaleString()} coins. The founder is the leader: they edit the clan (name, tag, description, flag), invite GMs, remove members and choose open or closed.</li>
          <li>Open clans: anyone can join from the board or a search. Closed clans: only with the clan's invite link or an invite from the leader.</li>
          <li>Each weekly board (Weekly Hunt, Rebuild and Career of the Week, 82-0, Guess the Player, Higher or Lower, the Bracket) scores each member 0-100 against that board's best result that week. The clan's points are its members' points added up.</li>
          <li>A clash runs for the current week (Monday to Sunday, UTC). The clan with more points when the week ends wins it.</li>
        </ul>
      </section>
    </div>}
  </div>;
}

/** A clan's invite link: what it leads to, and a button to join. */
function JoinLink({ code, inClan, onDone }: { code: string; inClan: boolean; onDone: () => void }) {
  const acct = useAccount();
  const [clan, setClan] = useState<Awaited<ReturnType<typeof clubByCode>> | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { let live = true; clubByCode(code).then(c => { if (live) setClan(c); }, (e: Error) => { if (live) { setClan(null); setMsg(e.message); } }); return () => { live = false; }; }, [code]);
  const join = async () => { try { await joinByCode(code); onDone(); } catch (e) { setMsg((e as Error).message); } };
  if (clan === undefined) return <section className="locker-bay"><p className="hint-text">Opening the invite link…</p></section>;
  return <section className="locker-bay clan-invite-card">
    <span className="pixel-eyebrow">CLAN INVITE LINK</span>
    {!clan ? <p>{msg ?? 'This invite link has expired. Ask the clan leader for a new one.'}</p> : <>
      <div className="clan-invite-head"><FlagArt flag={decodeFlag(clan.flag)} width={90} title={`${clan.name} flag`} /><div><h2>{clan.name} <small>[{clan.tag}]</small></h2><small>{clan.members}/{CLUB_MAX} GMs</small></div></div>
      {clan.description && <p className="clan-description">{clan.description}</p>}
      {acct.status !== 'signedIn' ? <button className="primary" onClick={openSignIn}>Sign in to join</button>
        : inClan ? <p className="hint-text">Leave your clan first to join {clan.name}.</p>
        : <button className="primary" disabled={clan.members >= CLUB_MAX} onClick={() => void join()}>{clan.members >= CLUB_MAX ? 'This clan is full' : `Join ${clan.name}`}</button>}
    </>}
    {msg && clan && <p className="hint-text" role="alert">{msg}</p>}
    <button className="link-button" onClick={onDone}>Close</button>
  </section>;
}

/** Clans that invited you: join or say no. */
function MyInvites({ onJoined }: { onJoined: () => void }) {
  const [list, setList] = useState<Club[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { let live = true; myInvites().then(l => { if (live) setList(l); }, () => { if (live) setList([]); }); return () => { live = false; }; }, []);
  if (!list?.length) return null;
  return <section className="locker-bay clan-invites">
    <h2><PixelIcon name="heart" size={18} /> Clan invites</h2>
    <ul className="club-found">{list.map(c => <li key={c.id}>
      <ClubBadge club={c} size={22} /><div><b>{c.name}</b><small>{c.members}/{CLUB_MAX} GMs{c.description ? ` · ${c.description}` : ''}</small></div>
      <button className="primary" disabled={c.members >= CLUB_MAX} onClick={() => { joinClub(c.id).then(() => { onJoined(); }, (e: Error) => setMsg(e.message)); }}>Join</button>
      <button onClick={() => { dropInvite(c.id).then(() => setList(l => (l ?? []).filter(x => x.id !== c.id)), (e: Error) => setMsg(e.message)); }}>No thanks</button>
    </li>)}</ul>
    {msg && <p className="hint-text" role="alert">{msg}</p>}
  </section>;
}

function MyClub({ club, onUser, onChange }: { club: Club; onUser: (u: string) => void; onChange: () => void }) {
  const acct = useAccount();
  const me = acct.userId;
  const [members, setMembers] = useState<ClubMember[] | null>(null);
  const [clash, setClash] = useState<Clash | null | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
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
    if (!window.confirm(owner ? 'Leave your clan? The longest-standing member becomes the leader (or the clan closes if you are the last one).' : 'Leave this clan?')) return;
    setBusy(true);
    try { await leaveClub(); onChange(); } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };
  const kick = async (m: ClubMember) => {
    if (!window.confirm(`Remove @${m.username} from ${club.name}? They can come back only with a new invite or the link.`)) return;
    try { await kickMember(m.userId); setMembers(ms => (ms ?? []).filter(x => x.userId !== m.userId)); onChange(); } catch (e) { setMsg((e as Error).message); }
  };
  const mine = clash ? (clash.a.clubId === club.id ? clash.a : clash.b) : null, theirs = clash ? (clash.a.clubId === club.id ? clash.b : clash.a) : null;
  if (editing) return <ClanForm club={club} onDone={() => { setEditing(false); onChange(); }} onCancel={() => setEditing(false)} />;
  return <section className="locker-bay club-home">
    <div className="club-head">
      {club.flag ? <FlagArt flag={decodeFlag(club.flag)} width={96} title={`${club.name} flag`} /> : <ClubBadge club={club} size={40} />}
      <div><h2>{club.name} <small>[{club.tag}]</small></h2>{club.motto && <p className="club-motto">"{club.motto}"</p>}
        <small>{club.members}/{CLUB_MAX} GMs · {club.open ? 'Open: anyone can join' : 'Closed: invite only'} · {club.xp.toLocaleString()} XP in all</small></div>
      <div className="club-points"><small>THIS WEEK</small><b>{total.toLocaleString()}</b><small>clan points</small></div>
    </div>
    {club.description && <p className="clan-description">{club.description}</p>}
    <ClubPassBar xp={club.xp} />
    {clash === undefined ? null : clash && mine && theirs
      ? <div className={`club-clash ${mine.points > theirs.points ? 'ahead' : mine.points < theirs.points ? 'behind' : ''}`}>
        <span className="pixel-eyebrow">CLAN CLASH · {days} DAY{days === 1 ? '' : 'S'} LEFT</span>
        <div><b>{mine.name}</b><strong>{mine.points}</strong><i>vs</i><strong>{theirs.points}</strong><b>{theirs.name}</b></div>
        <small>{mine.points > theirs.points ? 'You are ahead. Keep playing the weekly boards.' : mine.points < theirs.points ? 'You are behind: every weekly board you play adds points.' : 'All square.'}</small>
      </div>
      : <p className="hint-text">No clash this week. {owner ? 'Challenge a clan from the board below.' : 'Your clan leader can challenge another clan.'}</p>}
    <WeekendShowdown club={club} />
    <h3 className="hunt-subhead">Members</h3>
    {members == null ? <p className="hint-text">Loading the members…</p> : <ol className="club-members">{members.map(m => <li key={m.userId} className={m.userId === me ? 'you' : ''}>
      <button className="link-button" onClick={() => onUser(m.username)}><NameTag name={`@${m.username}`} icon={m.icon} color={m.color} title={m.title} /></button>
      <small>LV {m.level}{m.owner ? ' · leader' : ''}</small><b>{m.points}</b>
      {owner && !m.owner && <button className="link-button" onClick={() => void kick(m)} aria-label={`Remove @${m.username}`}>Remove</button>}
    </li>)}</ol>}
    {owner && <LeaderTools club={club} onEdit={() => setEditing(true)} />}
    <div className="club-actions">
      {!owner && <button onClick={() => { void navigator.clipboard?.writeText(`Join my Court Vision clan "${club.name}" [${club.tag}]: open Clans and search for it.`).then(() => setMsg('Copied: send it to your friends.'), () => setMsg(`Tell your friends to search for "${club.name}" in Clans.`)); }}>Tell a friend</button>}
      <button disabled={busy} onClick={() => void leave()}>Leave the clan</button>
    </div>
    {msg && <p className="hint-text" role="status">{msg}</p>}
  </section>;
}

/** The leader's tools: edit, invite by name, and the join link. */
function LeaderTools({ club, onEdit }: { club: Club; onEdit: () => void }) {
  const [name, setName] = useState('');
  const [sent, setSent] = useState<{ userId: string; username: string }[] | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    sentInvites(club).then(l => { if (live) setSent(l); }, () => { if (live) setSent([]); });
    clubCode(club).then(c => { if (live) setCode(c); }, () => {});
    return () => { live = false; };
  }, [club]);
  const invite = async () => {
    try { await inviteMember(name); setMsg(`Invite sent to @${name.replace(/^@/, '')}. It shows on their Clans page.`); setName(''); setSent(await sentInvites(club)); } catch (e) { setMsg((e as Error).message); }
  };
  const link = code ? clanLink(code) : null;
  return <div className="clan-leader">
    <h3 className="hunt-subhead">Leader tools</h3>
    <div className="club-actions"><button className="primary" onClick={onEdit}><PixelIcon name="settings" size={14} /> Edit the clan and its flag</button></div>
    <form className="signin-email" onSubmit={e => { e.preventDefault(); void invite(); }}>
      <label htmlFor="clan-invite">Invite a GM by name</label>
      <div><input id="clan-invite" className="year-input" value={name} onChange={e => setName(e.target.value)} placeholder="@username" autoComplete="off" /><button type="submit" disabled={name.replace(/^@/, '').trim().length < 3}>Invite</button></div>
    </form>
    {sent && sent.length > 0 && <ul className="clan-sent">{sent.map(u => <li key={u.userId}><span>@{u.username}</span><small>invited</small>
      <button className="link-button" onClick={() => { dropInvite(club.id, u.userId).then(() => setSent(l => (l ?? []).filter(x => x.userId !== u.userId)), (e: Error) => setMsg(e.message)); }}>Take back</button></li>)}</ul>}
    <div className="clan-link">
      <span>Invite link{club.open ? '' : ' (the only way into a closed clan, besides an invite)'}</span>
      {link ? <code>{link}</code> : <small>Run the clans update in Supabase to get a link.</small>}
      <div className="club-actions">
        {link && <button onClick={() => { void navigator.clipboard?.writeText(link).then(() => setMsg('Link copied.'), () => setMsg(link)); }}>Copy the link</button>}
        <button onClick={() => { if (!window.confirm('Make a new link? The old one stops working.')) return; newClubCode().then(c => { setCode(c); setMsg('New link made: the old one no longer works.'); }, (e: Error) => setMsg(e.message)); }}>New link</button>
      </div>
    </div>
    {msg && <p className="hint-text" role="status">{msg}</p>}
  </div>;
}

/** Found a clan, or (the leader) edit it: name, tag, motto, description, open or closed, badge, colour and the flag. */
function ClanForm({ club, onDone, onCancel }: { club?: Club; onDone: () => void; onCancel?: () => void }) {
  const editing = !!club;
  const [name, setName] = useState(club?.name ?? '');
  const [tag, setTag] = useState(club?.tag ?? '');
  const [motto, setMotto] = useState(club?.motto ?? '');
  const [description, setDescription] = useState(club?.description ?? '');
  const [open, setOpen] = useState(club?.open ?? true);
  const [badge, setBadge] = useState(club?.badge ?? BADGES[0]?.id ?? 'ball');
  const [color, setColor] = useState(club?.color ?? 'orange');
  const [flag, setFlag] = useState<ClanFlag>(() => (club?.flag ? decodeFlag(club.flag) : DEFAULT_FLAG));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coins, setCoins] = useState(() => loadRelics().coins);
  useEffect(() => { const sync = () => setCoins(loadRelics().coins); window.addEventListener(RELICS_EVENT, sync); return () => window.removeEventListener(RELICS_EVENT, sync); }, []);
  const short = !editing && coins < CLAN_PRICE;
  const submit = async () => {
    setBusy(true); setMsg(null);
    const edit = { name, tag, badge, color, motto, description, flag: encodeFlag(flag), open };
    try {
      if (editing) await updateClub(edit);
      else await createClub(edit);
      onDone();
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };
  return <section className="locker-bay club-create">
    <h2><PixelIcon name="team" size={18} /> {editing ? `Edit ${club!.name}` : 'Found a clan'}</h2>
    {!editing && <p className={short ? 'clan-price short' : 'clan-price'}>Founding a clan costs <b>{CLAN_PRICE.toLocaleString()} coins</b>. You have {coins.toLocaleString()}.{short ? ' Earn more in any mode, or join a clan for free.' : ''}</p>}
    <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label>Clan name<input className="year-input" value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="The Pixel Ballers" /></label>
      <label>Tag<input className="year-input" value={tag} maxLength={4} onChange={e => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="PXB" /></label>
      <label className="wide">Motto (optional)<input className="year-input" value={motto} maxLength={80} onChange={e => setMotto(e.target.value)} placeholder="Ball don't lie" /></label>
      <label className="wide">Description (optional)<textarea className="year-input clan-desc-input" value={description} maxLength={CLAN_DESCRIPTION_MAX} rows={3} onChange={e => setDescription(e.target.value)} placeholder="Who you are, what you play, when you play it." /><small>{description.length}/{CLAN_DESCRIPTION_MAX}</small></label>
      <fieldset className="wide"><legend>Who can join</legend><div className="hunt-replace">
        <button type="button" aria-pressed={open} className={open ? 'active' : ''} onClick={() => setOpen(true)}>Open: anyone</button>
        <button type="button" aria-pressed={!open} className={!open ? 'active' : ''} onClick={() => setOpen(false)}>Closed: link or invite only</button>
      </div></fieldset>
      <fieldset className="wide"><legend>Flag</legend><FlagEditor value={flag} onChange={setFlag} /></fieldset>
      <fieldset className="wide"><legend>Badge (shown where the flag is too small)</legend><div className="club-picks">{BADGES.map(b => <button type="button" key={b.id} aria-pressed={badge === b.id} className={badge === b.id ? 'active' : ''} title={b.name} onClick={() => setBadge(b.id)}><ProfileIcon id={b.id} size={26} /></button>)}</div></fieldset>
      <fieldset className="wide"><legend>Colour</legend><div className="club-picks">{COLORS.map(c => <button type="button" key={c.id} aria-pressed={color === c.id} className={color === c.id ? 'active' : ''} title={c.name} onClick={() => setColor(c.id)}><i className="club-swatch" style={{ background: c.css }} /></button>)}</div></fieldset>
      <div className="wide club-preview"><ClubBadge club={{ badge, color, tag: tag || 'TAG', flag: encodeFlag(flag) }} /> <b>{name || 'Your clan'}</b></div>
      <button className="primary wide" disabled={busy || short || name.trim().length < 3 || tag.length < 2}>{busy ? (editing ? 'Saving…' : 'Founding…') : editing ? 'Save the clan' : `Found the clan (${CLAN_PRICE.toLocaleString()} coins)`}</button>
      {onCancel && <button type="button" className="wide" onClick={onCancel}>Cancel</button>}
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
    <h2><PixelIcon name="trophy" size={18} /> Clan board · {weekKey()}</h2>
    {rows == null ? <p className="hint-text">Loading the board…</p> : !rows.length ? <p className="hint-text">No clan has points yet this week.</p>
      : <ol className="club-rank">{rows.map((r, i) => <li key={r.clubId} className={r.clubId === mine?.id ? 'you' : ''}>
        <span className="club-rank-n">{i + 1}</span><ClubBadge club={r} size={22} /><b>{r.name}</b><small>{r.players} playing</small><strong>{r.points}</strong>
        {owner && r.clubId !== mine?.id && <button onClick={() => void challenge(r.clubId, r.name)}>Clash</button>}
      </li>)}</ol>}
    <h3 className="hunt-subhead">Find a clan</h3>
    <form className="signin-email" onSubmit={e => { e.preventDefault(); void search(); }}>
      <label htmlFor="club-search">Clan name</label>
      <div><input id="club-search" className="year-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search clans" autoComplete="off" /><button type="submit">Search</button></div>
    </form>
    {found && (found.length ? <ul className="club-found">{found.map(c => <li key={c.id}>
      <ClubBadge club={c} size={22} /><div><b>{c.name}</b><small>{c.members}/{CLUB_MAX} GMs · {c.open ? 'open' : 'closed'}{c.motto ? ` · "${c.motto}"` : ''}</small></div>
      {canJoin && (c.open ? <button className="primary" disabled={c.members >= CLUB_MAX} onClick={() => void join(c.id)}>{c.members >= CLUB_MAX ? 'Full' : 'Join'}</button> : <small className="clan-closed"><PixelIcon name="lock" size={12} /> Invite only</small>)}
      {owner && c.id !== mine?.id && <button onClick={() => void challenge(c.id, c.name)}>Clash</button>}
    </li>)}</ul> : <p className="empty-state">No clan by that name.</p>)}
    {msg && <p className="hint-text" role="status">{msg}</p>}
  </section>;
}

/** The Weekend Showdown card: this weekend's rival (the club next to yours on the board) or last week's result. */
function WeekendShowdown({ club }: { club: Club }) {
  const [now] = useState(() => new Date());
  const [rows, setRows] = useState<{ cur: ClubWeekRow[]; last: ClubWeekRow[] } | null>(null);
  useEffect(() => {
    let live = true;
    const lastWeek = weekKey(new Date(now.getTime() - 7 * 86_400_000));
    void Promise.all([clubBoard(), clubBoard(lastWeek)]).then(([cur, last]) => {
      if (!live) return;
      setRows({ cur, last });
      // A showdown won last week counts once, for the Weekend Warriors achievement.
      const res = showdownResult(last, club.id);
      try { if (res?.outcome === 'won' && localStorage.getItem(SHOWDOWN_KEY) !== lastWeek) { localStorage.setItem(SHOWDOWN_KEY, lastWeek); noteFeat('showdownWins', 1); } } catch { /* storage blocked */ }
    }, () => { if (live) setRows({ cur: [], last: [] }); });
    return () => { live = false; };
  }, [club.id, now]);
  if (!rows) return null;
  const weekend = isShowdownWeekend(now), pair = showdownPair(rows.cur, club.id), last = showdownResult(rows.last, club.id);
  return <div className={`club-clash showdown ${pair && pair.me.points > pair.rival.points ? 'ahead' : pair && pair.me.points < pair.rival.points ? 'behind' : ''}`}>
    <span className="pixel-eyebrow">WEEKEND SHOWDOWN{weekend ? ' · LIVE UNTIL SUNDAY MIDNIGHT UTC' : ' · STARTS FRIDAY'}</span>
    {pair ? <div><b>{pair.me.name}</b><strong>{pair.me.points}</strong><i>vs</i><strong>{pair.rival.points}</strong><b>{pair.rival.name}</b></div>
      : <small>Your club needs points on this week's board to get a rival: the clubs next to each other on the board face off.</small>}
    <small>{weekend ? 'The week\'s club points at Sunday midnight decide it. Every weekly board your members play adds points.' : 'Each weekend your club faces the club next to it on the club board.'}{last ? ` Last week: ${last.outcome === 'won' ? `you beat ${last.rival.name}!` : last.outcome === 'lost' ? `${last.rival.name} won.` : `level with ${last.rival.name}.`}` : ''}</small>
  </div>;
}
const SHOWDOWN_KEY = 'cv-showdown-claimed';

/** The club pass: everyone's XP fills one bar, and banners unlock for the whole club. */
function ClubPassBar({ xp }: { xp: number }) {
  const p = clubPass(xp);
  return <div className="club-pass" aria-label={`Club pass tier ${p.tier} of ${CLUB_PASS_TIERS}`}>
    <span className="pixel-eyebrow">CLUB PASS · TIER {p.tier}/{CLUB_PASS_TIERS}</span>
    <i className="club-pass-bar"><i style={{ width: `${(p.into / p.need) * 100}%` }} /></i>
    <small>{p.tier >= CLUB_PASS_TIERS ? 'Every banner is yours.' : `${(p.need - p.into).toLocaleString()} XP to tier ${p.tier + 1}${p.next ? ` · next: ${p.next.name} at tier ${p.next.tier}` : ''}`}</small>
    <ul className="club-banners">{CLUB_BANNERS.map(b => <li key={b.tier} className={b.tier <= p.tier ? 'got' : ''} title={`${b.name} (tier ${b.tier})`}>
      <i style={{ background: `linear-gradient(${b.colors[0]}, ${b.colors[0]} 70%, ${b.colors[1]})`, borderColor: b.colors[1] }} /><small>{b.tier}</small></li>)}</ul>
  </div>;
}
