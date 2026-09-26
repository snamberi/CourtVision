// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  CONSENT_STORAGE_KEY, CONSENT_VERSION, parseConsent, deriveSnapshot,
  saveConsent, openPreferences, closePreferences, resetConsent, useConsent,
} from '../consent/consent';

beforeEach(() => {
  localStorage.clear();
  resetConsent();
  vi.stubGlobal('navigator', { ...navigator, globalPrivacyControl: undefined });
});

describe('consent store', () => {
  it('needs a decision on a first visit with no GPC signal', () => {
    const { result } = renderHook(() => useConsent());
    expect(result.current.needsDecision).toBe(true);
    expect(result.current.advertisingAllowed).toBe(false);
  });

  it('persists Accept/Reject and reflects it on the next read', () => {
    const { result } = renderHook(() => useConsent());
    act(() => saveConsent(true));
    expect(result.current.advertisingAllowed).toBe(true);
    expect(result.current.needsDecision).toBe(false);

    const stored = parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
    expect(stored?.advertising).toBe(true);
    expect(stored?.version).toBe(CONSENT_VERSION);

    act(() => saveConsent(false));
    expect(result.current.advertisingAllowed).toBe(false);
  });

  it('treats an unrecognized or old-version record as no decision made', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ version: CONSENT_VERSION + 1, advertising: true, decidedAt: 1 }));
    expect(parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY))).toBeNull();
    localStorage.setItem(CONSENT_STORAGE_KEY, 'not json');
    expect(parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY))).toBeNull();
  });

  it('a Global Privacy Control signal suppresses the banner and defaults advertising off, without being saved as a choice', () => {
    const snap = deriveSnapshot(null, true, false);
    expect(snap.needsDecision).toBe(false);
    expect(snap.advertisingAllowed).toBe(false);
    expect(snap.record).toBeNull(); // opening Cookie Settings and choosing Accept must still be possible
  });

  it('openPreferences/closePreferences toggle the panel without changing the saved choice', () => {
    const { result } = renderHook(() => useConsent());
    act(() => saveConsent(false));
    act(() => openPreferences());
    expect(result.current.preferencesOpen).toBe(true);
    expect(result.current.advertisingAllowed).toBe(false);
    act(() => closePreferences());
    expect(result.current.preferencesOpen).toBe(false);
  });

  it('resetConsent forgets the saved choice so the banner would reappear', () => {
    const { result } = renderHook(() => useConsent());
    act(() => saveConsent(true));
    act(() => resetConsent());
    expect(result.current.needsDecision).toBe(true);
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  });
});
