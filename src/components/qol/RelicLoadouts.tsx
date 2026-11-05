import { useState } from 'react';
import { LOADOUT_KEY, LOADOUT_MODES, readLoadouts, loadoutState, compareLuck } from '../../qol/relicLoadouts';
import { type RelicState } from '../../relics/relics';
export function RelicLoadouts({state, commit}: {state: RelicState; commit: (fn: (s: RelicState) => RelicState | null) => void}) {
  const [items, setItems] = useState(readLoadouts), [name, setName] = useState(''), [mode, setMode] = useState<string>('General'), [selected, setSelected] = useState(''), [error, setError] = useState('');
  const list = items.filter(x => x.mode === mode), pick = list.find(x => x.name === selected);
  const comparison = pick ? compareLuck(state, pick.equipped) : null;
  const write = (next: typeof items) => { try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(next)); setItems(next); setError(''); } catch { setError('Could not save this loadout. Browser storage may be full.'); } };
  return <section className="relic-section"><h2>Relic loadouts</h2><p>Named slot arrangements saved on this browser. Choose a mode to organize them; equipping is manual. Secret abilities stay active automatically.</p>
    <label>Mode <select value={mode} onChange={e => {setMode(e.target.value); setSelected('');}}>{LOADOUT_MODES.map(x => <option key={x}>{x}</option>)}</select></label>
    <label>Loadout name <input maxLength={40} value={name} onChange={e => setName(e.target.value)} /></label>
    <button disabled={!name.trim() || (items.length >= 30 && !items.some(x => x.mode === mode && x.name === name.trim()))} onClick={() => { const label = name.trim(); if (items.some(x => x.mode === mode && x.name === label) && !confirm('Replace this saved loadout?')) return; write([...items.filter(x => !(x.mode === mode && x.name === label)), {name: label, mode, equipped: [...state.equipped]}]); setSelected(label); }}>Save current slots</button>
    <label>Saved loadout <select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose a loadout</option>{list.map(x => <option key={x.name}>{x.name}</option>)}</select></label>
    {pick && comparison && <><p>Current luck: +{comparison.current}% → proposed: +{comparison.proposed}% ({(comparison.proposed - comparison.current).toFixed(2)} percentage points). {loadoutState(state, pick.equipped).equipped.length} owned relics will be equipped.</p><button onClick={() => commit(s => loadoutState(s, pick.equipped))}>Equip loadout</button><button onClick={() => {write(items.filter(x => x !== pick)); setSelected('');}}>Delete loadout</button></>}
    <p role="status">{error}</p>
  </section>;
}
