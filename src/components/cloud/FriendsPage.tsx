import { useEffect, useState } from 'react';
import { cloudEnabled, useAccount } from '../../cloud/account';
import { searchUsers } from '../../cloud/boards';
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

export function FriendsPage({ onExit, onUser, onCommunity }: { onExit: () => void; onUser: (username: string) => void; onCommunity: () => void }) {
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
      {signedIn && <RivalList />}
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

function FindGm({ onUser }: { onUser: (username: string) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const search = async () => {
    if (q.trim().length < 2) return;
    setBusy(true);
    setHits(await searchUsers(q.trim()).catch(() => []));
    setBusy(false);
  };
  return <section className="locker-bay friends-find">
    <h2><PixelIcon name="search" size={18} /> Find a GM</h2>
    <form className="signin-email" onSubmit={e => { e.preventDefault(); void search(); }}>
      <label htmlFor="friends-search">GM name</label>
      <div><input id="friends-search" className="year-input" value={q} onChange={e => setQ(e.target.value)} placeholder="At least 2 letters" autoComplete="off" />
        <button type="submit" disabled={busy || q.trim().length < 2}>{busy ? 'Searching…' : 'Search'}</button></div>
    </form>
    {hits && (hits.length
      ? <ul className="cv-saved">{hits.map(h => <li key={h.id}><div><b><NameTag name={`@${h.username}`} icon={h.icon} color={h.color} title={h.title} /></b><small>LV {h.level}</small></div><button onClick={() => onUser(h.username)}>Profile</button></li>)}</ul>
      : <p className="empty-state">No GM by that name.</p>)}
  </section>;
}
