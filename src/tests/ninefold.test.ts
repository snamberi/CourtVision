import { describe, expect, it } from 'vitest';
import { buildSummary, newMoments, roadRank } from '../cloud/ninefold';
import type { CloudProfile } from '../cloud/account';

const profile = (patch: Partial<CloudProfile> = {}): CloudProfile => ({
  id: 'u', username: 'Ace', title: 'Scout', frame: 'gold', icon: 'ball', color: 'cream', level: 11, xp: 5200,
  stats: { playSeconds: 16.4 * 3600, honors: ['gm-10', 'weekly-1', 'not-real'] }, ...patch,
});

describe('Ninefold profile card', () => {
  it('summarises Court Vision progress without inventing values', () => {
    const s = buildSummary(profile(), 42, new Date('2026-10-25T00:00:00Z'));
    expect(s).toMatchObject({ v: 1, level: 11, xp: 5200, title: 'Scout', scoutRank: 'Scout', hours: 16.4, achievements: 42 });
    expect(s.placements).toEqual([{ board: 'Top 10 GM', rank: 10, season: null }, { board: 'Weekly Champion', rank: 1, season: null }]);
    expect(buildSummary(profile({ stats: {} }), 0).hours).toBeNull();
    expect(roadRank(3)).toBeNull();
  });

  it('reports only new big moments, and nothing on the first publish', () => {
    const next = { level: 20, honors: ['gm-10'], ranked: 'gold' };
    expect(newMoments(null, next)).toEqual([]);
    const rows = newMoments({ level: 19, honors: [], ranked: 'silver' }, next);
    expect(rows.map(r => r.kind)).toEqual(['level-up', 'honor', 'ranked-tier']);
    expect(rows[0].text).toBe('Reached level 20 (Assistant GM) in Court Vision');
    expect(newMoments(next, next)).toEqual([]);
  });
});
