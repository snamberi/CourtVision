import { TeamLink } from './TeamLink';
import type { League } from '../simulation/league';
import { formatSeasonYear } from '../simulation/calendar';

interface Props {
  league: League;
  onSelectPlayer: (playerId: string) => void;
}

export function FranchiseHistoryPage({ league, onSelectPlayer }: Props) {
  const history = [...(league.franchiseHistory ?? [])].reverse();

  return (
    <div className="franchise-history-page">
      <h2>Franchise History</h2>
      <p className="hint-text">One entry is archived every time you advance past a season's playoffs into the draft.</p>
      {history.length === 0 ? (
        <p className="empty-state">No completed seasons yet — play through your first playoffs to start the record book.</p>
      ) : (
        <table className="db-table">
          <thead>
            <tr><th>Season</th><th>Champion</th><th>Finals MVP</th><th>MVP</th><th>DPOY</th><th>ROY</th></tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.season}>
                <td>{formatSeasonYear(h.season)}</td>
                <td><TeamLink name={h.championTeamName ?? '—'} /></td>
                <td>{h.fmvpPlayerId ? <span className="award-team-player" onClick={() => onSelectPlayer(h.fmvpPlayerId!)}>{h.fmvpPlayerId}</span> : '—'}</td>
                <td>{h.mvpPlayerId ? <span className="award-team-player" onClick={() => onSelectPlayer(h.mvpPlayerId!)}>{h.mvpPlayerId}</span> : '—'}</td>
                <td>{h.dpoyPlayerId ? <span className="award-team-player" onClick={() => onSelectPlayer(h.dpoyPlayerId!)}>{h.dpoyPlayerId}</span> : '—'}</td>
                <td>{h.royPlayerId ? <span className="award-team-player" onClick={() => onSelectPlayer(h.royPlayerId!)}>{h.royPlayerId}</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
