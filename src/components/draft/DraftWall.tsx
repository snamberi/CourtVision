import { useMemo } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import type { HuntCard } from '../../hunt/cards';
import { draftPool, onClock, ROUNDS, type DraftState } from '../../draft/allTimeDraft';
import { pickVerdict } from '../../draft/wall';
import { PlayerAvatar } from '../PlayerAvatar';

/*
 * The draft wall: every team (in draft order) by every round, filling in as the picks come, like the big board on
 * draft night. Your row is lit, the pick on the clock pulses, the newest picks flash in, and a pick taken far after
 * (or before) where the board had him is marked a steal (or a reach).
 */

const lastName = (name: string) => name.split(' ').slice(-1)[0];

export function DraftWall({ h, s }: { h: NbaHistory; s: DraftState }) {
  const pool = draftPool(h);
  const byId = useMemo(() => new Map<string, HuntCard>(pool.map(c => [c.id, c])), [pool]);
  const boardRank = useMemo(() => new Map(pool.map((c, i) => [c.id, i + 1])), [pool]);
  const me = s.config.userTeam;
  const clock = onClock(s);
  const cell = new Map(s.picks.map(p => [`${p.teamId}:${Math.ceil(p.overall / s.order.length)}`, p]));
  const newest = new Set(s.picks.slice(-8).map(p => p.overall));
  const teamName = (id: string) => s.config.teams.find(t => t.id === id)?.name ?? id;
  const steals = s.picks.filter(p => pickVerdict(p.overall, boardRank.get(p.cardId) ?? p.overall) === 'steal').length;
  return <div className="draft-wall-wrap">
    <p className="hint-text">{s.picks.length} of {s.order.length * ROUNDS} picks · {steals} steal{steals === 1 ? '' : 's'} so far. A steal went 15+ picks after his spot on the board; a reach went 25+ before it.</p>
    <div className="draft-wall-scroll" role="region" aria-label="Draft wall" tabIndex={0}>
      <table className="draft-wall">
        <thead><tr><th scope="col" className="dw-team">Team</th>{Array.from({ length: ROUNDS }, (_, r) => <th key={r} scope="col">R{r + 1}</th>)}</tr></thead>
        <tbody>{s.order.map(teamId => <tr key={teamId} className={teamId === me ? 'mine' : ''}>
          <th scope="row" className="dw-team">{teamName(teamId)}</th>
          {Array.from({ length: ROUNDS }, (_, r) => {
            const p = cell.get(`${teamId}:${r + 1}`);
            const onIt = !p && clock?.teamId === teamId && clock.round === r + 1;
            if (!p) return <td key={r} className={onIt ? 'dw-clock' : 'dw-empty'}>{onIt ? <span>ON THE CLOCK</span> : null}</td>;
            const c = byId.get(p.cardId);
            const verdict = pickVerdict(p.overall, boardRank.get(p.cardId) ?? p.overall);
            return <td key={r} className={`dw-pick ${newest.has(p.overall) ? 'dw-new' : ''} ${verdict ?? ''}`} title={c ? `#${p.overall} overall: ${c.name} (${c.pos}, ${c.end}) · ${c.ovr} · board #${boardRank.get(p.cardId)}` : ''}>
              {c && <PlayerAvatar playerId={c.name} mode="portrait" size={22} primaryColor="#2f6fb8" secondaryColor="#f4f0e6" />}
              <span className="dw-name">{c ? lastName(c.name) : '?'}</span>
              <span className="dw-meta">{c?.ovr}{verdict && <b>{verdict === 'steal' ? 'STEAL' : 'REACH'}</b>}</span>
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
