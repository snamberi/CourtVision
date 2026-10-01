// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { AVATAR_FRAMES } from '../profile/avatarFrames';
import { avatarItem, type AvatarCategory } from '../profile/avatar';
import { ICONS, SPRITES, PALETTE, NAME_COLORS, HONORS, MODE_TITLES, LEVEL_ROAD, ROAD_LOOK_NAMES, ENTITLEMENTS_KEY, isOpen, unlockContext, earnedExtraTitles, noteHonors, readHonors } from '../profile/cosmetics';
import { equipped, equip, levelFor, levelCost, MAX_LEVEL, FRAMES, FLOORS, TITLES, unlocksBetween } from '../profile/profile';
import { computeHonors } from '../../server/honors';

beforeEach(() => localStorage.clear());

describe('profile cosmetics', () => {
  it('every sprite is 10 x 10 in the palette, and every icon has one (71 icons: 38 from the level road, 17 from the Trophy Road, 2 from the card album, 1 from the Owner Box, 1 Game Owner only)', () => {
    for (const [id, rows] of Object.entries(SPRITES)) {
      expect(rows, id).toHaveLength(10);
      for (const row of rows) { expect(row.length, `${id}: ${row}`).toBe(10); for (const ch of row) expect(ch === '.' || ch in PALETTE, `${id}: ${ch}`).toBe(true); }
    }
    for (const icon of ICONS) expect(SPRITES[icon.base], icon.id).toBeTruthy();
    expect(ICONS.length).toBe(71);
    expect(new Set(ICONS.map(i => i.id)).size).toBe(ICONS.length);
    expect(new Set(NAME_COLORS.map(c => c.id)).size).toBe(NAME_COLORS.length);
  });

  it('the level road: a reward every 5 levels to 250, every 50 to 750, and every reward exists', () => {
    for (let l = 5; l <= 250; l += 5) expect(LEVEL_ROAD.some(([lv]) => lv === l), `level ${l}`).toBe(true);
    for (let l = 300; l <= 750; l += 50) expect(LEVEL_ROAD.some(([lv]) => lv === l), `level ${l}`).toBe(true);
    expect(LEVEL_ROAD.every(([lv]) => lv <= 250 || lv % 50 === 0)).toBe(true);
    for (const [lv, kind, id] of LEVEL_ROAD) {
      expect(lv % 5, `${kind} ${id}`).toBe(0);
      if (kind === 'look') { expect(ROAD_LOOK_NAMES[id], id).toBeTruthy(); continue; } // checked against the themes in themes.test
      if (kind === 'avatarFrame') { expect(AVATAR_FRAMES.find(f => f.id === id)?.level, id).toBe(lv); continue; }
      if (kind === 'avatar') { const [cat, piece] = id.split(':'); expect(avatarItem(cat as AvatarCategory, piece)?.rule, id).toEqual({ level: lv }); continue; }
      const list = kind === 'icon' ? ICONS : kind === 'color' ? NAME_COLORS : kind === 'frame' ? FRAMES : kind === 'floor' ? FLOORS : TITLES;
      const hit = list.find(x => x.id === id) as { rule?: { level?: number }; level?: number } | undefined;
      expect(hit, `${kind} ${id}`).toBeTruthy();
      expect(hit!.rule?.level ?? hit!.level, `${kind} ${id}`).toBe(lv);
    }
    expect(new Set(LEVEL_ROAD.map(([, k, id]) => `${k}:${id}`)).size).toBe(LEVEL_ROAD.length);
    expect(MAX_LEVEL).toBe(750);
    expect(levelFor(1e9).level).toBe(750);
    // Level 250 is a long road (over 800,000 XP), level 5 a short one.
    expect(Array.from({ length: 249 }, (_, i) => levelCost(i + 1)).reduce((a, b) => a + b, 0)).toBeGreaterThan(800_000);
    expect(levelFor(900).level).toBe(5);
    expect(unlocksBetween(0, 10)).toEqual(expect.arrayContaining(['the "Scout" title', 'the Sneaker icon']));
  });

  it('unlocks come from levels, ranked tiers, achievements and leaderboard honors', () => {
    const base = { level: 1, rank: -1, honors: [] as string[], modes: [] as string[], supporter: false, trophies: 0 };
    expect(isOpen({ level: 5 }, base)).toBe(false);
    expect(isOpen({ level: 5 }, { ...base, level: 5 })).toBe(true);
    expect(isOpen({ rank: 4 }, { ...base, rank: 4 })).toBe(true);
    expect(isOpen({ mode: 'pvp-1200' }, { ...base, modes: ['pvp-1200'] })).toBe(true);
    expect(isOpen({ anyHonor: true }, { ...base, honors: ['gm-100'] })).toBe(true);
    expect(isOpen({ trophies: 5000 }, { ...base, trophies: 4999 })).toBe(false);
    expect(isOpen({ trophies: 5000 }, { ...base, trophies: 5000 })).toBe(true);
    // Prism: a #1 finish only.
    expect(isOpen({ honor: 'first' }, { ...base, honors: ['gm-10'] })).toBe(false);
    expect(isOpen({ honor: 'first' }, { ...base, honors: ['weekly-1'] })).toBe(true);
    expect(earnedExtraTitles({ ...base, honors: ['gm-10'], modes: ['hunt-legend'] })).toEqual(['Top 10 GM', 'Legend Slayer']);
    expect(isOpen({ supporter: true }, base)).toBe(false);
    expect(earnedExtraTitles({ ...base, supporter: true })).toEqual(['Supporter']);
    expect(HONORS.length + MODE_TITLES.length).toBeGreaterThan(10);
  });

  it('honors are kept (never taken back) and unknown ones are ignored', () => {
    noteHonors(['gm-100', 'made-up']);
    noteHonors(['weekly-1']);
    expect(readHonors()).toEqual(['gm-100', 'weekly-1']);
    noteHonors(null);
    expect(readHonors()).toEqual(['gm-100', 'weekly-1']);
  });

  it('you can only wear what you have unlocked', () => {
    equip({ icon: 'crown', color: 'gold', title: 'Top 10 GM' });
    expect(equipped(1)).toMatchObject({ icon: 'ball', color: 'cream', title: 'Rookie GM' });
    expect(equipped(150)).toMatchObject({ icon: 'crown', color: 'gold' });
    // Supporter items need the pass.
    equip({ icon: 'heart' });
    expect(equipped(250).icon).toBe('ball');
    localStorage.setItem(ENTITLEMENTS_KEY, JSON.stringify({ supporter: true }));
    expect(equipped(1).icon).toBe('heart');
    noteHonors(['gm-10']);
    expect(equipped(1).title).toBe('Top 10 GM');
    expect(unlockContext(1).honors).toEqual(['gm-10']);
  });
});

