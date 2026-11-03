import { useEffect, useId, useRef, useState } from 'react';
import './releaseLayout.css';

/** Local section navigation follows the current tab, including asynchronously loaded sections. */
export function PageJumps() {
  const host = useRef<HTMLElement>(null);
  const prefix = useId();
  const [expanded, setExpanded] = useState(false);
  const [headings, setHeadings] = useState<{ el: HTMLElement; label: string; id: string }[]>([]);
  useEffect(() => {
    const page = host.current?.parentElement;
    if (!page) return;
    page.classList.add('release-page');
    let nextId = 0;
    const sync = () => {
      const next = [...page.querySelectorAll<HTMLElement>('h2, h3')].filter(h => !h.closest('[hidden], [aria-hidden="true"], details:not([open])'));
      next.forEach(h => { if (!h.id) h.id = `${prefix}-section-${nextId++}`; });
      const entries = next.map(el => ({ el, label: el.textContent ?? '', id: el.id }));
      setHeadings(old => old.length === entries.length && old.every((h, i) => h.el === entries[i].el && h.label === entries[i].label) ? old : entries);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(page, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['open', 'hidden', 'aria-hidden'] });
    return () => { observer.disconnect(); page.classList.remove('release-page'); };
  }, [prefix]);
  return <nav className={`page-jumps ${expanded ? 'is-open' : ''}`} ref={host} aria-label="Jump to a section" hidden={headings.length < 2}>
    <button className="page-jumps-toggle" aria-expanded={expanded} aria-controls={`${prefix}-links`} onClick={() => setExpanded(v => !v)}>Quick jumps {expanded ? '−' : '+'}</button><div className="page-jumps-links" id={`${prefix}-links`}><b>Quick jumps</b>{headings.map(h => <button key={h.id} onClick={() => { h.el.tabIndex = -1; h.el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); h.el.focus({ preventScroll: true }); setExpanded(false); }}>{h.label}</button>)}
    <button onClick={() => host.current?.parentElement?.scrollIntoView({ behavior: 'auto' })}>Back to top ↑</button></div>
  </nav>;
}
