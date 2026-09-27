import { cloudEnabled, useAccount } from '../../cloud/account';
import { IS_DESKTOP_BUILD } from '../../appMode';
import { openSignIn } from '../../cloud/signIn';

/** The masthead account control: "Sign in", or your GM name (opens Community). */
export function AccountButton({ onCommunity }: { onCommunity: () => void }) {
  const a = useAccount();
  if (IS_DESKTOP_BUILD) return null;
  if (!cloudEnabled) return <button className="account-chip primary" onClick={openSignIn}>Sign in</button>;
  if (a.status === 'signedIn') return <button className="account-chip" onClick={onCommunity} title={a.sync.state === 'error' ? `Sync problem: ${a.sync.message}` : a.sync.state === 'syncing' ? 'Syncing…' : 'Your profile and the leaderboards'}>
    <span className={`sync-dot ${a.sync.state}`} aria-hidden="true" /><b>@{a.profile?.username ?? '…'}</b>
  </button>;
  return <>
    <button className="account-chip" onClick={onCommunity}>Leaderboards</button>
    <button className="account-chip primary" disabled={a.status === 'loading' || a.status === 'idle'} onClick={openSignIn}>{a.status === 'loading' ? 'Signing in…' : 'Sign in'}</button>
  </>;
}

/** The account card on the main menu: sign in (with what it gives you), or who you are and where you stand. */
export function MenuAccountCard({ onCommunity }: { onCommunity: () => void }) {
  const a = useAccount();
  if (IS_DESKTOP_BUILD) return null;
  if (a.status === 'signedIn') {
    const p = a.profile;
    return <section className="account-card signed-in" aria-label="Your account">
      <div><span className="pixel-eyebrow">SIGNED IN</span><b>@{p?.username ?? '…'}</b><small>Level {p?.level ?? 1} · {p?.title ?? 'Rookie GM'} · {a.sync.state === 'error' ? 'sync problem, retrying' : a.sync.state === 'syncing' ? 'syncing…' : 'progress saved to your account'}</small></div>
      <button className="primary" onClick={onCommunity}>Leaderboards, ranked & PvP</button>
    </section>;
  }
  return <section className="account-card" aria-label="Sign in">
    <div><span className="pixel-eyebrow">PLAY ONLINE · FREE</span><b>Sign in to compete</b>
      <small>Keep your level, trophies and records on every device, climb the leaderboards, play ranked seasons and League Hunt PvP. Discord, Google or an email link.</small></div>
    <div className="account-card-actions">
      <button className="primary" disabled={a.status === 'loading'} onClick={openSignIn}>{a.status === 'loading' ? 'Signing in…' : 'Sign in'}</button>
      {cloudEnabled && <button onClick={onCommunity}>See the leaderboards</button>}
    </div>
  </section>;
}
