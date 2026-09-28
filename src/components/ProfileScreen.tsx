import { ProfilePanel } from './ProfilePanel';
import { PixelIcon } from './PixelIcon';
import './hunt/hunt.css';
import './locker/locker.css';

/** Your player profile on its own screen (from the level chip in the main menu). */
export function ProfileScreen({ onExit, onLocker }: { onExit: () => void; onLocker: () => void }) {
  return <div className="hunt locker">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">YOUR CARD, YOUR COLOURS</span><h1>Player Profile</h1></div>
      <button className="link-button" onClick={onLocker}>GM Locker →</button>
    </header>
    <ProfilePanel />
  </div>;
}
