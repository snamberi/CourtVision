import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { RELEASES, markReleasesSeen } from '../content/whatsNew';
import { themeOf, itemsOf, updateNumber, searchUpdates } from '../content/updates';
import { PixelIcon } from './PixelIcon';
import './updatesHub.css';

/** `**bold**` only; the items are ours. */
const rich = (t: string) => t.split(/(\*\*[^*]+\*\*)/).map((part, i) => part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part);

/**
 * The Updates hub (#/updates): every update, newest first, each in its own colours. A release shows a short line per
 * thing it added; tap one for the full description.
 */
export function UpdatesHub({ onExit }: { onExit: () => void }) {
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(6);
  const list = useMemo(() => searchUpdates(q), [q]);
  // Opening the hub counts as reading the latest update (the phone app's dot goes away).
  useEffect(() => { markReleasesSeen(); }, []);
  return <div className="hunt updates-hub">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">{RELEASES.length} UPDATES SO FAR</span><h1>Updates</h1></div>
    </header>
    <div className="updates-search">
      <label htmlFor="updates-q" className="sr-only">Search the updates</label>
      <input id="updates-q" className="year-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search: clans, relics, career…" autoComplete="off" />
      {q && <small>{list.length} update{list.length === 1 ? '' : 's'} mention "{q.trim()}"</small>}
    </div>
    <ol className="updates-list">{list.slice(0, q ? list.length : shown).map((r, idx) => {
      const t = themeOf(r), items = itemsOf(r);
      return <li key={r.id}>
        <article className="update-card" style={{ '--upd-accent': t.accent, '--upd-bg': t.bg } as CSSProperties}>
          <header>
            <span className="update-icon"><PixelIcon name={t.icon} size={22} /></span>
            <div><span className="pixel-eyebrow">UPDATE {updateNumber(r)} · {t.name.toUpperCase()}{idx === 0 && !q ? ' · LATEST' : ''}</span><h2>{r.title}</h2></div>
          </header>
          <ul className="update-items">{items.map((it, i) => <li key={i}>
            <details>
              <summary><PixelIcon name="check" size={12} /> <span>{it.head}</span></summary>
              <p>{rich(it.text)}</p>
            </details>
          </li>)}</ul>
        </article>
      </li>;
    })}</ol>
    {!q && shown < list.length && <button className="updates-more" onClick={() => setShown(n => n + 10)}>Show older updates ({list.length - shown} more)</button>}
    {q && !list.length && <p className="empty-state">No update mentions that yet.</p>}
  </div>;
}
