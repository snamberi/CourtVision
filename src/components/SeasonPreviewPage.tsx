import { useEffect, useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import { buildSeasonPreview, gradePreview, withSeasonPreview } from '../simulation/seasonPreview';
import { formatSeasonYear } from '../simulation/calendar';
import '../improvements.css';

/** Season Preview: preseason predictions for every team, graded as the season goes and when it ends. */
export function SeasonPreviewPage({ league, onChange, onSelectPlayer }: { league: League; onChange: (update: (l: League) => League) => void; onSelectPlayer: (id: string) => void }) {
  const stored = league.seasonPreviews ?? {};
  const seasons = Object.keys(stored).sort((a, b) => Number(b) - Number(a));
  const [season, setSeason] = useState(league.season ?? '');
  const noGamesYet = !league.schedule.some(g => g.played) && (league.seasonPhase ?? 'regular_season') === 'regular_season';
  // A brand-new season's preview is saved as soon as anyone looks, before the first game.
  useEffect(() => { if (noGamesYet && !stored[league.season ?? '']) onChange(l => withSeasonPreview(l)); }, [noGamesYet, league.season]); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = stored[season] ?? (season === league.season && noGamesYet ? buildSeasonPreview(league) : null);
  const card = useMemo(() => (preview ? gradePreview(league, preview) : null), [league, preview]);
  const teamName = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  return (
    <div className="season-preview">
      <div className="season-feature-header"><div><span className="pixel-eyebrow">LEAGUE OFFICE PREDICTIONS</span><h2>Season Preview</h2></div></div>
      {seasons.length > 1 && <div className="fa-controls"><select value={season} onChange={e => setSeason(e.target.value)}>
        {seasons.map(s => <option key={s} value={s}>{formatSeasonYear(s)}</option>)}</select></div>}
      {!preview || !card ? <p className="empty-state">Predictions are made before the first game of a season. The next preview comes when the next season starts.</p> : <>
        <div className="rvy-score">
          <div className={`grade-badge grade-${card.grade}`} aria-label={`Grade ${card.grade}`}>{card.grade}</div>
          <div>
            <b>{card.final ? 'Final report card' : card.rows.some(r => r.actualGames) ? 'Report card so far' : 'Before the opening tip'}</b>
            <span>Title favourite: {teamName(preview.champion)}{card.championHit != null ? (card.championHit ? ' ✓ won it' : ' ✗ missed') : ''} · MVP favourite: {preview.mvp ? <button className="link-button" onClick={() => onSelectPlayer(preview.mvp!)}>{preview.mvp}</button> : '—'}{card.mvpHit != null ? (card.mvpHit ? ' ✓' : ' ✗') : ''}</span>
            <small>{card.rows.some(r => r.actualGames) ? `Predictions miss by ${card.meanMiss.toFixed(1)} wins a team on average${card.final ? '' : ' (at the current pace)'}.` : `Predicted over ${preview.games} games from each roster's strength.`}
              {card.surprise ? ` Biggest surprise: ${card.surprise.teamName} (+${card.surprise.diff}).` : ''}{card.flop ? ` Biggest letdown: ${card.flop.teamName} (${card.flop.diff}).` : ''}</small>
          </div>
        </div>
        <div className="stat-table-scroll"><table className="db-table">
          <thead><tr><th className="num">#</th><th className="col-name">Team</th><th className="num">Predicted W</th><th className="num">Record</th><th className="num">vs pick</th></tr></thead>
          <tbody>{card.rows.map(r => <tr key={r.teamId}>
            <td className="num">{r.rank}</td><td className="col-name">{r.teamName}</td><td className="num">{r.predictedWins}</td>
            <td className="num">{r.actualGames ? `${r.actualWins}-${r.actualGames - r.actualWins}` : '—'}</td>
            <td className={`num ${r.diff > 0 ? 'good-text' : r.diff < 0 ? 'bad-text' : ''}`}>{r.actualGames ? (r.diff > 0 ? `+${r.diff}` : r.diff) : '—'}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="hint-text">"vs pick" is wins above or below the prediction{card.final ? '' : ', at each team\'s current pace'}. Grades: A within 5 wins a team on average, B 7, C 9, D 12.</p>
      </>}
    </div>
  );
}
