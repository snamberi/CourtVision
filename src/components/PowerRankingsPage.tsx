import { TeamLink } from './TeamLink';
import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import { computeRatingsTable, RATING_RANK_CATEGORIES } from '../simulation/powerRankings';

interface Props {
  league: League;
}

export function PowerRankingsPage({ league }: Props) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => computeRatingsTable(league), [league]);
  const filtered = rows.filter((r) => !query || r.teamName.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="power-rankings-page">
      <h4>Power Rankings</h4>
      <p className="hint-text">
        Team rating is based only on the ratings of players on each team. Rating ranks show where each team
        stands (1 = best in the league) in each category, averaged across the roster.
      </p>
      <div className="fa-controls">
        <input className="db-search" type="text" placeholder="Search teams…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <p className="empty-state">No teams yet.</p>
      ) : (
        <div className="power-rankings-table-wrap">
          <table className="db-table stat-line-table power-rankings-table">
            <thead>
              <tr>
                <th>#</th><th className="col-name">Team</th><th>Conf</th><th>Div</th><th>Rating</th>
                <th>W</th><th>L</th><th>L10</th><th>MOV</th><th>Age</th>
                {RATING_RANK_CATEGORIES.map((c) => <th key={c.key} title={c.label}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.teamId}>
                  <td>{i + 1}</td>
                  <td className="col-name"><TeamLink name={r.teamName} /></td>
                  <td className="pr-conf">{r.conferenceId ?? '—'}</td>
                  <td className="pr-div">{r.divisionId ?? '—'}</td>
                  <td className="pr-rating">{r.rating}</td>
                  <td>{r.wins}</td>
                  <td>{r.losses}</td>
                  <td>{r.last10}</td>
                  <td>{r.mov >= 0 ? '+' : ''}{r.mov.toFixed(1)}</td>
                  <td>{r.avgAge.toFixed(1)}</td>
                  {RATING_RANK_CATEGORIES.map((c) => (
                    <td key={c.key} className={rankClass(r.ranks[c.key], filtered.length)}>{r.ranks[c.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function rankClass(rank: number, total: number): string {
  if (rank <= Math.max(1, Math.ceil(total * 0.15))) return 'rank-elite';
  if (rank >= Math.ceil(total * 0.85)) return 'rank-weak';
  return '';
}
