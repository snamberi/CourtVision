import { useMemo, useState } from 'react';
import type { LeagueTeam } from '../simulation/league';
import { bondList, bondLevel, strongDuos, DUO_BOND, DUO_BOOST } from '../simulation/chemistryWeb';
import { calculateOverall } from '../simulation/engine/overall';
import { PlayerAvatar } from './PlayerAvatar';

const SIZE = 440, R = 176, C = SIZE / 2;
const LINE: Record<ReturnType<typeof bondLevel>, string> = { Duo: '#ffd166', Strong: '#f47b20', Growing: '#4da3ff', New: '#94a0b2' };
const surname = (id: string) => id.split(' ').slice(-1)[0];

/**
 * The chemistry web: the roster in a ring, a line between every two teammates whose bond has started to form.
 * Lines thicken as they play together; gold lines are strong duos. Pick a player to see only his bonds.
 */
export function ChemistryWeb({ team, onSelectPlayer }: { team: LeagueTeam; onSelectPlayer?: (id: string) => void }) {
  const [focus, setFocus] = useState<string | null>(null);
  const players = useMemo(() => [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a)), [team.seasons]);
  const bonds = useMemo(() => bondList(team), [team]);
  const duos = useMemo(() => strongDuos(team), [team]);
  const pos = new Map(players.map((p, i) => { const a = -Math.PI / 2 + (i / players.length) * Math.PI * 2; return [p.playerId, { x: C + Math.cos(a) * R, y: C + Math.sin(a) * R }]; }));
  const shown = focus ? bonds.filter(b => b.a === focus || b.b === focus) : bonds;
  const best = focus ? shown[0] : null;
  return <section className="chem-web" aria-label="Chemistry web">
    <div className="locker-room-head"><span className="section-label">CHEMISTRY WEB</span>
      <span>Strong duos <b>{duos.length}</b></span><span>Bonds <b>{bonds.length}</b></span></div>
    <div className="chem-web-body">
      <div className="chem-web-map" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
          <circle cx={C} cy={C} r={R} fill="none" stroke="#2a3546" strokeDasharray="4 6" />
          {shown.slice().reverse().map(b => { const p = pos.get(b.a), q = pos.get(b.b); if (!p || !q) return null; const lvl = bondLevel(b.bond);
            return <line key={b.key} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={LINE[lvl]} strokeWidth={1 + b.bond / 18} strokeOpacity={.25 + b.bond / 140} strokeLinecap="square" className={lvl === 'Duo' ? 'chem-duo-line' : undefined} />; })}
        </svg>
        {players.map(p => { const at = pos.get(p.playerId)!; const inDuo = duos.some(d => d.a === p.playerId || d.b === p.playerId);
          return <button key={p.playerId} className={`chem-node${focus === p.playerId ? ' active' : ''}${inDuo ? ' duo' : ''}`} style={{ left: at.x, top: at.y }}
            onClick={() => setFocus(focus === p.playerId ? null : p.playerId)} aria-pressed={focus === p.playerId} title={`${p.playerId}: show his bonds`}>
            <PlayerAvatar playerId={p.playerId} teamId={team.teamId} jerseyNumber={p.jerseyNumber} age={p.age} size={34} />
            <span>{surname(p.playerId)}</span>
          </button>; })}
      </div>
      <div className="chem-web-side">
        {focus ? <>
          <h5>{focus}</h5>
          {shown.length ? <ol className="chem-list">{shown.slice(0, 8).map(b => { const other = b.a === focus ? b.b : b.a; return <li key={b.key}>
            <button className="linkish" onClick={() => onSelectPlayer?.(other)}>{other}</button><span className={`chem-tag chem-${bondLevel(b.bond).toLowerCase()}`}>{bondLevel(b.bond)}</span><b>{Math.round(b.bond)}</b></li>; })}</ol>
            : <p className="hint-text">No bonds yet: he needs real minutes next to his teammates.</p>}
          {best && best.bond < DUO_BOND && <p className="hint-text">Closest to a duo: {best.a === focus ? best.b : best.a}, {Math.ceil(DUO_BOND - best.bond)} points away.</p>}
          <button onClick={() => setFocus(null)}>Show everyone</button>
        </> : <>
          <h5>Strong duos</h5>
          {duos.length ? <ol className="chem-list">{duos.map(d => <li key={d.key}><span>{surname(d.a)} + {surname(d.b)}</span><span className="chem-tag chem-duo">Duo</span><b>{Math.round(d.bond)}</b></li>)}</ol>
            : <p className="hint-text">None yet. Two players become a duo at a bond of {DUO_BOND}.</p>}
          <ul className="chem-legend">
            <li><i style={{ background: LINE.Duo }} /> Duo: +{DUO_BOOST} decision-making and help defense for both when they both dress, and their own callout on the court.</li>
            <li><i style={{ background: LINE.Strong }} /> Strong <i style={{ background: LINE.Growing }} /> Growing <i style={{ background: LINE.New }} /> New</li>
          </ul>
          <p className="hint-text">Bonds grow every game two players both log real minutes; the more minutes, the faster. One buried on the bench while the other plays weakens it, and a trade breaks it.</p>
        </>}
      </div>
    </div>
  </section>;
}
