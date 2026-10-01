import { cloudEnabled, useAccount } from '../../cloud/account';
import { IS_DESKTOP_BUILD } from '../../appMode';
import { openSignIn } from '../../cloud/signIn';
import { NameTag } from '../ProfileIcon';

/** The masthead account control: "Sign in", or your GM name (opens Community). */
export function AccountButton({ onCommunity }: { onCommunity: () => void }) {
  const a = useAccount();
  if (IS_DESKTOP_BUILD) return null;
  if (!cloudEnabled) return <button className="account-chip primary" onClick={openSignIn}>Sign in</button>;
  if (a.status === 'signedIn') return <><button className="account-chip" onClick={onCommunity}>Leaderboards</button><button className="account-chip" onClick={onCommunity} title={a.sync.state === 'error' ? `Sync problem: ${a.sync.message}` : a.sync.state === 'syncing' ? 'Syncing…' : 'Your profile and the leaderboards'}>
    <span className={`sync-dot ${a.sync.state}`} aria-hidden="true" /><b><NameTag name={`@${a.profile?.username ?? '…'}`} icon={a.profile?.icon} color={a.profile?.color} title={a.profile?.title} size={14} /></b>
  </button></>;
  return <>
    <button className="account-chip" onClick={onCommunity}>Leaderboards</button>
    <button className="account-chip primary" disabled={a.status === 'loading' || a.status === 'idle'} onClick={openSignIn}>{a.status === 'loading' ? 'Signing in…' : 'Sign in'}</button>
  </>;
}
