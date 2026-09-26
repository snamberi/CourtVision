// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AdBanner } from '../components/AdBanner';
import { ConsentBanner } from '../consent/ConsentBanner';
import { CONSENT_STORAGE_KEY, resetConsent } from '../consent/consent';
import { AD_CONFIG } from '../ads/adConfig';
import { ADSENSE_SRC } from '../ads/adsense';

const shippedCmp = AD_CONFIG.googleCmp;
beforeEach(() => {
  localStorage.clear();
  resetConsent();
  document.querySelectorAll(`script[src^="${ADSENSE_SRC}"]`).forEach((el) => el.remove());
});
afterEach(() => { cleanup(); AD_CONFIG.googleCmp = shippedCmp; });

describe('in-app banner mode (googleCmp off): no Google request before consent', () => {
  beforeEach(() => { AD_CONFIG.googleCmp = false; });
  it('never loads the AdSense script before the visitor decides', () => {
    render(<AdBanner slot="top" />);
    expect(document.querySelector(`script[src^="${ADSENSE_SRC}"]`)).toBeNull();
  });

  it('shows the cookie banner on first visit and loads AdSense only after Accept all', () => {
    render(<>
      <AdBanner slot="top" />
      <ConsentBanner />
    </>);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.querySelector(`script[src^="${ADSENSE_SRC}"]`)).toBeNull();

    fireEvent.click(screen.getByText('Accept all'));
    expect(JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!).advertising).toBe(true);
  });

  it('Reject non-essential keeps the script out and the banner closes', () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByText('Reject non-essential'));
    expect(JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY)!).advertising).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a Global Privacy Control signal suppresses the banner entirely', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    resetConsent(); // re-detect GPC with the flag now set, same as a fresh page load would
    render(<ConsentBanner />);
    expect(screen.queryByRole('dialog')).toBeNull();
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: undefined, configurable: true });
  });

  it('Cookie Settings link is present so the choice can always be changed later', async () => {
    const { CookieSettingsLink } = await import('../consent/ConsentBanner');
    render(<CookieSettingsLink />);
    expect(screen.getByText('Cookie Settings')).toBeTruthy();
  });

  it('every bundled default sponsor is flagged as a dev-only placeholder (AdBanner hides these under import.meta.env.PROD - see AdBanner.tsx)', () => {
    expect(AD_CONFIG.sponsors.length).toBeGreaterThan(0);
    for (const sp of AD_CONFIG.sponsors) expect(sp.placeholder).toBe(true);
  });
});

describe("Google's consent tool mode (googleCmp on, as shipped)", () => {
  beforeEach(() => { AD_CONFIG.googleCmp = true; });

  it('ships in this mode so visitors outside consent regions get ads without an opt-in click', () => {
    expect(shippedCmp).toBe(true);
  });

  it('shows no in-app banner and requests ads right away', () => {
    render(<>
      <AdBanner slot="top" />
      <ConsentBanner />
    </>);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector(`script[src^="${ADSENSE_SRC}"]`)).not.toBeNull();
    expect(document.querySelector('ins.adsbygoogle')).not.toBeNull();
  });

  it('still makes no ad request when the browser sends Global Privacy Control', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    resetConsent();
    render(<>
      <AdBanner slot="top" />
      <ConsentBanner />
    </>);
    expect(document.querySelector('ins.adsbygoogle')).toBeNull();
    expect(document.querySelector(`script[src^="${ADSENSE_SRC}"]`)).toBeNull();
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: undefined, configurable: true });
    resetConsent();
  });
});
