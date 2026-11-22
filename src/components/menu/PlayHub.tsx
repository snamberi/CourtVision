import { menuArt } from '../../menu/art';
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
import { LaunchBar, PosterDeck } from './PosterDeck';

const POSTERS = {
  franchise: ['Build a dynasty.', 'Draft and trade players.', 'Win championships.'],
  legends: ['Spin your squad.', 'Face ten historic teams.', 'Conquer every era.'],
  career: ['Create your player.', 'Grow your legacy.', 'Reach the Hall of Fame.'],
  perfect: ['Draft an all-time team.', 'Win all 82 games.', 'Go 16–0 in the playoffs.'],
  survival: ['Start with ten legends.', 'Trade after every win.', 'Survive your next rival.'],
  story: ['Start on the blacktop.', 'Choose your path.', 'Discover nine endings.'],
  yourCareer: ['Start at age thirteen.', 'Choose your school.', 'Earn your first contract.'],
} as const;
type PlayId = keyof typeof POSTERS;
const entries = Object.keys(POSTERS).map(id => modeById(id)!);

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
  const info = (id: PlayId) => id === 'franchise' ? latest && `${latest.name}${latest.season ? ' · ' + formatSeasonYear(latest.season) : ''}` : progress[id] ?? records[id];
  const subModes = subModesOf(selected.id);
  return <>
    <div className="arena-heading"><h1>Play <i aria-hidden="true">»</i></h1><p>Choose a game mode</p></div>
    <PosterDeck label="Game modes" entries={entries} selected={selected} onSelect={setSelected} art={e => menuArt(e.id, design)}
      badge={e => e.id === feature || (e.id === 'franchise' && feature === 'rebuild') ? '2× XP · ' + (feature === 'rebuild' ? 'Rebuild' : 'Featured') : undefined}>
      {entry => <span className="arena-facts">{POSTERS[entry.id as PlayId].map((line, i) =>
        <span key={line}><PixelIcon name={i === 0 ? entry.icon : i === 1 ? 'team' : 'trophy'} size={16} />{line}</span>)}</span>}
    </PosterDeck>
    <LaunchBar entry={selected} onPlay={() => onOpen(selected)} busy={busy}>
      {selected.id === 'franchise' && <button type="button" disabled={!!busy} onClick={onContinue}><PixelIcon name="list" size={16} />Saved leagues ({saves.length})</button>}
      {subModes.length > 0 && <button type="button" disabled={!!busy} onClick={() => setOptions(true)}><PixelIcon name="grid" size={16} />Ways to play</button>}
      {info(selected.id as PlayId) && <span className="arena-record"><PixelIcon name="star" size={14} />{info(selected.id as PlayId)}</span>}
    </LaunchBar>
    {options && <Modal label={`${selected.title} ways to play`} onClose={() => setOptions(false)} className="arena-dialog">
      <div className="arena-dialog-head"><h2>{selected.title}</h2><button onClick={() => setOptions(false)}>Close</button></div>
      <div className="arena-option-list">{[selected, ...subModes].map(e => <button type="button" key={e.id} disabled={!!busy} onClick={() => onOpen(e)}>
        <ModeIcon mode={e.id} size={38} /><span><strong>{e.title}</strong><small>{e.desc}</small></span><b aria-hidden="true">»</b>
      </button>)}</div>
    </Modal>}
  </>;
}
