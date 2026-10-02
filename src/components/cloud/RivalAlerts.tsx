import { useEffect, useState } from 'react';
import { cloudEnabled, useAccount } from '../../cloud/account';
import { loadRivalAlerts, dismissRival, RIVAL_BOARD_LABEL, RIVAL_PLAY, type RivalAlert } from '../../cloud/rivals';
import { PixelIcon } from '../PixelIcon';

/** The menu card for a signed-in GM: friends who are ahead of you this week, with a way straight back in. */
export function RivalAlerts() {
  const a = useAccount();
  const [alerts, setAlerts] = useState<RivalAlert[]>([]);
  useEffect(() => {
    if (!cloudEnabled || a.status !== 'signedIn') return;
    let live = true;
    void loadRivalAlerts().then(x => { if (live) setAlerts(x); }, () => {});
    return () => { live = false; };
  }, [a.status, a.sync.at]);
  if (!alerts.length) return null;
  const shown = alerts.slice(0, 3);
  const clear = () => { dismissRival(shown.map(x => x.id)); setAlerts(alerts.slice(3)); };
  return <section className="rival-alerts" aria-label="Friends ahead of you">
    <span className="pixel-eyebrow"><PixelIcon name="flame" size={12} /> RIVALS</span>
    <ul>{shown.map(x => <li key={x.id}>
      <span><b>@{x.friend}</b> {x.mine == null ? 'is on' : 'passed you on'} the {RIVAL_BOARD_LABEL[x.board]}: <b>{x.theirs.toLocaleString()}</b>{x.mine == null ? ". You haven't played it yet." : ` vs your ${x.mine.toLocaleString()}.`}</span>
      <button className="primary" onClick={() => { dismissRival([x.id]); location.hash = RIVAL_PLAY[x.board]; }}>{x.mine == null ? 'Play it' : 'Win it back'}</button>
    </li>)}</ul>
    <button className="link-button" onClick={clear}>Dismiss</button>
  </section>;
}
