import { useState } from 'react';
import { buyCosmetic, type RelicState } from '../../relics/relics';
import { SHOP_COSMETICS, SHOP_COSMETIC_BY_KEY, type ShopCosmetic } from '../../relics/shopCosmetics';
import { reward, wear } from '../../relics/wearCosmetic';
import { RoadReward } from '../roads/RoadReward';

const RARITY_NAME = { rare: 'Rare', epic: 'Epic', legendary: 'Legendary' } as const;

/** Today's three shop cosmetics (only sold here, and priced high), and how many of the 30 you own. */
export function ShopCosmetics({ state, commit, busy }: { state: RelicState; commit: (fn: (s: RelicState) => RelicState | null) => void; busy: boolean }) {
  const [worn, setWorn] = useState<string | null>(null);
  const owned = state.cosmetics ?? [];
  const offers = (state.cosmeticShop?.offers ?? []).map(k => SHOP_COSMETIC_BY_KEY.get(k)).filter((c): c is ShopCosmetic => !!c);
  return <>
    <h3 className="relic-daily-title">Today's cosmetics <small>3 a day, only sold here · new at midnight UTC · {SHOP_COSMETICS.filter(c => owned.includes(c.key)).length}/{SHOP_COSMETICS.length} owned</small></h3>
    <div className="relic-shop-grid shop-cosmetics">{offers.map(c => {
      const mine = owned.includes(c.key);
      return <div key={c.key} className={`relic-offer shop-cosmetic r-${c.rarity}`}>
        <span className="shop-cosmetic-art"><RoadReward {...reward(c)} /></span>
        <span><b>{c.name}</b><small>{RARITY_NAME[c.rarity]} · {c.label}</small></span>
        {mine
          ? <button onClick={() => { wear(c); setWorn(c.key); }} disabled={worn === c.key}>{worn === c.key ? 'Wearing it' : 'Equip'}</button>
          : <button className={c.rarity === 'legendary' ? 'primary' : ''} onClick={() => commit(s => buyCosmetic(s, c.key, c.price, c.name))} disabled={busy || state.coins < c.price}>{c.price.toLocaleString()} coins</button>}
      </div>;
    })}{!offers.length && <p className="relic-help">You own every shop cosmetic. Nothing left to sell you.</p>}</div>
    <p className="relic-help">Shop cosmetics are yours for good: character pieces, profile icons, name colours and title colours you can't get anywhere else. Change them any time on your Profile.</p>
  </>;
}
