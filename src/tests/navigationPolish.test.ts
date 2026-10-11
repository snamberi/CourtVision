// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { matchJump, typingIn, type JumpItem } from '../navigation/quickJump';
import { applyAccessibility, setColourSafe, setTextSize, textSize, colourSafe } from '../lib/accessibility';
import { checkForUpdate, dismissUpdate, newerRelease } from '../lib/updateCheck';
import { LATEST_RELEASE, hasUnseenRelease, WHATS_NEW_KEY } from '../content/whatsNewLatest';
import { RELEASES, unseenReleases } from '../content/whatsNew';

const items: JumpItem[] = [
  { label: 'Free Agents', tab: 'freeAgency', group: 'Front Office' },
  { label: 'Roster', tab: 'roster', group: 'Team' },
  { label: 'Trade', tab: 'trade', group: 'Front Office' },
  { label: 'Trading Block', tab: 'tradeBlock', group: 'Front Office' },
  { label: 'Standings', tab: 'standings', group: 'League' },
];

describe('quick jump', () => {
  it('finds pages by the start of any word, best match first', () => {
    expect(matchJump(items, 'fr ag').map(i => i.tab)).toEqual(['freeAgency']);
    expect(matchJump(items, 'trad')[0].tab).toBe('trade');
    expect(matchJump(items, 'front').map(i => i.tab)).toEqual(['freeAgency', 'trade', 'tradeBlock']);
    expect(matchJump(items, '')).toHaveLength(items.length);
    expect(matchJump(items, 'zzz')).toEqual([]);
  });
  it('ignores key presses meant for text boxes', () => {
    expect(typingIn(document.createElement('input'))).toBe(true);
    expect(typingIn(document.createElement('textarea'))).toBe(true);
    expect(typingIn(document.createElement('button'))).toBe(false);
    expect(typingIn(null)).toBe(false);
  });
});

describe('accessibility options', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.className = ''; });
  it('bigger text and colour-safe rarities are classes on <html> that survive a reload', () => {
    expect(textSize()).toBe('normal'); expect(colourSafe()).toBe(false);
    setTextSize('larger'); setColourSafe(true);
    document.documentElement.className = '';
    applyAccessibility();
    expect(document.documentElement.classList.contains('text-larger')).toBe(true);
    expect(document.documentElement.classList.contains('cb-safe')).toBe(true);
    setTextSize('normal'); setColourSafe(false);
    expect(document.documentElement.className).toBe('');
  });
});

describe('desktop update check', () => {
  beforeEach(() => localStorage.clear());
  it('only reports a newer, well-formed release', () => {
    expect(newerRelease({ release: '2099-01-01' }, '2027-05-12')).toBe('2099-01-01');
    expect(newerRelease({ release: '2027-05-12' }, '2027-05-12')).toBeNull();
    expect(newerRelease({ release: '2020-01-01' }, '2027-05-12')).toBeNull();
    expect(newerRelease({ release: 'hello' }, '2027-05-12')).toBeNull();
    expect(newerRelease(null)).toBeNull();
  });
  it('stays quiet offline, and once dismissed', async () => {
    const ok = (async () => new Response(JSON.stringify({ release: '2099-01-01' }))) as typeof fetch;
    expect(await checkForUpdate(ok)).toBe('2099-01-01');
    dismissUpdate('2099-01-01');
    expect(await checkForUpdate(ok)).toBeNull();
    expect(await checkForUpdate((async () => { throw new Error('offline'); }) as typeof fetch)).toBeNull();
  });
});

describe("What's New split", () => {
  beforeEach(() => localStorage.clear());
  it('the latest id matches the newest release', () => expect(LATEST_RELEASE).toBe(RELEASES[0].id));
  it('agrees with unseenReleases for new, returning and up-to-date players', () => {
    expect(hasUnseenRelease()).toBe(false); // brand new: marked up to date
    expect(unseenReleases()).toEqual([]);
    localStorage.clear(); localStorage.setItem('cv-profile', '{}');
    expect(hasUnseenRelease()).toBe(true);
    expect(unseenReleases().length > 0).toBe(true);
    localStorage.setItem(WHATS_NEW_KEY, LATEST_RELEASE);
    expect(hasUnseenRelease()).toBe(false);
  });
});
