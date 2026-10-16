import type { League } from '../simulation/league';
import { teamGamesPlayed } from '../simulation/league';
import { calculateOverall } from '../simulation/engine/overall';
import { setTwoWay, setCalledUp, twoWayBlocker, twoWayEligible, TWO_WAY_SLOTS, standardRosterCount } from '../simulation/twoWay';
import '../improvements.css';

/** Your Team: two-way contracts (G League), call-ups, and anyone holding out for a new deal. */
export function TwoWayCard({ league, teamId, onChange, onSelectPlayer }: { league: League; teamId: string; onChange: (l: League) => void; onSelectPlayer: (id: string) => void }) {
  const team = league.teams.find(t => t.teamId === teamId);
  if (!team) return null;
  const twoWay = team.seasons.filter(p => p.twoWay);
  const eligible = team.seasons.filter(p => !p.twoWay && twoWayEligible(p)).sort((a, b) => a.age - b.age).slice(0, 6);
  const played = teamGamesPlayed(league, teamId);
  const holdouts = Object.entries(league.holdouts ?? {}).filter(([, h]) => h.teamId === teamId && h.season === league.season && played < h.games);
  const name = (id: string) => <button className="link-button" onClick={() => onSelectPlayer(id)}>{id}</button>;
  return (
    <section className="reset-preview" aria-label="Two-way contracts and holdouts">
      <h4>G League &amp; two-way contracts</h4>
      <p className="hint-text">{TWO_WAY_SLOTS} two-way slots for players 25 or younger. They don't count toward your 15-man roster ({standardRosterCount(team)} standard now), play in the G League and grow a little faster, suit up only when called up, and can't play in the playoffs.</p>
      {twoWay.length > 0 && <table className="db-table"><tbody>{twoWay.map(p => <tr key={p.playerId}>
        <td className="col-name">{name(p.playerId)}</td><td className="num">{calculateOverall(p)} OVR</td><td className="num">{p.age} yrs</td>
        <td>{p.calledUp ? <span className="cv-chip good">Called up</span> : <span className="cv-chip">G League</span>}</td>
        <td><button onClick={() => onChange(setCalledUp(league, teamId, p.playerId, !p.calledUp))}>{p.calledUp ? 'Send down' : 'Call up'}</button>{' '}
          <button onClick={() => onChange(setTwoWay(league, teamId, p.playerId, false))}>Standard contract</button></td>
      </tr>)}</tbody></table>}
      {twoWay.length < TWO_WAY_SLOTS && eligible.length > 0 && <div className="cv-chip-row">{eligible.map(p => (
        <button key={p.playerId} disabled={!!twoWayBlocker(team, p)} title={twoWayBlocker(team, p) ?? 'Move him to a two-way deal'} onClick={() => onChange(setTwoWay(league, teamId, p.playerId, true))}>
          Two-way: {p.playerId} ({calculateOverall(p)})
        </button>))}</div>}
      {twoWay.length === 0 && eligible.length === 0 && <p className="hint-text">Nobody on the roster is young enough and raw enough for a two-way deal.</p>}
      {holdouts.length > 0 && <>
        <h4>Holding out</h4>
        <ul>{holdouts.map(([id, h]) => <li key={id}>{name(id)}: {h.reason}. Misses up to {h.games - played} more game{h.games - played === 1 ? '' : 's'}. An extension or a trade ends it.</li>)}</ul>
      </>}
    </section>
  );
}
