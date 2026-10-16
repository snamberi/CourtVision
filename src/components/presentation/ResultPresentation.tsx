import { useEffect, useRef, useState } from 'react';
import { celebrate } from '../../fx/effects';
import { PixelIcon } from '../PixelIcon';
import { PlayerAvatar } from '../PlayerAvatar';
import { teamColors } from '../../simulation/teamColors';
import './presentation.css';

/** The final number is exposed to assistive technology, without announcing every animation frame. */
export function ResultCount({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const still = typeof window !== 'undefined' && (!!(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion')) || document.documentElement.classList.contains('lite'));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (still) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => { const p = Math.min(1, (now - start) / 1100); setShown(value * (1 - (1 - p) ** 3)); if (p < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, still]);
  const format = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span className="result-counter" aria-label={format(value)}><span aria-hidden="true">{format(still ? value : shown)}</span></span>;
}

export function ResultCrest({ celebrateWin, label = 'COURT VISION · RUN COMPLETE' }: { celebrateWin: boolean; label?: string }) {
  const celebrated = useRef(false);
  useEffect(() => {
    if (!celebrateWin || celebrated.current) return;
    const timer = window.setTimeout(() => { celebrated.current = true; celebrate(['#ffd166', '#fff0bd', '#f47b20']); }, 450);
    return () => clearTimeout(timer);
  }, [celebrateWin]);
  return <div className={`result-crest ${celebrateWin ? 'is-champion' : ''}`}><span className="result-crest-icon"><PixelIcon name={celebrateWin ? 'trophy' : 'shield'} size={48} /></span><span>{label}</span></div>;
}

export function MvpSpotlight({ name, label = 'RUN MVP', detail, team, children }: { name: string; label?: string; detail?: string; team?: string; children?: React.ReactNode }) {
  const kit = teamColors(team);
  return <div className="result-mvp" style={{ ['--team-color' as string]: kit.primary, ['--team-trim' as string]: kit.secondary }}>
    <div className="result-mvp-art"><PlayerAvatar playerId={name.replace(/\s'\d{2}$/, '')} primaryColor={kit.primary} secondaryColor={kit.secondary} size={100} pose="raise" /></div>
    <div><span className="pixel-eyebrow"><PixelIcon name="star" size={14} /> {label}</span><h3>{name}</h3>{detail && <p>{detail}</p>}{children}</div>
  </div>;
}
