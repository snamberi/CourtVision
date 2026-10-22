import { describe, expect, it } from 'vitest';
import { derive, sanitizeBlob } from '../../server/derive';
import { MODE_CATALOG } from '../menu/modeCatalog';
import migration from '../../supabase/migrations/2026-10-22-owner-off-boards-play-time.sql?raw';
import honorsSource from '../../server/honors.ts?raw';

const NOW = new Date('2026-10-22T12:00:00Z');
const blob = (storage: Record<string, unknown>) => sanitizeBlob({ version: 1, updatedAt: 1, storage: Object.fromEntries(Object.entries(storage).map(([k, v]) => [k, JSON.stringify(v)])), careers: [] })!;

describe('time played on the profile and its board', () => {
  it('the synced save puts time played and the favourite mode on the public profile', () => {
    const s = derive(blob({ 'cv-play-time': { total: 7200, areas: { career: 5000, menu: 2200 } } }), NOW).profile.stats;
    expect(s.playSeconds).toBe(7200);
    expect(s.playTop).toBe('career');
  });

  it('a save can never claim more time than the game has existed', () => {
    const s = derive(blob({ 'cv-play-time': { total: 1e12, areas: {} } }), NOW).profile.stats;
    expect(s.playSeconds).toBeLessThanOrEqual((NOW.getTime() - Date.parse('2026-01-01T00:00:00Z')) / 1000);
  });

  it('the GM view exposes hours played for the Time played board', () => {
    expect(migration).toMatch(/create view public\.lb_users[\s\S]*as play_hours/);
  });
});

describe('the owner is on no leaderboard', () => {
  it('every board view leaves the owner out', () => {
    for (const view of ['lb_users', 'lb_players', 'lb_weekly', 'lb_daily', 'lb_rebuild', 'lb_codes', 'lb_ranked', 'lb_pvp', 'lb_clubs', 'lb_club_weekly', 'lb_club_members']) {
      const def = migration.split(`create view public.${view} `)[1]?.split(';')[0] ?? '';
      expect(def, view).toContain("p.role is distinct from 'owner'");
    }
  });

  it('honors only compare against the board views, never the raw score tables', () => {
    expect(honorsSource).not.toMatch(/`(weekly_scores|daily_legend|hunt_ghosts)\?/);
  });
});

describe('Clans on a computer', () => {
  it('the desktop menu lists every Compete page, Clans included', () => {
    const screens = MODE_CATALOG.filter(e => e.group === 'compete' && e.action.kind === 'screen').map(e => e.id);
    expect(screens).toEqual(expect.arrayContaining(['clubs', 'online', 'ranked', 'friends']));
  });
});
