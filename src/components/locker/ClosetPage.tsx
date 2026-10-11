import { useState } from 'react';
import { PixelIcon } from '../PixelIcon';
import { AvatarEditor } from '../AvatarEditor';
import { ClosetPickers, CLOSET_TABS, type ClosetTab } from '../ProfilePanel';
import '../hunt/hunt.css';
import './locker.css';

/**
 * The Closet (a phone app): everything you wear, in one place. Your character and its pieces, your picture frame,
 * profile icon, name and title colours, titles, share-card frame, court floor, menu phone and the app look.
 * Your Profile shows the result; this is where you change it.
 */
export function ClosetPage({ onExit, onProfile, initialTab = 'character' }: { onExit: () => void; onProfile?: () => void; initialTab?: ClosetTab }) {
  const [tab, setTab] = useState<ClosetTab>(initialTab);
  return <div className="hunt locker closet-page">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">YOUR CHARACTER AND EVERY COSMETIC</span><h1>Closet</h1></div>
      {onProfile && <button className="relic-switch" onClick={onProfile}><PixelIcon name="team" size={16} /> Profile</button>}
    </header>
    <div className="profile-tabs code-mode-actions" role="tablist" aria-label="Closet sections">{CLOSET_TABS.map(t =>
      <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
    {tab === 'character' ? <AvatarEditor /> : <ClosetPickers tab={tab} />}
  </div>;
}
