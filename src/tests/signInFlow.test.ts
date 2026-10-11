import { describe, expect, it } from 'vitest';
import { explainAuthError, inAppBrowser } from '../cloud/account';

describe('sign-in errors and browsers', () => {
  it('explains why a sign-in did not finish', () => {
    expect(explainAuthError('invalid request: both auth code and code verifier should be non-empty')).toMatch(/another tab or on another address/);
    expect(explainAuthError('PKCE code verifier not found in storage')).toMatch(/another tab/);
    expect(explainAuthError('access_denied')).toMatch(/cancelled/);
    expect(explainAuthError('Failed to fetch')).toMatch(/connection dropped/);
    expect(explainAuthError('something odd')).toMatch(/something odd/);
  });
  it('spots in-app browsers where Google blocks sign-in', () => {
    expect(inAppBrowser('Mozilla/5.0 (iPhone) AppleWebKit Instagram 300.0')).toBe(true);
    expect(inAppBrowser('Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit musical_ly_2023')).toBe(true);
    expect(inAppBrowser('Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/128 Safari/537.36 OPR/112')).toBe(false);
    expect(inAppBrowser('Mozilla/5.0 (iPhone) Version/17.0 Mobile Safari/604.1')).toBe(false);
  });
});
