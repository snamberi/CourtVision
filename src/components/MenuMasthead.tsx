import { useEffect, useRef, useState } from 'react';
import logoIcon from '../assets/brand/logo-icon.png';
import { PixelIcon } from './PixelIcon';
import { ProfileChip } from './ProfilePanel';
import { AccountButton } from './cloud/AccountButton';
import { DiscordLink } from './DiscordLink';
import { ThemeChip } from './ThemePicker';

interface Props {
  onProfile?: () => void;
  onLocker?: () => void;
  onCommunity?: () => void;
  onSettings?: () => void;
  streak: { current: number; best: number };
}

/** One masthead row at every width. Secondary actions move into a disclosure on smaller screens. */
export function MenuMasthead({ onProfile, onLocker, onCommunity, onSettings, streak }: Props) {
  const [expanded, setExpanded] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const dismiss = (e: PointerEvent) => {
      if (e.target instanceof Node && !header.current?.contains(e.target)) setExpanded(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setExpanded(false); toggle.current?.focus(); }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [expanded]);

  return <header className="menu-masthead" ref={header}>
    <span className="mh-brand"><img src={logoIcon} alt="" /><span className="mh-word">COURT VISION<small>BASKETBALL MANAGEMENT</small></span><i className="mh-led" aria-hidden="true" /></span>
    <span className="menu-edition">THE PIXEL COURT</span>
    <div className={`mh-actions${expanded ? ' is-open' : ''}`} id="menu-account-actions" role="group" aria-label="Account and community"
      onClick={e => { if ((e.target as Element).closest('button, a')) setExpanded(false); }}>
      {(onProfile || onLocker) && <ProfileChip onOpen={onProfile ?? onLocker} />}
      {streak.current >= 2 && <button type="button" className="account-chip streak-pill" onClick={onProfile ?? onLocker} title={`Daily streak: ${streak.current} days in a row (best ${streak.best})`}><PixelIcon name="flame" size={14} /> {streak.current}</button>}
      {onCommunity && <AccountButton onCommunity={onCommunity} onProfile={onProfile ?? onLocker} />}
      <DiscordLink className="menu-discord" />
    </div>
    <div className="mh-tools">
      <ThemeChip />
      {onSettings && <button type="button" className="account-chip menu-settings" onClick={onSettings} aria-label="Settings" title="Settings: backups, graphics, install, privacy"><PixelIcon name="settings" size={16} /><span>Settings</span></button>}
      <button type="button" ref={toggle} className="account-chip mh-more" aria-label="Account and community" aria-expanded={expanded} aria-controls="menu-account-actions" onClick={() => setExpanded(v => !v)}><PixelIcon name={expanded ? 'cross' : 'menu'} size={18} /></button>
    </div>
  </header>;
}
