import { useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { tradeableFuturePicks } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { validateThreeTeam, threeTeamSides, threeTeamCounter, executeThreeTeam, type AssetMove, type ThreeTeamTrade } from '../simulation/threeTeamTrade';
import { TeamLogo } from './TeamLogo';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  onChange: (league: League, extras: GMLeagueExtras) => void;
}

/** Build a deal between your team and two others: send each player or pick to either partner. */
export function ThreeTeamTradePage({ league, extras, controlledTeamId, onChange }: Props) {
  const others = league.teams.filter(t => t.teamId !== controlledTeamId);
  const [b, setB] = useState(others[0]?.teamId ?? '');
  const [c, setC] = useState(others[1]?.teamId ?? '');
  const [moves, setMoves] = useState<AssetMove[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [counter, setCounter] = useState<{ trade: ThreeTeamTrade; text: string } | null>(null);
  if (!controlledTeamId) return <p className="empty-state">Three-team trades start from the team you run.</p>;
  const ids: [string, string, string] = [controlledTeamId, b, c];
  const trade: ThreeTeamTrade = { teams: ids, moves };
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const sides = new Set(ids).size === 3 ? threeTeamSides(league, extras, trade) : [];
  const setDest = (kind: AssetMove['kind'], id: string, from: string, to: string) => {
    setCounter(null); setMessage(null);
    setMoves(ms => [...ms.filter(m => !(m.kind === kind && m.id === id)), ...(to ? [{ kind, id, from, to }] : [])]);
  };
  const dest = (kind: AssetMove['kind'], id: string) => moves.find(m => m.kind === kind && m.id === id)?.to ?? '';
  const reset = () => { setMoves([]); setCounter(null); };

  const propose = () => {
    const reasons = validateThreeTeam(league, extras, trade, controlledTeamId);
    if (!reasons.length) { const r = executeThreeTeam(league, extras, trade); onChange(r.league, r.extras); reset(); setMessage('Three-team deal done.'); return; }
    const answer = threeTeamCounter(league, extras, trade, controlledTeamId);
    setCounter(answer);
    setMessage(answer ? null : reasons.join(' '));
  };
  const acceptCounter = () => {
    if (!counter) return;
    if (validateThreeTeam(league, extras, counter.trade, controlledTeamId).length) { setCounter(null); setMessage('That counter is no longer on the table.'); return; }
    const r = executeThreeTeam(league, extras, counter.trade); onChange(r.league, r.extras); reset(); setMessage('Three-team deal done on their terms.');
  };

  const column = (teamId: string, pickTeam?: (v: string) => void) => {
    const team = league.teams.find(t => t.teamId === teamId);
    if (!team) return null;
    const targets = ids.filter(x => x !== teamId);
    const select = (kind: AssetMove['kind'], id: string) => <select aria-label={`Send ${id}`} value={dest(kind, id)} onChange={e => setDest(kind, id, teamId, e.target.value)}>
      <option value="">Keeps</option>{targets.map(t => <option key={t} value={t}>→ {name(t)}</option>)}</select>;
    const side = sides.find(s => s.teamId === teamId);
    return <section className="three-team-col">
      <header><TeamLogo team={team} size={28} />
        {pickTeam ? <select value={teamId} onChange={e => { pickTeam(e.target.value); reset(); }}>{others.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select> : <b>{team.name}</b>}</header>
      {side && <p className={`three-team-verdict ${side.ok || teamId === controlledTeamId ? 'ok' : 'no'}`}>Gives {side.give.toFixed(0)} · gets {side.receive.toFixed(0)}{teamId === controlledTeamId ? '' : side.ok ? ' · on board' : ' · wants more'}</p>}
      <ul>{[...team.seasons].sort((x, y) => calculateOverall(y) - calculateOverall(x)).map(p => <li key={p.playerId}><span>{p.playerId} <small>{calculateOverall(p)} OVR</small></span>{select('player', p.playerId)}</li>)}
        {tradeableFuturePicks(extras, teamId).map(pk => <li key={pk.id}><span>{pk.year} R{pk.round} pick{pk.originalTeamId !== teamId ? <small> via {name(pk.originalTeamId)}</small> : null}</span>{select('pick', pk.id)}</li>)}</ul>
    </section>;
  };

  return <div className="three-team-page">
    <header><span className="pixel-eyebrow">FRONT OFFICE</span><h2>Three-team trade</h2>
      <p className="hint-text">Send each player or pick to either partner. Every front office judges its own side of the deal; if one wants more, it will say what it needs from you.</p></header>
    <div className="three-team-grid">{column(controlledTeamId)}{column(b, v => setB(v))}{column(c, v => setC(v))}</div>
    {new Set(ids).size !== 3 && <p className="hint-text" role="alert">Pick two different partners.</p>}
    <div className="trade-counter-actions"><button className="primary" disabled={!moves.length || new Set(ids).size !== 3} onClick={propose}>Propose deal</button><button onClick={reset}>Clear</button></div>
    {counter && <div className="trade-counter" role="group" aria-label="Counter-offer"><span className="pixel-eyebrow">COUNTER-OFFER</span><p>{counter.text}</p>
      <div className="trade-counter-actions"><button className="primary" onClick={acceptCounter}>Accept counter</button><button onClick={() => { setMoves(counter.trade.moves); setCounter(null); }}>Put it in the builder</button><button onClick={() => setCounter(null)}>Decline</button></div></div>}
    {message && <p className="hint-text" role="status">{message}</p>}
  </div>;
}
