// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installDevice, startInstall, windowsDownloadStarted } from '../pwa/pwa';

const OPERA_GX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0 (Edition std-2)';

describe('install guide device detection', () => {
  it('picks the right steps for each device and browser', () => {
    expect(installDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')).toEqual({ device: 'pc', browser: 'chrome' });
    expect(installDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0')).toEqual({ device: 'pc', browser: 'edge' });
    expect(installDevice(OPERA_GX)).toEqual({ device: 'pc', browser: 'opera' });
    expect(installDevice('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36')).toEqual({ device: 'android', browser: 'samsung' });
    expect(installDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')).toEqual({ device: 'android', browser: 'chrome' });
    expect(installDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toEqual({ device: 'ios', browser: 'safari' });
    expect(installDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0')).toEqual({ device: 'pc', browser: 'firefox' });
  });
});

describe('install button with no install dialog', () => {
  afterEach(() => vi.restoreAllMocks());
  it('downloads the Windows edition on Opera GX instead of only showing the guide', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(OPERA_GX);
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this.getAttribute('href') ?? ''); });
    await startInstall('test');
    expect(clicked).toHaveLength(1);
    expect(clicked[0]).toMatch(/downloads\/CourtVision-Windows\.zip$/);
    expect(windowsDownloadStarted()).toBe(true);
  });
});
