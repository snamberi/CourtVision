import { describe, expect, it } from 'vitest';
import { handleSync } from '../../server/sync';
import { handlePvp } from '../../server/pvp';
import { supaEnv } from '../../server/supabase';

const env = { url: 'https://x.supabase.co', serviceKey: 'service', publicKey: 'anon' };
/** A fetch that knows one user ("good") and records every database call. */
function fakeFetch(rows: Record<string, unknown[]> = {}) {
  const calls: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const u = String(url), method = init?.method ?? 'GET';
    calls.push(`${method} ${u.replace(env.url, '')}`);
    if (u.endsWith('/auth/v1/user')) return (init?.headers as Record<string, string>).Authorization === 'Bearer good' ? Response.json({ id: 'u1' }) : new Response('no', { status: 401 });
    const table = u.split('/rest/v1/')[1]?.split('?')[0] ?? '';
    return method === 'GET' ? Response.json(rows[table] ?? []) : new Response(method === 'POST' && u.includes('pvp_matches') ? JSON.stringify([{ id: 'm1', seed: 5, era: '90s', status: 'pending', created_at: new Date().toISOString(), challenger: 'u1', defender: 'u2' }]) : '', { status: 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const req = (method: string, body?: unknown, token = 'good') => new Request('https://site/api', { method, headers: { Authorization: `Bearer ${token}` }, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });

describe('cloud endpoints', () => {
  it('env: reads the Vercel integration names', () => {
    expect(supaEnv({ SUPABASE_URL: 'https://a.supabase.co/', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })).toEqual({ url: 'https://a.supabase.co', serviceKey: 's', publicKey: 'a' });
    expect(supaEnv({ NEXT_PUBLIC_SUPABASE_URL: 'u', SUPABASE_SECRET_KEY: 'sb_secret_x', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_y' })).toMatchObject({ serviceKey: 'sb_secret_x', publicKey: 'sb_publishable_y' });
    expect(supaEnv({})).toBeNull();
  });

  it('sync: not set up, not signed in, too big, malformed, and a good sync', async () => {
    expect((await handleSync(req('POST', {}), null)).status).toBe(503);
    const { f, calls } = fakeFetch();
    expect((await handleSync(req('POST', {}, 'bad'), env, new Date(), f)).status).toBe(401);
    expect((await handleSync(req('POST', 'x'.repeat(900_000)), env, new Date(), f)).status).toBe(413);
    expect((await handleSync(req('POST', { version: 9 }), env, new Date(), f)).status).toBe(400);
    const ok = await handleSync(req('POST', { version: 1, updatedAt: 1, storage: { 'cv-hunt-records': JSON.stringify({ runs: 2, wins: 1, bestStop: 10 }) }, careers: [] }), env, new Date(), f);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true });
    expect(calls.some(c => c.startsWith('POST /rest/v1/progress'))).toBe(true);
    expect(calls.some(c => c.startsWith('PATCH /rest/v1/profiles?id=eq.u1'))).toBe(true);
    const del = await handleSync(req('DELETE'), env, new Date(), f);
    expect(del.status).toBe(200);
    expect(calls).toContain('DELETE /auth/v1/admin/users/u1');
  });

  it('sync: merges with the stored progress and slows down rapid pushes', async () => {
    const now = new Date('2026-09-28T12:00:00Z');
    const stored = { version: 1, updatedAt: 1, storage: { 'cv-hunt-album': JSON.stringify(['a']) }, careers: [] };
    const recent = fakeFetch({ progress: [{ data: stored, updated_at: new Date(now.getTime() - 1000).toISOString() }] });
    expect((await handleSync(req('POST', { version: 1, updatedAt: 2, storage: {}, careers: [] }), env, now, recent.f)).status).toBe(429);
    let body = '';
    const older = fakeFetch({ progress: [{ data: stored, updated_at: new Date(now.getTime() - 60_000).toISOString() }] });
    const spy = (async (url: string, init?: RequestInit) => { if (String(url).includes('/progress?on_conflict') || (init?.method === 'POST' && String(url).includes('/progress'))) body = String(init?.body); return older.f(url, init); }) as unknown as typeof fetch;
    const res = await handleSync(req('POST', { version: 1, updatedAt: 2, storage: { 'cv-hunt-album': JSON.stringify(['b']) }, careers: [] }), env, now, spy);
    expect(res.status).toBe(200);
    expect(JSON.parse(JSON.parse(body)[0].data.storage['cv-hunt-album']).sort()).toEqual(['a', 'b']);
  });

  it('sync: a table the database rejects is skipped, and the progress is still saved', async () => {
    const base = fakeFetch();
    // An older database that refuses one write (here the profile row); everything else goes through.
    const f = (async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && String(url).includes('/profiles?') && String(init.body).includes('"level"')) return new Response('{"message":"violates check constraint"}', { status: 400 });
      return base.f(url, init);
    }) as unknown as typeof fetch;
    const res = await handleSync(req('POST', { version: 1, updatedAt: 1, storage: {}, careers: [] }), env, new Date(), f);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, skipped: ['profile'] });
    expect(base.calls.some(c => c.startsWith('POST /rest/v1/progress'))).toBe(true);
  });

  it('pvp: needs a team, rejects results that do not add up', async () => {
    const none = fakeFetch();
    expect((await (await handlePvp(req('POST', { action: 'find' }), env, new Date(), none.f)).json()).error).toMatch(/Finish a League Hunt/);
    expect((await handlePvp(req('POST', { action: 'publish', ghost: { squad: ['a'] } }), env, new Date(), none.f)).status).toBe(400);
    const pending = [{ id: 'm1', challenger: 'u1', defender: 'u2', seed: 5, era: '90s', status: 'pending', created_at: new Date().toISOString() }];
    const withMatch = fakeFetch({ pvp_matches: pending, hunt_ghosts: [{ user_id: 'u1', rating: 1000, wins: 0, losses: 0 }] });
    const bad = await handlePvp(req('POST', { action: 'result', matchId: 'm1', won: true, games: [{ won: true }, { won: true }] }), env, new Date(), withMatch.f);
    expect(bad.status).toBe(400);
    const good = await handlePvp(req('POST', { action: 'result', matchId: 'm1', won: true, games: [{ won: true }, { won: false }, { won: true }, { won: true }, { won: true }] }), env, new Date(), withMatch.f);
    expect(await good.json()).toMatchObject({ ok: true, delta: 16 });
  });
});
