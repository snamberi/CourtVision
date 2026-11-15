import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { awardOptions, computeSeasonAwards } from '../simulation/awards';
import { AWARD_METRICS, awardDefinition, awardDefinitions, defaultAward, editAwardHistory, exportAwardPack, importAwardPack, normalizeAward, parseAwardPack, rankAward, readAwardWinners, resetAwardDefinition, saveAwardDefinition, type AwardDefinition, type AwardMetric, type AwardPack, type StudioWinner } from '../simulation/awardStudio';
import { getSave, listSaves, type SaveSummary } from '../storage/saves';
import { TROPHIES } from '../simulation/trophies';
import './awardStudio.css';

export const LeagueAwardContext = createContext<League | null>(null);
export function LeagueAwardProvider({ league, children }: { league: League; children: ReactNode }) { return <LeagueAwardContext.Provider value={league}>{children}</LeagueAwardContext.Provider>; }
export const useAwardDefinition = (id: string) => awardDefinition(useContext(LeagueAwardContext), id);
export function AwardName({ id, short = false }: { id: string; short?: boolean }) { const d = useAwardDefinition(id); return <>{short ? d.short : d.name}</>; }
export function AwardArtwork({ definition, size = 56 }: { definition: AwardDefinition; size?: number }) {
  return definition.image ? <img className="award-studio-art" src={definition.image} width={size} height={size} alt={definition.name} />
    : <span className="award-studio-fallback" role="img" aria-label={definition.name} style={{ color: definition.color, fontSize: size * .7 }}>🏆</span>;
}
function downloadPack(pack: AwardPack, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(pack)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `${name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60)}.cv-awards.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function readArtwork(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10_000_000) throw new Error('Choose a PNG, JPEG or WebP image under 10 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas'), ratio = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image conversion is unavailable.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/png');
  } finally { bitmap.close(); }
}
const msg = (e: unknown) => e instanceof Error ? e.message : String(e);
const metricOptions = Object.entries(AWARD_METRICS).map(([id, name]) => <option key={id} value={id}>{name}</option>);

export function AwardStudio({ league, extras, onChange }: { league: League; extras: GMLeagueExtras; onChange: (league: League) => void }) {
  const defs = useMemo(() => awardDefinitions(league), [league.awardStudio]);
  const [id, setId] = useState('mvp'), [draft, setDraft] = useState(() => awardDefinition(league, 'mvp'));
  const [view, setView] = useState<'definition' | 'history' | 'sharing'>('definition');
  const [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [metric, setMetric] = useState<AwardMetric>('ws');
  const [season, setSeason] = useState(league.franchiseHistory?.at(-1)?.season ?? league.season ?? '2026');
  const [entries, setEntries] = useState<StudioWinner[] | null>(null);
  const [saves, setSaves] = useState<SaveSummary[] | null>(null), [source, setSource] = useState('');
  const [pack, setPack] = useState<AwardPack | null>(null), [selected, setSelected] = useState<string[]>([]), [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false), fileInput = useRef<HTMLInputElement>(null);
  const live = useMemo(() => computeSeasonAwards(league, awardOptions(league.awardSettings)), [league]);
  const rec = league.franchiseHistory?.find(r => r.season === season);
  const original = league.awardStudio?.history[season]?.[id] ?? readAwardWinners(id, rec?.fullAwards ?? (season === league.season ? live : null), rec);
  const rows = entries ?? original;
  const isBuiltin = Object.hasOwn(TROPHIES, id);
  const preview = useMemo(() => view === 'definition' && draft.method === 'formula' ? rankAward(league, draft).slice(0, 10) : [], [league, draft, view]);
  const players = useMemo(() => [...new Set([...league.teams.flatMap(t => t.seasons.map(p => p.playerId)), ...extras.freeAgents.map(p => p.playerId), ...(league.retiredPlayers ?? []).map(p => p.playerId), ...(rec?.teamSeasons ?? []).flatMap(t => t.roster.map(p => p.playerId))])].sort(), [league.teams, league.retiredPlayers, extras.freeAgents, rec]);
  const choose = (key: string) => { setId(key); setDraft(awardDefinition(league, key)); setEntries(null); setError(''); setNotice(''); };
  const change = (patch: Partial<AwardDefinition>) => setDraft(d => ({ ...d, ...patch }));
  const run = (f: () => void, success: string) => { setError(''); try { f(); setNotice(success); } catch (e) { setError(msg(e)); } };
  const loadPack = (next: AwardPack) => { setPack(next); setSelected(next.definitions.map(d => d.id)); setNotice('Choose awards to import. Winner history in this league stays intact.'); setError(''); };
  const historyTeams = [...new Map([...league.teams.map(t=>[t.teamId,t.name] as const), ...(league.franchiseHistory ?? []).flatMap(r=>(r.teamSeasons ?? []).map(t=>[t.teamId,t.teamName] as const))]).entries()];
  const updateRow = (i: number, patch: Partial<StudioWinner>) => setEntries(rows.map((w, j) => j === i ? { ...w, ...patch } : w));
  if (!league.settings.sandboxMode) return null;
  return <section className="award-studio sandbox-tool">
    <header><span className="pixel-eyebrow">SANDBOX · THIS LEAGUE</span><h3>Award Studio</h3><p>Design every trophy, choose how it is earned, and edit winners from any season. Images stay in this league’s local save and travel with exported award packs.</p></header>
    <div className="studio-toolbar"><label>Award <select aria-label="Choose award" value={id} onChange={e => choose(e.target.value)}>{defs.map(d => <option key={d.id} value={d.id}>{d.name}{!d.enabled ? ' (disabled)' : ''}</option>)}{!defs.some(d => d.id === id) && <option value={id}>{draft.name} (new)</option>}</select></label>
      <button onClick={() => { const d = defaultAward(`award_${crypto.randomUUID()}`); setId(d.id); setDraft(d); setView('definition'); setEntries(null); }}>Create new award</button></div>
    <nav className="studio-tabs" aria-label="Award tools">{(['definition', 'history', 'sharing'] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'definition' ? 'Design & rules' : v === 'history' ? 'Edit award history' : 'Import / export'}</button>)}</nav>
    {error && <p role="alert" className="studio-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {view === 'definition' && <>
      <div className="studio-design"><AwardArtwork definition={draft} size={80} /><div><b style={{ color: draft.color }}>{draft.name}</b><p>{draft.description || 'Your league. Your honors.'}</p></div></div>
      <div className="studio-grid"><label>Name <input maxLength={100} value={draft.name} onChange={e => change({ name: e.target.value })} /></label><label>Short name <input maxLength={30} value={draft.short} onChange={e => change({ short: e.target.value })} /></label>
        <label>Color <input type="color" value={draft.color} onChange={e => change({ color: e.target.value })} /></label>
        <label>Artwork <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setBusy(true); try { change({ image: await readArtwork(f) }); } catch (err) { setError(msg(err)); } finally { setBusy(false); } }} /></label>
        {draft.image && <button onClick={() => change({ image: undefined })}>Remove image</button>}
        <label>Recipient <select value={draft.kind} onChange={e => change({ kind: e.target.value as AwardDefinition['kind'], method: 'formula' })}><option value="player">Player</option><option value="team">Team / coach / front office</option></select></label>
        <label>Selection <select value={draft.method} onChange={e => change({ method: e.target.value as AwardDefinition['method'] })}>{isBuiltin && <option value="default">Original award rules</option>}<option value="formula">Custom stat formula</option><option value="manual">Choose winners manually</option></select></label>
        <label>Number of winners <input type="number" min={1} max={100} value={draft.winners} onChange={e => change({ winners: Number(e.target.value) })} /></label>
        <label>Career prestige <input type="number" min={0} max={1000} step="0.25" value={draft.prestige} onChange={e => change({ prestige: Number(e.target.value) })} /></label>
        <label><input type="checkbox" checked={draft.enabled} onChange={e => change({ enabled: e.target.checked })} /> Award enabled</label></div>
      <label>Description <textarea maxLength={1000} value={draft.description} onChange={e => change({ description: e.target.value })} /></label>
      {draft.method === 'formula' && <>
        <h4>Winning formula</h4><p className="hint-text">Each selected stat is multiplied by its weight, then added. Negative weights penalize a stat. Shooting percentages use 0–100; team win percentage uses 0–1.</p>
        <div className="studio-grid"><label>Games used <select value={draft.scope} onChange={e => change({ scope: e.target.value as AwardDefinition['scope'] })}><option value="season">Regular season</option><option value="playoffs">Playoffs</option><option value="finals">Finals</option></select></label><label>Winner order <select value={draft.order} onChange={e => change({ order: e.target.value as AwardDefinition['order'] })}><option value="highest">Highest score first</option><option value="lowest">Lowest score first</option></select></label></div>
        <div className="studio-weights">{Object.entries(draft.weights).map(([k, w]) => <label key={k}>{AWARD_METRICS[k as AwardMetric]} <input aria-label={`${AWARD_METRICS[k as AwardMetric]} weight`} type="number" step="0.1" min={-10000} max={10000} value={w} onChange={e => change({ weights: { ...draft.weights, [k]: Number(e.target.value) } })} /><button aria-label={`Remove ${AWARD_METRICS[k as AwardMetric]}`} onClick={() => { const next = { ...draft.weights }; delete next[k as AwardMetric]; change({ weights: next }); }}>Remove</button></label>)}</div>
        <div className="studio-toolbar"><select aria-label="Add stat" value={metric} onChange={e => setMetric(e.target.value as AwardMetric)}>{metricOptions}</select><button onClick={() => change({ weights: { ...draft.weights, [metric]: 1 } })}>Add stat</button></div>
        <h4>Eligibility</h4><div className="studio-grid"><label>Minimum games <input type="number" min={0} max={1000} value={draft.minGames} onChange={e => change({ minGames: Number(e.target.value) })} /></label><label>Minimum share of team games (%) <input type="number" min={0} max={100} value={Math.round(draft.minGamesShare * 100)} onChange={e => change({ minGamesShare: Number(e.target.value) / 100 })} /></label><label><input type="checkbox" checked={draft.rookiesOnly} onChange={e => change({ rookiesOnly: e.target.checked })} /> Rookies only</label><label><input type="checkbox" checked={draft.benchOnly} onChange={e => change({ benchOnly: e.target.checked })} /> Bench players only</label></div>
        <fieldset><legend>Positions (none selected means any)</legend>{['PG', 'SG', 'SF', 'PF', 'C'].map(p => <label key={p}><input type="checkbox" checked={draft.positions.includes(p)} onChange={e => change({ positions: e.target.checked ? [...draft.positions, p] : draft.positions.filter(x => x !== p) })} />{p} </label>)}</fieldset>
        <label>Stat requirements <select value={draft.conditionMode} onChange={e => change({ conditionMode: e.target.value as 'all' | 'any' })}><option value="all">Meet ALL (AND)</option><option value="any">Meet ANY (OR)</option></select></label>
        {draft.conditions.map((c, i) => <div className="studio-toolbar" key={i}><select aria-label={`Condition ${i + 1} stat`} value={c.metric} onChange={e => change({ conditions: draft.conditions.map((x, j) => j === i ? { ...x, metric: e.target.value as AwardMetric } : x) })}>{metricOptions}</select><select aria-label={`Condition ${i + 1} comparison`} value={c.op} onChange={e => change({ conditions: draft.conditions.map((x, j) => j === i ? { ...x, op: e.target.value as 'gte' | 'lte' } : x) })}><option value="gte">at least</option><option value="lte">at most</option></select><input aria-label={`Condition ${i + 1} value`} type="number" step="0.1" value={c.value} onChange={e => change({ conditions: draft.conditions.map((x, j) => j === i ? { ...x, value: Number(e.target.value) } : x) })} /><button onClick={() => change({ conditions: draft.conditions.filter((_, j) => j !== i) })}>Remove</button></div>)}
        <button onClick={() => change({ conditions: [...draft.conditions, { metric: 'ws', op: 'gte', value: 0 }] })}>Add requirement</button>
        <details><summary>Preview current candidates</summary>{preview.length ? <ol>{preview.map(w => <li key={w.playerId}>{draft.kind === 'team' ? w.teamName : w.playerId} · {w.score.toFixed(2)}</li>)}</ol> : <p>No qualifying candidates for these rules yet.</p>}</details>
      </>}
      <div className="studio-toolbar"><button className="primary" disabled={busy} onClick={() => run(() => { const d = normalizeAward(draft); onChange(saveAwardDefinition(league, d)); setDraft(d); }, 'Award saved for this league.')}>Save award</button>
        <button onClick={() => run(() => { onChange(resetAwardDefinition(league, id)); choose('mvp'); }, isBuiltin ? 'Award definition reset. Recorded winners were preserved.' : 'Custom award and its recorded winners removed.')}>{isBuiltin ? 'Restore original design & rules' : 'Remove custom award'}</button></div>
    </>}
    {view === 'history' && <>
      <p>Change any winner, clear an award, add joint winners, or edit an entire selection team. Historical edits replace the recorded honors without replaying games.</p>
      <label>Season / year <input aria-label="Award season" list="studio-seasons" value={season} maxLength={40} onChange={e => { setSeason(e.target.value); setEntries(null); }} /></label><datalist id="studio-seasons">{[...new Set([league.season ?? '', ...(league.franchiseHistory ?? []).map(r => r.season)])].map(y => <option key={y}>{y}</option>)}</datalist>
      <datalist id="studio-player-names">{players.map(p => <option key={p}>{p}</option>)}</datalist>
      <datalist id="studio-team-ids">{historyTeams.map(([id,name])=><option key={id} value={id}>{name}</option>)}</datalist>
      {rows.map((w, i) => <div className="studio-winner" key={i}><label>Winner {i + 1}{draft.kind === 'team' ? <input list="studio-team-ids" value={w.teamId ?? w.playerId} placeholder="Team ID" onChange={e => updateRow(i, { playerId:e.target.value,teamId:e.target.value,teamName:historyTeams.find(([id])=>id===e.target.value)?.[1] ?? w.teamName })} /> : <input list="studio-player-names" value={w.playerId} onChange={e => { const archived = rec?.teamSeasons?.find(t => t.roster.some(p => p.playerId === e.target.value)); const team = league.teams.find(t => t.seasons.some(p => p.playerId === e.target.value)); updateRow(i, { playerId: e.target.value, ...(archived ? { teamId: archived.teamId, teamName: archived.teamName } : team ? { teamId: team.teamId, teamName: team.name } : {}) }); }} />}</label>
        <label>Team ID at time of award<input list="studio-team-ids" value={w.teamId ?? ''} onChange={e => updateRow(i, { teamId:e.target.value || null, ...(draft.kind === 'team' ? {playerId:e.target.value} : {}), teamName:historyTeams.find(([id])=>id===e.target.value)?.[1] ?? w.teamName })} /></label><label>Team at time of award <input value={w.teamName} onChange={e => updateRow(i, { teamName: e.target.value })} /></label>{draft.kind === 'team' && <label>Coach / executive name <input value={w.coachName ?? ''} onChange={e => updateRow(i, { coachName: e.target.value })} /></label>}
        {(id === 'pow' || id === 'pom') && <label>Period <input placeholder="Week 1 / November" value={w.period ?? ''} onChange={e => updateRow(i, { period: e.target.value })} /></label>}<button onClick={() => setEntries(rows.filter((_, j) => j !== i))}>Remove winner</button></div>)}
      {!rows.length && <p>No recorded winners. Add one below, including for a newly entered year.</p>}
      <div className="studio-toolbar"><button onClick={() => setEntries([...rows, { playerId: '', teamId: null, teamName: '', score: 0 }])}>Add winner</button><button onClick={() => setEntries([])}>Clear winners</button><button className="primary" onClick={() => run(() => { onChange(editAwardHistory(league, season.trim(), id, rows)); setEntries(null); }, `Updated ${draft.name} winners for ${season}.`)}>Save winners</button></div>
    </>}
    {view === 'sharing' && <>
      <div className="studio-toolbar"><button onClick={() => downloadPack(exportAwardPack(league, [id]), draft.name)}>Export this award</button><button onClick={() => downloadPack(exportAwardPack(league), 'CourtVision-awards')}>Export all awards</button><button onClick={() => fileInput.current?.click()}>Import award file</button><button disabled={busy} onClick={async () => { setBusy(true); try { setSaves(await listSaves()); } catch (e) { setError(msg(e)); } finally { setBusy(false); } }}>Import award from other leagues</button></div>
      <input ref={fileInput} type="file" accept=".json,.cv-awards.json,application/json" hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { if (f.size > 25_000_000) throw new Error('Award packs must be under 25 MB.'); loadPack(parseAwardPack(await f.text())); } catch (err) { setError(msg(err)); } }} />
      {saves && <div className="studio-toolbar"><label>Source league <select value={source} onChange={e => setSource(e.target.value)}><option value="">Choose a local league</option>{saves.map(s => <option key={s.id} value={s.id}>{s.name} · {s.season}</option>)}</select></label><button disabled={!source || busy} onClick={async () => { setBusy(true); try { const s = await getSave(source); if (!s) throw new Error('That league could not be loaded.'); loadPack(exportAwardPack(s.league)); } catch (e) { setError(msg(e)); } finally { setBusy(false); } }}>Choose awards</button></div>}
      {pack && <><label><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /> Replace definitions with matching IDs (turn off to create separate copies)</label><div className="studio-import-list">{pack.definitions.map(d => <label key={d.id}><input type="checkbox" checked={selected.includes(d.id)} onChange={e => setSelected(e.target.checked ? [...selected, d.id] : selected.filter(x => x !== d.id))} /><AwardArtwork definition={d} size={24} /> {d.name}</label>)}</div><button className="primary" disabled={!selected.length} onClick={() => run(() => { onChange(importAwardPack(league, { ...pack, definitions: pack.definitions.filter(d => selected.includes(d.id)) }, replace)); setPack(null); }, `Imported ${selected.length} award definitions and their images.`)}>Import {selected.length} awards</button></>}
    </>}
  </section>;
}

export function CustomAwardBoard({ league, season, onSelectPlayer }: { league: League; season: string; onSelectPlayer: (id: string) => void }) {
  const rec = league.franchiseHistory?.find(r => r.season === season);
  const live = useMemo(() => rec?.fullAwards ?? computeSeasonAwards(league, awardOptions(league.awardSettings)), [league, rec]);
  const definitions = awardDefinitions(league).filter(d => !Object.hasOwn(defaultKeys, d.id) || league.awardStudio?.definitions.some(x => x.id === d.id && x.method !== 'default'));
  if (!definitions.length) return null;
  return <section><h4>League awards</h4><div className="awards-grid">{definitions.filter(d => d.enabled).map(d => { const winners = league.awardStudio?.history[season]?.[d.id] ?? readAwardWinners(d.id, live, rec); return <article key={d.id} className="award-card studio-custom-card" style={{ borderColor: d.color }}><AwardArtwork definition={d} /><div><h4>{d.name}</h4><p>{d.description}</p>{winners.length ? winners.map((w, i) => <p key={`${w.playerId}-${i}`}>{d.kind === 'team' ? w.coachName || w.teamName : <button className="link-button" onClick={() => onSelectPlayer(w.playerId)}>{w.playerId}</button>}{w.period ? ` · ${w.period}` : ''}</p>) : <p className="hint-text">No winner recorded.</p>}</div></article>; })}</div></section>;
}
const defaultKeys = Object.fromEntries(awardDefinitions({} as League).map(d => [d.id, true]));
