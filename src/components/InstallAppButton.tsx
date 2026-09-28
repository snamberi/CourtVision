import { useState } from 'react';
import { useInstallState, promptInstall } from '../pwa/pwa';
import { track } from '../analytics/track';
import { PixelIcon } from './PixelIcon';

/** "Install app" in the menu masthead, when the browser offers it (or on iPhone, how to add it). */
export function InstallAppButton() {
  const state = useInstallState();
  const [hint, setHint] = useState(false);
  if (state === 'none') return null;
  return <span className="menu-install">
    <button onClick={async () => {
      if (state === 'ios') { setHint(h => !h); return; }
      const ok = await promptInstall();
      track('app_install', { outcome: ok ? 'accepted' : 'dismissed' });
    }} aria-expanded={state === 'ios' ? hint : undefined}><PixelIcon name="star" size={14} /> Install app</button>
    {hint && <span className="menu-install-hint" role="note">In Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. Court Vision opens full screen and plays offline.</span>}
  </span>;
}
