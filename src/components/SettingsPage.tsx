import { useState, type ReactNode } from 'react';
import { SmallRoom } from './presentation/SmallRoom';
import { ModeIcon } from './ModeIcon';
import { PixelIcon } from './PixelIcon';
import { InstallAppButton } from './InstallAppButton';
import { ThemeChip } from './ThemePicker';
import { OnlineStatus } from './cloud/OnlineStatus';
import { CookieSettingsLink } from '../consent/ConsentBanner';
import { PrivacyLink } from './PrivacyLink';
import { IS_DESKTOP_BUILD } from '../appMode';
import { liteMode, performanceSetting, setPerformanceSetting, type PerformanceSetting } from '../lib/performanceMode';
import { colourSafe, setColourSafe, setTextSize, textSize, reduceMotionSetting, setReduceMotion, type TextSize } from '../lib/accessibility';
import { DifficultyCards } from './DifficultyCards';
import { LEVELS, LEVEL_NAME, defaultLevel, setDefaultLevel, type Level } from '../retention/challenge';
import { GOLD_UNLOCK_SECONDS, goldProgress, goldUnlocked, menuStyle, setMenuStyle, type MenuStyle } from '../lib/menuStyle';
import { formatPlayTime, readPlayTime } from '../retention/playTime';
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

/** Accessibility: text size, colour-blind-safe colours and reduced motion. */
export function AccessibilityToggles() {
  const [size, setSize] = useState<TextSize>(() => textSize());
  const [safe, setSafe] = useState(() => colourSafe());
  const [calm, setCalm] = useState(() => reduceMotionSetting());
  const sizes: { id: TextSize; label: string }[] = [{ id: 'normal', label: 'Normal' }, { id: 'large', label: 'Large' }, { id: 'larger', label: 'Larger' }];
  return <>
    <div className="hunt-pills perf-choice" role="radiogroup" aria-label="Text size">
      {sizes.map(o => <button key={o.id} role="radio" aria-checked={size === o.id} className={`hunt-pill ${size === o.id ? 'on' : ''}`}
        onClick={() => { setTextSize(o.id); setSize(o.id); }}>{o.label} text</button>)}
    </div>
    <label className="settings-check"><input type="checkbox" checked={safe} onChange={e => { setColourSafe(e.target.checked); setSafe(e.target.checked); }} /> Colour-blind-safe colours (rarities, wins and losses, charts)</label>
    <label className="settings-check"><input type="checkbox" checked={calm} onChange={e => { setReduceMotion(e.target.checked); setCalm(e.target.checked); }} /> Reduce motion (no animations, spins land at once)</label>
  </>;
}

const LEVEL_INFO: Record<Level, string> = {
  rookie: 'Softer opponents and more help. Scores count a little less.',
  pro: 'The standard game. Daily and weekly runs always use it.',
  legend: 'Tougher teams, fewer second chances, bigger scores.',
};
/** Settings > Default difficulty. */
function DefaultDifficulty() {
  const [level, setLevel] = useState<Level>(defaultLevel);
  return <DifficultyCards label="Default difficulty" value={level} onChange={l => { setDefaultLevel(l); setLevel(l); }}
    options={LEVELS.map((l, i) => ({ id: l, name: LEVEL_NAME[l], blurb: LEVEL_INFO[l], level: i + 1 + (i === 2 ? 1 : 0) }))} />;
}

/** Settings > Menu style: Classic, or Gold Arcade after 24 hours played. */
function MenuStylePicker() {
  const [style, setStyle] = useState<MenuStyle>(menuStyle);
  const total = readPlayTime().total, open = goldUnlocked(total);
  const pick = (s: MenuStyle) => { setMenuStyle(s); setStyle(menuStyle()); };
  return <>
    <DifficultyCards label="Menu style" value={style} onChange={pick} options={[
      { id: 'classic', name: 'Classic', blurb: 'Sharp pixel panels in navy and orange.', level: 1, icon: 'court' },
      { id: 'gold', name: 'Gold Arcade', blurb: 'Chunky rounded buttons, a gold Play coin, bold Oswald titles.', level: 4, icon: 'star', locked: open ? undefined : `play ${formatPlayTime(GOLD_UNLOCK_SECONDS - total)} more (24 hours in total)` },
    ]} />
    {!open && <><i className="settings-progress" aria-hidden="true"><i style={{ width: `${goldProgress(total) * 100}%` }} /></i>
      <p className="hint-text">{formatPlayTime(total)} of 24 hours played.</p></>}
  </>;
}

function SettingCard({ icon, title, blurb, wide, children }: { icon: string; title: string; blurb?: string; wide?: boolean; children: ReactNode }) {
  return <section className={`setting-card ${wide ? 'wide' : ''}`}>
    <h2><ModeIcon mode={icon === 'shield' ? 'hunt-legend' : icon === 'home' ? 'franchise' : icon === 'team' ? 'friends' : icon === 'chart' ? 'league-history' : 'perfect-custom'} size={36} /> {title}</h2>
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
      <div className="hunt-title"><span className="pixel-eyebrow">LOOK, MENU STYLE, DIFFICULTY, BACKUPS, GRAPHICS, ACCESSIBILITY, PRIVACY</span><h1>Settings</h1></div>
    </header>
    <SmallRoom kind="settings" title="Make the game yours." detail="Set your look, tune the graphics and keep your leagues backed up." />
    <div className="setting-cards">
      <SettingCard icon="star" title="Look" blurb="The colours, fonts and menu art of the whole game. Pick from every look.">
        <span className="settings-theme"><ThemeChip /></span>
      </SettingCard>
      <SettingCard icon="home" title="Menu style" blurb="How the menus, the phone bar and the mode cards look. Gold Arcade unlocks after 24 hours of play.">
        <MenuStylePicker />
      </SettingCard>
      <SettingCard icon="shield" title="Default difficulty" blurb="What every mode starts on: League Hunt, 82-0, Survival, the All-Time Draft and Career. You can still change it in each mode.">
        <DefaultDifficulty />
      </SettingCard>
      <SettingCard icon="check" title="Backup everything">{backup}</SettingCard>
      <SettingCard icon="chart" title="League recovery">{recovery}</SettingCard>
      <SettingCard icon="star" title="Graphics" blurb="Lite mode stops looping animations and blur, and uses fewer simulation workers. Auto turns it on for low-memory devices.">
        <PerformanceToggle />
      </SettingCard>
      <SettingCard icon="search" title="Accessibility" blurb="Bigger text for the whole game, and rarity colours that stay easy to tell apart with colour blindness. Press ? in a league for keyboard shortcuts.">
        <AccessibilityToggles />
      </SettingCard>
      <SettingCard icon="play" title="Install the app" blurb="Court Vision as a real app on your PC or phone: its own icon and window, offline too, same saves.">
        <p className="settings-install"><InstallAppButton /></p>
        <p className="hint-text settings-install-note">You're playing the installed app.</p>
      </SettingCard>
      <SettingCard icon="team" title="Privacy" blurb="What Court Vision stores, and your cookie choices.">
        <p className="settings-links"><PrivacyLink /> · <CookieSettingsLink /></p>
        {import.meta.env.VITE_BUILD_STAMP && <p className="hint-text settings-build">Version {import.meta.env.VITE_BUILD_STAMP}</p>}
      </SettingCard>
      {!IS_DESKTOP_BUILD && <SettingCard icon="settings" title="Advanced" blurb="Checks the online services (accounts and leaderboards).">
        <details className="settings-advanced"><summary>Online status</summary><OnlineStatus /></details>
      </SettingCard>}
    </div>
  </div>;
}
