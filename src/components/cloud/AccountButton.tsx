import { cloudEnabled, useAccount } from '../../cloud/account';
import { IS_DESKTOP_BUILD } from '../../appMode';
import { openSignIn } from '../../cloud/signIn';
import { MyAvatar } from '../UserAvatar';

/** The masthead account controls: the leaderboards, then "Sign in" for a guest or your @name (to the Profile) once signed in. */
/** Sign in, or your name once signed in. `boards: false` leaves out the Leaderboards button and `signedInChip: false`
 *  the @name button once you are signed in (the menu phone has both). */
export function AccountButton({ onCommunity, onProfile, boards = true, signedInChip = true }: { onCommunity: () => void; onProfile?: () => void; boards?: boolean; signedInChip?: boolean }) {
  const a = useAccount();
  if (IS_DESKTOP_BUILD) return null;
  if (!cloudEnabled) return <button className="account-chip primary" onClick={openSignIn}>Sign in</button>;
  const name = a.profile?.username;
  return <>
    {boards && <button className="account-chip" onClick={onCommunity}>Leaderboards</button>}
    {a.status === 'signedIn'
      ? signedInChip && <button className="account-chip mh-user" onClick={onProfile} title="Signed in: your profile and sync">
        <i className="mh-user-dot" aria-hidden="true" /><MyAvatar size={22} mode="portrait" animate={false} title="" /><span><b>{name ? `@${name}` : 'Pick your GM name'}</b>{a.profile?.title && <small>{a.profile.title}</small>}</span>
      </button>
      : <button className="account-chip primary" disabled={a.status === 'loading' || a.status === 'idle'} onClick={openSignIn}>{a.status === 'loading' ? 'Signing in…' : 'Sign in'}</button>}
  </>;
}
