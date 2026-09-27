import { useRef, useState } from 'react';
import type { Backup, BackupSummary } from '../storage/backup';
import { PixelIcon } from './PixelIcon';
import { track } from '../analytics/track';

const describe = (s: BackupSummary) => `${s.leagues} GM league${s.leagues === 1 ? '' : 's'} · ${s.careers} career${s.careers === 1 ? '' : 's'}${s.hunts ? ' · League Hunt' : ''} · ${s.achievements} achievement${s.achievements === 1 ? '' : 's'}`;

/**
 * Backup everything / restore: one file with every mode's progress, so clearing the browser or changing devices
 * loses nothing. Restoring adds and replaces; it never deletes what is already here.
 */
export function BackupPanel({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const [pending, setPending] = useState<{ backup: Backup; summary: BackupSummary } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mod = () => import('../storage/backup');

  const download = async () => {
    setBusy('Packing everything…'); setMsg(null);
    try {
      const { blob, name, summary } = await (await mod()).backupFile();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      track('backup', { action: 'download', leagues: summary.leagues, careers: summary.careers });
      setMsg({ text: `Saved ${name} (${summary.sizeKb.toLocaleString()} KB): ${describe(summary)}.`, tone: 'ok' });
    } catch (e) { setMsg({ text: `Could not make the backup: ${e instanceof Error ? e.message : String(e)}`, tone: 'err' }); }
    setBusy(null);
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy('Reading the backup…'); setMsg(null);
    try {
      const m = await mod();
      const backup = await m.readBackup(file);
      setPending({ backup, summary: m.summarize(backup, file.size) });
    } catch (e) { setMsg({ text: e instanceof Error ? e.message : String(e), tone: 'err' }); }
    setBusy(null);
    if (input.current) input.current.value = '';
  };
  const restore = async () => {
    if (!pending) return;
    setBusy('Restoring…');
    try {
      await (await mod()).restoreBackup(pending.backup);
      track('backup', { action: 'restore' });
      setMsg({ text: 'Restored. Reloading…', tone: 'ok' });
      setTimeout(() => window.location.reload(), 600);
    } catch (e) { setMsg({ text: `Could not restore: ${e instanceof Error ? e.message : String(e)}`, tone: 'err' }); setBusy(null); }
  };

  return <section className={`backup-panel ${compact ? 'compact' : ''}`}>
    <h3><PixelIcon name="lock" size={16} /> Backup everything</h3>
    <p className="hint-text">Your progress lives in this browser. One file keeps all of it safe: GM leagues, Career Mode players, League Hunt, achievements and records. Restore it here or on another device.</p>
    <div className="contest-actions">
      <button className="primary" disabled={!!busy} onClick={download}>Download a backup</button>
      <button disabled={!!busy} onClick={() => input.current?.click()}>Restore from a file</button>
      <input ref={input} type="file" accept=".cvbackup,.json,application/json,application/gzip" hidden onChange={e => pick(e.target.files?.[0])} />
    </div>
    {busy && <p className="hint-text" role="status">{busy}</p>}
    {pending && !busy && <div className="backup-confirm" role="alertdialog" aria-label="Restore this backup?">
      <p>Backup from <b>{new Date(pending.backup.createdAt).toLocaleString()}</b>: {describe(pending.summary)}.</p>
      <p className="hint-text">Restoring adds these and replaces anything with the same name or id. Nothing else here is deleted.</p>
      <div className="contest-actions"><button className="primary" onClick={restore}>Restore</button><button onClick={() => setPending(null)}>Cancel</button></div>
    </div>}
    {msg && <p className={`backup-msg ${msg.tone}`} role="status">{msg.text}</p>}
  </section>;
}
