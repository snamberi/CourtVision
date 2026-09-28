import { useEffect, useState } from 'react';
import type { NbaHistory } from '../history/nbaHistoryData';
import { DreamMatchup } from './hunt/HuntHub';
import './hunt/hunt.css';

/** Legend Teams: Dream Matchup between any two real team-seasons, under any era's rules (the same as in League Hunt). */
export function LegendsPage(_props: { sandboxMode?: boolean; seed?: number }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import('../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);
  return <div className="legends-page">
    <div className="season-feature-header"><div><span className="pixel-eyebrow">REAL NBA HISTORY</span><h2>Dream Matchup</h2></div></div>
    {error ? <p className="empty-state">Could not load the NBA history data: {error}</p> : !h ? <p className="empty-state">Loading NBA history…</p> : <DreamMatchup h={h} />}
  </div>;
}
