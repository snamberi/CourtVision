import { cloudEnabled, useAccount } from '../../cloud/account';
import { openSignIn } from '../../cloud/signIn';

/** The masthead account control: "Sign in", or your GM name (opens Community). */
export function AccountButton({ onCommunity }: { onCommunity: () => void }) {
  const a = useAccount();
  if (!cloudEnabled) return null;
  if (a.status === 'signedIn') return <button className="account-chip" onClick={onCommunity} title={a.sync.state === 'error' ? `Sync problem: ${a.sync.message}` : a.sync.state === 'syncing' ? 'Syncing…' : 'Your profile and the leaderboards'}>
    <span className={`sync-dot ${a.sync.state}`} aria-hidden="true" /><b>@{a.profile?.username ?? '…'}</b>
  </button>;
  return <>
    <button className="account-chip" onClick={onCommunity}>Leaderboards</button>
    <button className="account-chip primary" disabled={a.status === 'loading' || a.status === 'idle'} onClick={openSignIn}>{a.status === 'loading' ? 'Signing in…' : 'Sign in'}</button>
  </>;
}
