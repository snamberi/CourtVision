// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { derive, publicAvatar, sanitizeBlob } from '../../server/derive';
import { bioProblem, cleanBio, cleanBanner, readPublicProfile, setPublicProfile } from '../profile/publicProfile';
import { mergeActivity, readActivity } from '../retention/activity';
import { noteWeekRun } from '../retention/weekLog';
import { AVATAR_FRAMES, avatarFrameOpen, avatarFrameDef } from '../profile/avatarFrames';
import { DEFAULT_AVATAR } from '../profile/avatar';
import { decodeAvatar, encodeAvatar } from '../profile/avatarCode';

const NOW = new Date('2026-10-22T12:00:00Z');
const blob = (storage: Record<string, unknown>) => sanitizeBlob({ version: 1, updatedAt: 1, careers: [], storage: Object.fromEntries(Object.entries(storage).map(([k, v]) => [k, JSON.stringify(v)])) })!;
const legacy = { version: 1, achievements: { first_season: { season: '2026', leagueName: 'L', at: 1, saveIds: ['s'] } }, leagues: {} };
const stats = (storage: Record<string, unknown>) => derive(blob(storage), NOW).profile.stats as Record<string, unknown>;

describe('bio and banner', () => {
  it('a bio is short, clean and has no links', () => {
    expect(bioProblem('Rebuilding the Kings, one pick at a time.')).toBeNull();
    expect(bioProblem('x'.repeat(81))).toMatch(/80/);
    expect(bioProblem('join www.spam.com')).toMatch(/links/);
    expect(bioProblem('what the fuck')).toMatch(/different/);
    expect(cleanBio('  two   spaces  ')).toBe('two spaces');
  });
  it('a banner is a clan, a real team, or nothing', () => {
    expect(cleanBanner('clan')).toBe('clan');
    expect(cleanBanner('team:GSW')).toBe('team:GSW');
    expect(cleanBanner('team:ZZZ')).toBe('none');
    expect(cleanBanner('<script>')).toBe('none');
  });
});

describe('the public profile from the synced save', () => {
  it('shows a featured achievement only when it is earned', () => {
    expect(stats({ 'courtvision:gmLegacy': legacy, 'cv-profile-public': { featured: 'ach:first_season' } }).featured).toMatchObject({ kind: 'achievement', name: 'Welcome to the Office' });
    expect(stats({ 'cv-profile-public': { featured: 'ach:first_season' } }).featured).toBeNull();
  });
  it('a featured title must be one you hold', () => {
    expect(stats({ 'cv-profile-public': { featured: 'title:Rookie GM' } }).featured).toMatchObject({ kind: 'title' });
    expect(stats({ 'cv-profile-public': { featured: 'title:Owner' } }).featured).toBeNull();
  });
  it('the bio, banner, last five results and play time by mode go up; a dirty bio does not', () => {
    const activity = Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, at: 1000 - i, kind: 'hunt', line: `League Hunt: run ${i}` }));
    const s = stats({ 'cv-profile-public': { bio: 'Hello GMs', banner: 'team:BOS' }, 'cv-activity': activity, 'cv-play-time': { total: 7200, areas: { career: 5000, hunt: 2200, menu: 10 } } });
    expect(s).toMatchObject({ bio: 'Hello GMs', banner: 'team:BOS', playAreas: { career: 5000, hunt: 2200 } });
    expect((s.activity as unknown[]).length).toBe(5);
    expect(stats({ 'cv-profile-public': { bio: 'shit team' } }).bio).toBeNull();
  });
});

describe('recent activity', () => {
  beforeEach(() => localStorage.clear());
  it('finished runs land in it once; quick games stay out', () => {
    noteWeekRun('hunt', { score: 900, line: 'beat the boss, 40-12' }, 'hunt-1');
    noteWeekRun('hunt', { score: 900, line: 'beat the boss, 40-12' }, 'hunt-1');
    noteWeekRun('quiz', { score: 5, line: '5/10 right' }, 'quiz-1');
    expect(readActivity().map(a => a.line)).toEqual(['League Hunt: beat the boss, 40-12']);
  });
  it('two devices keep both lists, newest first', () => {
    const merged = mergeActivity([{ id: 'a', at: 1, kind: 'x', line: 'a' }], [{ id: 'b', at: 2, kind: 'x', line: 'b' }, { id: 'a', at: 1, kind: 'x', line: 'a' }]);
    expect(merged.map(a => a.id)).toEqual(['b', 'a']);
  });
  it('your picks survive a reload', () => {
    setPublicProfile({ bio: 'Hi', banner: 'clan', featured: 'title:Rookie GM' });
    expect(readPublicProfile()).toEqual({ bio: 'Hi', banner: 'clan', featured: 'title:Rookie GM' });
  });
});

describe('time-played frames', () => {
  const ctx = (hours: number) => ({ level: 1, trophies: 0, honors: [], hours });
  it('open at 10, 50, 100 and 500 hours', () => {
    for (const [id, h] of [['clock10', 10], ['clock50', 50], ['clock100', 100], ['clock500', 500]] as const) {
      expect(avatarFrameOpen(avatarFrameDef(id), ctx(h - 0.1)), id).toBe(false);
      expect(avatarFrameOpen(avatarFrameDef(id), ctx(h)), id).toBe(true);
    }
    // Append-only: the new frames come last, so older look codes keep their frames.
    expect(AVATAR_FRAMES.slice(-4).map(f => f.id)).toEqual(['clock10', 'clock50', 'clock100', 'clock500']);
  });
  it('the boards show the frame only once the synced time is there', () => {
    const save = (seconds: number) => ({ version: 1 as const, updatedAt: 0, careers: [], storage: { 'cv-avatar': JSON.stringify(DEFAULT_AVATAR), 'cv-profile-equip': JSON.stringify({ avatarFrame: 'clock10' }), 'cv-play-time': JSON.stringify({ total: seconds, areas: {} }) } });
    expect(decodeAvatar(publicAvatar(save(9 * 3600), 1, []))!.frame).toBe('none');
    expect(decodeAvatar(publicAvatar(save(10 * 3600), 1, []))!.frame).toBe('clock10');
    expect(decodeAvatar(encodeAvatar(DEFAULT_AVATAR, 'clock500'))!.frame).toBe('clock500');
  });
});

describe('the public profile pieces', () => {
  it('draw the banner, featured trophy, activity and time-played bar', async () => {
    const { render, screen, cleanup } = await import('@testing-library/react');
    const { FeaturedTrophy, PlayTimeBar, ProfileBanner, RecentActivity } = await import('../components/cloud/ProfileExtras');
    render(<>
      <ProfileBanner banner="team:LAL"><h2>@gm</h2></ProfileBanner>
      <FeaturedTrophy featured={{ kind: 'achievement', name: 'Welcome to the Office', detail: 'Complete your first season.' }} />
      <RecentActivity userId="u" activity={[{ at: Date.now(), kind: 'title', line: 'Won the title with Boston (2027)' }]} />
      <PlayTimeBar areas={{ gm: 7200, career: 3600 }} />
    </>);
    expect(document.querySelector('.profile-banner.team')).not.toBeNull();
    expect(screen.getByText('Welcome to the Office')).toBeTruthy();
    expect(screen.getByText('Won the title with Boston (2027)')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'GM Mode 67%, Career 33%' })).toBeTruthy();
    cleanup();
  });
});
