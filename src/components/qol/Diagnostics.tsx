import { useState } from 'react';
import { getAccount } from '../../cloud/account';
import { diagnosticReport } from '../../qol/diagnostics';
export function Diagnostics() {
 const [note,setNote] = useState('');
 const download = () => {
  let storage = false; try { const key = 'courtvision-diagnostic-check'; localStorage.setItem(key,'1'); storage = localStorage.getItem(key) === '1'; localStorage.removeItem(key); } catch { /* report only */ }
  const a = getAccount();
  const report = diagnosticReport({build: import.meta.env.VITE_BUILD_STAMP ?? 'development', signedIn: a.status === 'signedIn', syncState: a.sync.state, online: navigator.onLine, localStorageAvailable: storage});
  const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'CourtVision-diagnostics.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNote('Diagnostic report downloaded. It contains capability checks, not account tokens or saved games.');
 };
 return <section><h2>Diagnostics</h2><p>Download a small support report containing the build, connection and storage availability. No usernames, tokens, messages or save contents.</p><button onClick={download}>Download diagnostic report</button><p role="status">{note}</p></section>;
}
