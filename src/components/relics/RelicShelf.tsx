import { useEffect, useState } from 'react';
import { loadRelics, RELIC_BY_ID, RELIC_RARITY, RARITY_ORDER, RELICS_EVENT } from '../../relics/relics';
import { PixelIcon } from '../PixelIcon';
import { RelicArt } from './RelicArt';
import './relics.css';

/** Your relic museum on the Profile tab: your six rarest relics (the same shelf friends see on your public profile). */
export function RelicShelf() {
  const [s, setS] = useState(loadRelics);
  useEffect(() => { const on = () => setS(loadRelics()); window.addEventListener(RELICS_EVENT, on); return () => window.removeEventListener(RELICS_EVENT, on); }, []);
  const ids = Object.keys(s.owned).filter(id => (s.owned[id] ?? 0) > 0 && RELIC_BY_ID.has(id))
    .sort((a, b) => RARITY_ORDER.indexOf(RELIC_BY_ID.get(b)!.rarity) - RARITY_ORDER.indexOf(RELIC_BY_ID.get(a)!.rarity) || a.localeCompare(b)).slice(0, 6);
  return <section className="locker-bay relic-shelf" aria-label="Relic museum">
    <h2><PixelIcon name="crown" size={18} /> Relic museum {s.secrets.length > 0 && <small>· {s.secrets.length} secret{s.secrets.length === 1 ? '' : 's'}</small>}</h2>
    {ids.length ? <ul className="relic-museum">{ids.map(id => { const r = RELIC_BY_ID.get(id)!; return <li key={id} className={`r-${r.rarity}`} title={`${r.name} (${RELIC_RARITY[r.rarity].name})`}><RelicArt id={id} size={52} /><small>{r.name}</small></li>; })}</ul>
      : <p className="hint-text">No relics yet. Win runs to earn Relic Spins.</p>}
    <p className="hint-text">Your six rarest relics. Friends see this shelf on your public profile.</p>
  </section>;
}
