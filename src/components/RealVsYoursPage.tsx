import { useEffect, useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { NbaHistory } from '../history/nbaHistoryData';
import { realVsYours, everyPlayer, driftLabel, type DriftCell } from '../history/realVsYours';
import { seasonText } from '../history/realDevelopment';
import { PixelIcon } from './PixelIcon';
import '../improvements.css';

/** Real vs Yours: this league's champions, MVPs and top picks next to the real ones, with a timeline-drift score. */
export function RealVsYoursPage({ league, extras, onSelectPlayer }: { league: League; extras: GMLeagueExtras; onSelectPlayer: (id: string) => void }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import('../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);
  const report = useMemo(() => (h ? realVsYours(h, league, everyPlayer(league, extras.freeAgents)) : null), [h, league, extras.freeAgents]);
  if (!league.historical) return <p className="empty-state">Real vs Yours is for leagues started from real NBA history.</p>;
  if (error) return <p className="empty-state">Could not load the NBA history data: {error}</p>;
  if (!report) return <p className="empty-state">Loading NBA history…</p>;
  const show = (c: DriftCell, player: boolean) => c.yours
    ? (player ? <button className="link-button" onClick={() => onSelectPlayer(c.yours!)}>{c.yours}</button> : c.yours)
    : <span className="muted">—</span>;
  const mark = (c: DriftCell) => (!c.real || !c.yours ? null : c.same
    ? <span className="rvy-mark same" title="Same as real history"><PixelIcon name="check" size={11} /> same</span>
    : <span className="rvy-mark diff" title="Different from real history">changed</span>);
  return (
    <div className="rvy-page">
      <div className="season-feature-header"><div><span className="pixel-eyebrow">SINCE {seasonText(league.historical.startYear).toUpperCase()}</span><h2>Real vs Yours</h2></div></div>
      <div className="rvy-score" role="status">
        <div className="rvy-meter" aria-hidden><span style={{ width: `${report.drift}%` }} /></div>
        <div><b>{report.compared ? `${report.drift}% rewritten` : '0% rewritten'}</b><span>{driftLabel(report.drift, report.compared)}</span>
          <small>{report.compared ? `${report.same} of ${report.compared} champions, MVPs and #1 picks match real history.` : 'Finish a season to compare it with what really happened.'}</small></div>
      </div>
      {report.rows.length === 0 ? <p className="empty-state">No completed seasons yet.</p> : (
        <div className="stat-table-scroll"><table className="db-table rvy-table">
          <thead><tr><th>Season</th><th className="col-name">Real champion</th><th className="col-name">Your champion</th><th className="col-name">Real MVP</th><th className="col-name">Your MVP</th><th className="col-name">Real #1 pick</th><th className="col-name">Your #1 pick</th></tr></thead>
          <tbody>{[...report.rows].reverse().map(r => <tr key={r.season}>
            <td>{seasonText(Number(r.season))}</td>
            <td className="col-name">{r.champion.real ?? '—'}</td><td className="col-name">{show(r.champion, false)} {mark(r.champion)}</td>
            <td className="col-name">{r.mvp.real ?? '—'}</td><td className="col-name">{show(r.mvp, true)} {mark(r.mvp)}</td>
            <td className="col-name">{r.topPick.real ?? '—'}</td><td className="col-name">{show(r.topPick, true)} {mark(r.topPick)}</td>
          </tr>)}</tbody>
        </table></div>
      )}
      <p className="hint-text">Only seasons the NBA data covers are compared. Your #1 pick is the first pick of the draft held at the end of that season.</p>
    </div>
  );
}
