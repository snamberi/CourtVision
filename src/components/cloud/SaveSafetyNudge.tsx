import { useEffect, useState } from 'react';
import { cloudEnabled, useAccount } from '../../cloud/account';
import { openSignIn } from '../../cloud/signIn';
import { listCareers } from '../../career/storage';
import { readPlayTime, formatPlayTime } from '../../retention/playTime';
import { track } from '../../analytics/track';
import { PixelIcon } from '../PixelIcon';

const SNOOZE_KEY = 'cv-save-nudge-snooze';
const SNOOZE_MS = 14 * 24 * 3600 * 1000;
export const NUDGE_HOURS = 3, NUDGE_CAREERS = 3;
const snoozed = () => { try { return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now(); } catch { return true; } };

/** Whether a guest has enough at stake to be reminded that it all lives in this browser. */
export const nudgeDue = (seconds: number, retired: number) => seconds >= NUDGE_HOURS * 3600 || retired >= NUDGE_CAREERS;

/** The main-menu reminder for a guest with a lot of play in this browser: sign in so it isn't lost. */
export function SaveSafetyNudge() {
  const a = useAccount();
  const [retired, setRetired] = useState<number | null>(null);
  const [hidden, setHidden] = useState(snoozed);
  useEffect(() => { let live = true; void listCareers().then(c => { if (live) setRetired(c.filter(x => x.status === 'retired').length); }, () => { if (live) setRetired(0); }); return () => { live = false; }; }, []);
  if (!cloudEnabled || a.status !== 'signedOut' || hidden || retired == null) return null;
  const seconds = readPlayTime().total;
  if (!nudgeDue(seconds, retired)) return null;
  const what = [seconds >= 3600 ? `${formatPlayTime(seconds)} of play` : '', retired ? `${retired} finished career${retired === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ');
  const later = () => { try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* storage blocked */ } setHidden(true); };
  return <div className="save-nudge" role="status">
    <PixelIcon name="lock" size={18} />
    <span><b>{what ? `${what[0].toUpperCase()}${what.slice(1)}` : 'Your saves'} only live in this browser.</b> Clear your history or switch devices and it is gone. Sign in (free) to keep everything on any device.</span>
    <button className="primary" onClick={() => { track('claim_rank', { step: 'save-nudge' }); openSignIn(); }}>Keep my progress</button>
    <button className="link-button" onClick={later}>Remind me later</button>
  </div>;
}
