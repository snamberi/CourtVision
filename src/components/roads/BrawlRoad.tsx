import { useEffect, useRef, type ReactNode } from 'react';
import { PixelIcon } from '../PixelIcon';
import { roadPosition, ROAD_COL } from '../../profile/roadMath';

export interface RoadStop { at: number; tick: string; rewards: ReactNode; major?: boolean }

/** Column width of one stop, in pixels. */
const W = ROAD_COL;

/**
 * A road like a battle-pass trophy road: reward cards on top, a long bar (orange where you've been, maroon ahead)
 * with each stop's value under it, and a marker with your number where you are. The latest reward reached is lit up
 * and the next one says NEXT GOAL. It scrolls sideways and opens centred on you.
 */
export function BrawlRoad({ stops, value, marker, label, icon = 'trophy' }: { stops: RoadStop[]; value: number; marker: string; label: string; icon?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const at = stops.map(s => s.at);
  const pos = roadPosition(at, value);
  // The marker and its number box stay on screen at the very start of the road.
  const mark = Math.max(26, pos);
  const reached = at.filter(a => a <= value).length;
  const latest = reached - 1, next = reached < stops.length ? reached : -1;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, pos - el.clientWidth / 2);
  }, [pos]);
  return <div className="brawl-road" ref={scroller} role="region" aria-label={label} tabIndex={0}>
    <div className="brawl-inner" style={{ width: stops.length * W, ['--road-col' as string]: `${W}px` }}>
      <ol className="brawl-cards">{stops.map((s, i) => {
        const got = i <= latest, state = i === latest ? 'latest' : i === next ? 'next' : got ? 'got' : 'ahead';
        return <li key={s.at} className={`brawl-card ${state} ${s.major ? 'major' : ''}`} aria-label={`${s.tick}: ${got ? 'unlocked' : 'locked'}`}>
          {state === 'latest' && <span className="brawl-tag new">UNLOCKED</span>}
          {state === 'next' && <span className="brawl-tag goal">NEXT GOAL</span>}
          <div className="brawl-card-body">{s.rewards}</div>
          {got && <span className="brawl-check" aria-hidden="true"><PixelIcon name="check" size={12} /></span>}
          {!got && <span className="brawl-lock" aria-hidden="true"><PixelIcon name="lock" size={12} /></span>}
        </li>;
      })}</ol>
      <div className="brawl-track" aria-hidden="true">
        <i className="brawl-fill" style={{ width: pos }} />
        {stops.map((s, i) => <b key={s.at} className={`brawl-node ${i <= latest ? 'got' : ''}`} style={{ left: i * W + W / 2 }} />)}
        <span className="brawl-marker" style={{ left: mark }}><PixelIcon name={icon} size={14} /></span>
      </div>
      <div className="brawl-ticks">
        {stops.map((s, i) => <small key={s.at} style={{ left: i * W + W / 2 }}>{s.tick}</small>)}
        <b className="brawl-value" style={{ left: mark }}>{marker}</b>
      </div>
    </div>
  </div>;
}
