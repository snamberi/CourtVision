import { useEffect, useRef, useState } from 'react';
import { unseenReleases, markReleasesSeen } from '../content/whatsNew';
import { IS_DESKTOP_BUILD } from '../appMode';
import { track } from '../analytics/track';

/** `**bold**` only; the items are ours. */
const rich = (t: string) => t.split(/(\*\*[^*]+\*\*)/).map((part, i) => part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part);

/** "What's new": once per update, on the main menu, for returning players. */
export function WhatsNew() {
  const [releases] = useState(() => unseenReleases());
  const [open, setOpen] = useState(releases.length > 0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => { markReleasesSeen(); setOpen(false); };
  useEffect(() => {
    if (!open) return;
    track('whats_new', { release: releases[0].id });
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  return <div className="share-modal whats-new" role="dialog" aria-modal="true" aria-labelledby="whats-new-title" onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="share-box">
      <span className="pixel-eyebrow">WHAT'S NEW</span>
      {releases.slice(0, 2).map((r, i) => <section key={r.id}>
        {i === 0 ? <h2 id="whats-new-title">{r.title}</h2> : <h3>{r.title}</h3>}
        <ul>{r.items.map(t => <li key={t}>{rich(t)}</li>)}</ul>
      </section>)}
      <div className="contest-actions">
        <button ref={closeRef} className="primary" onClick={close}>Let's play</button>
        {!IS_DESKTOP_BUILD && <a className="link-button" href="/changelog.html" onClick={() => markReleasesSeen()}>Full changelog</a>}
      </div>
    </div>
  </div>;
}
