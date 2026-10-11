import { useEffect, useRef } from 'react';
import { SECRET_COSMETICS, SECRET_COSMETIC_BY_KEY } from '../../relics/shopCosmetics';
import { SECRET_COSMETIC_CHANCE } from '../../relics/secretCosmetics';
import { reward, wear } from '../../relics/wearCosmetic';
import { RoadReward } from '../roads/RoadReward';
import { PixelIcon } from '../PixelIcon';

/** The eight secret cosmetics: found ones shown, the rest a mystery. */
export function SecretCosmeticsSection({ owned }: { owned: string[] }) {
  const found = SECRET_COSMETICS.filter(c => owned.includes(c.key)).length;
  return <section className="relic-section" aria-labelledby="secret-looks">
    <h2 id="secret-looks">Secret cosmetics <small>{found}/{SECRET_COSMETICS.length} found</small></h2>
    <p className="relic-help">Every spin has a {(SECRET_COSMETIC_CHANCE * 100).toFixed(1)}% chance to also drop a secret cosmetic you don't have (double on a Lucky Spin). They can't be bought.</p>
    <div className="relic-grid secret-looks">{SECRET_COSMETICS.map(c => {
      const has = owned.includes(c.key);
      return <div key={c.key} className={`relic-card shop-cosmetic ${has ? 'r-legendary' : 'missing'}`}>
        <span className="shop-cosmetic-art">{has ? <RoadReward {...reward(c)} /> : <PixelIcon name="lock" size={28} />}</span>
        <span><b>{has ? c.name : '???'}</b><small>{has ? `${c.label} · equip it on your Profile` : `A secret ${c.label.toLowerCase()}`}</small></span>
      </div>;
    })}</div>
  </section>;
}

/** The moment a spin drops a secret cosmetic. */
export function SecretCosmeticFound({ keyId, onClose }: { keyId: string; onClose: () => void }) {
  const c = SECRET_COSMETIC_BY_KEY.get(keyId);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  if (!c) return null;
  return <div className="relic-big-backdrop" onClick={onClose}>
    <div className="relic-big r-legendary" role="dialog" aria-modal="true" aria-label={`Secret cosmetic: ${c.name}`} onClick={e => e.stopPropagation()}>
      <div className="relic-big-rays" aria-hidden="true" />
      <span className="shop-cosmetic-art secret-found-art"><RoadReward {...reward(c)} /></span>
      <span className="pixel-eyebrow">SECRET COSMETIC FOUND</span>
      <h2>{c.name}</h2>
      <p>A secret {c.label.toLowerCase()}, yours for good. Only spins drop these.</p>
      <div className="relic-big-actions"><button className="primary" onClick={() => { wear(c); onClose(); }}>Equip now</button><button ref={close} onClick={onClose}>Later</button></div>
    </div>
  </div>;
}
