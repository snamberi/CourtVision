// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CareerMeta } from '../career/career';

// A fake account + cloud row + career store, so syncNow runs end to end without a network.
const h = vi.hoisted(() => ({ userId: 'u1', cloud: null as unknown, careers: [] as CareerMeta[], pushed: [] as unknown[] }));
vi.mock('../cloud/account', () => {
  let state = { status: 'signedIn', userId: h.userId, profile: null, sync: { state: 'idle', at: null, message: null } } as Record<string, unknown>;
  return {
    supa: async () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.cloud ? { data: h.cloud } : null, error: null }) }) }) }) }),
    accessToken: () => 'token',
    getAccount: () => ({ ...state, userId: h.userId }),
    setAccount: (p: Record<string, unknown>) => { state = { ...state, ...p }; },
    refreshProfile: async () => null,
    updateProfile: async () => null,
    SIGNED_IN_EVENT: 'x',
  };
});
vi.mock('../career/storage', () => ({
  listCareers: async () => h.careers,
  restoreCareers: async ({ metas }: { metas: CareerMeta[] }) => { for (const m of metas) h.careers = [...h.careers.filter(c => c.id !== m.id), m]; },
}));

const { syncNow } = await import('../cloud/sync');
const career = (id: string, owner?: string) => ({ id, name: id, status: 'retired', updatedAt: 1, cloudOwner: owner }) as unknown as CareerMeta;

beforeEach(() => {
  localStorage.clear();
  h.cloud = null; h.careers = []; h.pushed = [];
  globalThis.fetch = vi.fn(async (_u: unknown, init?: RequestInit) => { h.pushed.push(JSON.parse(String(init?.body))); return new Response('{}', { status: 200 }); }) as typeof fetch;
});

describe('cloud sync ownership', () => {
  it('claims progress made before signing in, then keeps the next account from taking it', async () => {
    localStorage.setItem('cv-hunt-album', JSON.stringify(['a', 'b']));
    h.careers = [career('c1')];
    h.userId = 'u1';
    await syncNow();
    expect(localStorage.getItem('cv-cloud-owner')).toBe('u1');
    const first = h.pushed.at(-1) as { storage: Record<string, string>; careers: CareerMeta[] };
    expect(first.storage['cv-hunt-album']).toBe(JSON.stringify(['a', 'b']));
    expect(first.careers.map(c => c.id)).toEqual(['c1']);
    expect(h.careers[0].cloudOwner).toBe('u1');

    // Someone else signs in on this device: their cloud progress replaces the first player's, nothing is merged.
    h.userId = 'u2';
    h.cloud = { version: 1, updatedAt: 1, storage: { 'cv-hunt-album': JSON.stringify(['z']) }, careers: [] };
    await syncNow();
    const second = h.pushed.at(-1) as { storage: Record<string, string>; careers: CareerMeta[] };
    expect(second.storage['cv-hunt-album']).toBe(JSON.stringify(['z']));
    expect(second.careers).toEqual([]);
    expect(localStorage.getItem('cv-hunt-album')).toBe(JSON.stringify(['z']));
    expect(localStorage.getItem('cv-cloud-owner')).toBe('u2');
  });

  it('clears the previous account\'s keys that the new account does not have', async () => {
    localStorage.setItem('cv-cloud-owner', 'u1');
    localStorage.setItem('cv-rebuild-records', '{"x":{"best":1,"stars":1,"titleIn":null,"attempts":1}}');
    h.userId = 'u3';
    await syncNow();
    expect(localStorage.getItem('cv-rebuild-records')).toBeNull();
  });
});
