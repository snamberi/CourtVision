import { PixelIcon } from '../PixelIcon';
import { ProfileIcon } from '../ProfileIcon';
import { ICONS } from '../../profile/cosmetics';
import { useEntitlements, activeProducts } from '../../billing/billing';
import { PRODUCTS } from '../../billing/products';
import { IS_DESKTOP_BUILD } from '../../appMode';

/** One icon to stand for each product in the summary. */
const iconFor = (id: string) => ICONS.find(i => id === 'supporter' ? 'supporter' in i.rule : 'product' in i.rule && i.rule.product === id)?.id;

/**
 * The Passes tab of the Player Profile: what this account has from the Support Shop, and the way to the shop
 * (#/support), where the passes and bundles are bought and monthly passes are cancelled.
 */
export function PassesPanel() {
  const owned = useEntitlements();
  const active = activeProducts(owned);
  return <section className="locker-bay passes">
    <h2><PixelIcon name="star" size={18} /> Passes</h2>
    <p className="hint-text">Court Vision is free and stays free. You never have to buy anything: passes and bundles only help pay for hosting, and unlock cosmetics or ad-free play. Nothing makes a team, a player, a spin or a pick any better.</p>
    {IS_DESKTOP_BUILD ? <p className="empty-state">The Windows edition has no ads. The Support Shop is on the website version.</p> : <>
      {active.length > 0 && <ul className="pass-owned">{active.map(id => { const p = PRODUCTS.find(x => x.id === id)!; const icon = iconFor(id);
        return <li key={id}>{icon && <ProfileIcon id={icon} size={24} title="" />}<b>{p.name}</b></li>; })}</ul>}
      {owned.noAds && !active.includes('noAds') && !owned.supporter && <p className="hint-text">You have the lifetime No-Ads Pass.</p>}
      <a className="pass-buy primary" href="#/support">{active.length ? 'Open the Support Shop (manage or cancel)' : 'Open the Support Shop'}</a>
    </>}
  </section>;
}
