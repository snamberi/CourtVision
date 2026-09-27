import { useEffect, useRef, useState } from 'react';
import { fetchBoard, postScore, savedName, wasPosted, markPosted, postedKey, ONLINE_BOARDS, type Board, type BoardResponse, type CareerFields } from '../online/leaderboard';
import type { ScoredSeason } from '../simulation/rebuildScenarios';
import { weekKey } from '../retention/week';
import { track } from '../analytics/track';

/** The online top 100 for the Rebuild and Career of the Week, in a dialog. */
export function WeeklyBoardDialog({ onClose, initial = 'rebuild' }: { onClose: () => void; initial?: Board }) {
  const [board, setBoard] = useState<Board>(initial);
  const [lastWeek, setLastWeek] = useState(false);
  const [weeks] = useState(() => ({ now: weekKey(), last: weekKey(new Date(Date.now() - 7 * 86_400_000)) }));
  const week = lastWeek ? weeks.last : weeks.now;
  const want = `${board}|${week}`;
  const [result, setResult] = useState<{ key: string; data?: BoardResponse; error?: string } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let live = true;
    fetchBoard(board, week).then(d => { if (live) setResult({ key: `${board}|${week}`, data: d }); }, e => { if (live) setResult({ key: `${board}|${week}`, error: e instanceof Error ? e.message : String(e) }); });
    return () => { live = false; };
  }, [board, week]);
  const current = result?.key === want ? result : null;
  const data = current?.data ?? null, error = current?.error ?? null;
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    track('leaderboard', { action: 'view' });
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="share-modal weekly-board" role="dialog" aria-modal="true" aria-label="Weekly leaderboard" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="share-box">
      <div className="wb-head"><span className="pixel-eyebrow">WEEKLY LEADERBOARD · {week}</span><button ref={closeRef} className="link-button" onClick={onClose}>Close</button></div>
      <div className="stats-view-toggle" role="tablist" aria-label="Board">
        <button role="tab" aria-selected={board === 'rebuild'} className={board === 'rebuild' ? 'active' : ''} onClick={() => setBoard('rebuild')}>Rebuild of the Week</button>
        <button role="tab" aria-selected={board === 'career'} className={board === 'career' ? 'active' : ''} onClick={() => setBoard('career')}>Career of the Week</button>
        <button aria-pressed={lastWeek} className={lastWeek ? 'active' : ''} onClick={() => setLastWeek(v => !v)}>{lastWeek ? 'Last week' : 'This week'}</button>
      </div>
      {error ? <p className="empty-state">{error}</p> : !data ? <p className="hint-text">Loading the board…</p> : !data.entries.length ? <p className="empty-state">No scores yet {lastWeek ? 'for last week' : 'this week'}. Be the first: finish the {board === 'rebuild' ? 'Rebuild' : 'Career'} of the Week and post it.</p> : <>
        <div className="feature-table-scroll"><table className="db-table wb-table"><thead><tr><th>#</th><th className="col-name">GM</th><th>{board === 'rebuild' ? 'Score' : 'Legacy'}</th><th className="col-name">Result</th></tr></thead>
          <tbody>{data.entries.map(e => <tr key={e.rank} className={e.you ? 'wb-you' : ''}><td>{e.rank}</td><td className="col-name">{e.name}{e.you ? ' (you)' : ''}</td><td>{e.score.toLocaleString()}</td><td className="col-name">{e.detail}</td></tr>)}</tbody></table></div>
        <p className="hint-text">{data.total.toLocaleString()} GM{data.total === 1 ? '' : 's'} on the board{data.you && !data.entries.some(e => e.you) ? ` · you are #${data.you.rank} with ${data.you.score.toLocaleString()}` : ''}.</p>
      </>}
    </div>
  </div>;
}

/** "Post to the weekly board": a name, then the entry goes up. */
export function PostScore({ board, week, refKey, payload, label = 'Post to the weekly board' }: { board: Board; week: string; refKey: string; payload: { results?: ScoredSeason[]; career?: CareerFields }; label?: string }) {
  const k = postedKey(board, week, refKey);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(() => savedName());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(() => wasPosted(k) ? { text: 'Posted to the weekly board.', ok: true } : null);
  const [board2, setBoard2] = useState(false);
  if (!ONLINE_BOARDS) return null;
  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await postScore(board, week, name, payload);
      markPosted(k);
      setMsg({ text: r.you ? `On the board: #${r.you.rank} of ${r.total.toLocaleString()} this week.` : 'Posted.', ok: true });
      setOpen(false);
      track('leaderboard', { action: 'post', board });
    } catch (e) { setMsg({ text: e instanceof Error ? e.message : String(e), ok: false }); }
    setBusy(false);
  };
  return <div className="post-score">
    {!open && <button className={msg?.ok ? '' : 'primary'} onClick={() => setOpen(true)}>{msg?.ok ? 'Post again' : label}</button>}
    {msg?.ok && <button className="link-button" onClick={() => setBoard2(true)}>See the board</button>}
    {open && <form onSubmit={e => { e.preventDefault(); void send(); }}>
      <label>Your name on the board <input className="year-input" value={name} onChange={e => setName(e.target.value)} maxLength={18} autoFocus placeholder="2-18 letters or numbers" /></label>
      <button className="primary" type="submit" disabled={busy || name.trim().length < 2}>{busy ? 'Posting…' : 'Post'}</button>
      <button type="button" className="link-button" onClick={() => setOpen(false)}>Cancel</button>
      <small className="hint-text">Your name and result are shown publicly on this week's board.</small>
    </form>}
    {msg && <p className={`backup-msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</p>}
    {board2 && <WeeklyBoardDialog initial={board} onClose={() => setBoard2(false)} />}
  </div>;
}
