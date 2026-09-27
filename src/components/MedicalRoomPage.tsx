import type { League } from '../simulation/league';
import { calculateOverall } from '../simulation/engine/overall';
import { chooseTreatment, medicalState, pendingDecisions, REST_LABEL, setRestPlan, treatmentOptions, type RestPlan } from '../simulation/medical';
import { PixelIcon } from './PixelIcon';

interface Props {
  league: League;
  controlledTeamId: string | null;
  onChange: (league: League) => void;
  onSelectPlayer: (id: string) => void;
}

/** Injury decisions, who's still out, who's coming back fragile, and load management for the team you run. */
export function MedicalRoomPage({ league, controlledTeamId, onChange, onSelectPlayer }: Props) {
  const team = league.teams.find(t => t.teamId === controlledTeamId);
  if (!team) return <p className="empty-state">The medical room belongs to the team you run.</p>;
  const med = medicalState(league);
  const decisions = pendingDecisions(league, team.teamId);
  const out = Object.values(league.injuries ?? {}).filter(r => r.teamId === team.teamId && r.treatment);
  const fragile = team.seasons.filter(p => med.fragile[p.playerId]);
  const rotation = [...team.seasons].sort((a, b) => b.minutes.target - a.minutes.target || calculateOverall(b) - calculateOverall(a)).slice(0, 10);

  return <div className="medical-room">
    <header><span className="pixel-eyebrow">TRAINING STAFF</span><h2><PixelIcon name="warning" size={24} /> Medical Room</h2></header>

    <section>
      <h3>Decisions</h3>
      {decisions.length === 0 ? <p className="hint-text">No injuries waiting on you. When a player gets hurt, the doctors bring you the options here.</p>
        : decisions.map(inj => <article key={inj.playerId} className="medical-card">
          <p><b><button className="link-button" onClick={() => onSelectPlayer(inj.playerId)}>{inj.playerId}</button></b> · {inj.severity} injury · first estimate {inj.totalGames} game{inj.totalGames === 1 ? '' : 's'}</p>
          <div className="medical-options">{treatmentOptions(inj).map(o => <button key={o.id} onClick={() => onChange(chooseTreatment(league, inj.playerId, o.id))}>
            <b>{o.label}</b><span>{o.games} game{o.games === 1 ? '' : 's'} out · {o.risk}</span><small>{o.detail}</small></button>)}</div>
        </article>)}
    </section>

    <section>
      <h3>Injury report</h3>
      {out.length === 0 ? <p className="hint-text">Nobody else is out.</p>
        : <div className="finances-table-wrap"><table className="db-table"><thead><tr><th className="col-name">Player</th><th>Injury</th><th>Treatment</th><th>Games left</th></tr></thead><tbody>
          {out.map(r => <tr key={r.playerId}><td className="col-name">{r.playerId}</td><td>{r.severity}</td><td>{r.treatment}</td><td>{r.gamesRemaining} of {r.totalGames}</td></tr>)}</tbody></table></div>}
      {fragile.length > 0 && <p className="hint-text">Back but fragile: {fragile.map(p => `${p.playerId} (${med.fragile[p.playerId].gamesLeft} more games at ${med.fragile[p.playerId].mult}× risk)`).join(' · ')}</p>}
    </section>

    <section>
      <h3>Load management</h3>
      <p className="hint-text">Resting a player keeps his workload down, and with it his fatigue and injury risk. Rested games are regular-season only; everyone plays in the playoffs.</p>
      <div className="finances-table-wrap"><table className="db-table"><thead><tr><th className="col-name">Player</th><th>OVR</th><th>Age</th><th>Workload</th><th>Plan</th></tr></thead><tbody>
        {rotation.map(p => { const load = Math.round(p.training?.workload ?? 0); return <tr key={p.playerId}>
          <td className="col-name">{p.playerId}</td><td>{calculateOverall(p)}</td><td>{p.age}</td>
          <td className={load >= 70 ? 'minus' : undefined}>{load}{load >= 70 ? ' (heavy)' : ''}</td>
          <td><select aria-label={`Rest plan for ${p.playerId}`} value={med.rest[p.playerId] ?? 'none'} onChange={e => onChange(setRestPlan(league, p.playerId, e.target.value as RestPlan))}>
            {(Object.keys(REST_LABEL) as RestPlan[]).map(k => <option key={k} value={k}>{REST_LABEL[k]}</option>)}</select></td></tr>; })}
      </tbody></table></div>
    </section>
  </div>;
}
