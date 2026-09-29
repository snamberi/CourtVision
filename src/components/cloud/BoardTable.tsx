import { useEffect, useState } from 'react';
import { loadBoard, type BoardSpec, type BoardResult, type BoardRow } from '../../cloud/boards';
import { baseline, loadRankHistory, rankChange, recordRanks, saveRankHistory, YOU, type RankSnapshot } from '../../cloud/rankHistory';
import { NameTag } from '../ProfileIcon';
import { PixelIcon } from '../PixelIcon';

/** Boards that last long enough for rank changes to mean something (not a single day, week or league code). */
const trackedBoard = (spec: BoardSpec): string | null =>
  spec.kind === 'daily' || spec.kind === 'weekly' || spec.kind === 'code' || (spec.kind === 'players' && spec.week) ? null : JSON.stringify(spec);

/** Keeps today's ranks for a board and returns the snapshot to compare against (last week's, or the oldest kept). */
function trackRanks(spec: BoardSpec, d: BoardResult): { base: RankSnapshot | null; since?: string } {
  const board = trackedBoard(spec);
  if (!board) return { base: null };
  const now = Date.now();
  const history = loadRankHistory(board);
  const ranks: Record<string, number> = Object.fromEntries(d.rows.map(r => [r.userId, r.rank]));
  if (d.you) ranks[YOU] = d.you.rank;
  saveRankHistory(board, recordRanks(history, ranks, now));
  const base = baseline(history, now);
  const ago = base ? Math.floor(now / 86_400_000) - base.day : 0;
  return { base, since: ago >= 7 ? 'last week' : ago === 1 ? 'yesterday' : `${ago} days ago` };
}

function Move({ change, since }: { change: number | 'new' | null; since: string }) {
  if (change == null) return null;
  if (change === 'new') return <span className="wb-move new" title={`New on the board since ${since}`}>NEW</span>;
  if (change === 0) return <span className="wb-move same" title={`Same rank as ${since}`} aria-label="No change">–</span>;
  return <span className={`wb-move ${change > 0 ? 'up' : 'down'}`} title={`${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} since ${since}`}><PixelIcon name={change > 0 ? 'up' : 'down'} size={12} />{Math.abs(change)}</span>;
}

const MEDAL = ['GOLD', 'SILVER', 'BRONZE'];

/** One online leaderboard: the top three on a podium, the rest in a table, and your own rank pinned at the bottom. */
export function BoardTable({ spec, scoreLabel, onUser, empty = 'No one on this board yet.', limit = 100 }: { spec: BoardSpec; scoreLabel: string; onUser?: (username: string) => void; empty?: string; limit?: number }) {
  const key = JSON.stringify(spec);
  const [res, setRes] = useState<{ key: string; data?: BoardResult; base?: RankSnapshot | null; since?: string; error?: string } | null>(null);
  useEffect(() => {
    let live = true;
    loadBoard(spec, limit).then(d => { if (live) setRes({ key, data: d, ...trackRanks(spec, d) }); }, e => { if (live) setRes({ key, error: e instanceof Error ? e.message : String(e) }); });
    return () => { live = false; };
  }, [key, limit]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = res?.key === key ? res : null;
  if (!cur) return <p className="hint-text" role="status">Loading the board…</p>;
  if (cur.error) return <p className="empty-state">The leaderboard is not available right now. {cur.error.includes('fetch') ? 'Check your connection.' : ''}</p>;
  const d = cur.data!;
  if (!d.rows.length) return <p className="empty-state">{empty}</p>;
  const base = cur.base ?? null;
  const since = cur.since ?? 'last week';
  const name = (r: BoardRow) => onUser && r.username ? <button className="link-button name-link" onClick={() => onUser(r.username)}><NameTag name={r.username} icon={r.icon} color={r.color} title={r.title} /></button> : <NameTag name={r.username} icon={r.icon} color={r.color} title={r.title} />;
  const podium = d.rows.filter(r => r.rank <= 3).slice(0, 3);
  const rest = d.rows.filter(r => !podium.includes(r));
  const mine = d.rows.find(r => r.you);
  const you = d.you ?? (mine ? { rank: mine.rank, score: mine.score } : null);
  return <>
    {podium.length > 0 && <ol className="wb-podium" aria-label="Top three">{[podium[1], podium[0], podium[2]].map(r => r && <li key={r.userId} className={`wb-step p${r.rank} ${r.you ? 'wb-you' : ''}`}>
      <span className="wb-who">{name(r)}{r.you ? <small> (you)</small> : null}</span>
      <b className="wb-pscore">{r.score.toLocaleString()} <small>{scoreLabel}</small></b>
      <Move since={since} change={rankChange(base, r.userId, r.rank)} />
      <span className="wb-block" aria-label={`Rank ${r.rank}`}><i>{r.rank}</i><small>{MEDAL[r.rank - 1]}</small></span>
    </li>)}</ol>}
    {rest.length > 0 && <div className="feature-table-scroll"><table className="db-table wb-table">
      <thead><tr><th>#</th><th className="col-name">GM</th><th>{scoreLabel}</th><th className="col-name">Result</th></tr></thead>
      <tbody>{rest.map(r => <tr key={`${r.userId}-${r.rank}`} className={r.you ? 'wb-you' : ''}>
        <td>{r.rank} <Move since={since} change={rankChange(base, r.userId, r.rank)} /></td>
        <td className="col-name">{name(r)}{r.you ? ' (you)' : ''}</td>
        <td>{r.score.toLocaleString()}</td><td className="col-name">{r.detail}</td>
      </tr>)}</tbody>
    </table></div>}
    {you && <div className="wb-pinned" role="status">
      <span className="wb-pin-rank">#{you.rank.toLocaleString()}</span>
      <span className="wb-pin-name">{mine ? name(mine) : 'You'}</span>
      <Move since={since} change={rankChange(base, YOU, you.rank)} />
      <b>{you.score.toLocaleString()} <small>{scoreLabel}</small></b>
      <small className="wb-pin-of">of {d.total.toLocaleString()}</small>
    </div>}
    <p className="hint-text">{d.total.toLocaleString()} on this board{base ? ` · arrows show rank changes since ${since}` : ''}.</p>
  </>;
}
