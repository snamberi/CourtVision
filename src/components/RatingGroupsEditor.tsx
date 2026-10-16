import { useState } from 'react';
import { PixelIcon } from './PixelIcon';
import './ratingGroups.css';

/*
 * Ratings in groups (Three-Point, Playmaking, ...): one slider moves the whole group, "Fine-tune" opens every rating in
 * it one by one. Each rating and each group can be locked: a locked rating stays where it is when its group's slider
 * moves, and (where the caller supports it) development and age never change it either.
 */

export interface RatingGroup { id: string; name: string; blurb?: string; paths: string[] }

interface Props {
  groups: RatingGroup[];
  value: (path: string) => number;
  min: number;
  max: number;
  /** Sets ratings (locked ones are already left out). */
  onSet: (paths: string[], v: number) => void;
  /** Locked rating paths; with `onLock`, every group and rating gets a lock button. */
  locked?: ReadonlySet<string>;
  onLock?: (paths: string[], locked: boolean) => void;
  disabled?: boolean;
  /** What a locked rating means here, for the lock buttons' tooltip. */
  lockHint?: string;
  /** Tooltips for single ratings, by path. */
  hints?: Record<string, string>;
}

/** "offense.pullUp3" → "Pull Up 3". */
const ratingLabel = (path: string) => (path.split('.')[1] ?? path)
  .replace(/([A-Z])/g, ' $1').replace(/(\d+)/g, ' $1').replace(/^./, c => c.toUpperCase()).replace(/ I Q\b/g, ' IQ').replace(/\s+/g, ' ').trim();

const avg = (vals: number[]) => Math.round(vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length));

function LockButton({ state, name, hint, onClick, disabled }: { state: 'on' | 'off' | 'some'; name: string; hint?: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className={`rg-lock ${state}`} disabled={disabled} onClick={onClick}
    aria-pressed={state === 'on' ? true : state === 'some' ? 'mixed' : false}
    aria-label={`${state === 'on' ? 'Unlock' : 'Lock'} ${name}`} title={hint}>
    <PixelIcon name={state === 'off' ? 'unlock' : 'lock'} size={16} />
  </button>;
}

export function RatingGroupsEditor({ groups, value, min, max, onSet, locked, onLock, disabled = false, lockHint, hints }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(Number.isFinite(v) ? v : min)));
  const isLocked = (p: string) => !!locked?.has(p);
  return <ul className="rg-list">{groups.map(g => {
    const free = g.paths.filter(p => !isLocked(p));
    const v = avg(g.paths.map(value));
    const set = (n: number) => { if (free.length) onSet(free, clamp(n)); };
    const lockState = free.length === 0 ? 'on' : free.length === g.paths.length ? 'off' : 'some';
    const off = disabled || !free.length;
    return <li key={g.id} className={lockState === 'on' ? 'all-locked' : ''}>
      <div className="rg-head">
        <label><span><b>{g.name}</b>{g.blurb && <small> {g.blurb}</small>}</span>
          <span className="rg-stepper">
            <button type="button" disabled={off} aria-label={`Lower ${g.name}`} onClick={() => set(v - 1)}>−</button>
            <input type="range" min={min} max={max} value={v} disabled={off} onChange={e => set(Number(e.target.value))} aria-label={g.name} />
            <button type="button" disabled={off} aria-label={`Raise ${g.name}`} onClick={() => set(v + 1)}>+</button>
            <input className="year-input rg-num" type="number" min={min} max={max} value={v} disabled={off} onChange={e => set(Number(e.target.value))} aria-label={`${g.name} value`} />
          </span>
        </label>
        {onLock && <LockButton state={lockState} name={g.name} hint={lockHint} disabled={disabled} onClick={() => onLock(g.paths, lockState !== 'on')} />}
      </div>
      <button type="button" className="link-button" aria-expanded={open === g.id} onClick={() => setOpen(open === g.id ? null : g.id)}>
        {open === g.id ? 'Hide each rating' : `Fine-tune ${g.paths.length} rating${g.paths.length === 1 ? '' : 's'}`}{lockState === 'some' ? ` · ${g.paths.length - free.length} locked` : lockState === 'on' ? ' · all locked' : ''}
      </button>
      {open === g.id && <div className="rg-fields">{g.paths.map(p => {
        const lockedHere = isLocked(p), shown = Math.round(value(p));
        return <div key={p} className={`rg-field ${lockedHere ? 'locked' : ''}`}>
          <label title={hints?.[p]}><span>{ratingLabel(p)} <b>{shown}</b></span>
            <input type="range" min={min} max={max} value={shown} disabled={disabled || lockedHere} onChange={e => onSet([p], clamp(Number(e.target.value)))} aria-label={ratingLabel(p)} /></label>
          {onLock && <LockButton state={lockedHere ? 'on' : 'off'} name={ratingLabel(p)} hint={lockHint} disabled={disabled} onClick={() => onLock([p], !lockedHere)} />}
        </div>;
      })}</div>}
    </li>;
  })}</ul>;
}
