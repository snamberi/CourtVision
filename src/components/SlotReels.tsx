import { useEffect, useRef, useState } from 'react';
import { burst } from '../fx/effects';
import './slotReels.css';

/*
 * Arcade reels: each reel scrolls a strip of values, slows down and lands on its value; the reels stop one after
 * another, each with a little burst of sparks in its colour. Used where a mode rolls something (82-0's Franchise Spin
 * rolls a team and an era). `rollKey` changing starts a new spin: every roll mounts fresh reels.
 */
export interface Reel { label: string; values: string[]; landing: string; color: string; sub?: string }

const ROW = 46;

function OneReel({ reel, spin, stopAt, rollKey, onStop }: { reel: Reel; spin: boolean; stopAt: number; rollKey: string; onStop: () => void }) {
  // A strip of other values that ends on the landing value; it slides up with a slowing transition.
  const [strip] = useState<string[]>(() => {
    if (!spin) return [reel.landing];
    const n = 18 + Math.round(stopAt / 120);
    const pool = reel.values.filter(v => v !== reel.landing);
    return [...Array.from({ length: n }, (_, i) => pool[(i * 7 + rollKey.length * 3 + i * i) % Math.max(1, pool.length)] ?? reel.landing), reel.landing];
  });
  const [phase, setPhase] = useState<'reset' | 'run' | 'done'>(spin ? 'reset' : 'done');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!spin) return;
    let go = requestAnimationFrame(() => { go = requestAnimationFrame(() => setPhase('run')); });
    const stop = window.setTimeout(() => {
      setPhase('done'); onStop();
      burst(box.current, { colors: [reel.color, '#ffd166', '#f4f0e6'], count: 18, power: 4 });
    }, stopAt);
    return () => { cancelAnimationFrame(go); window.clearTimeout(stop); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const landed = phase === 'done';
  const offset = phase === 'reset' ? 0 : (strip.length - 1) * ROW;
  return <div className={`reel ${landed ? 'landed' : 'rolling'}`} style={{ ['--reel' as string]: reel.color }} ref={box}>
    <span className="reel-label">{reel.label}</span>
    <div className="reel-window" aria-live="polite" aria-label={`${reel.label}: ${landed ? reel.landing : 'spinning'}`}>
      <div className="reel-strip" style={{ transform: `translateY(-${offset}px)`, transitionDuration: phase === 'run' ? `${stopAt}ms` : '0ms' }}>
        {strip.map((v, i) => <b key={i} style={{ height: ROW }}>{v}</b>)}
      </div>
      <i className="reel-glass" aria-hidden="true" />
    </div>
    {reel.sub && <small className="reel-sub">{landed ? reel.sub : ' '}</small>}
  </div>;
}

/** The reels for one roll. `onLanded` fires when the last reel stops; `onTick` while they spin (for a sound). */
export function SlotReels({ reels, rollKey, onLanded, onTick }: { reels: Reel[]; rollKey: string; onLanded?: () => void; onTick?: () => void }) {
  const stopped = useRef(0), ticker = useRef(0);
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    stopped.current = 0;
    if (reduce) { onLanded?.(); return; }
    if (onTick) ticker.current = window.setInterval(onTick, 110);
    return () => window.clearInterval(ticker.current);
  }, [rollKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const stopOne = () => {
    stopped.current++;
    if (stopped.current >= reels.length) { window.clearInterval(ticker.current); onLanded?.(); }
  };
  return <div className="slot-reels" style={{ gridTemplateColumns: `repeat(${reels.length}, minmax(0, 1fr))` }}>
    {reels.map((r, i) => <OneReel key={`${r.label}|${rollKey}`} reel={r} spin={!reduce} stopAt={1100 + i * 550} rollKey={rollKey} onStop={stopOne} />)}
  </div>;
}
