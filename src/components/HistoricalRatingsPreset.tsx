import { useState } from 'react';
import { loadNbaHistory, type NbaHistory } from '../history/nbaHistoryData';
import { searchHistoryPlayers, importableSeasons, historicalRatingPreset } from '../history/importPlayer';
import type { PlayerSeason } from '../simulation/types';
export function HistoricalRatingsPreset({ player, onChange }: { player: PlayerSeason; onChange: (p: PlayerSeason) => void }) {
  const [history, setHistory] = useState<NbaHistory | null>(null), [query, setQuery] = useState(player.playerId);
  const [id, setId] = useState(''), [end, setEnd] = useState(''), [error, setError] = useState('');
  const hp = history?.byId.get(id), seasons = hp && history ? importableSeasons(history, hp) : [];
  return <section className="sandbox-tool"><h4>Historical age presets</h4><p className="hint-text">Copy ratings from a recorded age/season. Current age, identity, measurements and career statistics stay intact. Only ages with historical data are listed.</p>
    {!history ? <button onClick={() => { void loadNbaHistory().then(setHistory).catch(e => setError(String(e))); }}>Load rating presets</button> : <>
      <label>Player <input value={query} onChange={e => { setQuery(e.target.value); setId(''); setEnd(''); }} /></label>
      <select aria-label="Historical player" value={id} onChange={e => { setId(e.target.value); setEnd(''); }}><option value="">Choose player</option>{searchHistoryPlayers(history, query, 30).map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select>
      <select aria-label="Ratings at age" value={end} onChange={e => setEnd(e.target.value)}><option value="">Choose age / season</option>{seasons.map(s => <option key={s.end} value={s.end}>Age {s.age ?? 'unknown'} · {s.end} · {s.ovr ?? '?'} OVR</option>)}</select>
      <button disabled={!id || !end} onClick={() => { try { onChange(historicalRatingPreset(history, id, Number(end), player)); setError('Ratings applied.'); } catch (e) { setError(String(e)); } }}>Apply ratings</button>
    </>}<p role="status">{error}</p></section>;
}
