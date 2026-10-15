import { useState } from 'react';
import type { League, LeagueTeam } from '../simulation/league';
import { canDropPlayer, waiveToFreeAgency, type GMLeagueExtras } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { primaryPosition } from '../simulation/teamStatus';
import { isStuck } from '../simulation/sticky';
import { shortMoney } from '../lib/humanize';
import './waivePanel.css';
import { PlayerNameTag } from './PlayerAvatar';

/**
 * Waive from the signing screen: your roster sorted by overall, each with a two-step Waive button (tap, then
 * Confirm) so a misclick never releases anyone. Uses the same rules as the Re-sign / Waive phase.
 */
export function WaivePanel({ league, extras, team, controlledTeamId, onChange, onSelectPlayer }: {
  league: League; extras: GMLeagueExtras; team: LeagueTeam; controlledTeamId: string | null;
  onChange: (league: League, extras: GMLeagueExtras) => void; onSelectPlayer: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const atMinimum = !canDropPlayer(team, extras.capSettings);
  const roster = [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a));
  const waive = (playerId: string) => {
    const r = waiveToFreeAgency(league, extras, playerId, team.teamId, controlledTeamId);
    setConfirm(null);
    if (r.league === league) { setNote(`${playerId} can't be waived right now.`); return; }
    setNote(`Waived ${playerId}. He's now a free agent.`);
    onChange(r.league, r.extras);
  };
  return <section className="waive-panel" aria-label="Waive a player">
    <h4>Waive a player</h4>
    <p className="hint-text">Waived players join the free-agent pool and their salary comes off your books. {atMinimum ? `You're at or below the usual minimum (${extras.capSettings.minRosterSize}); you can still waive, and games play either way.` : ''}</p>
    {note && <p className="hint-text" role="status">{note}</p>}
    <div className="waive-scroll"><table className="db-table stat-line-table">
      <thead><tr><th className="col-name">Name</th><th>Pos</th><th>Ovr</th><th>Salary</th><th>Actions</th></tr></thead>
      <tbody>{roster.map(s => {
        const stuck = isStuck(s), salary = extras.contracts[s.playerId]?.annualSalary;
        return <tr key={s.playerId}>
          <td className="col-name"><button className="link-button" onClick={() => onSelectPlayer(s.playerId)}><PlayerNameTag playerId={s.playerId} /></button></td>
          <td>{primaryPosition(s)}</td>
          <td>{calculateOverall(s)}</td>
          <td>{salary ? shortMoney(salary) : '-'}</td>
          <td>{confirm === s.playerId
            ? <span className="waive-confirm"><button className="danger" onClick={() => waive(s.playerId)}>Confirm waive</button><button onClick={() => setConfirm(null)}>Cancel</button></span>
            : <button disabled={atMinimum || stuck} title={stuck ? 'Locked to this team in Sandbox' : undefined} onClick={() => setConfirm(s.playerId)}>Waive</button>}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </section>;
}
