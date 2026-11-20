import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { ModeEntry } from '../../menu/modeCatalog';
import { courtPlate, type MenuDesign } from '../../menu/design';
import { PixelIcon } from '../PixelIcon';

interface Props<Entry extends ModeEntry> {
  design: MenuDesign;
  label: string;
  entries: Entry[];
  selected: Entry;
  onSelect: (entry: Entry) => void;
  onPlay: () => void;
  busy?: string | null;
  badge?: string;
  record?: (entry: Entry) => readonly [string, string];
  children?: ReactNode;
}

export function ModePicker<Entry extends ModeEntry>({ design, label, entries, selected, onSelect, onPlay, busy, badge, record, children }: Props<Entry>) {
  const roster = useRef<HTMLDivElement>(null);
  const index = entries.findIndex(entry => entry.id === selected.id);
  const pick = (n: number, focus = false) => {
    const i = (n + entries.length) % entries.length;
    onSelect(entries[i]);
    if (focus) roster.current?.querySelectorAll('button')[i]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, n: number) => {
    const next = { ArrowLeft: n - 1, ArrowUp: n - 1, ArrowRight: n + 1, ArrowDown: n + 1, Home: 0, End: entries.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    pick(next, true);
  };
  const stat = record?.(selected);
  return <div className={'mode-picker' + (record ? ' has-records' : '')}>
    <div className="mode-plate"><img src={courtPlate(design, selected.id)} width="320" height="144" alt="" /></div>
    <section className="mode-roster" aria-label={label}>
      <header><h2>{label}</h2><span>{String(index + 1).padStart(2, '0')} / {String(entries.length).padStart(2, '0')}</span></header>
      <div className="mode-rows" ref={roster}>{entries.map((entry, i) =>
        <button type="button" key={entry.id} aria-label={entry.title} aria-pressed={entry.id === selected.id}
          tabIndex={entry.id === selected.id ? 0 : -1} onClick={() => onSelect(entry)} onKeyDown={event => onKey(event, i)}>
          <span className="mode-cursor" aria-hidden="true" /><PixelIcon name={entry.icon} size={21} /><strong>{entry.title}</strong>
          {record && <small>{record(entry)[1]}</small>}
        </button>)}</div>
    </section>
    <div className="mode-detail">
      <div className="mode-turn"><button type="button" aria-label="Previous card" onClick={() => pick(index - 1)}>‹</button>
        <button type="button" aria-label="Next card" onClick={() => pick(index + 1)}>›</button></div>
      <div className="mode-copy" aria-live="polite"><h2>{selected.title}</h2><p>{selected.desc}</p>
        {stat && <small>{stat[0]} · <b>{stat[1]}</b></small>}{badge && <small>{badge}</small>}</div>
      <div className="mode-actions"><button type="button" className="arena-gold picker-play" aria-label={'Play ' + selected.title} disabled={!!busy} onClick={onPlay}>
        <PixelIcon name="play" size={16} />{busy || 'Play'}</button>{children}</div>
    </div>
  </div>;
}
