import { useEffect, useState } from 'react';
import { closeSignIn, useSignInOpen } from '../../cloud/signIn';
import { Modal } from '../Modal';
import { cloudEnabled, explainAuthError, inAppBrowser, setAuthError, signInWith, updateProfile, useAccount, useAuthError, type Provider } from '../../cloud/account';
import { usernameProblem } from '../../lib/names';
import { track } from '../../analytics/track';

/* Sign-in and first-time username dialogs, mounted once at the root so any screen can ask for them. */

function SignInDialog() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const lastError = useAuthError();
  const inApp = inAppBrowser();
  // Coming back with the browser's Back button (or a cancelled sign-in) restores this page as it was: free the buttons.
  useEffect(() => {
    const reset = () => setBusy(null);
    window.addEventListener('pageshow', reset);
    const t = busy ? window.setTimeout(reset, 15_000) : undefined;
    return () => { window.removeEventListener('pageshow', reset); window.clearTimeout(t); };
  }, [busy]);
  const go = async (p: Provider) => {
    setBusy(p); setMsg(null);
    track('account', { action: 'sign_in', method: p });
    try { await signInWith(p); } catch (e) { setMsg(explainAuthError(e instanceof Error ? e.message : String(e))); setBusy(null); }
  };
  const problem = msg ?? lastError;
  return <Modal label="Sign in" onClose={closeSignIn}>
    <span className="pixel-eyebrow">COURT VISION ACCOUNT</span>
    <h2>Sign in</h2>
    <p className="hint-text">Keep your level, trophies, records and retired careers on every device, and get on the online leaderboards. Free, and optional: the game works the same without it.</p>
    {inApp && <p className="backup-msg err" role="alert">You're inside another app's browser, where Google sign-in is blocked. Open courtvisiongame.com in Chrome, Safari or Edge to sign in with Google (Discord works here).</p>}
    <div className="signin-options">
      <button className="signin-discord" disabled={!!busy} onClick={() => void go('discord')}><DiscordMark /> {busy === 'discord' ? 'Opening Discord…' : 'Continue with Discord'}</button>
      <button className="signin-google" disabled={!!busy} onClick={() => void go('google')}><GoogleMark /> {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}</button>
    </div>
    {problem && <p className="backup-msg err" role="alert">{problem}</p>}
    <p className="hint-text signin-fine">No password to remember. Finish signing in in the same tab you started it. Your GM leagues stay on this device (they are too big to sync); use Backup everything to move them. See the <a href="/privacy.html">Privacy Policy</a>.</p>
    <div className="contest-actions"><button className="link-button" onClick={() => { setAuthError(null); closeSignIn(); }}>Not now</button></div>
  </Modal>;
}

function UsernameDialog() {
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const p = usernameProblem(name);
    if (p) { setErr(p); return; }
    setBusy(true);
    const e = await updateProfile({ username: name.trim() });
    setBusy(false);
    if (e) setErr(e); else track('account', { action: 'username' });
  };
  return <Modal label="Choose your GM name">
    <span className="pixel-eyebrow">WELCOME, GM</span>
    <h2>Choose your GM name</h2>
    <p className="hint-text">It's how you appear on the leaderboards and your profile. 3-18 letters, numbers or underscores.</p>
    <form className="signin-email" onSubmit={e => { e.preventDefault(); void save(); }}>
      <div><input className="year-input" value={name} maxLength={18} onChange={e => { setName(e.target.value); setErr(null); }} placeholder="e.g. PixelGM_23" autoComplete="nickname" />
        <button className="primary" type="submit" disabled={busy || name.trim().length < 3}>{busy ? 'Saving…' : 'Save'}</button></div>
    </form>
    {err && <p className="backup-msg err" role="alert">{err}</p>}
  </Modal>;
}

/** Shown until the site's accounts service is connected (see docs/ACCOUNTS_SETUP.md). */
function NotReadyDialog() {
  return <Modal label="Sign in" onClose={closeSignIn}>
    <span className="pixel-eyebrow">COURT VISION ACCOUNT</span>
    <h2>Accounts are almost here</h2>
    <p className="hint-text">Sign-in with Discord or Google is switching on soon. Your progress is safe in this browser in the meantime, and it will move to your account the first time you sign in.</p>
    <div className="contest-actions"><button className="primary" onClick={closeSignIn}>OK</button></div>
  </Modal>;
}

export function CloudRoot() {
  const isOpen = useSignInOpen();
  const acct = useAccount();
  useEffect(() => { if (acct.status === 'signedIn' && isOpen) closeSignIn(); }, [acct.status, isOpen]);
  if (!cloudEnabled) return isOpen ? <NotReadyDialog /> : null;
  if (acct.status === 'signedIn' && acct.profile && !acct.profile.username) return <UsernameDialog />;
  return isOpen && acct.status !== 'signedIn' ? <SignInDialog /> : null;
}

const DiscordMark = () => <svg width="18" height="14" viewBox="0 0 71 55" aria-hidden="true"><path fill="currentColor" d="M60.1 4.9A58.5 58.5 0 0 0 45.6.4a.2.2 0 0 0-.2.1 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0A37.4 37.4 0 0 0 25.5.5a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.8 4.9a.2.2 0 0 0-.1.1C1.5 18.7-1 32.1.3 45.3v.1a58.8 58.8 0 0 0 17.7 9 .2.2 0 0 0 .3-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.8 38.8 0 0 1-5.5-2.6.2.2 0 0 1 0-.4l1.1-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.6 0 .2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .4 36.4 36.4 0 0 1-5.5 2.6.2.2 0 0 0-.1.3 47.2 47.2 0 0 0 3.6 5.9.2.2 0 0 0 .3.1 58.6 58.6 0 0 0 17.7-9v-.1c1.5-15.3-2.5-28.6-10.5-40.3a.2.2 0 0 0-.1-.1ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.8 7.1-6.4 7.1Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.8 7.1-6.4 7.1Z"/></svg>;
const GoogleMark = () => <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;
