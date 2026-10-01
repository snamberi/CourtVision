// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { placeLabel, claimSnoozed, snoozeClaims, claimDismissed, dismissClaim, popupShownToday, notePopupShown } from '../cloud/claimRank';
import { codeScore } from '../retention/codeResults';

beforeEach(() => localStorage.clear());

describe('Claim your rank', () => {
  it('names a place inside the top 100 and a share past it', () => {
    expect(placeLabel({ rank: 8, total: 900 })).toBe('#8');
    expect(placeLabel({ rank: 100, total: 900 })).toBe('#100');
    expect(placeLabel({ rank: 207, total: 900 })).toBe('in the top 23%');
    expect(placeLabel({ rank: 101, total: 101 })).toBe('in the top 99%');
  });
  it('does not nag: not now sticks to a result, a week snooze covers all, the popup once a day', () => {
    expect(claimDismissed('career:a')).toBe(false);
    dismissClaim('career:a');
    expect(claimDismissed('career:a')).toBe(true);
    expect(claimDismissed('career:b')).toBe(false);
    const now = Date.parse('2026-10-01T12:00:00Z');
    expect(claimSnoozed(now)).toBe(false);
    snoozeClaims(now);
    expect(claimSnoozed(now + 6 * 86_400_000)).toBe(true);
    expect(claimSnoozed(now + 8 * 86_400_000)).toBe(false);
    expect(popupShownToday('2026-10-01')).toBe(false);
    notePopupShown('2026-10-01');
    expect(popupShownToday('2026-10-01')).toBe(true);
    expect(popupShownToday('2026-10-02')).toBe(false);
  });
  it('scores a league code the way the server does', () => {
    expect(codeScore({ wins: 55, finish: 'Second Round' })).toBe(150);
    expect(codeScore({ wins: 30, finish: 'Lottery' })).toBe(60);
  });
});
