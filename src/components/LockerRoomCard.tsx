import { useState } from 'react';
import type { League } from '../simulation/league';
import { lockerState, answerLocker, type LockerEvent } from '../simulation/lockerRoom';
import { PlayerAvatar } from './PlayerAvatar';
import { PixelIcon } from './PixelIcon';

const KIND_LABEL: Record<LockerEvent['kind'], string> = { mentor: 'MENTOR', click: 'CHEMISTRY', clash: 'LOCKER ROOM', role: 'ROLE', rehab: 'INJURY CHECK-IN', comeback: 'COMEBACK' };

/** The dashboard's locker-room moments: a decision with the players' faces, and what your last calls did. */
export function LockerRoomCard({ league, teamId, onChange }: { league: League; teamId: string; onChange: (l: League) => void }) {
  const st = lockerState(league);
  const [last, setLast] = useState<string | null>(null);
  const ev = st.pending[0];
  if (!ev && !last && !st.log.length) return null;
  return <section className="dashboard-panel locker-moment" aria-label="Locker room">
    <h5><PixelIcon name="team" size={14} /> Locker room{st.pending.length > 1 ? ` · ${st.pending.length} waiting` : ''}</h5>
    {ev ? <div className="locker-event">
      <div className="locker-faces">{ev.players.map(p => <PlayerAvatar key={p} playerId={p} teamId={teamId} mode="portrait" size={44} title={p} />)}</div>
      <div><span className="pixel-eyebrow">{KIND_LABEL[ev.kind]}</span><b>{ev.title}</b><p>{ev.text}</p>
        <div className="locker-choices">{ev.choices.map(c => <button key={c.id} onClick={() => { const r = answerLocker(league, ev.id, c.id); setLast(r.result); onChange(r.league); }}>{c.text}</button>)}</div></div>
    </div> : <p className="hint-text">{last ?? 'All quiet. The next moment comes in a couple of weeks.'}</p>}
    {ev && last && <p className="hint-text">Last call: {last}</p>}
    {st.log.length > 0 && <details className="locker-log"><summary>Your calls this season ({st.log.filter(r => r.season === league.season).length})</summary>
      <ul>{[...st.log].reverse().slice(0, 8).map(r => <li key={r.id}><b>{r.title}</b>: {r.choice}. <small>{r.result}</small></li>)}</ul></details>}
  </section>;
}
