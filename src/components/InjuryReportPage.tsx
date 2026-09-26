import { TeamLink } from './TeamLink';
import { canEditTeam } from '../navigation/permissions';
import { useState } from 'react';
import type { League } from '../simulation/league';
import { listLeagueInjuries, redistributeMinutesForInjuries, healthyRotationMinutes } from '../simulation/injuryReport';

interface Props {
  sandboxMode?: boolean;
  league: League;
  controlledTeamId: string | null;
  onChange: (league: League) => void;
  onSelectPlayer: (playerId: string) => void;
}

const SEVERITY_LABEL: Record<string, string> = { minor: 'Minor', moderate: 'Moderate', severe: 'Severe' };

export function InjuryReportPage({ league, controlledTeamId, onChange, onSelectPlayer, sandboxMode = false }: Props) {
  const [scope, setScope] = useState<'league' | 'mine'>(controlledTeamId ? 'mine' : 'league');
  const allInjuries = listLeagueInjuries(league);
  const injuries = scope === 'mine' && controlledTeamId ? allInjuries.filter((e) => e.record.teamId === controlledTeamId) : allInjuries;

  const affectedTeamIds = [...new Set(allInjuries.map((e) => e.record.teamId))];

  const handleRedistribute = (teamId: string) => {
    const team = league.teams.find((t) => t.teamId === teamId);
    if (!team || !canEditTeam(sandboxMode, controlledTeamId, teamId)) return;
    const updatedTeam = redistributeMinutesForInjuries(team, league.injuries);
    const teams = league.teams.map((t) => (t.teamId === teamId ? updatedTeam : t));
    onChange({ ...league, teams });
  };

  return (
    <div className="injury-report-page">
      <div className="yt-header">
        <div>
          <h2>Injury Report</h2>
          <p className="hint-text">{allInjuries.length} player{allInjuries.length === 1 ? '' : 's'} currently sidelined league-wide.</p>
        </div>
        {controlledTeamId && (
          <div className="code-mode-actions">
            <button className={scope === 'mine' ? 'active' : ''} onClick={() => setScope('mine')}>My Team</button>
            <button className={scope === 'league' ? 'active' : ''} onClick={() => setScope('league')}>League-wide</button>
          </div>
        )}
      </div>

      {injuries.length === 0 ? (
        <p className="empty-state">
          {scope === 'mine' ? 'Nobody on your roster is hurt right now.' : 'The league is fully healthy right now.'}
        </p>
      ) : (
        <table className="db-table">
          <thead>
            <tr><th>Player</th><th>Team</th><th>Severity</th><th>Games Remaining</th><th>Progress</th></tr>
          </thead>
          <tbody>
            {injuries.map((entry) => (
              <tr key={entry.player.playerId} onClick={() => onSelectPlayer(entry.player.playerId)}>
                <td>{entry.player.playerId}</td>
                <td><TeamLink name={entry.teamName} /></td>
                <td>{SEVERITY_LABEL[entry.record.severity] ?? entry.record.severity}</td>
                <td>{entry.record.gamesRemaining}</td>
                <td>{entry.record.totalGames - entry.record.gamesRemaining} of {entry.record.totalGames} games missed</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {affectedTeamIds.length > 0 && (
        <section className="injury-redistribute-section">
          <h4>Short-Handed Rosters</h4>
          <p className="hint-text">
            Teams with injuries whose healthy rotation no longer adds up to a full game (240 player-minutes) can
            auto-redistribute minutes to the players still available.
          </p>
          <table className="db-table">
            <thead><tr><th>Team</th><th>Injured</th><th>Healthy Rotation Minutes</th><th></th></tr></thead>
            <tbody>
              {affectedTeamIds.map((teamId) => {
                const team = league.teams.find((t) => t.teamId === teamId);
                if (!team) return null;
                const count = allInjuries.filter((e) => e.record.teamId === teamId).length;
                const minutes = healthyRotationMinutes(team, league.injuries);
                const short = minutes < 240;
                return (
                  <tr key={teamId}>
                    <td><TeamLink name={team.name} /></td>
                    <td>{count}</td>
                    <td>{minutes} / 240{short ? ' (short)' : ''}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {short && canEditTeam(sandboxMode, controlledTeamId, teamId) && (
                        <button className="play-button secondary" onClick={() => handleRedistribute(teamId)}>
                          Redistribute Minutes
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
