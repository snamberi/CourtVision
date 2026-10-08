import { describe, expect, it } from 'vitest';
import { installDevice } from '../pwa/pwa';

describe('install guide device detection', () => {
  it('picks the right steps for each device and browser', () => {
    expect(installDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')).toEqual({ device: 'pc', browser: 'chrome' });
    expect(installDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0')).toEqual({ device: 'pc', browser: 'edge' });
    expect(installDevice('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36')).toEqual({ device: 'android', browser: 'samsung' });
    expect(installDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')).toEqual({ device: 'android', browser: 'chrome' });
    expect(installDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toEqual({ device: 'ios', browser: 'safari' });
    expect(installDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0')).toEqual({ device: 'pc', browser: 'firefox' });
  });
});
