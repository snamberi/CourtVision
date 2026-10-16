import { useEffect, useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { NbaHistory } from '../history/nbaHistoryData';
import { realDynasties, leagueDynasties, rankDynasties, tierOf, TITLE_POINTS, FINALS_POINTS, MAX_GAP, type DynastyRow } from '../history/dynastyRankings';
import './create.css';
import '../improvements.css';

type Show = 'all' | 'league' | 'real';
const span = (d: DynastyRow) => (d.from === d.to ? String(d.from) : `${d.from}–${d.to}`);
const pct = (d: DynastyRow) => (d.wins + d.losses ? (d.wins / (d.wins + d.losses)).toFixed(3).replace(/^0/, '') : '—');

/** Dynasty rankings: this league's title runs ranked with the real NBA's, on one score. */
export function DynastyRankingsPage({ league, userTeamId, onSelectTeam }: { league: League; userTeamId: string | null; onSelectTeam?: (teamId: string) => void }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState<Show>('all');
  useEffect(() => {
    let live = true;
    import('../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);
  const real = useMemo(() => (h ? realDynasties(h) : []), [h]);
  const mine = useMemo(() => leagueDynasties(league.franchiseHistory ?? [], userTeamId), [league.franchiseHistory, userTeamId]);
  const ranking = useMemo(() => rankDynasties(real, mine), [real, mine]);
  if (error) return <p className="empty-state">Could not load the NBA history data: {error}</p>;
  if (!h) return <p className="empty-state">Loading NBA history…</p>;

  const lead = ranking.yourBest ?? ranking.best;
  const rows = ranking.rows.filter(d => show === 'all' || d.source === show);
  const total = ranking.rows.length;
  return (
    <div className="dynasty-rank-page">
      <div className="season-feature-header"><div><span className="pixel-eyebrow">ALL-TIME</span><h2>Dynasty Rankings</h2></div></div>
      <div className="rvy-score" role="status">
        <div className="grade-badge wide" aria-hidden>{lead ? `#${lead.rank}` : '—'}</div>
        {lead ? <div>
          <b>{lead.yours ? 'Your best run' : 'This league’s best run'}: {lead.teamName} {span(lead)}</b>
          <span>{lead.titles.length} titles · ranks #{lead.rank} of {total} all-time · {tierOf(lead)}</span>
          <small>{ranking.above ? `Behind ${ranking.above.teamName} ${span(ranking.above)}` : 'Ahead of every real dynasty'}{ranking.below ? `, ahead of ${ranking.below.teamName} ${span(ranking.below)}.` : '.'}</small>
        </div> : <div>
          <b>No dynasties in this league yet</b>
          <span>Win two titles within {MAX_GAP} seasons to make the list.</span>
          <small>{mine.length === 0 && (league.franchiseHistory ?? []).some(r => !r.imported) ? 'Every champion so far has been a one-off.' : 'Finish a few seasons and your league’s best teams will show up here, next to the real ones.'}</small>
        </div>}
      </div>

      <div className="create-segment" role="radiogroup" aria-label="Which dynasties">
        {([['all', 'All'], ['league', `This league (${mine.length})`], ['real', `Real NBA (${real.length})`]] as [Show, string][]).map(([k, label]) =>
          <button key={k} role="radio" aria-checked={show === k} className={show === k ? 'selected' : ''} onClick={() => setShow(k)}>{label}</button>)}
      </div>

      {rows.length === 0 ? <p className="empty-state">Nothing to rank yet.</p> : (
        <div className="stat-table-scroll"><table className="db-table dynasty-table">
          <thead><tr><th className="num">#</th><th className="col-name">Team</th><th>Seasons</th><th className="num">Titles</th><th className="num">Finals lost</th><th className="num">Record</th><th className="num">Win%</th><th className="num">Score</th><th>Tier</th><th /></tr></thead>
          <tbody>{rows.map(d => (
            <tr key={d.key} className={d.yours ? 'hof-yes' : ''}>
              <td className="num">{d.rank}</td>
              <td className="col-name">{d.source === 'league' && onSelectTeam ? <button className="link-button" onClick={() => onSelectTeam(d.teamId)}>{d.teamName}</button> : d.teamName}</td>
              <td title={`Titles: ${d.titles.join(', ')}`}>{span(d)}</td>
              <td className="num">{d.titles.length}</td>
              <td className="num">{d.finalsLosses}</td>
              <td className="num">{d.wins + d.losses ? `${d.wins}-${d.losses}` : '—'}</td>
              <td className="num">{pct(d)}</td>
              <td className="num"><b>{d.score}</b></td>
              <td><span className={`cv-chip ${tierOf(d) === 'Legendary' ? 'gold' : ''}`}>{tierOf(d)}</span></td>
              <td>{d.yours ? <span className="cv-chip gold">Yours</span> : d.source === 'league' ? <span className="cv-chip good">Your league</span> : <span className="cv-chip">Real</span>}</td>
            </tr>))}</tbody>
        </table></div>
      )}
      <p className="hint-text">A dynasty is two or more titles with no more than {MAX_GAP} seasons between them. Score: {TITLE_POINTS} per title, {FINALS_POINTS} per lost Finals inside the run, plus how far above .500 the team played across it. Real teams are grouped by franchise and shown by city; seasons are the year they ended.</p>
    </div>
  );
}
