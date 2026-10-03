import { useEffect, useState } from 'react';
import { cloudEnabled, useAccount } from '../../cloud/account';
import { searchUsers, friendActivity, type ActivityItem } from '../../cloud/boards';
import { loadRivalAlerts, dismissRival, RIVAL_BOARD_LABEL, RIVAL_PLAY, type RivalAlert } from '../../cloud/rivals';
import { openSignIn } from '../../cloud/signIn';
import { BoardTable } from './BoardTable';
import { NameTag } from '../ProfileIcon';
import { PixelIcon } from '../PixelIcon';
import '../hunt/hunt.css';
import '../locker/locker.css';

/*
 * Friends (the menu phone's Friends app, #/friends): the GMs you follow and how you stack up, friends who passed
 * you this week, finding a GM by name, and the ways to play a friend.
 */

type Hit = { id: string; username: string; title: string; level: number; icon?: string; color?: string };

export function FriendsPage({ onExit, onUser, onCommunity, onClubs, onOnline }: { onExit: () => void; onUser: (username: string) => void; onCommunity: () => void; onClubs?: () => void; onOnline?: () => void }) {
  const acct = useAccount();
  const signedIn = acct.status === 'signedIn';
  return <div className="hunt locker friends-page">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">YOUR CREW</span><h1>Friends</h1></div>
    </header>
    {!cloudEnabled ? <p className="empty-state">Accounts and friends are not switched on for this site yet.</p> : <div className="friends-grid">
      {!signedIn && <section className="locker-bay friends-signin">
        <h2><PixelIcon name="team" size={18} /> Play with your friends</h2>
        <p>Sign in to follow GMs, see how you stack up, get told when a friend passes you and challenge them to a 1v1.</p>
        <button className="primary" disabled={acct.status === 'loading'} onClick={openSignIn}>{acct.status === 'loading' ? 'Signing in…' : 'Sign in'}</button>
      </section>}
      {signedIn && <section className="locker-bay friends-list">
        <h2><PixelIcon name="team" size={18} /> You and the GMs you follow</h2>
        <BoardTable spec={{ kind: 'friends' }} scoreLabel="XP" onUser={onUser} empty="You don't follow anyone yet. Find a GM below and press Follow on their profile." />
      </section>}
      {onOnline && <section className="locker-bay friends-online">
        <h2><PixelIcon name="court" size={18} /> Online leagues</h2>
        <p>Run a GM league with 2-8 friends: everyone runs a team, the league moves when everyone is ready, and trades between friends need both of you to agree.</p>
        <button className="primary" onClick={onOnline}>Open online leagues</button>
      </section>}
      {onClubs && <section className="locker-bay friends-clubs">
        <h2><PixelIcon name="crown" size={18} /> Clubs</h2>
        <p>Start a club with your friends (up to 20 GMs): a name, a tag and a badge, club points from every weekly board, and one-week clashes against other clubs.</p>
        <button className="primary" onClick={onClubs}>Open Clubs</button>
      </section>}
      {signedIn && <RivalList />}
      {signedIn && <ActivityFeed onUser={onUser} />}
      <FindGm onUser={onUser} />
      <section className="locker-bay friends-ways">
        <h2><PixelIcon name="trophy" size={18} /> Ways to play a friend</h2>
        <ul>
          <li><b>1v1 match</b><span>Open a friend's profile and press <i>Challenge to a 1v1</i>: your League Hunt squad against theirs.</span></li>
          <li><b>Same spins</b><span>Finish a League Hunt or 82-0 run and share the duel link: your friend gets the exact same spins.</span></li>
          <li><b>League code</b><span>Every GM league shows a code on its dashboard. Your friend starts the same league from the menu's <i>Have a league code?</i> box.</span></li>
          <li><b>Weekly boards</b><span>The Weekly Hunt, Rebuild and Career of the Week are the same for everyone.</span><button className="link-button" onClick={onCommunity}>Open the leaderboards</button></li>
        </ul>
      </section>
    </div>}
  </div>;
}

