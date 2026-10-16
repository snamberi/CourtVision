import { useEffect, useState } from 'react';
import { listRestorePoints, restorePointInfo, type RestorePoint } from '../storage/saves';
import { formatSeasonYear } from '../simulation/calendar';
import '../improvements.css';

/** Rewind: go back to a moment saved before Deadline Day, the playoffs, the draft, re-signing or free agency. */
export function RewindPage({ saveId, onRewind }: { saveId: string | null; onRewind: (pointId: string, label: string) => Promise<void> }) {
  const [points, setPoints] = useState<RestorePoint[] | null>(() => (saveId ? null : []));
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<RestorePoint | null>(null);
  useEffect(() => { if (saveId) void listRestorePoints(saveId).then(setPoints); }, [saveId]);
  if (!saveId) return <p className="empty-state">Rewind works for saved leagues.</p>;
  if (!points) return <p className="empty-state">Loading saved moments…</p>;
  const key = points.filter(p => p.key), routine = points.filter(p => !p.key);
  const row = (p: RestorePoint) => {
    const i = restorePointInfo(p);
    return <li key={p.id} className={`rewind-row ${p.key ? 'key' : ''}`}>
      <div><b>{p.label}</b><small>{formatSeasonYear(i.season)} · {i.phase?.replace('_', ' ') ?? 'regular season'} · {i.games} games played · saved {new Date(p.createdAt).toLocaleString()}</small></div>
      <button disabled={!!busy} onClick={() => setConfirm(p)}>Rewind here</button>
    </li>;
  };
  return (
    <div className="rewind-page">
      <div className="season-feature-header"><div><span className="pixel-eyebrow">UNDO A BAD MOVE</span><h2>Rewind</h2></div></div>
      <p className="hint-text">The game saves a copy of your league just before Deadline Day, the playoffs, the draft, re-signing, free agency and each new season, plus regular backups. Rewinding first saves where you are now as "Before rewind", so you can always come back.</p>
      {confirm && <div className="reset-preview" role="alertdialog" aria-label="Confirm rewind">
        <h4>Rewind to "{confirm.label}"?</h4>
        <p className="hint-text">Everything after that moment in this league is replaced (it stays in Rewind as "Before rewind").</p>
        <button className="primary" disabled={!!busy} onClick={() => { setBusy(confirm.id); void onRewind(confirm.id, confirm.label).finally(() => { setBusy(null); setConfirm(null); }); }}>{busy ? 'Rewinding…' : 'Yes, rewind'}</button>{' '}
        <button onClick={() => setConfirm(null)}>Cancel</button>
      </div>}
      <h4>Key moments</h4>
      {key.length ? <ul className="rewind-list">{key.map(row)}</ul> : <p className="hint-text">None yet. The first one is saved when your league reaches its next big moment.</p>}
      <h4>Regular backups</h4>
      {routine.length ? <ul className="rewind-list">{routine.map(row)}</ul> : <p className="hint-text">None yet.</p>}
    </div>
  );
}
