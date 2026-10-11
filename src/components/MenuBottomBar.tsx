import { useEffect, useState } from 'react';
import { PixelIcon } from './PixelIcon';
import { Modal } from './Modal';
import { ModeCard } from './ModeCard';
import { modesIn, type ModeEntry } from '../menu/modeCatalog';
import './modeCards.css';

export type BarTab = 'home' | 'compete' | 'play' | 'ranks' | 'me';

/**
 * The phone's bottom bar on the menus: Home, Compete, a big Play button, Ranks and Me. Play opens every mode and
 * sub-mode as cards; Compete opens the tournaments, boards, clubs and friend games. Hidden on wide screens (CSS).
 */
export function MenuBottomBar({ active, onHome, onRanks, onMe, onOpen }: { active: BarTab; onHome: () => void; onRanks: () => void; onMe: () => void; onOpen: (e: ModeEntry) => void }) {
  const [sheet, setSheet] = useState<'play' | 'compete' | null>(null);
  useEffect(() => { document.body.classList.add('has-menu-bar'); return () => document.body.classList.remove('has-menu-bar'); }, []);
  const open = (e: ModeEntry) => { setSheet(null); onOpen(e); };
  const tab = (id: BarTab, icon: string, label: string, go: () => void) =>
    <button className={`menu-bar-tab ${active === id || sheet === id ? 'on' : ''}`} onClick={go} aria-current={active === id ? 'page' : undefined}>
      <PixelIcon name={icon} size={22} /><span>{label}</span></button>;
  return <>
    <nav className="menu-bar" aria-label="Main">
      {tab('home', 'home', 'Home', () => { setSheet(null); onHome(); })}
      {tab('compete', 'swords', 'Compete', () => setSheet(s => s === 'compete' ? null : 'compete'))}
      <button className={`menu-bar-play ${sheet === 'play' ? 'on' : ''}`} onClick={() => setSheet(s => s === 'play' ? null : 'play')} aria-label="Play: pick a game mode">
        <span className="menu-bar-coin"><PixelIcon name="play" size={30} /></span><span>Play</span></button>
      {tab('ranks', 'podium', 'Ranks', () => { setSheet(null); onRanks(); })}
      {tab('me', 'user', 'Me', () => { setSheet(null); onMe(); })}
    </nav>
    {sheet && <Modal label={sheet === 'play' ? 'Play' : 'Compete'} onClose={() => setSheet(null)} className="menu-sheet">
      {sheet === 'play' ? <>
        <h2><PixelIcon name="play" size={18} /> Play</h2>
        <h3>Game modes</h3>
        <div className="mode-tiles">{modesIn('main', 'perfect').map(e => <ModeCard key={e.id} entry={e} onOpen={open} />)}</div>
        <h3>Franchise</h3>
        <div className="mode-tiles">{modesIn('franchise').map(e => <ModeCard key={e.id} entry={e} onOpen={open} />)}</div>
        <h3>Quick games</h3>
        <div className="mode-tiles">{modesIn('quick').map(e => <ModeCard key={e.id} entry={e} onOpen={open} />)}</div>
      </> : <>
        <h2><PixelIcon name="swords" size={18} /> Compete</h2>
        <div className="mode-tiles">{modesIn('compete').map(e => <ModeCard key={e.id} entry={e} onOpen={open} />)}</div>
      </>}
      <button className="menu-sheet-close" onClick={() => setSheet(null)}>Close</button>
    </Modal>}
  </>;
}
