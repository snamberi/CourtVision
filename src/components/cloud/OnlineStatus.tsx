import { useState } from 'react';
import { PixelIcon } from '../PixelIcon';
import { checkOnline, redirectHelp, type Step } from '../../cloud/onlineStatus';

/** "Online status": checks each thing accounts and leaderboards need on this site and says how to fix the first gap. */
export function OnlineStatus({ open = false }: { open?: boolean }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => { setBusy(true); checkOnline().then(setSteps, () => setSteps([])).finally(() => setBusy(false)); };
  const allOk = !!steps?.length && steps.every(s => s.state === 'ok');
  return <details className="online-status" open={open}>
    <summary>Online status (for the site owner)</summary>
    <p className="hint-text">Sign-in, leaderboards and cloud saves need the site's Supabase settings. This check shows which one is missing. It never shows the keys themselves.</p>
    <button onClick={run} disabled={busy}>{busy ? 'Checking…' : steps ? 'Check again' : 'Run the check'}</button>
    {steps && <ol className="os-steps">{steps.map(s => <li key={s.id} className={`os-${s.state}`}>
      <b aria-hidden="true">{s.state === 'ok' ? <PixelIcon name="check" size={16} /> : s.state === 'fail' ? <PixelIcon name="cross" size={16} /> : '?'}</b>
      <span>{s.label}<span className="sr-only"> ({s.state === 'ok' ? 'working' : s.state === 'fail' ? 'not working' : 'not checked'})</span>{s.fix && <small>{s.fix}</small>}</span>
    </li>)}</ol>}
    {steps && <p className="hint-text">{allOk ? 'Everything answers. If sign-in still bounces back to the wrong site: ' : 'Also check that sign-in can come back here: '}{redirectHelp()}</p>}
  </details>;
}
