import { useEffect, useState } from 'react';
import { PixelIcon } from '../PixelIcon';
import { NameTag } from '../ProfileIcon';
import { CodeAvatar } from '../AvatarFrame';
import { cloudEnabled, useAccount } from '../../cloud/account';
import { openSignIn } from '../../cloud/signIn';
import { lastSeenLabel } from '../../cloud/lastSeen';
import { claimGifts, loadFriends, loadGifts, loadVisitors, sendGift, type Friend, type GiftStatus } from '../../cloud/social';
import '../hunt/hunt.css';
import '../locker/locker.css';

/**
 * The phone's Friend list: everyone you follow, with a free daily gift for each (150 coins and a Lucky Spin for them,
 * nothing spent by you, ten friends a day), the gifts waiting for you, and who visited your profile.
 */
export function FriendListPage({ onExit, onUser, onFind }: { onExit: () => void; onUser: (username: string) => void; onFind?: () => void }) {
  const acct = useAccount();
  const signedIn = acct.status === 'signedIn';
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [gifts, setGifts] = useState<GiftStatus | null>(null);
  const [visitors, setVisitors] = useState<{ today: number; week: number } | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    loadFriends().then(f => { if (live) setFriends(f); }, () => { if (live) setFriends([]); });
    loadGifts().then(g => { if (live) setGifts(g); }, e => { if (live) setNote({ text: e instanceof Error ? e.message : String(e), ok: false }); });
    loadVisitors().then(v => { if (live) setVisitors(v); }, () => {});
    return () => { live = false; };
  }, [signedIn]);

  const gift = async (f: Friend) => {
    setBusy(f.userId); setNote(null);
    try {
      const out = await sendGift(f.userId);
      setGifts(g => g && { ...g, sentTo: [...g.sentTo, f.userId], left: out.left });
      setNote({ text: `Sent! @${f.username} gets 150 coins and a Lucky Spin. It cost you nothing.`, ok: true });
    } catch (e) { setNote({ text: e instanceof Error ? e.message : String(e), ok: false }); }
    setBusy(null);
  };
  const collect = async () => {
    setBusy('claim'); setNote(null);
    try {
      const got = await claimGifts();
      setGifts(g => g && { ...g, waiting: [] });
      setNote({ text: got.coins ? `Collected ${got.coins.toLocaleString()} coins and ${got.lucky} Lucky Spin${got.lucky === 1 ? '' : 's'} from ${got.from.join(', ')}. They're in your Relic Vault.` : 'Nothing to collect right now.', ok: true });
    } catch (e) { setNote({ text: e instanceof Error ? e.message : String(e), ok: false }); }
    setBusy(null);
  };

  const waiting = gifts?.waiting ?? [];
  return <div className="hunt locker friend-list-page">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">YOUR FRIENDS · FREE DAILY GIFTS</span><h1>Friend list</h1></div>
      {onFind && <button className="relic-switch" onClick={onFind}><PixelIcon name="search" size={16} /> Find GMs</button>}
    </header>

    {!cloudEnabled || !signedIn ? <section className="locker-bay">
      <h2>Sign in to see your friends</h2>
      <p className="hint-text">Follow GMs you know, then send each of them a free gift every day: 150 coins and a Lucky Spin, and it costs you nothing.</p>
      {cloudEnabled && <button className="primary" onClick={openSignIn}>Sign in</button>}
    </section> : <>
      {waiting.length > 0 && <section className="locker-bay gift-inbox" aria-label="Gifts for you">
        <h2><PixelIcon name="star" size={18} /> {waiting.length} gift{waiting.length === 1 ? '' : 's'} for you</h2>
        <p className="hint-text">From {[...new Set(waiting.map(g => `@${g.from}`))].join(', ')}: {waiting.reduce((n, g) => n + g.coins, 0).toLocaleString()} coins and {waiting.reduce((n, g) => n + g.lucky, 0)} Lucky Spin{waiting.reduce((n, g) => n + g.lucky, 0) === 1 ? '' : 's'}.</p>
        <button className="primary" onClick={() => void collect()} disabled={busy === 'claim'}>{busy === 'claim' ? 'Collecting…' : 'Collect all'}</button>
      </section>}

      <section className="locker-bay">
        <div className="friend-list-head">
          <h2>Your friends {friends ? <small>{friends.length}</small> : null}</h2>
          {gifts && <span className="hint-text">Gifts left today: <b>{gifts.left}/{gifts.perDay}</b> · free for you</span>}
          {visitors && <span className="hint-text">{visitors.today} GM{visitors.today === 1 ? '' : 's'} visited your profile today · {visitors.week} this week</span>}
        </div>
        {note && <p className={`backup-msg ${note.ok ? 'ok' : 'err'}`} role="status">{note.text}</p>}
        {friends === null ? <p className="hint-text" role="status">Loading your friends…</p>
          : !friends.length ? <p className="empty-state">You don't follow anyone yet. {onFind ? 'Find GMs on the boards or by name, follow them, and they show up here.' : 'Follow GMs from their profile and they show up here.'}</p>
          : <ul className="friend-list">{friends.map(f => {
            const sent = !!gifts?.sentTo.includes(f.userId), seen = lastSeenLabel(f.lastSeen);
            return <li key={f.userId} className="friend-row">
              <span className="friend-avatar"><CodeAvatar code={f.avatar} size={40} /></span>
              <button className="link-button friend-name" onClick={() => onUser(f.username)}>
                <NameTag name={f.username} icon={f.icon} color={f.color} title={f.title} />
                <small>Level {f.level}{seen ? ` · ${seen === 'Online now' ? 'online now' : `seen ${seen}`}` : ''}</small>
              </button>
              <button className={sent ? '' : 'primary'} onClick={() => void gift(f)} disabled={sent || busy === f.userId || !gifts || gifts.left <= 0}
                title={sent ? 'Already sent today' : 'Free: 150 coins and a Lucky Spin for them'}>
                <PixelIcon name={sent ? 'check' : 'star'} size={14} /> {sent ? 'Sent today' : busy === f.userId ? 'Sending…' : 'Send gift'}
              </button>
            </li>;
          })}</ul>}
        <p className="hint-text">A gift is free: you don't spend any coins or spins. Your friend gets 150 coins and a Lucky Spin. Up to 10 friends a day, once each; new gifts at midnight UTC.</p>
      </section>
    </>}
  </div>;
}
