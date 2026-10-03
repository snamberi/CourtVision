import { formatSeasonYear } from '../simulation/calendar';
import { TeamLink } from './TeamLink';
import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import { computeLeagueAnalytics, type PlayerRankEntry, type TeamRankEntry, type RookieEntry } from '../simulation/leagueAnalytics';
import { stat1 } from './statFormat';

interface Props {
  league: League;
  onSelectPlayer: (playerId: string) => void;
}

function PlayerTable({ title, rows, onSelectPlayer, showDelta }: {
  title: string; rows: PlayerRankEntry[]; onSelectPlayer: (id: string) => void; showDelta?: boolean;
}) {
  return (
    <div className="analytics-block">
      <h4>{title}</h4>
      {rows.length === 0 ? <p className="empty-state">Nothing to show yet.</p> : (
        <table className="db-table">
          <thead><tr><th>Player</th><th>Team</th><th>Overall</th>{showDelta && <th>Δ</th>}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.playerId} onClick={() => onSelectPlayer(r.playerId)}>
                <td>{r.playerId}</td>
                <td><TeamLink name={r.teamName} /></td>
                <td>{r.overall}</td>
                {showDelta && <td className={((r.delta ?? 0) > 0 ? 'delta-up' : (r.delta ?? 0) < 0 ? 'delta-down' : '')}>
                  {r.delta != null ? `${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)}` : '—'}
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TeamTable({ title, rows, showDelta }: { title: string; rows: TeamRankEntry[]; showDelta?: boolean }) {
  return (
    <div className="analytics-block">
      <h4>{title}</h4>
      {rows.length === 0 ? <p className="empty-state">Nothing to show yet.</p> : (
        <table className="db-table">
          <thead><tr><th>Team</th><th>Avg Overall</th>{showDelta && <th>Δ</th>}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId}>
                <td><TeamLink name={r.teamName} /></td>
                <td>{r.overallAverage.toFixed(1)}</td>
                {showDelta && <td className={((r.delta ?? 0) > 0 ? 'delta-up' : (r.delta ?? 0) < 0 ? 'delta-down' : '')}>
                  {r.delta != null ? `${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)}` : '—'}
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RookieTable({ rows, onSelectPlayer }: { rows: RookieEntry[]; onSelectPlayer: (id: string) => void }) {
  return (
    <div className="analytics-block">
      <h4>Best Rookies</h4>
      {rows.length === 0 ? <p className="empty-state">No rookies (age 21 or younger) on any roster.</p> : (
        <table className="db-table">
          <thead><tr><th>Player</th><th>Team</th><th>Overall</th><th>PPG</th><th>APG</th><th>RPG</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.playerId} onClick={() => onSelectPlayer(r.playerId)}>
                <td>{r.playerId}</td>
                <td><TeamLink name={r.teamName} /></td>
                <td>{r.overall}</td>
                <td>{stat1(r.ppg)}</td>
                <td>{stat1(r.apg)}</td>
                <td>{stat1(r.rpg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function AnalyticsPage({ league, onSelectPlayer }: Props) {
  const [topN, setTopN] = useState(10);
  const analytics = useMemo(() => computeLeagueAnalytics(league, { topN }), [league, topN]);

  return (
    <div className="analytics-page">
      <div className="yt-header">
        <div>
          <h2>League Analytics</h2>
          <p className="hint-text">
            "Overall" here is a full-attribute composite — the plain average of every rated attribute a player has
            (not shot tendencies, not the headline roster/trade Overall). Improve/decline needs at least one
            season rollover (or manual development pass) to have something to compare against.
          </p>
        </div>
        <label className="rating-row" style={{ maxWidth: 220 }}>
          <span className="rating-label">Top N</span>
          <input type="range" min={5} max={30} step={5} value={topN} onChange={(e) => setTopN(Number(e.target.value))} />
          <input type="number" className="rating-number" value={topN} onChange={(e) => setTopN(Number(e.target.value))} />
        </label>
      </div>

      <div className="analytics-grid">
        <PlayerTable title="Best Players" rows={analytics.bestPlayers} onSelectPlayer={onSelectPlayer} />
        <RookieTable rows={analytics.bestRookies} onSelectPlayer={onSelectPlayer} />
        <PlayerTable title="Most Improved Players" rows={analytics.mostImprovedPlayers} onSelectPlayer={onSelectPlayer} showDelta />
        <PlayerTable title="Most Declined Players" rows={analytics.mostDeclinedPlayers} onSelectPlayer={onSelectPlayer} showDelta />
        <TeamTable title="Best 5 Teams" rows={analytics.bestTeams} />
        <TeamTable title="Worst 5 Teams" rows={analytics.worstTeams} />
        <TeamTable title="Most Improved Teams" rows={analytics.improvedTeams} showDelta />
        <TeamTable title="Most Declined Teams" rows={analytics.declinedTeams} showDelta />
      </div>

      <div className="analytics-block">
        <h4>Retired Players</h4>
        {analytics.retiredPlayers.length === 0 ? <p className="empty-state">Nobody has retired yet.</p> : (
          <table className="db-table">
            <thead><tr><th>Player</th><th>Final Team</th><th>Final Season</th><th>Final Age</th><th>Final Overall</th></tr></thead>
            <tbody>
              {analytics.retiredPlayers.map((r) => (
                <tr key={r.playerId + r.finalSeason}>
                  <td>{r.playerId}</td>
                  <td><TeamLink name={r.finalTeamName} /></td>
                  <td>{formatSeasonYear(r.finalSeason)}</td>
                  <td>{r.finalAge}</td>
                  <td>{r.finalOverall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
