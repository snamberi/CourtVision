import { plural } from '../lib/humanize';
import { useEffect, useRef, useState } from 'react';
import { createRestorePoint, createSave, getSave, listRestorePoints, listSaves, recoverRestorePoint, type RestorePoint, type SaveSummary } from '../storage/saves';
import { downloadSnapshot, readUniverseFromFile } from '../storage/universeIO';

export function SaveRecoveryPanel({ saveId, beforeAction, onOpen }: {
  saveId?: string | null; beforeAction: () => Promise<unknown>; onOpen: (id: string) => Promise<void>;
}) {
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [selected, setSelected] = useState(saveId ?? '');
  const [points, setPoints] = useState<RestorePoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const current = saveId ?? selected;
  useEffect(() => {
    let active = true;
    void Promise.all([listSaves(), current ? listRestorePoints(current) : Promise.resolve([])]).then(([rows, backups]) => {
      if (!active) return;
      setSaves(rows); setPoints(backups);
      if (!current && rows[0]) setSelected(rows[0].id);
    }).catch(e => { if (active) setMessage(`Could not read backups: ${String(e)}`); });
    return () => { active = false; };
  }, [current, revision]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await beforeAction(); await action(); setRevision(n => n + 1); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const visiblePoints = points.filter(p => p.saveId === current);
  return <section className="save-recovery" aria-label="Save backups and recovery">
    <h3>Backups &amp; recovery</h3>
    <p>Keep up to five restore points per league. Automatic backups protect earlier progress as you play and before season or phase changes. Recovery opens a separate league; your current save stays intact.</p>
    <p className="hint-text">Local backups share this browser’s storage. Download a backup to protect against clearing browser data or changing devices.</p>
    {!saveId && <label>Saved league <select aria-label="Backup league" value={current} disabled={busy} onChange={e => setSelected(e.target.value)}>
      {!saves.length && <option value="">No saved leagues</option>}
      {saves.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select></label>}
    <div className="backup-actions">
      <button disabled={!current || busy} onClick={() => void run(async () => { await createRestorePoint(current); setMessage('Restore point created.'); })}>Create Restore Point</button>
      <button disabled={!current || busy} onClick={() => void run(async () => {
        const snapshot = await getSave(current); if (!snapshot) throw new Error('Saved league not found.');
        downloadSnapshot(snapshot); setMessage('Backup downloaded.');
      })}>Download Backup</button>
      <button disabled={busy} onClick={() => file.current?.click()}>Recover Backup File</button>
      <button disabled={busy} onClick={() => setRevision(n => n + 1)}>Refresh Backups</button>
      <input ref={file} type="file" accept=".json,application/json" hidden aria-label="Recover backup file" onChange={e => {
        const selectedFile = e.target.files?.[0]; e.target.value = '';
        if (selectedFile) void run(async () => {
          const snapshot = await readUniverseFromFile(selectedFile);
          const teamId = snapshot.league.teams.some(t => t.teamId === snapshot.controlledTeamId) ? snapshot.controlledTeamId! : null;
          const id = await createSave(`${selectedFile.name.replace(/\.json$/i, '')} — recovered`, snapshot.league, snapshot.extras, teamId);
          await onOpen(id);
        });
      }} />
    </div>
    {message && <p role="status">{message}</p>}
    {busy && <p role="status">Working with your backup…</p>}
    {!visiblePoints.length ? <p className="hint-text">No restore points yet. Create one now or keep playing to let autosave make one.</p> : <ul className="backup-list">
      {visiblePoints.map(point => <li key={point.id}>
        <div><strong>{point.label}</strong><small>{new Date(point.createdAt).toLocaleString()} · {point.snapshot.league.season ?? 'Unknown season'} · {point.snapshot.league.seasonPhase ?? 'regular season'} · {plural(point.snapshot.league.schedule.filter(g => g.played).length, 'game')} played</small></div>
        <button disabled={busy} onClick={() => void run(async () => { downloadSnapshot(point.snapshot, `courtvision-restore-${point.createdAt}.json`); })}>Download</button>
        <button disabled={busy} onClick={() => void run(async () => { await onOpen(await recoverRestorePoint(current, point.id)); })}>Restore as New League</button>
      </li>)}
    </ul>}
  </section>;
}
