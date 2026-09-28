import { useEffect, useState } from 'react';
import { PixelIcon } from '../PixelIcon';
import { ProfileIcon } from '../ProfileIcon';
import { ICONS, NAME_COLORS, SUPPORTER_TITLE } from '../../profile/cosmetics';
import { useAccount, refreshProfile, cloudEnabled } from '../../cloud/account';
import { useEntitlements, checkoutUrl, passesOnSale, PASS_URLS, type PassKind } from '../../billing/billing';
import { IS_DESKTOP_BUILD } from '../../appMode';

const supporterIcons = ICONS.filter(i => 'supporter' in i.rule);
const supporterColors = NAME_COLORS.filter(c => 'supporter' in c.rule);
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

/**
 * The passes (the Passes tab of the Player Profile): the No-Ads Pass and the Supporter Pass, sold through Lemon
 * Squeezy. Both are cosmetic or ad-free only; nothing here makes a team, a player or a spin better.
 */
export function PassesPanel() {
  const account = useAccount();
  const owned = useEntitlements();
  const [checking, setChecking] = useState(false);
  const signedIn = account.status === 'signedIn' && !!account.userId;
  // Coming back from a checkout tab: look again for the pass.
  useEffect(() => {
    if (!signedIn) return;
    const again = () => { if (document.visibilityState === 'visible') void refreshProfile().catch(() => null); };
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [signedIn]);
  const recheck = async () => { setChecking(true); try { await refreshProfile(); } catch { /* offline */ } setChecking(false); };

  const buy = (kind: PassKind, label: string) => {
    const url = signedIn ? checkoutUrl(kind, account.userId!, account.email) : null;
    if (!PASS_URLS[kind]) return <small className="pass-status">Not on sale here yet</small>;
    if (!url) return <small className="pass-status">Sign in to buy (from the main menu), so the pass follows your account</small>;
    return <a className="pass-buy primary" href={url} target="_blank" rel="noopener noreferrer">{label}</a>;
  };

  const supporterNote = owned.supporter
    ? owned.supporterStatus === 'cancelled' ? `Cancelled; perks last until ${day(owned.supporterUntil)}` : `Active${owned.supporterUntil ? ` · renews by ${day(owned.supporterUntil)}` : ''}`
    : owned.supporterUntil ? `Ended ${day(owned.supporterUntil)}` : null;

  return <section className="locker-bay passes">
    <h2><PixelIcon name="star" size={18} /> Passes</h2>
    <p className="hint-text">Court Vision is free and stays free. A pass takes the ads away and helps pay for the servers; it never makes a team, a player, a spin or a pick any better, and every mode, level and achievement stays open to everyone.</p>
    {IS_DESKTOP_BUILD ? <p className="empty-state">The Windows edition has no ads. Passes are on the website version.</p> : <>
      <div className="pass-cards">
        <article className={`pass-card ${owned.noAds ? 'owned' : ''}`}>
          <header><b>No-Ads Pass</b><span>one-time</span></header>
          <ul><li>No ad banners, anywhere, for good</li><li>On every device you sign in on</li></ul>
          <footer>{owned.noAds ? <strong className="pass-status ok">Owned</strong> : owned.supporter ? <small className="pass-status">Included while your Supporter Pass is active</small> : buy('noAds', 'Get the No-Ads Pass')}</footer>
        </article>
        <article className={`pass-card supporter ${owned.supporter ? 'owned' : ''}`}>
          <header><b>Supporter Pass</b><span>monthly · cancel any time</span></header>
          <ul><li>No ads while it is active</li><li>The <b>{SUPPORTER_TITLE}</b> title</li>
            <li>{supporterColors.map(c => c.name).join(' and ')} name colours</li>
            <li className="pass-icons">{supporterIcons.map(i => <ProfileIcon key={i.id} id={i.id} size={28} title={i.name} />)}<span>{supporterIcons.length} supporter icons</span></li></ul>
          <footer>{supporterNote && <strong className={`pass-status ${owned.supporter ? 'ok' : ''}`}>{supporterNote}</strong>}
            {owned.supporter && owned.portal ? <a className="pass-buy" href={owned.portal} target="_blank" rel="noopener noreferrer">Manage or cancel</a> : !owned.supporter && buy('supporter', 'Become a Supporter')}</footer>
        </article>
      </div>
      {signedIn && passesOnSale() && <p className="hint-text">Just paid? It can take a minute to arrive. <button className="link-button" disabled={checking} onClick={recheck}>{checking ? 'Checking…' : 'Check again'}</button></p>}
      {!cloudEnabled && <p className="hint-text">Accounts are not set up on this site, so passes can't be bought here.</p>}
      <p className="hint-text pass-fine">Payments, receipts and refunds are handled by Lemon Squeezy, our reseller and merchant of record. A pass belongs to your account; deleting the account removes it, and doesn't cancel a Supporter Pass, so cancel that first under Manage or cancel.</p>
    </>}
  </section>;
}
