import { useEffect, useState } from 'react';
import { PixelIcon } from '../PixelIcon';
import { ProfileIcon, NameTag } from '../ProfileIcon';
import { ICONS, NAME_COLORS, type Rule } from '../../profile/cosmetics';
import { useAccount, refreshProfile, cloudEnabled, accessToken } from '../../cloud/account';
import { openSignIn } from '../../cloud/signIn';
import { useEntitlements, checkoutUrl, passesOnSale, PASS_URLS, activeProducts, cancelSubscription, type Entitlements, type SubscriptionKind } from '../../billing/billing';
import { PRODUCTS, type Product } from '../../billing/products';
import { IS_DESKTOP_BUILD } from '../../appMode';
import './shop.css';

/** Re-reads the profile (and with it the purchases); offline just leaves things as they are. */
async function refreshQuietly(): Promise<void> { try { await refreshProfile(); } catch { /* offline */ } }
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');
/** The cosmetics a product unlocks (the Supporter Pass's are the long-standing { supporter: true } ones). */
const unlocks = (p: Product) => (rule: Rule) => p.id === 'supporter' ? 'supporter' in rule : 'product' in rule && rule.product === p.id;
const cosmeticsOf = (p: Product) => ({ icons: ICONS.filter(i => unlocks(p)(i.rule)), colors: NAME_COLORS.filter(c => unlocks(p)(c.rule)) });

const buyLabel = (p: Product) => {
  if (p.flexible) return 'Choose your amount';
  return p.billing === 'monthly' ? `Subscribe · ${p.price}/mo` : `Buy · ${p.price}`;
};
const priceNote = (p: Product) => {
  if (p.billing === 'monthly') return 'per month · cancel any time';
  return p.flexible ? 'or more, you choose' : 'one-time';
};

/** A monthly pass's state: when it renews or ends, and where Lemon Squeezy lets the buyer manage it. */
function subState(kind: SubscriptionKind, e: Entitlements) {
  return kind === 'supporter'
    ? { until: e.supporterUntil, status: e.supporterStatus, portal: e.portal }
    : { until: e.noAdsUntil, status: e.noAdsStatus, portal: e.noAdsPortal };
}

/**
 * The Support Shop (#/support): the two monthly passes and the four one-time bundles, sold through Lemon Squeezy.
 * Everything is optional and cosmetic; the header says so before anything else.
 */
