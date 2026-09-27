import { describe, expect, it } from 'vitest';
import { handle, checkSubmission, cleanName, openWeeks, type Redis } from '../../server/leaderboard';
import { weeklyRebuild } from '../retention/weekly';

/** Just enough Redis for the leaderboard: sorted sets, hashes and counters. */
function fakeRedis(): Redis & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const z = (k: string) => (data.get(k) ?? data.set(k, new Map<string, number>()).get(k)) as Map<string, number>;
  const h = (k: string) => (data.get(k) ?? data.set(k, new Map<string, string>()).get(k)) as Map<string, string>;
  const sorted = (k: string) => [...z(k).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    data,
    async run(cmds) {
      return cmds.map(([c, k, ...a]) => {
        const key = String(k);
        switch (c) {
          case 'ZREVRANGE': return sorted(key).slice(Number(a[0]), Number(a[1]) + 1).flatMap(([m, s]) => [m, String(s)]);
          case 'ZCARD': return z(key).size;
          case 'ZREVRANK': { const i = sorted(key).findIndex(([m]) => m === a[0]); return i < 0 ? null : i; }
          case 'ZSCORE': { const v = z(key).get(String(a[0])); return v == null ? null : String(v); }
          case 'ZADD': z(key).set(String(a[1]), Number(a[0])); return 1;
          case 'HSET': h(key).set(String(a[0]), String(a[1])); return 1;
          case 'HMGET': return a.map(f => h(key).get(String(f)) ?? null);
          case 'INCR': { const v = Number(data.get(key) ?? 0) + 1; data.set(key, v); return v; }
          case 'EXPIRE': return 1;
          default: throw new Error(`unexpected ${c}`);
        }
      });
    },
  };
}

const NOW = new Date('2026-09-30T12:00:00Z'); // 2026-W40
const WEEK = '2026-W40';
const post = (body: unknown, ip = '1.2.3.4') => new Request('https://cv.test/api/leaderboard', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': ip } });
const id = (n: number) => `player${String(n).padStart(12, '0')}`;
const seasons = weeklyRebuild(WEEK).seasons;
const results = (title: boolean) => Array.from({ length: title ? 2 : seasons }, (_, i) => ({ wins: 30 + i * 10, losses: 52 - i * 10, finish: title && i === 1 ? 'Champion' : 'Missed Playoffs' }));

describe('online leaderboard', () => {
  it('names: letters and numbers, 2-18, clean', () => {
    expect(cleanName('  Saba  GM ')).toBe('Saba GM');
    expect(cleanName('Łukasz_23')).toBe('Łukasz_23');
    expect(cleanName('x')).toBeNull();
    expect(cleanName('<script>')).toBeNull();
    expect(cleanName('a'.repeat(19))).toBeNull();
    expect(cleanName('Sh1t head')).toBeTruthy(); // leetspeak slips through; the owner can delete entries
    expect(cleanName('shithead')).toBeNull();
  });

  it('rebuild scores are recomputed on the server; unfinished runs are refused', () => {
    const won = checkSubmission({ board: 'rebuild', week: WEEK, id: id(1), name: 'Saba', results: results(true) as never }, NOW);
    expect(won).toMatchObject({ ok: true, detail: '★★★ · title in year 2' });
    expect(won.ok && won.score).toBe(30 * 2 + 40 * 2 + 200 + 1000 + (seasons - 2) * 250);
    expect(checkSubmission({ board: 'rebuild', week: WEEK, id: id(1), name: 'Saba', results: results(false).slice(0, 1) as never }, NOW)).toMatchObject({ ok: false, error: /Finish/ });
    expect(checkSubmission({ board: 'rebuild', week: WEEK, id: id(1), name: 'Saba', results: [{ wins: 90, losses: 0, finish: 'Champion' }] as never }, NOW).ok).toBe(false);
    expect(checkSubmission({ board: 'rebuild', week: '2026-W30', id: id(1), name: 'Saba', results: results(true) as never }, NOW)).toMatchObject({ ok: false, error: /closed/ });
    expect(openWeeks(NOW)).toEqual(['2026-W40', '2026-W39', '2026-W38', '2026-W37']);
  });

  it('career entries must be plausible', () => {
    const c = { player: 'Tyrese Reed', legacy: 180, seasons: 21, titles: 0, mvps: 11, hof: 'first-ballot' as const };
    expect(checkSubmission({ board: 'career', week: WEEK, id: id(2), name: 'Saba', career: c }, NOW)).toEqual({ ok: true, score: 180, detail: 'Tyrese Reed · 21 seasons · 0 titles · 11 MVPs · Hall of Fame' });
    expect(checkSubmission({ board: 'career', week: WEEK, id: id(2), name: 'Saba', career: { ...c, legacy: 9999 } }, NOW).ok).toBe(false);
    expect(checkSubmission({ board: 'career', week: WEEK, id: id(2), name: 'Saba', career: { ...c, mvps: 30 } }, NOW).ok).toBe(false);
  });

  it('keeps each player\'s best, ranks the board, and rate-limits', async () => {
    const redis = fakeRedis();
    const career = (legacy: number) => ({ player: 'Zion Monroe', legacy, seasons: 20, titles: 2, mvps: 0, hof: 'yes' });
    let r = await handle(post({ board: 'career', week: WEEK, id: id(1), name: 'Alpha', career: career(90) }), redis, NOW);
    expect(r.status).toBe(200);
    await handle(post({ board: 'career', week: WEEK, id: id(2), name: 'Bravo', career: career(120) }), redis, NOW);
    r = await handle(post({ board: 'career', week: WEEK, id: id(1), name: 'Alpha', career: career(60) }), redis, NOW); // worse: ignored
    const body = await r.json();
    expect(body.entries.map((e: { name: string; score: number }) => [e.name, e.score])).toEqual([['Bravo', 120], ['Alpha', 90]]);
    expect(body.you).toEqual({ rank: 2, score: 90 });
    const get = await handle(new Request(`https://cv.test/api/leaderboard?board=career&week=${WEEK}&id=${id(2)}`), redis, NOW);
    expect((await get.json()).you).toEqual({ rank: 1, score: 120 });
    for (let i = 0; i < 12; i++) await handle(post({ board: 'career', week: WEEK, id: id(3), name: 'Spam', career: career(10) }, '9.9.9.9'), redis, NOW);
    expect((await handle(post({ board: 'career', week: WEEK, id: id(3), name: 'Spam', career: career(10) }, '9.9.9.9'), redis, NOW)).status).toBe(429);
    expect([...redis.data.keys()].some(k => k.includes('9.9.9.9'))).toBe(false); // IPs are only kept hashed
  });

  it('bad requests and no database', async () => {
    expect((await handle(new Request('https://cv.test/api/leaderboard?board=nope'), fakeRedis(), NOW)).status).toBe(400);
    expect((await handle(post({ board: 'career' }), fakeRedis(), NOW)).status).toBe(400);
    expect((await handle(new Request('https://cv.test/api/leaderboard?board=career'), null, NOW)).status).toBe(503);
  });
});
