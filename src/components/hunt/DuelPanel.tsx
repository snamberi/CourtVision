import { useState } from 'react';
import { useAccount } from '../../cloud/account';
import { localName } from '../../profile/profile';
import { decodeDuel, duelLink, duelVerdict, type Duel, type DuelResult } from '../../retention/duel';
import { track } from '../../analytics/track';
import { PixelIcon } from '../PixelIcon';

type Setup = Pick<Duel, 'm' | 's' | 'deck' | 'diff' | 'pm'>;

/** Your name for a duel link: your GM name when signed in, else the profile name (never "You"). */
function senderName(username: string | null | undefined): string {
  if (username) return `@${username}`;
  const n = localName();
  return n && n !== 'You' ? n : 'A friend';
}

/**
 * The end of a run: a challenge link for the exact same run, or, when this run was a duel, the two results side by
 * side and a link to send yours back.
 */
export function DuelPanel({ setup, mine, duel }: { setup: Setup; mine: DuelResult; duel?: string }) {
  const a = useAccount();
  const [copied, setCopied] = useState(false);
  const them = duel ? decodeDuel(duel) : null;
  const me = senderName(a.profile?.username);
  const link = duelLink({ v: 1, ...setup, n: me, r: mine });
  const text = them ? `${me} played your run: ${mine.line} (${mine.score.toLocaleString()}). Your move:` : `Same spins, same schedule. Can you beat ${mine.line} (${mine.score.toLocaleString()})?`;
  const send = async () => {
    track('league_code', { action: them ? 'duel-reply' : 'duel', kind: setup.m });
    try {
      if (navigator.share) { await navigator.share({ title: 'Court Vision duel', text, url: link }); return; }
    } catch { /* closed the share sheet: fall back to copying */ }
    try { await navigator.clipboard.writeText(`${text} ${link}`); setCopied(true); } catch { setCopied(false); }
  };
  const verdict = them ? duelVerdict(mine.score, them.r.score, them.n) : null;
  return <div className={`duel-panel ${verdict ? `duel-${verdict.outcome}` : ''}`}>
    <span className="pixel-eyebrow"><PixelIcon name="trade" size={12} /> {them ? 'SAME-SPIN DUEL' : 'CHALLENGE A FRIEND'}</span>
    {them && verdict ? <>
      <div className="duel-vs">
        <div className={verdict.outcome === 'win' ? 'winner' : ''}><small>YOU</small><b>{mine.score.toLocaleString()}</b><span>{mine.line}</span></div>
        <i aria-hidden="true">VS</i>
        <div className={verdict.outcome === 'loss' ? 'winner' : ''}><small>{them.n.toUpperCase()}</small><b>{them.r.score.toLocaleString()}</b><span>{them.r.line}</span></div>
      </div>
      <p className="duel-verdict">{verdict.text}</p>
    </> : <p>Send a friend this exact run: the same {setup.m === 'hunt' ? 'reels, teams and boss' : 'spins, schedule and bosses'}. Only the picks change. The link carries your score, so they see who won when they finish.</p>}
    <div className="contest-actions"><button className="primary" onClick={() => void send()}>{them ? 'Send your result back' : 'Challenge a friend'}</button>{copied && <span className="backup-msg ok">Link copied.</span>}</div>
  </div>;
}

/** The banner while a duel run is on. */
export function DuelBanner({ duel }: { duel?: string }) {
  const them = duel ? decodeDuel(duel) : null;
  if (!them) return null;
  return <p className="duel-banner"><PixelIcon name="trade" size={14} /> Duel: {them.n} scored <b>{them.r.score.toLocaleString()}</b> on this exact run ({them.r.line}). Beat it.</p>;
}
