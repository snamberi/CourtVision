import { describe, expect, it } from 'vitest';
import { handleSync, MAX_BYTES, MAX_RAW_BYTES } from '../../server/sync';
import { gzip } from '../cloud/sync';

const env = { url: 'https://x.supabase.co', serviceKey: 'service', publicKey: 'anon' };
const f = (async (url: string, init?: RequestInit) => {
  const u = String(url), method = init?.method ?? 'GET';
  if (u.endsWith('/auth/v1/user')) return Response.json({ id: 'u1' });
  return method === 'GET' ? Response.json([]) : new Response('', { status: 200 });
}) as unknown as typeof fetch;
const post = (body: BodyInit, gz: boolean) => new Request('https://site/api/sync', { method: 'POST', headers: { Authorization: 'Bearer good', ...(gz ? { 'X-Sync-Encoding': 'gzip' } : {}) }, body });

/** A big account: 90 retired careers with 15 full seasons each, well over the old 800 KB limit. */
function bigBlob() {
  const year = (i: number) => ({ season: String(2000 + i), age: 20 + i, teamId: 'BOS', teamName: 'Boston', overall: 80, awards: [{ key: 'allStar' }], training: ['iq'],
    stats: { gamesPlayed: 80, minutes: 2800, points: 2100, fgm: 800, fga: 1600, tpm: 150, tpa: 400, ftm: 350, fta: 420, oreb: 90, dreb: 400, ast: 500, stl: 100, blk: 50, tov: 200, pf: 180, ba: 60, blkAtt: 300, clutchPoints: 120 },
    playoffs: { gamesPlayed: 12, minutes: 450, points: 300, fgm: 110, fga: 230, tpm: 20, tpa: 60, ftm: 60, fta: 70, oreb: 15, dreb: 60, ast: 70, stl: 15, blk: 8, tov: 30, pf: 30, ba: 9, blkAtt: 40, clutchPoints: 30 },
    highs: { doubleDoubles: 30, tripleDoubles: 5, quadrupleDoubles: 0, quintupleDoubles: 0, gameHighPoints: 50, gameHighRebounds: 18, gameHighAssists: 15, gameHighSteals: 6, gameHighBlocks: 5 } });
  const careers = Array.from({ length: 90 }, (_, c) => ({ version: 1, id: `career-${c}`, createdAt: c, updatedAt: c + 1, seed: c, status: 'retired', playerId: `Player ${c}`, years: Array.from({ length: 15 }, (_, i) => year(i)), notes: [], training: [], retired: { age: 35, season: '2015', legacy: 60, rank: null, hallOfFame: 'yes' } }));
  return JSON.stringify({ version: 1, updatedAt: 1, storage: {}, careers });
}

describe('sync size', () => {
  it('takes a big account gzipped, and says how big when it is really too large', async () => {
    const text = bigBlob();
    expect(text.length).toBeGreaterThan(MAX_BYTES);
    // Plain JSON that size is still refused (old clients), with the size in the message.
    const plain = await handleSync(post(text, false), env, new Date(), f);
    expect(plain.status).toBe(413);
    expect((await plain.json() as { error: string }).error).toMatch(/MB/);
    // Gzipped it goes through.
    const packed = (await gzip(text))!;
    expect(packed.byteLength).toBeLessThan(MAX_BYTES / 4);
    const ok = await handleSync(post(packed, true), env, new Date(), f);
    expect(ok.status).toBe(200);
    // A zip bomb past the unpacked limit is refused without unpacking all of it.
    const bomb = (await gzip(' '.repeat(MAX_RAW_BYTES + 10)))!;
    expect((await handleSync(post(bomb, true), env, new Date(), f)).status).toBe(413);
    // Garbage claiming to be gzip is a bad request.
    expect((await handleSync(post(new Uint8Array([1, 2, 3]), true), env, new Date(), f)).status).toBe(400);
  });
});
