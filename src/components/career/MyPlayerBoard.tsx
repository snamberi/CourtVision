import type { ReactNode } from 'react';
import { PlayerAvatar } from '../PlayerAvatar';
import { CATEGORY_BY_ID, feetInches, type CategoryId } from '../../career/categories';
import { capFor, type Build } from '../../career/create';

/*
 * MyPlayer's body board: your player as a pixel sprite in the middle, each of the ten categories a callout wired to
 * the part of him it lives in (the IQ in his head, the jumper in his shooting hand, the handle in his off hand...).
 * Click a callout to work on it. The board is laid out on a 520 x 540 grid in percentages, so it scales; on a phone
 * it becomes a figure over a two-column list (no wires).
 */

const W = 520, H = 540;
/** Where each category lives on the 40 x 52 sprite, and which side its callout sits on (top to bottom). */
const SPOTS: { id: CategoryId; part: string; label: string; x: number; y: number; side: 'left' | 'right' }[] = [
  { id: 'interiorD', label: 'Rebounding & D', part: 'Core', x: 20, y: 33, side: 'left' },
  { id: 'body', label: 'Strength', part: 'Chest', x: 15, y: 28, side: 'left' },
  { id: 'midRange', label: 'Mid-Range', part: 'Forearms', x: 8, y: 30, side: 'left' },
  { id: 'threePoint', label: '3-Pointer', part: 'Shooting hand', x: 4, y: 34, side: 'left' },
  { id: 'finishing', label: 'Finishing', part: 'Thighs', x: 15, y: 42, side: 'left' },
  { id: 'iq', label: 'IQ & Clutch', part: 'Head', x: 18, y: 11, side: 'right' },
  { id: 'size', label: 'Frame', part: 'Height', x: 24, y: 2, side: 'right' },
  { id: 'perimeterD', label: 'Defense', part: 'Shoulders', x: 27, y: 26, side: 'right' },
  { id: 'playmaking', label: 'Playmaking', part: 'Off hand', x: 34, y: 34, side: 'right' },
  { id: 'athleticism', label: 'Speed & Hops', part: 'Legs', x: 25, y: 45, side: 'right' },
];
const CARD_W = 146, CARD_H = 54, ROW = [36, 132, 228, 324, 420];

export function valueLabel(b: Build, id: CategoryId): string {
  if (id === 'size') return feetInches(b.heightIn);
  if (id === 'body') return `${b.ratings.body}`;
  return String(b.ratings[id as Exclude<CategoryId, 'size'>]);
}

export function MyPlayerBoard({ b, name, selected, onSelect }: { b: Build; name: string; selected: CategoryId; onSelect: (id: CategoryId) => void }) {
  const cells = Object.fromEntries(SPOTS.map(s => {
    const cap = s.id === 'size' ? null : capFor(s.id as Exclude<CategoryId, 'size'>, b.heightIn);
    return [s.id, { value: <>{valueLabel(b, s.id)}{cap != null && <small>/{cap}</small>}</> }];
  })) as Record<CategoryId, BoardCell>;
  return <BodyBoard heightIn={b.heightIn} name={name} cells={cells} selected={selected} onSelect={onSelect} label="Your player's build by body part" />;
}

/** One callout on the board: its value, an optional line under the name (in place of the body part), and a look. */
export interface BoardCell { value: ReactNode; sub?: string; state?: 'empty' | 'filled' | 'pickable' | 'boosted' }

/** The body board itself (MyPlayer's editor and the Career wheel's build both use it). */
export function BodyBoard({ heightIn, name, cells, selected, onSelect, label }: { heightIn: number; name: string; cells: Record<CategoryId, BoardCell>; selected?: CategoryId | null; onSelect?: (id: CategoryId) => void; label: string }) {
  // The sprite stands on the floor at the bottom; taller builds stand taller.
  const scale = Math.max(0.88, Math.min(1.12, heightIn / 79));
  const px = 5 * scale, floor = 500;
  const at = (x: number, y: number) => ({ x: W / 2 + (x - 20) * px, y: floor - (52 - y) * px });
  const cards = SPOTS.map(s => {
    const i = SPOTS.filter(o => o.side === s.side).indexOf(s);
    const left = s.side === 'left' ? 8 : W - 8 - CARD_W, top = ROW[i];
    return { ...s, left, top, anchor: { x: s.side === 'left' ? left + CARD_W : left, y: top + CARD_H / 2 }, dot: at(s.x, s.y) };
  });
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return <div className="mp-board" role="group" aria-label={label}>
    <i className="mp-corner tl" aria-hidden="true" /><i className="mp-corner br" aria-hidden="true" />
    <svg className="mp-wires" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" preserveAspectRatio="none">
      {cards.map(c => <line key={c.id} x1={c.anchor.x} y1={c.anchor.y} x2={c.dot.x} y2={c.dot.y} className={c.id === selected ? 'on' : ''} />)}
    </svg>
    <div className="mp-figure" style={{ left: pct(W / 2 - 20 * px, W), top: pct(floor - 52 * px, H), width: pct(40 * px, W) }}>
      <PlayerAvatar playerId={name || 'You'} primaryColor="#f4f0e6" secondaryColor="#f47b20" size={200} title={`${name || 'Your player'}, ${feetInches(heightIn)}`} />
    </div>
    {cards.map(c => <span key={`d-${c.id}`} className={`mp-dot ${c.id === selected || cells[c.id].state === 'filled' || cells[c.id].state === 'boosted' ? 'on' : ''}`} style={{ left: pct(c.dot.x, W), top: pct(c.dot.y, H) }} aria-hidden="true" />)}
    {cards.map(c => {
      const cell = cells[c.id];
      const style = { left: pct(c.left, W), top: pct(c.top, H), width: pct(CARD_W, W) };
      const body = <><b>{c.label}</b><small>{cell.sub ?? c.part}</small><em>{cell.value}</em></>;
      const cls = `mp-callout ${c.side} ${c.id === selected ? 'on' : ''} ${cell.state ? `mp-${cell.state}` : ''}`;
      // Without a handler (or when it can't be picked) a callout is just a label.
      return onSelect && cell.state !== 'filled' && cell.state !== 'empty' && cell.state !== 'boosted'
        ? <button key={c.id} type="button" className={cls} aria-pressed={c.id === selected} title={CATEGORY_BY_ID.get(c.id)?.blurb} style={style} onClick={() => onSelect(c.id)}>{body}</button>
        : <div key={c.id} className={cls} title={CATEGORY_BY_ID.get(c.id)?.blurb} style={style}>{body}</div>;
    })}
  </div>;
}
