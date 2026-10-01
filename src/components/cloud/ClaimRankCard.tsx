import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { cloudEnabled, useAccount } from '../../cloud/account';
import { openSignIn } from '../../cloud/signIn';
import { syncNow } from '../../cloud/sync';
import { track } from '../../analytics/track';
import { placeOnBoard, placeLabel, claimSnoozed, snoozeClaims, claimDismissed, dismissClaim, popupShownToday, notePopupShown, type ClaimBoard, type Placement } from '../../cloud/claimRank';
import { MyFramedAvatar } from '../AvatarFrame';

interface Props {
  /** One id per result, so "Not now" sticks to it. */
  id: string;
  board: ClaimBoard;
  score: number;
  /** "Your career scored 214.7". */
  scored: string;
  /** "globally", "on today's Daily Hunt". */
  where: string;
  /** No board for this result: just the pitch, no place. */
  pitchOnly?: boolean;
}

/**
 * The results-screen pitch for a guest: where this result would land on the board and a free account to put it there.
 * It pops up once a day at most and otherwise sits on the results screen; signed in, it confirms the result is posted.
 */
export function ClaimRankCard({ id, board, score, scored, where, pitchOnly }: Props) {
  const a = useAccount();
  const [place, setPlace] = useState<Placement | null>(null);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(() => claimDismissed(id) || claimSnoozed());
  const [popup, setPopup] = useState(false);
  const boardKey = JSON.stringify(board);
  useEffect(() => {
    if (!cloudEnabled || pitchOnly || a.status === 'idle' || a.status === 'loading') return;
    let live = true;
    const go = () => placeOnBoard(JSON.parse(boardKey) as ClaimBoard, score).then(p => { if (live) setPlace(p); }, () => { if (live) setFailed(true); });
    if (a.status === 'signedIn') void syncNow().finally(go); else void go();
    return () => { live = false; };
  }, [boardKey, score, a.status, pitchOnly]);
  // The popup: once a day, for a guest, as soon as the place is known (or straight away without a board).
  useEffect(() => {
    if (a.status !== 'signedOut' || hidden || popupShownToday() || (!pitchOnly && !place && !failed)) return;
    notePopupShown(); setPopup(true); track('claim_rank', { step: 'popup' });
  }, [a.status, hidden, place, failed, pitchOnly]);
  if (!cloudEnabled) return null;

  if (a.status === 'signedIn') return pitchOnly ? null : <div className="claim-rank claim-rank--done" role="status">
    <MyFramedAvatar size={36} title="" />
    <span>✓ {scored}{place ? ` and sits ${placeLabel(place)} ${where}` : ''}. It is on the board as <b>@{a.profile?.username ?? '…'}</b>.</span>
  </div>;
  if (a.status !== 'signedOut' || hidden) return null;

  const headline = pitchOnly ? `${scored}.` : place ? `${scored} and would place ${placeLabel(place)} ${where}.` : `${scored}.`;
  const ask = pitchOnly ? 'Create a free account to save your runs and race the daily and weekly boards.' : 'Create a free account to add it to the leaderboard.';
  const signUp = () => { track('claim_rank', { step: 'signup' }); setPopup(false); openSignIn(); };
  const notNow = () => { dismissClaim(id); setPopup(false); setHidden(true); };
  const week = () => { snoozeClaims(); setPopup(false); setHidden(true); };
  const body = <>
    <div className="claim-rank-head"><MyFramedAvatar frame="founding" size={popup ? 72 : 44} title="You with the Founding GM frame" /><div>
      {!pitchOnly && place && <span className="pixel-eyebrow">{placeLabel(place).replace(/^in the /, '').toUpperCase()}{place.rank <= 100 ? ' ON THE BOARD' : ''}</span>}
      <b className="claim-rank-line">{headline}</b>
      <span className="hint-text">{ask} Free, with Discord, Google or an email link: you also get the <b>Founding GM</b> title and frame. Your result is kept and goes up as soon as you sign in.</span>
    </div></div>
    <div className="contest-actions"><button className="primary" onClick={signUp}>Create free account</button><button onClick={notNow}>Not now</button><button className="link-button" onClick={week}>Don't ask for a week</button></div>
  </>;
  return <>
    <div className="claim-rank">{body}</div>
    {popup && <Modal label="Put it on the leaderboard" onClose={() => setPopup(false)} className="claim-rank-modal">{body}</Modal>}
  </>;
}
