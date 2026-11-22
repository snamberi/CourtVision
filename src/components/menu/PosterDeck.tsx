import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { PixelIcon } from '../PixelIcon';
import { MODE_SHORT } from '../../menu/modePresentation';
import type { ModeEntry } from '../../menu/modeCatalog';

interface Props {
  label: string;
  entries: ModeEntry[];
  selected: ModeEntry;
  onSelect: (entry: ModeEntry) => void;
  art: (entry: ModeEntry) => string;
  children: (entry: ModeEntry) => ReactNode;
  badge?: (entry: ModeEntry) => string | undefined;
}

/** One selected poster drives the launch action. Touch, keyboard and the pager share that selection. */
export function PosterDeck({ label, entries, selected, onSelect, art, children, badge }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const index = entries.findIndex(entry => entry.id === selected.id);
  const reveal = (slot: HTMLElement) => {
    const el = track.current;
    if (!el) return;
    const inset = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const left = slot.offsetLeft - inset;
    const right = slot.offsetLeft + slot.offsetWidth + inset - el.clientWidth;
    if (left < el.scrollLeft) el.scrollLeft = left;
    else if (right > el.scrollLeft) el.scrollLeft = right;
  };
  useLayoutEffect(() => {
    const slot = track.current?.children[index] as HTMLElement | undefined;
    if (!slot) return;
    reveal(slot);
    if (!track.current || typeof ResizeObserver === 'undefined') return;
    const resize = new ResizeObserver(() => reveal(slot));
    resize.observe(track.current);
    return () => resize.disconnect();
  }, [index, selected.id]);

  const pick = (n: number, focus = false) => {
    const next = (n + entries.length) % entries.length;
    onSelect(entries[next]);
    if (focus) (track.current?.children[next]?.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
  };
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, n: number) => {
    const target = { ArrowLeft: n - 1, ArrowUp: n - 1, ArrowRight: n + 1, ArrowDown: n + 1, Home: 0, End: entries.length - 1 }[event.key];
    if (target == null) return;
    event.preventDefault();
    pick(target, true);
  };
  const syncSwipe = () => {
    const el = track.current;
    if (!el?.clientWidth) return;
    const slots = Array.from(el.children) as HTMLElement[];
    const center = (slot: HTMLElement) => slot.offsetLeft + slot.offsetWidth / 2 - el.scrollLeft;
    const current = slots[index];
    if (!current || (center(current) >= 0 && center(current) <= el.clientWidth)) return;
    const visible = slots.findIndex(slot => center(slot) >= 0 && center(slot) <= el.clientWidth);
    if (visible >= 0) onSelect(entries[visible]);
  };

  return <div className="arena-deck" role="group" aria-label={label}>
    <div ref={track} className="arena-track" onScroll={syncSwipe}>
      {entries.map((entry, n) => <div className="arena-slot" key={entry.id}>
        <button type="button" className="arena-poster" data-mode={entry.id} aria-label={entry.title} aria-pressed={entry.id === selected.id}
          tabIndex={entry.id === selected.id ? 0 : -1} onKeyDown={event => onKey(event, n)} onClick={() => onSelect(entry)}>
          <span className="arena-poster-art"><img src={art(entry)} alt="" draggable={false} loading={n < 4 ? 'eager' : 'lazy'} /></span>
          {badge?.(entry) && <span className="arena-poster-badge">{badge(entry)}</span>}
          <span className="arena-poster-body"><strong>{entry.title}</strong>{children(entry)}</span>
        </button>
      </div>)}
    </div>
    <div className="arena-pager" role="group" aria-label={`${label} controls`}>
      <button type="button" className="arena-arrow" aria-label="Previous card" onClick={() => pick(index - 1)}><i /></button>
      <div className="arena-dots">{entries.map((entry, n) => <button type="button" key={entry.id} aria-label={`Select ${entry.title}`}
        aria-current={entry.id === selected.id || undefined} onClick={() => pick(n)}><i /></button>)}</div>
      <button type="button" className="arena-arrow next" aria-label="Next card" onClick={() => pick(index + 1)}><i /></button>
    </div>
  </div>;
}

export function LaunchBar({ entry, busy, onPlay, children }: { entry: ModeEntry; busy?: string | null; onPlay: () => void; children?: ReactNode }) {
  return <div className="arena-launch">
    <div className="arena-selection" aria-live="polite"><PixelIcon name={entry.icon} size={26} /><div><strong>{entry.title}</strong><span>{MODE_SHORT[entry.id] ?? entry.desc}</span></div></div>
    <button type="button" className="arena-gold arena-play" disabled={!!busy} aria-label={`Play ${entry.title}`} onClick={onPlay}>{busy || 'Play'} <b aria-hidden="true">»</b></button>
    {children && <div className="arena-mode-links">{children}</div>}
  </div>;
}
