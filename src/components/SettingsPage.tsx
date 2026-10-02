import { useState, type ReactNode } from 'react';
import { PixelIcon } from './PixelIcon';
import { InstallAppButton } from './InstallAppButton';
import { OnlineStatus } from './cloud/OnlineStatus';
import { CookieSettingsLink } from '../consent/ConsentBanner';
import { PrivacyLink } from './PrivacyPolicyPage';
import { IS_DESKTOP_BUILD } from '../appMode';
import { liteMode, performanceSetting, setPerformanceSetting, type PerformanceSetting } from '../lib/performanceMode';
import './locker/locker.css';
import './hunt/hunt.css';

/** Graphics: Auto (lite on low-end devices), Lite or Full. */
export function PerformanceToggle() {
  const [setting, setSetting] = useState<PerformanceSetting>(() => performanceSetting());
  const next: Record<PerformanceSetting, PerformanceSetting> = { auto: 'lite', lite: 'full', full: 'auto' };
  const label = setting === 'auto' ? `Auto (${liteMode('auto') ? 'lite' : 'full'})` : setting === 'lite' ? 'Lite' : 'Full';
  return <button className="link-button" title="Lite mode stops looping animations and blur, and uses fewer simulation workers. Auto turns it on for low-memory devices."
    onClick={() => { const v = next[setting]; setPerformanceSetting(v); setSetting(v); }}>Graphics: {label}</button>;
}

/**
 * Settings (the gear in the main menu header): backups and league recovery, graphics, privacy, and, tucked away at
 * the bottom, the site owner's online status check.
 */
export function SettingsPage({ onExit, backups }: { onExit: () => void; backups: ReactNode }) {
  return <div className="hunt locker settings-page">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">BACKUPS, GRAPHICS, INSTALL, PRIVACY</span><h1>Settings</h1></div>
    </header>
    <section className="locker-bay">
      <h2><PixelIcon name="check" size={18} /> Backups</h2>
      <p className="hint-text">Save everything to one file (leagues, careers, your profile, records and cosmetics), bring it back on any device, or recover a league.</p>
      {backups}
    </section>
    <section className="locker-bay">
      <h2><PixelIcon name="star" size={18} /> Graphics</h2>
      <p className="hint-text">Lite mode stops looping animations and blur, and uses fewer simulation workers. Auto turns it on for low-memory devices.</p>
      <PerformanceToggle />
      <p className="settings-install"><InstallAppButton /></p>
    </section>
    <section className="locker-bay">
      <h2><PixelIcon name="team" size={18} /> Privacy</h2>
      <p className="settings-links"><PrivacyLink /> · <CookieSettingsLink /></p>
    </section>
    {!IS_DESKTOP_BUILD && <details className="settings-advanced">
      <summary>Advanced</summary>
      <OnlineStatus />
    </details>}
  </div>;
}
