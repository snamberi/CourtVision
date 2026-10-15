import { useEffect, useState } from 'react';
import { PixelIcon } from '../PixelIcon';
import { UserAvatar, useAvatar } from '../UserAvatar';
import { FramedAvatar } from '../AvatarFrame';
import { ProfileIcon } from '../ProfileIcon';
import { activeHoliday, daysLeft, eventCoins, loadHoliday, HOLIDAY_EVENT, FINISH_COINS, WIN_COINS, type HolidayRun } from '../../retention/holiday';
import { piecesFor, type EventPiece } from '../../retention/holidayShop';
import { buyEventPiece } from '../../retention/holidayBuy';
import { loadRelics, RELICS_EVENT } from '../../relics/relics';
import { THEME_BY_ID } from '../../theme/themes';
import { burst } from '../../fx/effects';
import type { CSSProperties } from 'react';
import '../hunt/hunt.css';

const varsOf = (run: HolidayRun): CSSProperties => ({ '--hol-bg': run.holiday.colors.bg, '--hol-panel': run.holiday.colors.panel, '--hol-accent': run.holiday.colors.accent, '--hol-text': run.holiday.colors.text, '--hol-glow': run.holiday.colors.glow } as CSSProperties);

/** The event's own art: a pixel pumpkin or snowman, drawn in SVG rects. */
export function HolidayArt({ id, size = 64 }: { id: 'halloween' | 'christmas'; size?: number }) {
  const px: [number, number, number, number, string][] = id === 'halloween'
    ? [[3, 4, 10, 9, '#ff7a1a'], [2, 6, 1, 5, '#ff7a1a'], [13, 6, 1, 5, '#ff7a1a'], [6, 4, 1, 9, '#d9580b'], [9, 4, 1, 9, '#d9580b'], [7, 1, 2, 3, '#3f7a24'],
      [4, 7, 2, 2, '#ffd166'], [10, 7, 2, 2, '#ffd166'], [5, 10, 6, 1, '#ffd166'], [4, 9, 1, 1, '#ffd166'], [11, 9, 1, 1, '#ffd166']]
    : [[5, 1, 6, 1, '#e8323c'], [6, 0, 4, 1, '#e8323c'], [5, 2, 6, 4, '#f4fbff'], [3, 7, 10, 7, '#f4fbff'], [6, 3, 1, 1, '#0b1018'], [9, 3, 1, 1, '#0b1018'],
      [7, 4, 2, 1, '#ff7a1a'], [4, 6, 8, 1, '#e8323c'], [10, 6, 2, 3, '#1f8a3a'], [7, 9, 1, 1, '#0b1018'], [7, 11, 1, 1, '#0b1018'], [1, 8, 2, 1, '#8a5a2b'], [13, 8, 2, 1, '#8a5a2b']];
  return <svg width={size} height={size} viewBox="0 0 16 15" shapeRendering="crispEdges" aria-hidden="true">{px.map(([x, y, w, h, c], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={c} />)}</svg>;
}

function Preview({ piece }: { piece: EventPiece }) {
  const { look, team } = useAvatar();
  switch (piece.kind) {
    case 'avatar': return <UserAvatar look={{ ...look, [piece.category!]: piece.id }} team={team} size={72} title={piece.name} />;
    case 'frame': return <FramedAvatar look={look} team={team} frame={piece.id} size={72} title={piece.name} />;
    case 'icon': return <ProfileIcon id={piece.id} size={48} title={piece.name} />;
    case 'color': case 'titleColor': return <span className="holiday-swatch anim-flow" style={{ background: piece.css, backgroundSize: '200% 100%' }} />;
    case 'title': return <b className="holiday-title">“{piece.name}”</b>;
    case 'theme': { const p = THEME_BY_ID.get(piece.id as never)?.preview; return p ? <span className="holiday-theme" style={{ background: p.bg, border: `2px solid ${p.line}` }}><i style={{ background: p.panel }} /><i style={{ background: p.accent }} /><i style={{ background: p.hi }} /></span> : null; }
  }
}

/** The holiday event: its coins, how to earn them, and its shop. Only reachable while the event is on. */
export function HolidayEventPage({ onExit, onCloset }: { onExit: () => void; onCloset: () => void }) {
  const [run] = useState(() => activeHoliday());
  const [coins, setCoins] = useState(() => (run ? eventCoins(loadHoliday(), run.key) : 0));
  const [owned, setOwned] = useState(() => loadRelics().cosmetics ?? []);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!run) return;
    const sync = () => { setCoins(eventCoins(loadHoliday(), run.key)); setOwned(loadRelics().cosmetics ?? []); };
    window.addEventListener(HOLIDAY_EVENT, sync); window.addEventListener(RELICS_EVENT, sync);
    return () => { window.removeEventListener(HOLIDAY_EVENT, sync); window.removeEventListener(RELICS_EVENT, sync); };
  }, [run]);
  if (!run) return <div className="hunt"><header className="hunt-top"><button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button><div className="hunt-title"><h1>No event right now</h1></div></header>
    <p className="hint-text">Holiday events show up here while they're on. Keep an eye on the main menu.</p></div>;
  const h = run.holiday, pieces = piecesFor(h.id), left = daysLeft(run);
  const buy = (p: EventPiece, el: HTMLElement) => {
    const r = buyEventPiece(p.key);
    if (r === 'ok') { setNote(`${p.name} is yours. Wear it from the Closet.`); burst(el, { colors: [h.colors.accent, h.colors.glow, '#ffffff'], count: 24, power: 4 }); }
    else setNote(r === 'coins' ? `Not enough ${h.coins} yet.` : r === 'owned' ? 'You already have it.' : 'The event is over.');
    setCoins(eventCoins(loadHoliday(), run.key)); setOwned(loadRelics().cosmetics ?? []);
  };
  return <div className="hunt holiday" style={varsOf(run)}>
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">HOLIDAY EVENT · {left} DAY{left === 1 ? '' : 'S'} LEFT</span><h1>{h.name}</h1></div>
      <button className="relic-switch" onClick={onCloset}><PixelIcon name="team" size={16} /> Closet</button>
    </header>
    <section className="holiday-banner">
      <span className="holiday-art"><HolidayArt id={h.id} size={72} /></span>
      <span className="pixel-eyebrow">{run.start.toISOString().slice(5, 10).replace('-', '/')} → {new Date(run.end.getTime() - 86_400_000).toISOString().slice(5, 10).replace('-', '/')}</span>
      <h2>{h.name}</h2>
      <p>{h.blurb}</p>
      <div className="holiday-coins" aria-label={`${coins} ${h.coins}`}><b>{coins.toLocaleString()}</b><span>{h.coins}</span></div>
      <ul className="holiday-earn">
        <li>Finish any game mode: <b>+{FINISH_COINS}</b> {FINISH_COINS === 1 ? h.coin : h.coins}.</li>
        <li>Win it: <b>+{WIN_COINS}</b> {h.coins}.</li>
        <li>Everything here can only be bought while the event is on. What you buy is yours for good.</li>
      </ul>
    </section>
    {note && <p className="relic-note" role="status">{note}</p>}
    <h2 className="hunt-subhead">The {h.id === 'halloween' ? 'Spooky' : 'Holiday'} Shop</h2>
    <div className="holiday-grid">{pieces.map(p => { const have = owned.includes(p.key); return <div key={p.key} className={`holiday-item ${have ? 'owned' : ''}`}>
      <div className="holiday-preview"><Preview piece={p} /></div>
      <b>{p.name}</b><small>{p.label}</small>
      {have ? <button onClick={onCloset}><PixelIcon name="check" size={12} /> Owned · wear it</button>
        : <button className="primary" disabled={coins < p.price} onClick={e => buy(p, e.currentTarget)}>{p.price} {h.coins}</button>}
    </div>; })}</div>
  </div>;
}
