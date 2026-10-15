import { useState } from 'react';
import type { SaveSummary } from '../storage/saves';
import { formatSeasonYear } from '../simulation/calendar';
import { PixelIcon } from './PixelIcon';
import { ModeBackdrop } from './presentation/ModeScene';
import { SmallRoom } from './presentation/SmallRoom';

interface Props {
  saves: SaveSummary[];
  onContinue: (id: string) => void | Promise<void>;
  onDeleteSave: (id: string) => void | Promise<void>;
  onRenameSave: (id: string, name: string) => void | Promise<void>;
  onBack: () => void;
  onCreate: () => void;
}

export function ContinueFranchise({ saves, onContinue, onDeleteSave, onRenameSave, onBack, onCreate }: Props) {
  const [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<'selected' | 'all' | null>(null);
  const sorted = [...saves].sort((a, b) => b.updatedAt - a.updatedAt);
  const visible = sorted.filter(s => `${s.name} ${s.controlledTeamName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const act = async (id: string, action: () => void | Promise<void>) => {
    if (pending) return;
    setPending(id); setError('');
    try { await action(); setRenaming(null); setDeleting(null); } catch { setError('That change could not be saved. Please try again.'); }
    finally { setPending(null); }
  };
  const toggle = (id: string) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); setBulk(null); };
  // Deletes one at a time so a failure part-way still leaves the rest of the shelf intact.
  const deleteMany = (ids: string[]) => act('bulk', async () => { for (const id of ids) await onDeleteSave(id); stopSelecting(); });
  const bulkIds = bulk === 'all' ? saves.map(s => s.id) : [...picked];
  return <main className="continue-franchise create-page mode-environment" data-environment="franchise">
    <header className="create-top"><button className="hunt-exit" onClick={onBack}><PixelIcon name="exit" size={16} /> Main Menu</button><div><span className="pixel-eyebrow">FRANCHISE · CONTINUE</span><h1>Your Leagues</h1></div><button onClick={onCreate}>New franchise</button></header>
    <ModeBackdrop mode="franchise" />
    <div className="continue-heading"><div><h2>Pick up your dynasty.</h2><p>{saves.length ? `${saves.length} saved league${saves.length === 1 ? '' : 's'} · most recently played first` : 'Your next great franchise starts here.'}</p></div>
      {saves.length > 0 && <label className="continue-search">Find a league<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="League or team name" /></label>}</div>
    {saves.length > 1 && <div className="continue-bulk" role="toolbar" aria-label="Manage several leagues">
      {selecting ? <>
        <span>{picked.size} selected</span>
        <button disabled={!!pending} onClick={() => setPicked(picked.size === visible.length ? new Set() : new Set(visible.map(s => s.id)))}>{picked.size === visible.length && visible.length > 0 ? 'Clear selection' : 'Select all shown'}</button>
        <button className="danger" disabled={!picked.size || !!pending} onClick={() => setBulk('selected')}>Delete selected</button>
        <button className="danger" disabled={!!pending} onClick={() => setBulk('all')}>Delete all</button>
        <button disabled={!!pending} onClick={stopSelecting}>Done</button>
      </> : <button onClick={() => { setSelecting(true); setRenaming(null); setDeleting(null); }}>Select leagues</button>}
    </div>}
    {bulk && <div className="continue-delete continue-bulk-confirm" role="alertdialog" aria-label="Confirm deleting leagues">
      <p>{bulk === 'all' ? `Delete all ${saves.length} saved leagues? This can't be undone.` : `Delete ${bulkIds.length} selected league${bulkIds.length === 1 ? '' : 's'}? This can't be undone.`}</p>
      <button className="danger" disabled={!!pending || !bulkIds.length} onClick={() => void deleteMany(bulkIds)}>{pending === 'bulk' ? 'Deleting…' : 'Yes, delete'}</button>
      <button disabled={!!pending} onClick={() => setBulk(null)}>Cancel</button>
    </div>}
    {error && <p role="alert" className="backup-msg err">{error}</p>}
    {saves.length === 0 ? <section className="continue-empty"><SmallRoom kind="archive" title="An empty shelf. An open future." detail="Your saved franchises will live here, ready for their next season." /><h2>No saved leagues yet</h2><p>Create your first franchise, then come back here to continue it.</p><button className="primary" onClick={onCreate}>Play · new franchise</button></section>
      : <section className="continue-saves" aria-label="Saved leagues">
        {visible.map(s => <article key={s.id} className={`continue-save ${picked.has(s.id) ? 'is-picked' : ''}`}>
          {selecting ? <label className="continue-pick"><input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Select ${s.name}`} /></label>
            : <div className="continue-save-icon" aria-hidden="true"><PixelIcon name="trophy" size={32} /></div>}
          <div className="continue-save-info">
            <span className="pixel-eyebrow">{s.id === sorted[0]?.id ? 'LAST PLAYED' : 'FRANCHISE'} · {s.season ? formatSeasonYear(s.season) : 'PRESEASON'}</span>
            {renaming === s.id ? <form onSubmit={e => { e.preventDefault(); if (name.trim()) void act(s.id, () => onRenameSave(s.id, name.trim())); }}><label>League name<input autoFocus value={name} maxLength={100} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setRenaming(null); }} /></label><button className="primary" disabled={!name.trim() || !!pending}>Save name</button><button type="button" onClick={() => setRenaming(null)}>Cancel</button></form>
              : <h3>{s.name}</h3>}
            <p>{s.controlledTeamName || 'League commissioner'} · {s.teamCount} teams</p>
            <small>Saved {new Date(s.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
          </div>
          {!selecting && <div className="continue-save-actions"><button className="primary" disabled={!!pending} onClick={() => void act(s.id, () => onContinue(s.id))}><PixelIcon name="play" size={14} /> {pending === s.id ? 'Please wait…' : 'Continue'}</button>
            <button disabled={!!pending} onClick={() => { setRenaming(s.id); setName(s.name); setDeleting(null); }}>Rename</button><button disabled={!!pending} onClick={() => { setDeleting(s.id); setRenaming(null); }}>Delete</button></div>}
          {deleting === s.id && <div className="continue-delete" role="group" aria-label={`Delete ${s.name}`}><p>Delete “{s.name}”?</p><button className="danger" disabled={!!pending} onClick={() => void act(s.id, () => onDeleteSave(s.id))}>Confirm delete</button><button onClick={() => setDeleting(null)}>Cancel</button></div>}
        </article>)}
        {visible.length === 0 && <p className="empty-state">No leagues match “{search}”. <button onClick={() => setSearch('')}>Clear search</button></p>}
      </section>}
  </main>;
}
