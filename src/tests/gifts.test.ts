import { describe, expect, it } from 'vitest';
import { handleSocial, GIFTS_PER_DAY } from '../../server/social';

const ME = '11111111-1111-4111-8111-111111111111';
const env = { url: 'https://db.test', serviceKey: 'svc', publicKey: 'pub' };
const friend = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;

/** A tiny in-memory PostgREST for gifts, follows and profiles. */
function fakeDb(follows: string[]) {
  const gifts: { id: string; sender: string; recipient: string; day: string; coins: number; lucky: number; claimed: boolean; created_at: string }[] = [];
  let n = 0;
  const f = (async (url: string, init?: RequestInit) => {
    const u = new URL(url), path = u.pathname.replace('/rest/v1/', ''), q = u.searchParams, method = init?.method ?? 'GET';
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (u.pathname === '/auth/v1/user') return ok({ id: ME });
    const eq = (k: string) => q.get(k)?.replace(/^eq\./, '');
    if (path === 'follows') return ok(follows.includes(eq('target_id') ?? '') ? [{ target_id: eq('target_id') }] : []);
    if (path === 'profiles') return ok([{ id: ME, username: 'me' }]);
    if (path === 'gifts' && method === 'GET') {
      let rows = gifts;
      if (q.get('sender')) rows = rows.filter(g => g.sender === eq('sender') && g.day === eq('day'));
      if (q.get('recipient')) rows = rows.filter(g => g.recipient === eq('recipient') && !g.claimed);
      return ok(rows);
    }
    if (path === 'gifts' && method === 'POST') {
      const [row] = JSON.parse(String(init!.body));
      if (gifts.some(g => g.sender === row.sender && g.recipient === row.recipient && g.day === row.day)) return new Response('23505 duplicate', { status: 409 });
      gifts.push({ id: `g${n++}`, claimed: false, ...row });
      return new Response('', { status: 201 });
    }
    if (path === 'gifts' && method === 'PATCH') {
      const mine = gifts.filter(g => g.recipient === eq('recipient') && !g.claimed);
      mine.forEach(g => { g.claimed = true; });
      return ok(mine);
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return { f, gifts };
}
const req = (body: unknown) => new Request('https://x/api/social', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) });
const now = new Date('2026-10-12T10:00:00Z');

describe('friend gifts', () => {
  it('sends a free gift to a friend once a day, up to 10 friends', async () => {
    const friends = Array.from({ length: 12 }, (_, i) => friend(i));
    const db = fakeDb(friends);
    const send = async (to: string) => handleSocial(req({ action: 'send', to }), env, now, db.f);
    expect((await send(friends[0])).status).toBe(200);
    expect(db.gifts[0]).toMatchObject({ sender: ME, recipient: friends[0], coins: 150, lucky: 1 });
    expect((await send(friends[0])).status).toBe(409);
    for (let i = 1; i < GIFTS_PER_DAY; i++) expect((await send(friends[i])).status).toBe(200);
    expect((await send(friends[GIFTS_PER_DAY])).status).toBe(429);
    // Tomorrow is a new day.
    expect((await handleSocial(req({ action: 'send', to: friends[0] }), env, new Date('2026-10-13T10:00:00Z'), db.f)).status).toBe(200);
  });
  it('only gifts GMs you follow, never yourself', async () => {
    const db = fakeDb([]);
    expect((await handleSocial(req({ action: 'send', to: friend(1) }), env, now, db.f)).status).toBe(403);
    expect((await handleSocial(req({ action: 'send', to: ME }), env, now, db.f)).status).toBe(400);
    expect(db.gifts).toHaveLength(0);
  });
  it('a gift is collected once', async () => {
    const db = fakeDb([]);
    db.gifts.push({ id: 'a', sender: friend(1), recipient: ME, day: '2026-10-12', coins: 150, lucky: 1, claimed: false, created_at: now.toISOString() });
    db.gifts.push({ id: 'b', sender: friend(2), recipient: ME, day: '2026-10-12', coins: 150, lucky: 1, claimed: false, created_at: now.toISOString() });
    const first = await (await handleSocial(req({ action: 'claim' }), env, now, db.f)).json();
    expect(first).toMatchObject({ coins: 300, lucky: 2 });
    const again = await (await handleSocial(req({ action: 'claim' }), env, now, db.f)).json();
    expect(again).toMatchObject({ coins: 0, lucky: 0 });
  });
  it('says so when the tables are not set up yet', async () => {
    const f = (async (url: string) => new URL(url).pathname === '/auth/v1/user' ? new Response(JSON.stringify({ id: ME })) : new Response('PGRST205 Could not find the table', { status: 404 })) as typeof fetch;
    const res = await handleSocial(req({ action: 'gifts' }), env, now, f);
    expect(res.status).toBe(503);
    expect((await res.json()).setup).toBe(true);
  });
});
