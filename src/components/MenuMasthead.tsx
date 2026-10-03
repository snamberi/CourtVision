import logoIcon from '../assets/brand/logo-icon.png';
import { PixelIcon } from './PixelIcon';
import { AccountButton } from './cloud/AccountButton';
import { DiscordLink } from './DiscordLink';

interface Props {
  onProfile?: () => void;
  onCommunity?: () => void;
  onSettings?: () => void;
}

/** The menu header: the brand, then Sign in (gone once you are signed in), a Settings gear and Discord. Leaderboards,
 *  friends, your profile and streak live on the menu phone (MenuPhone); the look is changed in Settings. */
export function MenuMasthead({ onProfile, onCommunity, onSettings }: Props) {
  return <header className="menu-masthead">
    <span className="mh-brand"><img src={logoIcon} alt="" /><span className="mh-word">COURT VISION<small>BASKETBALL MANAGEMENT</small></span><i className="mh-led" aria-hidden="true" /></span>
    <span className="menu-edition">THE PIXEL COURT</span>
    <div className="mh-actions mh-simple" role="group" aria-label="Account">
      {onCommunity && <AccountButton onCommunity={onCommunity} onProfile={onProfile} boards={false} signedInChip={false} />}
      {onSettings && <button type="button" className="account-chip menu-settings" onClick={onSettings} aria-label="Settings" title="Settings: look, backups, graphics, install, privacy"><PixelIcon name="gear" size={18} /></button>}
      <DiscordLink className="menu-discord" />
    </div>
  </header>;
}
