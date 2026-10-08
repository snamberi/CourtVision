import { useEffect, useState } from 'react';
import { closeInstallGuide, installDevice, openInstallGuide, promptInstall, useInstallGuideOpen, useInstallState, type InstallDevice } from '../pwa/pwa';
import { Modal } from './Modal';
import { PixelIcon } from './PixelIcon';

/*
 * How to install Court Vision as an app on a PC, an Android phone or an iPhone. Installing keeps the same saves (it
 * is the same site), gives it its own icon and window, and plays offline. Shown by every Install button when the
 * browser has no install dialog of its own, and by the #/install link (for social bios).
 */

interface Steps { title: string; icon: string; note?: string; ways: { browser: string; steps: string[] }[] }
const GUIDES: Record<InstallDevice, Steps> = {
  pc: {
    title: 'Windows or Mac', icon: 'trophy', note: 'Court Vision shows up in your Start menu (or Applications) and you can pin it to the taskbar.',
    ways: [
      { browser: 'Chrome', steps: ['Click the install icon at the right end of the address bar (a small screen with an arrow).', 'Or open the ⋮ menu → Cast, save and share → Install page as app.', 'Click Install.'] },
      { browser: 'Edge', steps: ['Click the install icon at the right end of the address bar.', 'Or open the … menu → Apps → Install this site as an app.', 'Click Install.'] },
      { browser: 'Firefox', steps: ['Firefox on PC can\'t install apps. Open courtvisiongame.com in Chrome or Edge and follow those steps.'] },
    ],
  },
  android: {
    title: 'Android phone or tablet', icon: 'play', note: 'Court Vision gets its own icon on your home screen and opens full screen.',
    ways: [
      { browser: 'Chrome', steps: ['Tap the ⋮ menu (top right).', 'Tap Add to Home screen (or Install app).', 'Tap Install.'] },
      { browser: 'Samsung Internet', steps: ['Tap the ☰ menu (bottom right).', 'Tap Add page to → Home screen.', 'Tap Add.'] },
      { browser: 'Firefox', steps: ['Tap the ⋮ menu.', 'Tap Add to Home screen (or Install).', 'Tap Add.'] },
    ],
  },
  ios: {
    title: 'iPhone or iPad', icon: 'star', note: 'Court Vision gets its own icon on your home screen and opens full screen.',
    ways: [{ browser: 'Safari', steps: ['Tap the Share button (the square with an arrow).', 'Scroll down and tap Add to Home Screen.', 'Tap Add.'] }],
  },
};
const ORDER: InstallDevice[] = ['pc', 'android', 'ios'];
const BROWSER_NAME = { chrome: 'Chrome', edge: 'Edge', samsung: 'Samsung Internet', firefox: 'Firefox', safari: 'Safari', other: '' } as const;

export function InstallGuideHost() {
  const open = useInstallGuideOpen();
  // courtvisiongame.com/#/install opens the guide straight away (the link for TikTok and Instagram bios).
  useEffect(() => { if (location.hash === '#/install') { history.replaceState(null, '', '#/menu'); openInstallGuide(); } }, []);
  return open ? <InstallGuide /> : null;
}

function InstallGuide() {
  const state = useInstallState();
  const { device, browser } = installDevice();
  const [shown, setShown] = useState<InstallDevice>(device);
  const guide = GUIDES[shown];
  const mine = BROWSER_NAME[browser];
  // Your own browser's steps first.
  const ways = shown === device ? [...guide.ways].sort((a, b) => Number(b.browser === mine) - Number(a.browser === mine)) : guide.ways;
  return <Modal label="Install Court Vision" onClose={closeInstallGuide} className="install-guide">
    <button className="install-close" onClick={closeInstallGuide} aria-label="Close">×</button>
    <p className="install-kicker">FREE · NO STORE NEEDED</p>
    <h2>Install Court Vision</h2>
    <ul className="install-perks">
      <li><PixelIcon name="star" size={14} /> Its own icon and its own window, no browser bar</li>
      <li><PixelIcon name="play" size={14} /> Plays offline</li>
      <li><PixelIcon name="check" size={14} /> Your saves come with you</li>
    </ul>
    {state === 'installed' ? <p className="install-done">You're already playing the installed app.</p>
      : state === 'prompt' && <button className="primary install-now" onClick={async () => { if (await promptInstall()) closeInstallGuide(); }}>Install now</button>}
    <div className="install-tabs" role="tablist" aria-label="Your device">
      {ORDER.map(d => <button key={d} role="tab" aria-selected={shown === d} className={shown === d ? 'active' : ''} onClick={() => setShown(d)}>{GUIDES[d].title}{d === device ? ' (this one)' : ''}</button>)}
    </div>
    <div className="install-ways">
      {ways.map(w => <section key={w.browser} className={`install-way ${shown === device && w.browser === mine ? 'mine' : ''}`}>
        <h3>{w.browser}{shown === device && w.browser === mine && <small> · your browser</small>}</h3>
        <ol>{w.steps.map(s => <li key={s}>{s}</li>)}</ol>
      </section>)}
    </div>
    {guide.note && <p className="hint-text">{guide.note}</p>}
  </Modal>;
}
