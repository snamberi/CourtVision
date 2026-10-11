import { useState } from 'react';
import type { SeasonCosmetic } from '../../retention/season';
import { Modal } from '../Modal';
import { PixelIcon } from '../PixelIcon';
import { RoadReward } from './RoadReward';
import { asRoadReward, equipSeasonCosmetic } from './seasonEquip';
import './roads.css';

/** The moment a Season Pass tier unlocks cosmetics: what you got, an Equip button for each, and the free spins. */
export function SeasonTierUp({ cosmetics, spins, onClose, onOpenPass }: { cosmetics: SeasonCosmetic[]; spins: number; onClose: () => void; onOpenPass?: () => void }) {
  const [on, setOn] = useState<string[]>([]);
  if (!cosmetics.length) return null;
  return <Modal label="Season Pass reward" onClose={onClose} className="sp-tierup">
    <span className="pixel-eyebrow">SEASON PASS · TIER {Math.max(...cosmetics.map(c => c.tier))}</span>
    <h2>{cosmetics.length === 1 ? 'New cosmetic unlocked!' : `${cosmetics.length} new cosmetics unlocked!`}</h2>
    <ul className="sp-tierup-list">{cosmetics.map(c => {
      const key = `${c.kind}:${c.id}`, done = on.includes(key);
      return <li key={key}>
        <RoadReward {...asRoadReward(c)} titleNote={c.label} />
        <span><b>{c.name}</b><small>{c.label} · tier {c.tier}</small></span>
        <button className={done ? '' : 'primary'} disabled={done} onClick={() => { equipSeasonCosmetic(c); setOn(o => [...o, key]); }}>{done ? 'Equipped' : 'Equip now'}</button>
      </li>;
    })}</ul>
    {spins > 0 && <p className="hint-text"><PixelIcon name="flame" size={14} /> Plus {spins} free Lucky Spin{spins === 1 ? '' : 's'} in the Relic Vault.</p>}
    <div className="sp-tierup-actions">
      {onOpenPass && <button onClick={onOpenPass}>Open the Season Pass</button>}
      <button className="primary" onClick={onClose}>Nice!</button>
    </div>
  </Modal>;
}
