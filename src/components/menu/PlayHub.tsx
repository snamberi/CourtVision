import type { MenuDesign } from '../../menu/design';
import { useEffect, useState } from 'react';
import { modeById, subModesOf, type ModeEntry } from '../../menu/modeCatalog';
import { localProgress, careerProgress } from '../../menu/inProgress';
import { modeRecords } from '../../menu/modePresentation';
import { modeOfWeek } from '../../retention/modeOfWeek';
import { formatSeasonYear } from '../../simulation/calendar';
import type { SaveSummary } from '../../storage/saves';
import { PixelIcon } from '../PixelIcon';
import { Modal } from '../Modal';
import { ModeIcon } from '../ModeIcon';
import { ModePicker } from './ModePicker';

const entries = ['franchise', 'legends', 'career', 'perfect', 'survival', 'story', 'yourCareer'].map(id => modeById(id)!);

export function PlayHub({ design = 'fieldhouse', onOpen, onContinue, saves, busy }: { design?: MenuDesign; onOpen: (entry: ModeEntry) => void; onContinue: () => void; saves: SaveSummary[]; busy: string | null }) {
  const [selected, setSelected] = useState(entries[0]);
  const [options, setOptions] = useState(false);
  const [progress, setProgress] = useState(localProgress);
  const [records, setRecords] = useState(modeRecords);
  useEffect(() => {
    let live = true;
    import('../../career/storage').then(m => m.listCareers()).then(list => {
      if (!live) return;
      const active = careerProgress(list);
      if (active) setProgress(p => ({ ...p, career: active }));
      const latest = [...list].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (latest) setRecords(r => ({ ...r, career: `${latest.identity.name} · ${latest.years.length} seasons` }));
    }, () => {});
    return () => { live = false; };
  }, []);
  const latest = [...saves].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const feature = modeOfWeek();
  const info = selected.id === 'franchise'
    ? latest && [latest.name, latest.season && formatSeasonYear(latest.season)].filter(Boolean).join(' · ')
    : (selected.action.kind === 'start' ? progress[selected.action.mode] : undefined) ?? records[selected.id];
  const subModes = subModesOf(selected.id);
  const featured = selected.id === feature || (selected.id === 'franchise' && feature === 'rebuild');
  return <>
    <div className="arena-heading"><h1>Play</h1></div>
    <ModePicker design={design} label="Game modes" entries={entries} selected={selected} onSelect={setSelected}
      onPlay={() => onOpen(selected)} busy={busy} badge={featured ? (feature === 'rebuild' ? 'Rebuild · Double XP this week' : 'Double XP this week') : undefined}>
      {selected.id === 'franchise' && <button type="button" disabled={!!busy} onClick={onContinue}>Saved leagues ({saves.length})</button>}
      {subModes.length > 0 && <button type="button" disabled={!!busy} onClick={() => setOptions(true)}>Ways to play</button>}
      {info && <span className="arena-record"><PixelIcon name="star" size={14} />{info}</span>}
    </ModePicker>
    {options && <Modal label={`${selected.title} ways to play`} onClose={() => setOptions(false)} className="arena-dialog">
      <div className="arena-dialog-head"><h2>{selected.title}</h2><button onClick={() => setOptions(false)}>Close</button></div>
      <div className="arena-option-list">{[selected, ...subModes].map(e => <button type="button" key={e.id} disabled={!!busy} onClick={() => onOpen(e)}>
        <ModeIcon mode={e.id} size={38} /><span><strong>{e.title}</strong><small>{e.desc}</small></span><b aria-hidden="true">»</b>
      </button>)}</div>
    </Modal>}
  </>;
}
