import { TeamLink } from './TeamLink';
import { TeamIdentityPanel } from './TeamIdentityPanel';
import { useState } from 'react';
import type { League } from '../simulation/league';
import { computeStandings } from '../simulation/league';
import {
  computeTeamOverallSum, computeTeamOverallAverage, computeTeamStatus, teamLeader,
  getRotationOrder, moveInRotation, moveToPosition, primaryPosition,
} from '../simulation/teamStatus';
import { calculateOverall } from '../simulation/engine/overall';
import { computeTradeValue } from '../simulation/gm';
import { perGameAverages } from '../simulation/careerStats';
import type { PlayerSeason } from '../simulation/types';
import { StarIcon } from './Icons';

interface Props {
  currentChampion?: string | null;
  league: League;
  controlledTeamId: string;
  onSelectPlayer: (playerId: string) => void;
  onChange?: (league: League) => void;
}

export function YourTeamPage({ league, controlledTeamId, onSelectPlayer, onChange, currentChampion }: Props) {
  const team = league.teams.find((t) => t.teamId === controlledTeamId);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  if (!team) return <p className="empty-state">Your team could not be found.</p>;

  const standings = computeStandings(league);
  const row = standings.find((r) => r.teamId === controlledTeamId) ?? null;
  const status = computeTeamStatus(team, row);
  const overallSum = computeTeamOverallSum(team);
  const overallAvg = computeTeamOverallAverage(team);
  const leader = teamLeader(team);

  const order = getRotationOrder(team);
  const seasonById = new Map(team.seasons.map((s) => [s.playerId, s]));
  const starters = order.slice(0, 5).map((id) => seasonById.get(id)).filter((s): s is PlayerSeason => !!s);
  const bench = order.slice(5).map((id) => seasonById.get(id)).filter((s): s is PlayerSeason => !!s);

  const applyTeamUpdate = (updatedTeam: typeof team) => {
    onChange?.({ ...league, teams: league.teams.map((t) => (t.teamId === team.teamId ? updatedTeam : t)) });
  };

  const move = (playerId: string, direction: 'up' | 'down') => {
    if (!onChange) return;
    applyTeamUpdate(moveInRotation(team, playerId, direction));
  };

  const handleDrop = (targetId: string) => {
    if (!onChange || !draggingId || draggingId === targetId) { setDraggingId(null); return; }
    applyTeamUpdate(moveToPosition(team, draggingId, targetId));
    setDraggingId(null);
  };

  const renderRow = (s: PlayerSeason, index: number, sectionSize: number) => {
    const injury = league.injuries?.[s.playerId];
    const isInjured = !!injury && injury.gamesRemaining > 0;
    const avg = perGameAverages(s.seasonStats);
    const isLeader = leader?.playerId === s.playerId;
    const isHighlighted = highlightedId === s.playerId;

    return (
      <tr
        key={s.playerId}
        className={`${isHighlighted ? 'row-highlighted' : ''} ${draggingId === s.playerId ? 'row-dragging' : ''}`}
        draggable={!!onChange}
        onDragStart={() => setDraggingId(s.playerId)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDrop(s.playerId)}
        onDragEnd={() => setDraggingId(null)}
        onClick={() => setHighlightedId((cur) => (cur === s.playerId ? null : s.playerId))}
      >
        <td className="rotation-order-cell">
          {onChange && (
            <span className="rotation-arrows">
              <button disabled={index === 0} onClick={(e) => { e.stopPropagation(); move(s.playerId, 'up'); }} title="Move up">▲</button>
              <button disabled={index === sectionSize - 1} onClick={(e) => { e.stopPropagation(); move(s.playerId, 'down'); }} title="Move down">▼</button>
            </span>
          )}
        </td>
        <td onClick={(e) => { e.stopPropagation(); onSelectPlayer(s.playerId); }} style={{ cursor: 'pointer' }}>
          {isLeader && <StarIcon className="inline-star" />}
          {s.playerId}{isInjured && <span className="injury-plus">+</span>}
        </td>
        <td>{primaryPosition(s)}</td>
        <td>{s.age}</td>
        <td>{calculateOverall(s)}</td>
        <td>{s.development.potential.toFixed(0)}</td>
        <td>{computeTradeValue(s).toFixed(0)}</td>
        <td>{avg.gamesPlayed > 0 ? avg.ppg.toFixed(1) : '—'}</td>
        <td>{avg.gamesPlayed > 0 ? avg.rpg.toFixed(1) : '—'}</td>
        <td>{avg.gamesPlayed > 0 ? avg.apg.toFixed(1) : '—'}</td>
        <td>{avg.gamesPlayed > 0 ? avg.mpg.toFixed(1) : '—'}</td>
        <td>{avg.gamesPlayed > 0 ? avg.efficiency.toFixed(1) : '—'}</td>
        <td>{isInjured ? <span className="injury-out-tag">{injury!.gamesRemaining}d</span> : ''}</td>
      </tr>
    );
  };

  const headerRow = (
    <tr>
      <th></th><th>Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>POT</th><th>Trade Value</th>
      <th>PPG</th><th>RPG</th><th>APG</th><th>MPG</th><th>EFF</th><th>Status</th>
    </tr>
  );

  return (
    <div className="your-team-page">
      <TeamIdentityPanel team={team} history={league.franchiseHistory} currentChampion={currentChampion} currentSeason={league.season} onChange={onChange ? identity => applyTeamUpdate({ ...team, identity }) : undefined} />
      <div className="yt-header">
        <div>
          <h2><TeamLink name={team.name} /></h2>
          <p className={`yt-status yt-status-${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</p>
        </div>
        <div className="yt-stats">
          <div><span className="qs-label">Team Overall (sum)</span><span className="qs-value">{overallSum}</span></div>
          <div><span className="qs-label">Avg Overall</span><span className="qs-value">{overallAvg.toFixed(1)}</span></div>
          {row && <div><span className="qs-label">Record</span><span className="qs-value">{row.wins}-{row.losses}</span></div>}
        </div>
      </div>

      {onChange && (
        <p className="hint-text">
          Drag a row onto another to reorder the depth chart, or use the ▲▼ arrows. The top 5 are your starters.
          Click a row to highlight it; click a player's name to open their profile.
        </p>
      )}

      <h4 className="rotation-section-title">Starters</h4>
      <table className="db-table roster-table" data-tour="rotation">
        <thead>{headerRow}</thead>
        <tbody>{starters.map((s, i) => renderRow(s, i, starters.length))}</tbody>
      </table>

      <h4 className="rotation-section-title">Bench</h4>
      <table className="db-table roster-table">
        <thead>{headerRow}</thead>
        <tbody>{bench.map((s, i) => renderRow(s, i, bench.length))}</tbody>
      </table>
    </div>
  );
}
