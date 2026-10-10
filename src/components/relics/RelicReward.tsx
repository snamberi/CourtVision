import { useEffect, useState } from 'react';
import { loadRelics, rewardOf, luckPercent, RELIC_BY_ID, SECRET_BY_ID, RELICS_EVENT } from '../../relics/relics';
import { PixelIcon } from '../PixelIcon';
import './relics.css';

const openVault = () => { window.location.hash = '#/relics'; };

/** What a finished run paid into the Relic Vault, on its end screen. */
export function RelicReward({ rewardKey }: { rewardKey: string }) {
  const [r, setR] = useState(() => rewardOf(loadRelics(), rewardKey));
  useEffect(() => {
    const on = () => setR(rewardOf(loadRelics(), rewardKey));
    on();
    window.addEventListener(RELICS_EVENT, on); return () => window.removeEventListener(RELICS_EVENT, on);
  }, [rewardKey]);
  if (!r) return null;
  const secret = r.secret ? SECRET_BY_ID.get(r.secret) : undefined;
  return <div className={`relic-reward ${secret ? 'secret' : ''}`} role="status">
    <PixelIcon name={secret ? 'crown' : r.spins ? 'star' : 'chart'} size={20} />
    <span>
      <b>{[r.spins ? `+${r.spins} Relic Spin${r.spins === 1 ? '' : 's'}` : '', `+${r.coins} coins`].filter(Boolean).join(' · ')}</b>
      {secret && <small>Secret relic uncovered: <b>{secret.name}</b> ({secret.ability})</small>}
    </span>
    <button className={r.spins || secret ? 'primary' : ''} onClick={openVault}>{r.spins ? 'Spin them' : 'Relic Vault'}</button>
  </div>;
}

/** Your relics in their slots: a little trophy case for the Career player's page. */
export function RelicCase() {
  const [s] = useState(loadRelics);
  const relics = s.equipped.map(id => RELIC_BY_ID.get(id)).filter(r => !!r);
  if (!relics.length && !s.secrets.length) return null;
  return <section className="relic-case" aria-label="Relic case">
    <span className="pixel-eyebrow">RELIC CASE · +{luckPercent(s)}% LUCK</span>
    <ul>
      {relics.map(r => <li key={r.id} className={`r-${r.rarity}`} title={`${r.name}: ${r.blurb}`}><PixelIcon name={r.icon} size={18} /><small>{r.name}</small></li>)}
      {s.secrets.map(id => <li key={id} className="r-secret" title={SECRET_BY_ID.get(id)?.ability}><PixelIcon name="crown" size={18} /><small>{SECRET_BY_ID.get(id)?.name}</small></li>)}
    </ul>
  </section>;
}

/** "Relic luck +12%" on a spin screen (nothing when the run has no luck). */
export function LuckChip({ luck }: { luck?: number }) {
  if (!luck) return null;
  return <span className="relic-luck-chip" title="Your relics make the best results of a spin likelier (not in Dailies, Weeklies or duels)."><PixelIcon name="star" size={12} /> Relic luck +{+(luck * 100).toFixed(1)}%</span>;
}
