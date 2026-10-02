// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { encodeDuel, decodeDuel, duelFromHash, duelLink, savePendingDuel, takePendingDuel, duelVerdict, type Duel } from '../retention/duel';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { newRun } from '../hunt/run';
import { newPerfectRun, pickPlayer, rollPool } from '../perfect/run';

beforeEach(() => localStorage.clear());
const duel: Duel = { v: 1, m: 'perfect', s: 123456, pm: 'franchise', n: '@sabá', r: { score: 14317, line: '76-6 · playoffs 14-9', won: false } };

describe('Same-spin duels', () => {
  it('round-trips a duel through a link, names and all', () => {
    const link = duelLink(duel, 'https://courtvisiongame.com');
    expect(link).toMatch(/^https:\/\/courtvisiongame\.com\/#\/duel\/[A-Za-z0-9_-]+$/);
    expect(duelFromHash(link.slice(link.indexOf('#')))).toEqual(duel);
    expect(decodeDuel(encodeDuel(duel))).toEqual(duel);
  });
  it('turns away broken or hand-made junk', () => {
    expect(decodeDuel('not-a-duel')).toBeNull();
    expect(decodeDuel(encodeDuel({ ...duel, m: 'chess' as 'hunt' }))).toBeNull();
    expect(decodeDuel(encodeDuel({ ...duel, pm: undefined }))).toBeNull();
    expect(decodeDuel(encodeDuel({ ...duel, n: '<script>' + 'x'.repeat(50) }))!.n).not.toContain('<');
    expect(duelFromHash('#/hunt')).toBeNull();
  });
  it('holds the link for its mode until the mode takes it', () => {
    savePendingDuel(duel);
    expect(takePendingDuel('hunt')).toBeNull();
    expect(takePendingDuel('perfect')).toEqual(duel);
    expect(takePendingDuel('perfect')).toBeNull();
  });
  it('says who won', () => {
    expect(duelVerdict(15000, 14317, '@sam')).toEqual({ text: 'You beat @sam by 683.', outcome: 'win' });
    expect(duelVerdict(1, 1, '@sam').outcome).toBe('tie');
    expect(duelVerdict(10, 20, '@sam').outcome).toBe('loss');
  });
  it('the same seed gives the same run: the same Hunt teams and the same 82-0 rolls', async () => {
    const h = await loadHistoryForTests();
    const a = newRun(h, 777, { deck: 'classic', difficulty: 'pro' }), b = newRun(h, 777, { deck: 'classic', difficulty: 'pro' });
    expect(a.series.map(s => s.teamId)).toEqual(b.series.map(s => s.teamId));
    const p = newPerfectRun(h, 'franchise', 99), q = newPerfectRun(h, 'franchise', 99);
    expect(q.roll).toEqual(p.roll);
    const pick = (r: typeof p) => pickPlayer(h, r, rollPool(h, r, r.roll!)[0].id);
    expect(pick(q).roll).toEqual(pick(p).roll);
  });
});
