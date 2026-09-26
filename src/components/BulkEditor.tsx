import { useState } from 'react';
import type { LeagueTeam } from '../simulation/league';

interface Props {
  teams: LeagueTeam[];
  onApply: (teams: LeagueTeam[]) => void;
}

const ATTRIBUTE_PATHS: { label: string; group: 'offense' | 'defense' | 'physical' | 'mental'; key: string }[] = [
  { label: 'Offense: 3PT', group: 'offense', key: 'threePoint' },
  { label: 'Offense: Ball Handling', group: 'offense', key: 'ballHandling' },
  { label: 'Offense: Ball Security', group: 'offense', key: 'ballSecurity' },
  { label: 'Offense: Passing', group: 'offense', key: 'passing' },
  { label: 'Offense: Finishing', group: 'offense', key: 'finishing' },
  { label: 'Defense: Perimeter Defense', group: 'defense', key: 'perimeterDefense' },
  { label: 'Defense: Block', group: 'defense', key: 'block' },
  { label: 'Defense: Steal', group: 'defense', key: 'steal' },
  { label: 'Physical: Speed', group: 'physical', key: 'speed' },
  { label: 'Physical: Stamina', group: 'physical', key: 'stamina' },
  { label: 'Mental: Clutch', group: 'mental', key: 'clutch' },
];

export function BulkEditor({ teams, onApply }: Props) {
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'PG' | 'SG' | 'SF' | 'PF' | 'C'>('ALL');
  const [attrIdx, setAttrIdx] = useState(0);
  const [delta, setDelta] = useState(5);
  const [lastAppliedCount, setLastAppliedCount] = useState<number | null>(null);

  const apply = () => {
    const attr = ATTRIBUTE_PATHS[attrIdx];
    let count = 0;
    const nextTeams = teams.map((t) => {
      if (teamFilter !== 'ALL' && t.teamId !== teamFilter) return t;
      const seasons = t.seasons.map((s) => {
        if (positionFilter !== 'ALL' && s.positions[positionFilter] < 50) return s;
        count++;
        const group = { ...(s.attributes as any)[attr.group] };
        group[attr.key] = group[attr.key] + delta;
        return { ...s, attributes: { ...s.attributes, [attr.group]: group } };
      });
      return { ...t, seasons };
    });
    onApply(nextTeams);
    setLastAppliedCount(count);
  };

  return (
    <div className="bulk-editor">
      <h4>Bulk Editor</h4>
      <label className="rating-row">
        <span className="rating-label">Team</span>
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
          <option value="ALL">All Teams</option>
          {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
        </select>
      </label>
      <label className="rating-row">
        <span className="rating-label">Position (suitability &gt;= 50)</span>
        <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value as any)}>
          <option value="ALL">All Positions</option>
          <option value="PG">PG</option>
          <option value="SG">SG</option>
          <option value="SF">SF</option>
          <option value="PF">PF</option>
          <option value="C">C</option>
        </select>
      </label>
      <label className="rating-row">
        <span className="rating-label">Attribute</span>
        <select value={attrIdx} onChange={(e) => setAttrIdx(Number(e.target.value))}>
          {ATTRIBUTE_PATHS.map((a, i) => <option key={a.label} value={i}>{a.label}</option>)}
        </select>
      </label>
      <label className="rating-row">
        <span className="rating-label">Delta</span>
        <input type="number" className="rating-number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
      </label>
      <button className="primary" onClick={apply}>Apply to matching players</button>
      {lastAppliedCount != null && <p className="hint-text">Applied to {lastAppliedCount} player(s).</p>}
    </div>
  );
}
