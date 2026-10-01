import { useState } from 'react';
import { Modal } from '../Modal';
import { cloudEnabled, useAccount } from '../../cloud/account';
import { openSignIn } from '../../cloud/signIn';
import { IS_DESKTOP_BUILD } from '../../appMode';
import { MyFramedAvatar } from '../AvatarFrame';

const ASKED_KEY = 'cv-signin-asked';
const asked = () => { try { return localStorage.getItem(ASKED_KEY) === '1'; } catch { return true; } };
const remember = () => { try { localStorage.setItem(ASKED_KEY, '1'); } catch { /* storage blocked */ } };

/** Whether the welcome sign-in card is still to be shown (first visit, accounts on, not signed in). */
export function needsSignInWelcome(status: string): boolean {
  return !IS_DESKTOP_BUILD && cloudEnabled && status === 'signedOut' && !asked();
}

/** The first visit: sign in to keep your progress everywhere, or carry on without an account. */
export function WelcomeSignIn({ onDone }: { onDone: () => void }) {
  const a = useAccount();
  const [open, setOpen] = useState(true);
  if (!open || !needsSignInWelcome(a.status)) return null;
  const close = () => { remember(); setOpen(false); onDone(); };
  return <Modal label="Welcome to Court Vision" onClose={close} className="welcome-signin">
    <div className="welcome-signin-head"><MyFramedAvatar frame="founding" size={88} title="You with the Founding GM frame" /><div>
      <span className="pixel-eyebrow">WELCOME, GM</span>
      <h2>Sign in to save your progress</h2>
      <p className="hint-text">Keep your level, trophies, character and records on every device, and play the leaderboards, ranked seasons and League Hunt PvP. Discord, Google or an email link, free, and you get the Founding GM title and profile frame.</p>
    </div></div>
    <div className="contest-actions">
      <button className="primary" onClick={() => { remember(); setOpen(false); openSignIn(); onDone(); }}>Sign in</button>
      <button onClick={close}>Continue without signing in</button>
    </div>
    <p className="hint-text">You can sign in any time from the header. Progress made before you sign in moves to your account.</p>
  </Modal>;
}
