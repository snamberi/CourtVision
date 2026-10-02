import { useState, type ReactNode } from 'react';
import { PixelIcon } from './PixelIcon';
import { InstallAppButton } from './InstallAppButton';
import { ThemeChip } from './ThemePicker';
import { OnlineStatus } from './cloud/OnlineStatus';
import { CookieSettingsLink } from '../consent/ConsentBanner';
import { PrivacyLink } from './PrivacyPolicyPage';
import { IS_DESKTOP_BUILD } from '../appMode';
import { liteMode, performanceSetting, setPerformanceSetting, type PerformanceSetting } from '../lib/performanceMode';
import './locker/locker.css';
import './hunt/hunt.css';

/** Graphics: Auto (lite on low-end devices), Lite or Full: three plain choices. */
export function PerformanceToggle() {
  const [setting, setSetting] = useState<PerformanceSetting>(() => performanceSetting());
  const options: { id: PerformanceSetting; label: string }[] = [{ id: 'auto', label: `Auto (${liteMode('auto') ? 'lite' : 'full'} here)` }, { id: 'lite', label: 'Lite' }, { id: 'full', label: 'Full' }];
  return <div className="hunt-pills perf-choice" role="radiogroup" aria-label="Graphics">
    {options.map(o => <button key={o.id} role="radio" aria-checked={setting === o.id} className={`hunt-pill ${setting === o.id ? 'on' : ''}`}
      onClick={() => { setPerformanceSetting(o.id); setSetting(o.id); }}>{o.label}</button>)}
  </div>;
}

function SettingCard({ icon, title, blurb, wide, children }: { icon: string; title: string; blurb?: string; wide?: boolean; children: ReactNode }) {
  return <section className={`setting-card ${wide ? 'wide' : ''}`}>
    <h2><PixelIcon name={icon} size={18} /> {title}</h2>
    {blurb && <p className="hint-text">{blurb}</p>}
    <div className="setting-card-body">{children}</div>
  </section>;
}

/**
 * Settings (the gear in the main menu header): one card per setting. Backups and league recovery, graphics, the app
 * install, privacy, and, tucked away at the bottom, the site owner's online status check.
 */
export function SettingsPage({ onExit, backup, recovery }: { onExit: () => void; backup: ReactNode; recovery: ReactNode }) {
  return <div className="hunt locker settings-page settings-menu">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">LOOK, BACKUPS, GRAPHICS, INSTALL, PRIVACY</span><h1>Settings</h1></div>
    </header>
    <div className="setting-cards">
      <SettingCard icon="star" title="Look" blurb="The colours, fonts and menu art of the whole game. Pick from every look.">
        <span className="settings-theme"><ThemeChip /></span>
      </SettingCard>
      <SettingCard icon="check" title="Backup everything">{backup}</SettingCard>
      <SettingCard icon="chart" title="League recovery">{recovery}</SettingCard>
      <SettingCard icon="star" title="Graphics" blurb="Lite mode stops looping animations and blur, and uses fewer simulation workers. Auto turns it on for low-memory devices.">
        <PerformanceToggle />
      </SettingCard>
      <SettingCard icon="play" title="Install the app" blurb="Play from your home screen or desktop, offline too.">
        <p className="settings-install"><InstallAppButton /></p>
        <p className="hint-text settings-install-note">Already installed, or your browser can't install apps? Use your browser's menu: "Add to Home Screen" or "Install".</p>
      </SettingCard>
      <SettingCard icon="team" title="Privacy" blurb="What Court Vision stores, and your cookie choices.">
        <p className="settings-links"><PrivacyLink /> · <CookieSettingsLink /></p>
      </SettingCard>
      {!IS_DESKTOP_BUILD && <SettingCard icon="settings" title="Advanced" blurb="Checks the online services (accounts and leaderboards).">
        <details className="settings-advanced"><summary>Online status</summary><OnlineStatus /></details>
      </SettingCard>}
    </div>
  </div>;
}