export function SupportShop({ onExit, onProfile }: { onExit: () => void; onProfile: () => void }) {
  const account = useAccount();
  const owned = useEntitlements();
  const [checking, setChecking] = useState(false);
  const [confirm, setConfirm] = useState<Product | null>(null);
  const signedIn = account.status === 'signedIn' && !!account.userId;
  const active = activeProducts(owned);
  // Coming back from a checkout tab: look again for the purchase.
  useEffect(() => {
    if (!signedIn) return;
    const again = () => { if (document.visibilityState === 'visible') void refreshQuietly(); };
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [signedIn]);
  const recheck = async () => { setChecking(true); await refreshQuietly(); setChecking(false); };
  const name = account.profile?.username || 'You';

  const card = (p: Product) => {
    const has = active.includes(p.id);
    const { icons, colors } = cosmeticsOf(p);
    const monthly = p.billing === 'monthly';
    const sub = monthly ? subState(p.id as SubscriptionKind, owned) : null;
    const cancelled = sub?.status === 'cancelled';
    const url = signedIn ? checkoutUrl(p.id, account.userId!, account.email) : null;
    let action: React.ReactNode;
    if (has && monthly) {
      action = <>
        <strong className="shop-status ok">{cancelled ? `Cancelled · perks until ${day(sub?.until)}` : `Active${sub?.until ? ` · renews ${day(sub.until)}` : ''}`}</strong>
        {!cancelled && <button type="button" className="shop-cancel" onClick={() => setConfirm(p)}>Cancel pass</button>}
      </>;
    } else if (has) {
      action = <strong className="shop-status ok"><PixelIcon name="check" size={14} /> Owned · thank you!</strong>;
    } else if (p.id === 'noAds' && owned.noAds) {
      action = <strong className="shop-status ok">{owned.supporter ? 'Ads are already off with your Supporter Pass' : 'You already have the lifetime No-Ads Pass'}</strong>;
    } else if (!PASS_URLS[p.id]) {
      action = <small className="shop-status">Not on sale here yet</small>;
    } else if (!url) {
      action = <button type="button" className="shop-buy" onClick={openSignIn}>Sign in to buy</button>;
    } else {
      action = <a className="shop-buy" href={url} target="_blank" rel="noopener noreferrer">{buyLabel(p)}</a>;
    }
    return <article key={p.id} className={`shop-card${has ? ' owned' : ''}${p.id === 'bundleFounder' ? ' legendary' : ''}`} style={{ '--accent': p.accent } as React.CSSProperties}>
      <div className="shop-card-art" aria-hidden="true">
        <span className="shop-card-glow" />
        {icons[0] && <ProfileIcon id={icons[0].id} size={72} title="" />}
      </div>
      <header>
        <h3>{p.name}</h3>
        <span className="shop-price"><b>{p.price}</b><small>{priceNote(p)}</small></span>
      </header>
      <p className="shop-tagline">{p.tagline}</p>
      <div className="shop-preview" aria-label={`Preview: your name with the ${p.name} look`}>
        <NameTag name={name} icon={icons[0]?.id ?? null} color={colors[0]?.id} title={p.title} size={18} />
      </div>
      <ul className="shop-perks">{p.perks.map(t => <li key={t}>{t}</li>)}</ul>
      {icons.length > 1 && <div className="shop-icons">{icons.map(i => <ProfileIcon key={i.id} id={i.id} size={30} title={i.name} />)}</div>}
      <footer>{action}</footer>
    </article>;
  };

  return <main className="support-shop">
    <div className="shop-top">
      <button type="button" className="chip-button" onClick={onExit}><PixelIcon name="exit" size={14} /> Menu</button>
    </div>
    <header className="shop-hero">
      <p className="pixel-eyebrow">SUPPORT SHOP</p>
      <h1>Help keep the courts lit</h1>
      <div className="shop-disclaimer" role="note">
        <PixelIcon name="heart" size={20} />
        <p><b>You never have to buy anything.</b> Court Vision is free and always will be. Everything here is optional and goes toward hosting and servers.
          It only unlocks cosmetics and ad-free play: every mode, level and achievement stays open to everyone, and nothing here makes a team, a player, a spin or a pick any better.</p>
      </div>
    </header>

    {IS_DESKTOP_BUILD ? <p className="empty-state">The Windows edition has no ads. The Support Shop is on the website version.</p> : <>
      {!cloudEnabled && <p className="hint-text">Accounts are not set up on this site, so nothing can be bought here.</p>}
      {cloudEnabled && !signedIn && <p className="shop-signin">Purchases belong to your free account, so they follow you to every device. <button type="button" className="link-button" onClick={openSignIn}>Sign in</button></p>}
      <section className="shop-section">
        <h2><PixelIcon name="star" size={18} /> Monthly passes</h2>
        <div className="shop-grid">{PRODUCTS.filter(p => p.billing === 'monthly').map(card)}</div>
      </section>
      <section className="shop-section">
        <h2><PixelIcon name="trophy" size={18} /> One-time bundles</h2>
        <div className="shop-grid">{PRODUCTS.filter(p => p.billing === 'once').map(card)}</div>
      </section>
      {active.length > 0 && <p className="hint-text">Your cosmetics are in your <button type="button" className="link-button" onClick={onProfile}>Profile</button>: pick an icon, name colour and title.</p>}
      {signedIn && passesOnSale() && <p className="hint-text">Just paid? It can take a minute to arrive. <button type="button" className="link-button" disabled={checking} onClick={recheck}>{checking ? 'Checking…' : 'Check again'}</button></p>}
      <p className="hint-text shop-fine">Payments, receipts, tax and refunds are handled by Lemon Squeezy, our reseller and merchant of record. Monthly passes renew each month until you cancel;
        cancelling stops the next payment and you keep the perks until the end of the month you paid for. Bundles are one-time and yours for good. Deleting your account removes what you own and doesn't cancel a monthly pass, so cancel first.
        Questions or a refund? Ask on our Discord.</p>
    </>}
    {confirm && <CancelDialog product={confirm} owned={owned} onClose={() => setConfirm(null)} />}
  </main>;
}

/** "Are you sure?" for cancelling a monthly pass, then the cancel itself (or Lemon Squeezy's page as a fallback). */
function CancelDialog({ product, owned, onClose }: { product: Product; owned: Entitlements; onClose: () => void }) {
  const kind = product.id as SubscriptionKind;
  const sub = subState(kind, owned);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [busy, onClose]);
  const go = async () => {
    const token = accessToken();
    if (!token) { setError('Sign in again, then try once more.'); return; }
    setBusy(true); setError(null);
    const r = await cancelSubscription(kind, token);
    if (r === 'portal') {
      if (sub.portal) { window.open(sub.portal, '_blank', 'noopener'); onClose(); } else setError('Open the receipt email from Lemon Squeezy and use "Manage subscription" to cancel.');
    } else if (r) setError(r);
    else { setDone(true); void refreshQuietly(); }
    setBusy(false);
  };
  return <div className="shop-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-title" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div className="shop-modal-box">
      {done ? <>
        <h2 id="cancel-title">Cancelled</h2>
        <p>Your {product.name} won't renew. You keep everything until the end of the month you paid for. Thank you for supporting Court Vision!</p>
        <div className="shop-modal-actions"><button type="button" className="shop-buy" onClick={onClose} autoFocus>Close</button></div>
      </> : <>
        <h2 id="cancel-title">Cancel your {product.name}?</h2>
        <p>No more payments after this. You keep the perks{sub.until ? ` until ${day(sub.until)}` : ' until the end of this month'}, and you can subscribe again any time.</p>
        {error && <p className="shop-error" role="alert">{error}</p>}
        <div className="shop-modal-actions">
          <button type="button" className="shop-keep" onClick={onClose} disabled={busy} autoFocus>Keep it</button>
          <button type="button" className="shop-cancel" onClick={() => void go()} disabled={busy}>{busy ? 'Cancelling…' : 'Yes, cancel'}</button>
        </div>
        {sub.portal && <p className="hint-text"><a href={sub.portal} target="_blank" rel="noopener noreferrer">Or manage it on Lemon Squeezy</a></p>}
      </>}
    </div>
  </div>;
}
