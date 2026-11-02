// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../cloud/boards', () => ({ friendActivity: vi.fn() }));
vi.mock('../cloud/social', () => ({ loadGifts: vi.fn() }));
import { friendActivity } from '../cloud/boards';
import { loadGifts } from '../cloud/social';
import { inboxItems, loadInbox, markInboxRead, readInboxIds } from '../cloud/notifications';
const activity = { username: 'friend', at: '2026-11-01T12:00:00Z', text: 'won a game' };
const gift = { id: 'g1', from: 'owner', at: '2026-11-02T12:00:00Z', coins: 150, lucky: 1, message: 'Thanks for playing!' };
beforeEach(() => { localStorage.clear(); vi.resetAllMocks(); });
describe('notification inbox', () => {
  it('deduplicates stable results, orders newest first and includes custom gift messages', () => {
    const items = inboxItems([activity, activity], [gift]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: 'gift:g1', body: gift.message });
    expect(items[1].id).toBe(inboxItems([activity], [])[0].id);
    expect(inboxItems([{ ...activity, text: 'won another game' }], [])[0].id).not.toBe(items[1].id);
  });
  it('keeps read history separate for different signed-in accounts', () => {
    expect(markInboxRead('a', ['gift:g1'])).toBe(true);
    expect(readInboxIds('a').has('gift:g1')).toBe(true);
    expect(readInboxIds('b').size).toBe(0);
    markInboxRead('a', ['gift:g1', 'gift:g2']);
    expect(readInboxIds('a').size).toBe(2);
  });
  it('handles damaged history and reports storage failures', () => {
    localStorage.setItem('courtvision-inbox-read:a', 'bad json');
    expect(readInboxIds('a').size).toBe(0);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(markInboxRead('a', ['x'])).toBe(false);
    spy.mockRestore();
  });
  it('retains only the failed source and removes collected gifts after a successful refresh', async () => {
    vi.mocked(friendActivity).mockRejectedValue(new Error('offline'));
    vi.mocked(loadGifts).mockResolvedValue({ day: '', left: 10, perDay: 10, sentTo: [], waiting: [] });
    const out = await loadInbox(inboxItems([activity], [gift]));
    expect(out.items).toHaveLength(1);
    expect(out.items[0].kind).toBe('activity');
    expect(out.errors).toEqual(['Friend activity could not refresh.']);
  });
  it('does not turn a total outage into an empty success state', async () => {
    vi.mocked(friendActivity).mockRejectedValue(new Error('offline'));
    vi.mocked(loadGifts).mockRejectedValue(new Error('offline'));
    const out = await loadInbox(inboxItems([activity], [gift]));
    expect(out.items).toHaveLength(2);
    expect(out.errors).toHaveLength(2);
  });
});