/** Friends ahead of you this week (all of them, not just the three on the menu). */
function RivalList() {
  const a = useAccount();
  const [alerts, setAlerts] = useState<RivalAlert[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadRivalAlerts().then(x => { if (live) setAlerts(x); }, () => { if (live) setAlerts([]); });
    return () => { live = false; };
  }, [a.sync.at]);
  return <section className="locker-bay friends-rivals">
    <h2><PixelIcon name="flame" size={18} /> Rivals this week</h2>
    {alerts == null ? <p className="hint-text">Checking the boards…</p>
      : !alerts.length ? <p className="hint-text">No friend is ahead of you on this week's boards. Keep it that way.</p>
      : <ul className="rival-list">{alerts.map(x => <li key={x.id}>
        <span><b>@{x.friend}</b> {x.mine == null ? 'is on' : 'passed you on'} the {RIVAL_BOARD_LABEL[x.board]}: <b>{x.theirs.toLocaleString()}</b>{x.mine == null ? '.' : ` vs your ${x.mine.toLocaleString()}.`}</span>
        <button className="primary" onClick={() => { dismissRival([x.id]); location.hash = RIVAL_PLAY[x.board]; }}>{x.mine == null ? 'Play it' : 'Win it back'}</button>
      </li>)}</ul>}
  </section>;
}

/** Search GMs by name (shared with the Leaderboards' Friends tab). */
export function FindGm({ onUser }: { onUser: (username: string) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const search = async () => {
    if (q.trim().length < 2) return;
    setBusy(true);
    setFailed(false);
    // A dropped connection is not "no GM by that name": say which it was.
    setHits(await searchUsers(q.trim()).catch(() => { setFailed(true); return null; }));
    setBusy(false);
  };
  return <section className="locker-bay friends-find">
    <h2><PixelIcon name="search" size={18} /> Find a GM</h2>
    <form className="signin-email" onSubmit={e => { e.preventDefault(); void search(); }}>
      <label htmlFor="friends-search">GM name</label>
      <div><input id="friends-search" className="year-input" value={q} onChange={e => setQ(e.target.value)} placeholder="At least 2 letters" autoComplete="off" />
        <button type="submit" disabled={busy || q.trim().length < 2}>{busy ? 'Searching…' : 'Search'}</button></div>
    </form>
    {failed && <p className="empty-state">Couldn't reach the server. Check your connection and search again.</p>}
    {hits && (hits.length
      ? <ul className="cv-saved">{hits.map(h => <li key={h.id}><div><b><NameTag name={`@${h.username}`} icon={h.icon} color={h.color} title={h.title} /></b><small>LV {h.level}</small></div><button onClick={() => onUser(h.username)}>Profile</button></li>)}</ul>
      : <p className="empty-state">No GM by that name.</p>)}
  </section>;
}

const ago = (iso: string) => { const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
/** The activity feed: what the GMs you follow have been doing lately. */
function ActivityFeed({ onUser }: { onUser: (username: string) => void }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  useEffect(() => { let live = true; void friendActivity().then(x => { if (live) setItems(x); }, () => { if (live) setItems([]); }); return () => { live = false; }; }, []);
  return <section className="locker-bay friends-activity">
    <h2><PixelIcon name="chart" size={18} /> Friend activity</h2>
    {items == null ? <p className="hint-text">Loading…</p> : !items.length ? <p className="hint-text">Nothing yet. Follow some GMs and their results show up here.</p>
      : <ul className="activity-feed">{items.map((a, i) => <li key={i}><button className="link-button" onClick={() => onUser(a.username)}><NameTag name={`@${a.username}`} icon={a.icon} color={a.color} /></button> <span>{a.text}</span><small>{ago(a.at)}</small></li>)}</ul>}
  </section>;
}
