// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { AdBanner } from '../components/AdBanner';
import { saveConsent, resetConsent } from '../consent/consent';
import { unloadAdsense, ADSENSE_SRC } from '../ads/adsense';
import { resetAdRetries, AD_RETRY_MIN_GAP_MS, AD_MAX_RETRIES } from '../ads/adRetry';

const banner = () => document.querySelector('aside.ad-banner') as HTMLElement | null;
const unit = () => document.querySelector('ins.adsbygoogle') as HTMLElement | null;
async function loadScript() {
  const script = document.querySelector(`script[src^="${ADSENSE_SRC}"]`)!;
  await act(async () => { script.dispatchEvent(new Event('load')); });
}

describe('ads only appear once Google actually sends one', () => {
  beforeEach(() => {
    localStorage.clear(); resetConsent(); unloadAdsense(); resetAdRetries();
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    window.adsbygoogle = { push: vi.fn() } as unknown as unknown[];
  });
  afterEach(() => { cleanup(); unloadAdsense(); delete window.adsbygoogle; vi.restoreAllMocks(); vi.useRealTimers(); });

  it('a No-Ads or active Supporter pass shows no banner and loads no ad script; a lapsed Supporter pass does', async () => {
    act(() => saveConsent(true));
    for (const e of [{ noAds: true }, { supporter: true, supporterUntil: new Date(Date.now() + 86_400_000).toISOString() }]) {
      localStorage.setItem('cv-entitlements', JSON.stringify(e));
      render(<AdBanner slot="top" refreshKey="dashboard" />);
      expect(banner()).toBeNull();
      expect(document.querySelector(`script[src^="${ADSENSE_SRC}"]`)).toBeNull();
      cleanup();
    }
    localStorage.setItem('cv-entitlements', JSON.stringify({ supporter: true, supporterUntil: new Date(Date.now() - 1000).toISOString() }));
    render(<AdBanner slot="top" refreshKey="dashboard" />);
    expect(document.querySelector(`script[src^="${ADSENSE_SRC}"]`)).not.toBeNull();
  });

  it('keeps the frame collapsed while waiting and reveals it when the ad is filled', async () => {
    act(() => saveConsent(true));
    render(<AdBanner slot="top" refreshKey="dashboard" />);
    await loadScript();
    expect(banner()!.dataset.state).toBe('waiting');
    await act(async () => { unit()!.dataset.adStatus = 'filled'; });
    expect(banner()!.dataset.state).toBe('filled');
  });

  it('an unfilled answer never shows a Google frame, and a later navigation asks again (rate-limited)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    act(() => saveConsent(true));
    const { rerender } = render(<AdBanner slot="top" refreshKey="a" />);
    await loadScript();
    const push = (window.adsbygoogle as unknown as { push: ReturnType<typeof vi.fn> }).push;
    expect(push).toHaveBeenCalledTimes(1);
    await act(async () => { unit()!.dataset.adStatus = 'unfilled'; });
    expect(unit()).toBeNull(); // development builds show a house placeholder instead; production shows nothing
    // Navigating straight away does not re-request (minimum gap).
    rerender(<AdBanner slot="top" refreshKey="b" />);
    await act(async () => {});
    expect(unit()).toBeNull();
    // After the gap, the next navigation asks once more.
    for (let i = 1; i <= AD_MAX_RETRIES + 1; i++) {
      vi.setSystemTime(Date.now() + AD_RETRY_MIN_GAP_MS + 1);
      rerender(<AdBanner slot="top" refreshKey={`page-${i}`} />);
      await act(async () => {});
      if (i <= AD_MAX_RETRIES) {
        expect(unit()).not.toBeNull();
        expect(push).toHaveBeenCalledTimes(1 + i);
        await act(async () => { unit()!.dataset.adStatus = 'unfilled'; });
      } else {
        expect(unit()).toBeNull(); // retries are capped per visit
      }
    }
  });

  it('never refreshes a unit that is showing an ad', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    act(() => saveConsent(true));
    const { rerender } = render(<AdBanner slot="inline" refreshKey="a" />);
    await loadScript();
    const shown = unit()!;
    await act(async () => { shown.dataset.adStatus = 'filled'; });
    vi.setSystemTime(Date.now() + AD_RETRY_MIN_GAP_MS * 3);
    rerender(<AdBanner slot="inline" refreshKey="b" />);
    await act(async () => {});
    expect(unit()).toBe(shown);
  });
});
