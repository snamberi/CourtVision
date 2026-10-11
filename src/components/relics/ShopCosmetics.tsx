import { useState } from 'react';
import { buyCosmetic, toggleWish, type RelicState } from '../../relics/relics';
import { SHOP_COSMETICS, SHOP_COSMETIC_BY_KEY, type ShopCosmetic } from '../../relics/shopCosmetics';
import { reward, wear } from '../../relics/wearCosmetic';
import { RoadReward } from '../roads/RoadReward';
import { PixelIcon } from '../PixelIcon';

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
        <span><b>{c.name}{(state.wishlist ?? []).includes(c.key) && !mine ? ' ★' : ''}</b><small>{RARITY_NAME[c.rarity]} · {c.label}{(state.wishlist ?? []).includes(c.key) && !mine ? ' · on your wish list!' : ''}</small></span>
        {mine
          ? <button onClick={() => { wear(c); setWorn(c.key); }} disabled={worn === c.key}>{worn === c.key ? 'Wearing it' : 'Equip'}</button>
          : <button className={c.rarity === 'legendary' ? 'primary' : ''} onClick={() => commit(s => buyCosmetic(s, c.key, c.price, c.name))} disabled={busy || state.coins < c.price}>{c.price.toLocaleString()} coins</button>}
      </div>;
    })}{!offers.length && <p className="relic-help">You own every shop cosmetic. Nothing left to sell you.</p>}</div>
    <details className="shop-wishlist">
      <summary>All {SHOP_COSMETICS.length} shop cosmetics · star the ones you want and your phone tells you the day they're on sale</summary>
      <div className="relic-shop-grid shop-cosmetics">{SHOP_COSMETICS.map(c => {
        const mine = owned.includes(c.key), wished = (state.wishlist ?? []).includes(c.key);
        return <div key={c.key} className={`relic-offer shop-cosmetic r-${c.rarity} ${mine ? 'owned' : ''}`}>
          <span className="shop-cosmetic-art"><RoadReward {...reward(c)} /></span>
          <span><b>{c.name}</b><small>{RARITY_NAME[c.rarity]} · {c.label} · {c.price.toLocaleString()} coins</small></span>
          {mine ? <span className="hint-text">Owned</span>
            : <button aria-pressed={wished} className={wished ? 'primary' : ''} onClick={() => commit(s => toggleWish(s, c.key))} title={wished ? 'Starred: tap to unstar' : 'Star it'}><PixelIcon name="star" size={14} /> {wished ? 'Starred' : 'Star'}</button>}
        </div>;
      })}</div>
    </details>
    <p className="relic-help">Shop cosmetics are yours for good: character pieces, profile icons, name colours and title colours you can't get anywhere else. Change them any time in your Closet.</p>
  </>;
}
