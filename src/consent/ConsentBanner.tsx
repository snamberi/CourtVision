import { useEffect, useState } from 'react';
import { useConsent, saveConsent, openPreferences, closePreferences } from './consent';
import { unloadAdsense, showGoogleConsentChoices } from '../ads/adsense';
import { AD_CONFIG } from '../ads/adConfig';
import { advertisingPermitted } from '../ads/adPolicy';
import { IS_DESKTOP_BUILD } from '../appMode';
import { PRIVACY_HASH } from '../components/PrivacyPolicyPage';

/**
 * First-visit cookie banner plus a re-openable "Cookie settings" panel, for the web build only.
 *
 * CourtVision itself never asks for consent to function - saves are stored locally regardless (that's
 * "Strictly necessary" below, and it's the only thing the offline Windows edition ever uses). The one
 * thing that needs a yes/no is Google AdSense, which is not loaded until the visitor says yes here (see
 * ads/adsense.ts and components/AdBanner.tsx, which both check useConsent().advertisingAllowed).
 *
 * If `AD_CONFIG.googleCmp` is turned on instead, Google's own certified consent message (configured in
 * the AdSense dashboard) handles this and this banner stays hidden, to avoid asking twice.
 */
export function ConsentBanner() {
  const consent = useConsent();
  const [expanded, setExpanded] = useState(false);
  const [draftAdvertising, setDraftAdvertising] = useState(consent.record?.advertising ?? false);

  useEffect(() => { if (consent.preferencesOpen) setDraftAdvertising(consent.record?.advertising ?? false); }, [consent.preferencesOpen, consent.record?.advertising]);
  const permitted = advertisingPermitted(consent);
  useEffect(() => { if (!permitted) unloadAdsense(); }, [permitted]);

  if (IS_DESKTOP_BUILD || !AD_CONFIG.enabled || AD_CONFIG.googleCmp) return null;
  if (!consent.needsDecision && !consent.preferencesOpen) return null;

  const acceptAll = () => saveConsent(true);
  const rejectAll = () => saveConsent(false);
  const savePreferences = () => { saveConsent(draftAdvertising); setExpanded(false); };
  const close = () => { closePreferences(); setExpanded(false); };

  const panel = consent.preferencesOpen || expanded;

  return (
    <div className="consent-overlay" role="dialog" aria-modal="true" aria-labelledby="consent-heading">
      <div className="consent-banner">
        <h2 id="consent-heading">Cookies &amp; privacy</h2>
        {!panel ? (
          <>
            <p>
              CourtVision saves your leagues on your own device and never on a server of ours - that part always works, no
              choice needed. To keep the game free, this web version can also show ads from Google AdSense, which uses
              cookies to do that. The choices below control advertising. Cookie-free Vercel Analytics measures page usage on the web version; it never receives your leagues.{' '}
              <a href={PRIVACY_HASH}>Privacy Policy</a>.
            </p>
            <div className="consent-actions">
              <button className="consent-btn-secondary" onClick={() => setExpanded(true)}>Manage preferences</button>
              <button className="consent-btn-secondary" onClick={rejectAll}>Reject non-essential</button>
              <button className="consent-btn-primary" onClick={acceptAll}>Accept all</button>
            </div>
          </>
        ) : (
          <>
            <div className="consent-category">
              <div className="consent-category-header">
                <strong>Strictly necessary</strong>
                <span className="consent-toggle-fixed">Always on</span>
              </div>
              <p>Lets the game save your leagues, settings, and which save you had open - all stored on this device only. The game can't work without this.</p>
            </div>
            <div className="consent-category">
              <div className="consent-category-header">
                <strong>Advertising</strong>
                <label className="consent-switch">
                  <input
                    type="checkbox"
                    checked={draftAdvertising}
                    onChange={(e) => setDraftAdvertising(e.target.checked)}
                    aria-label="Allow advertising cookies"
                  />
                  <span className="consent-switch-track" aria-hidden="true" />
                </label>
              </div>
              <p>
                Lets Google AdSense show ads and measure how they perform. Google may set cookies and use your IP address
                for this. Off by default. Turning it on loads Google's script; turning it off removes it and stops new ad
                requests (cookies Google already set stay until you clear them in your browser). See{' '}
                <a href={PRIVACY_HASH}>Privacy Policy, Section 5</a> for detail and opt-out links.
              </p>
            </div>
            <div className="consent-actions">
              {consent.record && <button className="consent-btn-secondary" onClick={close}>Close</button>}
              <button className="consent-btn-secondary" onClick={() => { setDraftAdvertising(false); saveConsent(false); setExpanded(false); }}>Reject all</button>
              <button className="consent-btn-primary" onClick={savePreferences}>Save preferences</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Footer link that reopens the cookie preferences panel (also works after Google's own CMP has taken over, by falling back to it). */
export function CookieSettingsLink({ className }: { className?: string }) {
  const onClick = () => (AD_CONFIG.googleCmp ? showGoogleConsentChoices() : openPreferences());
  if (IS_DESKTOP_BUILD || !AD_CONFIG.enabled) return null;
  return <button className={className ?? 'legal-link legal-link-button'} onClick={onClick}>Cookie Settings</button>;
}
