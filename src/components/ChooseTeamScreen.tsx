import { useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { ExpansionDraftBoard } from './ExpansionDraftBoard';
import { calculateOverall } from '../simulation/engine/overall';
import { PlayerAvatar } from './PlayerAvatar';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  onConfirm: (league: League, extras: GMLeagueExtras, controlledTeamId: string, asOwner?: boolean) => void;
}

export function ChooseTeamScreen({ league, extras, onConfirm }: Props) {
  const [mode, setMode] = useState<'pick' | 'create' | 'own'>('pick');
  const [pickedTeamId, setPickedTeamId] = useState(league.teams[0]?.teamId ?? '');

  const avgOverall = (teamId: string) => {
    const t = league.teams.find((x) => x.teamId === teamId);
    if (!t || t.seasons.length === 0) return 0;
    return Math.round(t.seasons.reduce((s, p) => s + calculateOverall(p), 0) / t.seasons.length);
  };

  const confirmPick = () => onConfirm(league, extras, pickedTeamId);
  const previewPlayers = [...(league.teams.find((team) => team.teamId === pickedTeamId)?.seasons ?? [])]
    .sort((a, b) => calculateOverall(b) - calculateOverall(a)).slice(0, 5);

  return (
    <div className="main-menu">
      <h1 className="menu-title">CHOOSE YOUR TEAM</h1>
      <p className="menu-subtitle">Pick a team to run, or create a brand-new expansion team via an expansion draft.</p>

      <div className="mode-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <button className={`mode-card ${mode === 'pick' ? 'selected' : ''}`} onClick={() => setMode('pick')}>
          <h3>Pick an Existing Team</h3>
          <p>Take over one of the {league.teams.length} generated teams as-is.</p>
        </button>
        <button className={`mode-card ${mode === 'create' ? 'selected' : ''}`} onClick={() => setMode('create')}>
          <h3>Create Your Own Team</h3>
          <p>A real expansion draft: every team files a protection list, then you pick your roster from the exposed players.</p>
        </button>
        <button className={`mode-card ${mode === 'own' ? 'selected' : ''}`} onClick={() => setMode('own')}>
          <h3>Own a Team</h3>
          <p>The Owner's Box: hire a GM to run it, set the goal and the budget, build the arena, vote on the rules.</p>
        </button>
      </div>

      {(mode === 'pick' || mode === 'own') && (
        <div className="team-pick-list">
          <select className="year-input" value={pickedTeamId} onChange={(e) => setPickedTeamId(e.target.value)}>
            {league.teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>{t.name} (avg OVR {avgOverall(t.teamId)})</option>
            ))}
          </select>
          <div className="team-pick-preview" aria-label="Top players on the selected team">
            {previewPlayers.map((player) => <div key={player.playerId}><PlayerAvatar playerId={player.playerId} teamId={player.teamId} jerseyNumber={player.jerseyNumber} age={player.age} size={80} /><strong>{player.playerId}</strong><span>{calculateOverall(player)} OVR</span></div>)}
          </div>
          {mode === 'own'
            ? <button className="primary menu-start" onClick={() => onConfirm(league, extras, pickedTeamId, true)}>Buy the {league.teams.find((t) => t.teamId === pickedTeamId)?.name}</button>
            : <button className="primary menu-start" onClick={confirmPick}>Take Over {league.teams.find((t) => t.teamId === pickedTeamId)?.name}</button>}
        </div>
      )}

      {mode === 'create' && <ExpansionDraftBoard league={league} extras={extras} onDone={onConfirm} />}
    </div>
  );
}
