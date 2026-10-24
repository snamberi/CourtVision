import { describe, expect, it } from 'vitest';
import { advertisingPermitted } from '../ads/adPolicy';
import { AD_CONFIG } from '../ads/adConfig';
import indexHtml from '../../index.html?raw';
import adsTxt from '../../public/ads.txt?raw';

const consent = { gpc: false, advertisingAllowed: true } as Parameters<typeof advertisingPermitted>[0];

describe('ad requests only declare the real site', () => {
  it('a production build requests ads only on the hostnames registered in AdSense', () => {
    expect(advertisingPermitted(consent, AD_CONFIG, false, 'courtvisiongame.com')).toBe(true);
    expect(advertisingPermitted(consent, AD_CONFIG, false, 'www.courtvisiongame.com')).toBe(true);
    for (const host of ['courtvision.example.workers.dev', 'localhost', 'mirror.example.com']) {
      expect(advertisingPermitted(consent, AD_CONFIG, false, host)).toBe(false);
    }
  });

  it('the page carries no AMP ad markup and gates the publisher tag to the site hostname', () => {
    const html = indexHtml;
    expect(html).not.toMatch(/amp-auto-ads|cdn\.ampproject\.org/);
    expect(html).not.toMatch(/<script[^>]+src="https:\/\/pagead2\.googlesyndication\.com/);
    expect(html).toContain('courtvisiongame\\.com$/.test(location.hostname)');
    expect(adsTxt).toContain(`google.com, ${AD_CONFIG.adsenseClient.replace('ca-', '')}, DIRECT`);
  });
});
