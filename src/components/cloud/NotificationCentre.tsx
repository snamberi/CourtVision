import { PushSettings } from './PushSettings';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cloudEnabled, useAccount } from '../../cloud/account';
import { INBOX_EVENT, loadInbox, markInboxRead, readInboxIds, type InboxSnapshot } from '../../cloud/notifications';
import { openSignIn } from '../../cloud/signIn';
import { Modal } from '../Modal';
import { PixelIcon } from '../PixelIcon';

export function NotificationApp({ onFriends, onFriendList }: { onFriends?: () => void; onFriendList?: () => void }) {
  const account = useAccount();
  // Remount on identity changes to discard pending requests and other accounts' content.
  return <AccountInbox key={account.userId ?? 'signed-out'} userId={account.status === 'signedIn' ? account.userId : null} onFriends={onFriends} onFriendList={onFriendList} />;
}
function AccountInbox({ userId, onFriends, onFriendList }: { userId: string | null; onFriends?: () => void; onFriendList?: () => void }) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<InboxSnapshot>({ items: [], errors: [] });
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [read, setRead] = useState(() => readInboxIds(userId ?? ''));
  const previous = useRef(snapshot.items), pending = useRef(false), live = useRef(false);
  const refresh = useCallback(async () => {
    if (!userId || !cloudEnabled || pending.current) return;
    pending.current = true; setBusy(true);
    try {
      const next = await loadInbox(previous.current);
      if (live.current) { previous.current = next.items; setSnapshot(next); setLoaded(true); }
    } finally { pending.current = false; if (live.current) setBusy(false); }
  }, [userId]);
  useEffect(() => {
    live.current = true;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60_000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { live.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  useEffect(() => {
    const sync = () => setRead(readInboxIds(userId ?? ''));
    window.addEventListener(INBOX_EVENT, sync); window.addEventListener('storage', sync);
    return () => { window.removeEventListener(INBOX_EVENT, sync); window.removeEventListener('storage', sync); };
  }, [userId]);
  const mark = (ids: string[]) => {
    if (userId && !markInboxRead(userId, ids)) setStorageError('Could not save read status on this device.');
    else setStorageError('');
  };
  const unread = snapshot.items.filter(i => !read.has(i.id)).length;
  return <>
    <button className="menu-phone-app" aria-haspopup="dialog" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => { setOpen(true); void refresh(); }}>
      <span className="app-tile news"><PixelIcon name="list" size={20} />{unread > 0 && <em className="app-badge">{unread > 9 ? '9+' : unread}</em>}</span><small>Notifications</small>
    </button>
    {open && createPortal(<Modal label="Notifications" className="notification-centre" onClose={() => setOpen(false)}>
      <header><h2>Notifications</h2><button onClick={() => setOpen(false)} aria-label="Close notifications">Close</button></header>
      {!cloudEnabled ? <p>Account notifications are unavailable in this build.</p> : !userId ? <><p>Sign in to see friend activity and gifts.</p><button onClick={openSignIn}>Sign in</button></> : <>
        <PushSettings />
        <div className="notification-actions"><button disabled={busy} onClick={() => void refresh()}>{busy ? 'Refreshing…' : 'Refresh'}</button><button disabled={!unread} onClick={() => mark(snapshot.items.map(i => i.id))}>Mark all read</button></div>
        <p className="hint-text">Updates while the menu is open. Read status is saved on this device. Enable push below to receive alerts while the game is closed.</p>
        {snapshot.errors.map(error => <p role="alert" key={error}>{error} Try Refresh.</p>)}
        {storageError && <p role="alert">{storageError}</p>}
        {!loaded && busy ? <p role="status">Loading notifications…</p> : !snapshot.items.length && !snapshot.errors.length ? <p>No notifications yet. Friend results and waiting gifts will appear here.</p> : null}
        <ul className="notification-list">{snapshot.items.map(item => {
          const destination = item.kind === 'gift' ? onFriendList : onFriends;
          return <li key={item.id} className={read.has(item.id) ? 'read' : 'unread'}>
            <strong>{!read.has(item.id) && <span className="notification-unread">Unread · </span>}{item.title}</strong>
            <p>{item.body}</p>{Number.isFinite(Date.parse(item.at)) && <time dateTime={item.at}>{new Date(item.at).toLocaleString()}</time>}
            <div>{destination && <button onClick={() => { mark([item.id]); setOpen(false); destination(); }}>{item.kind === 'gift' ? 'Open gifts' : 'View activity'}</button>}
            {!read.has(item.id) && <button onClick={() => mark([item.id])}>Mark read</button>}</div>
          </li>;
        })}</ul>
      </>}
    </Modal>, document.body)}
  </>;
}