describe('leaderboard honors on the server', () => {
  const env = { url: 'https://x.supabase.co', serviceKey: 's', publicKey: 'a' };
  /** Answers each count query from a table of (substring → total). */
  const counts = (table: [string, number][]) => (async (url: string) => {
    const u = decodeURIComponent(String(url));
    const hit = table.find(([k]) => u.includes(k));
    return new Response('[]', { status: 200, headers: { 'content-range': `0-0/${hit ? hit[1] : 0}` } });
  }) as unknown as typeof fetch;
  const derived = (over: Partial<Parameters<typeof computeHonors>[2]> = {}) => ({ profile: { level: 20, xp: 9000, stats: {} }, achievements: [], players: [], weekly: [], daily: [], rebuild: [], codes: [], ranked: [], ...over });

  it('ranks on the GM board once the field is real, and keeps what was earned', async () => {
    const now = new Date('2026-10-05T12:00:00Z');
    expect(await computeHonors(env, 'me', derived(), now, [], counts([['xp=gt', 0], ['lb_users', 50]]))).toEqual(['gm-1', 'gm-10', 'gm-100']);
    expect(await computeHonors(env, 'me', derived(), now, [], counts([['xp=gt', 30], ['lb_users', 50]]))).toEqual(['gm-100']);
    // Too small a field hands out nothing new; earlier honors stay.
    expect(await computeHonors(env, 'me', derived(), now, ['weekly-1'], counts([['lb_users', 4]]))).toEqual(['weekly-1']);
  });

  it('a finished weekly board you top is a Weekly Champion; this week does not count yet', async () => {
    const now = new Date('2026-10-05T12:00:00Z'); // week 41
    const weekly = [{ board: 'rebuild' as const, week: '2026-W40', score: 900, detail: '' }, { board: 'rebuild' as const, week: '2026-W41', score: 999, detail: '' }];
    const f = counts([['score=gt', 0], ['weekly_scores', 8], ['lb_users', 2]]);
    expect(await computeHonors(env, 'me', derived({ weekly }), now, [], f)).toEqual(['weekly-1']);
    expect(await computeHonors(env, 'me', derived({ weekly: [weekly[1]] }), now, [], f)).toEqual([]);
  });

  it('a ranked season that ended: #1, #2 or #3 of a real field earns a podium honor (and its frame)', async () => {
    const now = new Date('2026-10-05T12:00:00Z');
    const ranked = [{ event: 'dl:2026-09-20', season: '2026-09', points: 300 }];
    expect(await computeHonors(env, 'me', derived({ ranked }), now, [], counts([['points=gt', 1], ['lb_ranked', 12], ['lb_users', 2]]))).toEqual(['ranked-2']);
    expect(await computeHonors(env, 'me', derived({ ranked }), now, [], counts([['points=gt', 3], ['lb_ranked', 12], ['lb_users', 2]]))).toEqual([]);
    // Too few played that season.
    expect(await computeHonors(env, 'me', derived({ ranked }), now, [], counts([['points=gt', 0], ['lb_ranked', 2], ['lb_users', 2]]))).toEqual([]);
  });

  it('the top 10% of a finished Weekly Hunt earn Weekly Hunter', async () => {
    const now = new Date('2026-10-05T12:00:00Z');
    const weekly = [{ board: 'hunt' as const, week: '2026-W40', score: 700, detail: '' }];
    // 30 played: the top 3 make the cut. Fourth does not.
    expect(await computeHonors(env, 'me', derived({ weekly }), now, [], counts([['score=gt', 2], ['board=eq.hunt', 29], ['lb_users', 2]]))).toContain('hunt-week-10');
    expect(await computeHonors(env, 'me', derived({ weekly }), now, [], counts([['score=gt', 3], ['board=eq.hunt', 29], ['lb_users', 2]]))).not.toContain('hunt-week-10');
  });
});
