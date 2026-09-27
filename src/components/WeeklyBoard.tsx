import { useEffect, useRef, useState } from 'react';
import { cloudEnabled, useAccount } from '../cloud/account';
import { syncNow } from '../cloud/sync';
import { weekKey } from '../retention/week';
import { BoardTable } from './cloud/BoardTable';
import { openSignIn } from '../cloud/signIn';
import { track } from '../analytics/track';

type Board = 'rebuild' | 'career';

/** The online boards for the Rebuild and Career of the Week, in a dialog. */
export function WeeklyBoardDialog({ onClose, initial = 'rebuild', onCommunity }: { onClose: () => void; initial?: Board; onCommunity?: () => void }) {
  const [board, setBoard] = useState<Board>(initial);
  const [lastWeek, setLastWeek] = useState(false);
  const [weeks] = useState(() => ({ now: weekKey(), last: weekKey(new Date(Date.now() - 7 * 86_400_000)) }));
  const week = lastWeek ? weeks.last : weeks.now;
  const closeRef = useRef<HTMLButtonElement>(null);
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
      </div>
      <div className="board-options"><button aria-pressed={lastWeek} onClick={() => setLastWeek(v => !v)}>{lastWeek ? 'Last week' : 'This week'}</button>{onCommunity && <button className="link-button" onClick={onCommunity}>All leaderboards</button>}</div>
      {cloudEnabled ? <BoardTable spec={{ kind: 'weekly', board, week }} scoreLabel={board === 'rebuild' ? 'Score' : 'Legacy'} empty={`No scores yet ${lastWeek ? 'for last week' : 'this week'}. Finish the ${board === 'rebuild' ? 'Rebuild' : 'Career'} of the Week while signed in to be first.`} />
        : <p className="empty-state">Online leaderboards are not available in this version.</p>}
    </div>
  </div>;
}

/** Under a finished weekly result: signed in, it is on the board automatically; signed out, a way in. */
export function PostScore({ board, week }: { board: Board; week: string }) {
  const acct = useAccount();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (acct.status === 'signedIn') void syncNow(); }, [acct.status]);
  if (!cloudEnabled) return null;
  return <div className="post-score">
    {acct.status === 'signedIn'
      ? <span className="backup-msg ok">✓ On the {week} board as @{acct.profile?.username ?? '…'} (it syncs automatically).</span>
      : <><button className="primary" onClick={openSignIn}>Sign in to put this on the weekly board</button><span className="hint-text">Your result is saved here and goes up as soon as you sign in.</span></>}
    <button className="link-button" onClick={() => setOpen(true)}>See the board</button>
    {open && <WeeklyBoardDialog initial={board} onClose={() => setOpen(false)} />}
  </div>;
}
