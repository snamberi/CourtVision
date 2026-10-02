import { useEffect, useState } from 'react';
import { cloudEnabled, useAccount } from '../cloud/account';
import { loadBoard } from '../cloud/boards';
import { readWeekLog, lastWeekKey, recapWorthy, recapLines } from '../retention/weekLog';
import { formatPlayTime } from '../retention/playTime';
import { PixelIcon } from './PixelIcon';

const SEEN_KEY = 'cv-recap-seen';
const BOARDS = [['hunt', 'Weekly Hunt'], ['perfect', 'Daily 82-0'], ['career', 'Career of the Week'], ['rebuild', 'Rebuild of the Week']] as const;

/** The menu card for a new week: what you did last week, your places on last week's boards, and a share. */
export function WeeklyRecap() {
  const a = useAccount();
  const week = lastWeekKey();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(SEEN_KEY) === week; } catch { return true; } });
  const [ranks, setRanks] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const entry = readWeekLog()[week];
  useEffect(() => {
    if (hidden || !cloudEnabled || a.status !== 'signedIn') return;
    let live = true;
    void Promise.all(BOARDS.map(([board, label]) => loadBoard({ kind: 'weekly', board, week }, 1).then(r => (r.you ? `#${r.you.rank} of ${r.total.toLocaleString()} on the ${label}` : null), () => null)))
      .then(list => { if (live) setRanks(list.filter((x): x is string => !!x)); });
    return () => { live = false; };
  }, [hidden, a.status, week]);
  if (hidden || (!recapWorthy(entry) && !ranks.length)) return null;
  const lines = [...(entry ? recapLines(entry, formatPlayTime) : []), ...ranks];
  const dismiss = () => { try { localStorage.setItem(SEEN_KEY, week); } catch { /* storage blocked */ } setHidden(true); };
  const share = async () => {
    const text = `My Court Vision week (${week}):\n${lines.map(l => `• ${l}`).join('\n')}\nhttps://courtvisiongame.com`;
    try { if (navigator.share) { await navigator.share({ title: 'My Court Vision week', text }); return; } } catch { /* closed the share sheet */ }
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  };
  return <section className="weekly-recap" aria-label="Last week's recap">
    <div className="weekly-recap-head"><span className="pixel-eyebrow"><PixelIcon name="calendar" size={12} /> LAST WEEK · {week}</span><button className="link-button" onClick={dismiss}>Dismiss</button></div>
    <ul>{lines.map(l => <li key={l}>{l}</li>)}</ul>
    <div className="contest-actions"><button onClick={() => void share()}><PixelIcon name="star" size={14} /> Share my week</button>{copied && <span className="backup-msg ok">Copied.</span>}</div>
  </section>;
}
