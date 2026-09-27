import { useEffect, useState } from 'react';
import { loadBoard, type BoardSpec, type BoardResult } from '../../cloud/boards';

/** One online leaderboard: top rows, your row highlighted, and your rank when you are further down. */
export function BoardTable({ spec, scoreLabel, onUser, empty = 'No one on this board yet.', limit = 100 }: { spec: BoardSpec; scoreLabel: string; onUser?: (username: string) => void; empty?: string; limit?: number }) {
  const key = JSON.stringify(spec);
  const [res, setRes] = useState<{ key: string; data?: BoardResult; error?: string } | null>(null);
  useEffect(() => {
    let live = true;
    loadBoard(spec, limit).then(d => { if (live) setRes({ key, data: d }); }, e => { if (live) setRes({ key, error: e instanceof Error ? e.message : String(e) }); });
    return () => { live = false; };
  }, [key, limit]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = res?.key === key ? res : null;
  if (!cur) return <p className="hint-text" role="status">Loading the board…</p>;
  if (cur.error) return <p className="empty-state">The leaderboard is not available right now. {cur.error.includes('fetch') ? 'Check your connection.' : ''}</p>;
  const d = cur.data!;
  if (!d.rows.length) return <p className="empty-state">{empty}</p>;
  return <>
    <div className="feature-table-scroll"><table className="db-table wb-table">
      <thead><tr><th>#</th><th className="col-name">GM</th><th>{scoreLabel}</th><th className="col-name">Result</th></tr></thead>
      <tbody>{d.rows.map(r => <tr key={`${r.userId}-${r.rank}`} className={r.you ? 'wb-you' : ''}>
        <td>{r.rank}</td>
        <td className="col-name">{onUser && r.username ? <button className="link-button" onClick={() => onUser(r.username)}>{r.username}</button> : r.username}{r.you ? ' (you)' : ''}{r.title ? <small className="wb-title"> {r.title}</small> : null}</td>
        <td>{r.score.toLocaleString()}</td><td className="col-name">{r.detail}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="hint-text">{d.total.toLocaleString()} on this board{d.you && !d.rows.some(r => r.you) ? ` · you are #${d.you.rank.toLocaleString()} with ${d.you.score.toLocaleString()}` : ''}.</p>
  </>;
}
