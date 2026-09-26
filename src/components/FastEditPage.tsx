import { useState } from 'react';
import type { LeagueTeam } from '../simulation/league';
import type { PlayerSeason } from '../simulation/types';
import { calculateOverall } from '../simulation/engine/overall';

interface Props {
  teams: LeagueTeam[];
  sandboxMode: boolean;
  onUpdatePlayer: (teamId: string, next: PlayerSeason) => void;
  onSelectPlayer: (playerId: string) => void;
}

const COLUMNS: { key: string; label: string; group: 'offense' | 'defense' | 'development' }[] = [
  { key: 'threePoint', label: '3PT', group: 'offense' },
  { key: 'ballHandling', label: 'Handle', group: 'offense' },
  { key: 'finishing', label: 'Finish', group: 'offense' },
  { key: 'passing', label: 'Pass', group: 'offense' },
  { key: 'perimeterDefense', label: 'Perim Def', group: 'defense' },
  { key: 'block', label: 'Block', group: 'defense' },
  { key: 'defensiveRebounding', label: 'DReb', group: 'defense' },
  { key: 'potential', label: 'POT', group: 'development' },
];

export function FastEditPage({ teams, sandboxMode, onUpdatePlayer, onSelectPlayer }: Props) {
  const [teamId, setTeamId] = useState(teams[0]?.teamId ?? '');
  const team = teams.find((t) => t.teamId === teamId) ?? teams[0];
  const max = sandboxMode ? 200 : 99;

  const setValue = (season: PlayerSeason, col: (typeof COLUMNS)[number], value: number) => {
    if (!team) return;
    if (col.group === 'development') {
      onUpdatePlayer(team.teamId, { ...season, development: { ...season.development, potential: value } });
    } else {
      const groupObj = { ...(season.attributes as any)[col.group], [col.key]: value };
      onUpdatePlayer(team.teamId, { ...season, attributes: { ...season.attributes, [col.group]: groupObj } });
    }
  };

  const getValue = (season: PlayerSeason, col: (typeof COLUMNS)[number]): number => {
    if (col.group === 'development') return season.development.potential;
    return (season.attributes as any)[col.group][col.key];
  };

  return (
    <div className="fast-edit-page">
      <p className="hint-text">
        Inline editing for the most-used ratings across the whole roster at once. Actual ratings
        (everything but Potential) are still locked outside Sandbox Mode.
      </p>
      <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
        {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
      </select>

      {team && (
        <table className="fast-edit-table">
          <thead>
            <tr>
              <th>Player</th><th>Age</th><th>OVR</th>
              {COLUMNS.map((c) => <th key={c.label}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {team.seasons.map((s) => (
              <tr key={s.playerId}>
                <td className="fe-name" onClick={() => onSelectPlayer(s.playerId)}>{s.playerId}</td>
                <td>{s.age}</td>
                <td>{calculateOverall(s)}</td>
                {COLUMNS.map((c) => {
                  const locked = c.group !== 'development' && !sandboxMode;
                  return (
                    <td key={c.label}>
                      <input
                        type="number" className="fe-input" min={0} max={max} disabled={locked}
                        value={getValue(s, c)}
                        onChange={(e) => setValue(s, c, Number(e.target.value))}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
