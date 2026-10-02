import { cloudEnabled, useAccount } from '../../cloud/account';
import { IS_DESKTOP_BUILD } from '../../appMode';
import { openSignIn } from '../../cloud/signIn';

/** The masthead account controls: the leaderboards, and "Sign in" for a guest. Signed in, your name and sync live in the Profile. */
export function AccountButton({ onCommunity }: { onCommunity: () => void }) {
  const a = useAccount();
  if (IS_DESKTOP_BUILD) return null;
  if (!cloudEnabled) return <button className="account-chip primary" onClick={openSignIn}>Sign in</button>;
  return <>
    <button className="account-chip" onClick={onCommunity}>Leaderboards</button>
    {a.status !== 'signedIn' && <button className="account-chip primary" disabled={a.status === 'loading' || a.status === 'idle'} onClick={openSignIn}>{a.status === 'loading' ? 'Signing in…' : 'Sign in'}</button>}
  </>;
}
