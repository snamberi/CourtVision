import { useCallback, useEffect, useRef, useState } from 'react';
import { AD_CONFIG, type AdSlot, type Sponsor } from '../ads/adConfig';
import { loadAdsenseScript } from '../ads/adsense';
import { useConsent } from '../consent/consent';
import { advertisingPermitted } from '../ads/adPolicy';
import { mayRetryAd, noteAdRequest, noteAdRetry } from '../ads/adRetry';

/** How long to wait for Google to mark a unit filled before trusting a rendered ad frame instead. */
const FILL_FALLBACK_MS = 3000;
function AdsenseUnit({ client, slotId, onUnavailable, onFilled }: { client: string; slotId: string; onUnavailable: () => void; onFilled: () => void }) {
  const unit = useRef<HTMLModElement>(null);
  useEffect(() => {
    let cancelled = false;
    let pushed = false;
    let fallback: number | undefined;
    const element = unit.current!;
    const check = () => {
      if (cancelled) return;
      if (element.dataset.adStatus === 'unfilled') onUnavailable();
      else if (element.dataset.adStatus === 'filled') onFilled();
    };
    const observer = new MutationObserver(check);
    observer.observe(element, { attributes: true, attributeFilter: ['data-ad-status'] });
    const submit = () => {
      if (cancelled || pushed || element.clientWidth < 1) return;
      pushed = true;
      // Older ad tags never set data-ad-status: reveal a unit once Google has rendered an ad frame into it.
      fallback = window.setTimeout(() => {
        if (!cancelled && !element.dataset.adStatus && element.querySelector('iframe') && element.offsetHeight > 0) onFilled();
      }, FILL_FALLBACK_MS);
      if (element.dataset.adsbygoogleStatus) return;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
      catch { onUnavailable(); }
    };
    let ready = false;
    const onResize = () => { if (ready) submit(); };
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
    resize?.observe(element);
    window.addEventListener('resize', onResize);
    loadAdsenseScript(client).then(ok => {
      if (cancelled) return;
      if (!ok) { onUnavailable(); return; }
      ready = true; submit();
    });
    return () => { cancelled = true; window.clearTimeout(fallback); observer.disconnect(); resize?.disconnect(); window.removeEventListener('resize', onResize); };
  }, [client, slotId, onUnavailable, onFilled]);
  return <ins ref={unit} className="adsbygoogle ad-adsense" style={{ display: 'block', minHeight: 90 }} data-ad-client={client} data-ad-slot={slotId} data-ad-format="auto" data-full-width-responsive="true" />;
}

function SponsorCreative({ sponsor }: { sponsor: Sponsor }) {
  const inner = sponsor.imageSrc ? (
    <img className="ad-image" src={sponsor.imageSrc} alt={sponsor.alt ?? sponsor.headline ?? 'Advertisement'} />
  ) : (
    <div className="ad-text">
      <strong className="ad-headline">{sponsor.headline}</strong>
      {sponsor.body && <span className="ad-body">{sponsor.body}</span>}
      {sponsor.cta && <span className="ad-cta">{sponsor.cta}</span>}
    </div>
  );
  return sponsor.href ? (
    <a className="ad-creative" href={sponsor.href} target="_blank" rel="sponsored noopener noreferrer">{inner}</a>
  ) : (
    <div className="ad-creative">{inner}</div>
  );
}

/**
 * One advertisement banner. `slot` picks the placement (and its size class): 'top' is the slim strip under the
 * header, 'inline' sits at the end of each page's content, 'menu' closes out the main menu. Always labelled
 * "Advertisement" so it can't be mistaken for app content.
 *
 * A Google unit stays collapsed until Google reports an ad, so an empty ("unfilled") response never flashes a
 * frame that then vanishes. `refreshKey` (the current page) lets an unfilled placement ask again after the player
 * navigates — never on a timer, and never for a unit that already shows an ad.
 */
export function AdBanner({ slot, refreshKey }: { slot: AdSlot; refreshKey?: string }) {
  // Filler sponsors are for development only - a published site shows real ads or nothing.
  const sponsors = AD_CONFIG.sponsors.filter((sp) => !sp.placeholder || import.meta.env.DEV);
  const consent = useConsent();
  const [unavailable, setUnavailable] = useState(false);
  const [filled, setFilled] = useState(false);
  const fail = useCallback(() => setUnavailable(true), []);
  const fill = useCallback(() => setFilled(true), []);
  // A consent change starts over (adjusted during render rather than in an effect).
  const [seenConsent, setSeenConsent] = useState(consent.advertisingAllowed);
  if (seenConsent !== consent.advertisingAllowed) { setSeenConsent(consent.advertisingAllowed); setUnavailable(false); setFilled(false); }
  const [index, setIndex] = useState(() => (slot === 'top' ? 0 : slot === 'inline' ? 1 : 0) % Math.max(1, sponsors.length));

  const adsenseSlotId = AD_CONFIG.adsenseSlots[slot];
  // Google ads load only with the visitor's permission - or, when Google's own consent tool is in use, once that tool allows it.
  const adsAllowed = advertisingPermitted(consent);
  const useAdsense = !unavailable && adsAllowed && !!AD_CONFIG.adsenseClient && !!adsenseSlotId;

  // After an unfilled answer, the next navigation may ask once more (rate-limited, see ads/adRetry.ts).
  const [retry, setRetry] = useState({ key: refreshKey, attempt: 0 });
  if (retry.key !== refreshKey) {
    const again = unavailable && adsAllowed && mayRetryAd(slot);
    setRetry({ key: refreshKey, attempt: retry.attempt + (again ? 1 : 0) });
    if (again) { setUnavailable(false); setFilled(false); }
  }
  const attempt = retry.attempt;
  useEffect(() => { if (attempt > 0) noteAdRetry(slot); }, [attempt, slot]);
  useEffect(() => { if (useAdsense) noteAdRequest(slot); }, [useAdsense, attempt, slot]);

  useEffect(() => {
    if (sponsors.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % sponsors.length), AD_CONFIG.rotateEveryMs);
    return () => clearInterval(t);
  }, [sponsors.length]);

  if (!AD_CONFIG.enabled) return null;
  if (!useAdsense && sponsors.length === 0) return null;

  return (
    <aside className={`ad-banner ad-${slot}`} aria-label="Advertisement" data-state={useAdsense ? (filled ? 'filled' : 'waiting') : 'sponsor'}>
      <span className="ad-label">Advertisement</span>
      {useAdsense
        ? <AdsenseUnit key={attempt} client={AD_CONFIG.adsenseClient} slotId={adsenseSlotId!} onUnavailable={fail} onFilled={fill} />
        : <SponsorCreative sponsor={sponsors[index % sponsors.length]} />}
    </aside>
  );
}
