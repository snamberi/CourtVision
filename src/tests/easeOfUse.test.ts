// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { appendInbox, loadInbox, markAllRead, unreadCount, clearInbox } from '../inbox';
import { matchJump, SHORTCUTS, type JumpItem } from '../navigation/quickJump';
import { keyMoment, createSave, updateSave, listRestorePoints, prepareRewind, MAX_KEY_POINTS } from '../storage/saves';
import { prefersReducedMotion, setReduceMotion } from '../lib/accessibility';
import { generateFullLeague } from '../simulation/leagueGenerator';
import type { League } from '../simulation/league';

beforeEach(() => localStorage.clear());

describe('inbox', () => {
  it('keeps every message per league, skips an instant duplicate, and counts unread', () => {
    appendInbox('a', { text: 'Signed X', tone: 'success' });
    appendInbox('a', { text: 'Signed X', tone: 'success' });
    appendInbox('a', { text: 'Injury: Y', tone: 'error' });
    appendInbox('b', { text: 'Other league', tone: 'info' });
    expect(loadInbox('a').map(m => m.text)).toEqual(['Signed X', 'Injury: Y']);
    expect(unreadCount(loadInbox('a'))).toBe(2);
    markAllRead('a');
    expect(unreadCount(loadInbox('a'))).toBe(0);
    expect(loadInbox('b')).toHaveLength(1);
    clearInbox('a');
    expect(loadInbox('a')).toHaveLength(0);
    appendInbox(null, { text: 'nowhere', tone: 'info' });
  });
});

describe('Ctrl+K search', () => {
  const items: JumpItem[] = [
    { label: 'Roster', tab: 'roster', group: 'Team' },
    { label: 'LeBron James', tab: 'editor', group: 'Cleveland', kind: 'player', id: 'LeBron James' },
    { label: 'Cleveland', tab: 'teamProfile', group: 'Team', kind: 'team', id: 'CLE' },
  ];
  it('lists pages when empty and finds players and teams once you type', () => {
    expect(matchJump(items, '').map(i => i.label)).toEqual(['Roster']);
    expect(matchJump(items, 'lebr').map(i => i.label)).toEqual(['LeBron James']);
    expect(matchJump(items, 'clev').map(i => i.label)).toContain('Cleveland');
    expect(matchJump(items, 'r').every(i => !i.kind)).toBe(true);
  });
  it('documents the new shortcuts', () => {
    expect(SHORTCUTS.map(s => s[0])).toEqual(expect.arrayContaining(['W', 'L', 'I']));
  });
});

describe('rewind', () => {
  const base = () => generateFullLeague(3, 30, 18, 82, '2025');
  it('names the key moment a save passes', () => {
    const { league } = base();
    expect(keyMoment(league, { ...league, seasonPhase: 'draft' })).toBe('Before the draft');
    expect(keyMoment(league, { ...league, seasonPhase: 'free_agency' })).toBe('Before free agency');
    expect(keyMoment(league, { ...league, season: '2026' })).toBe('Before the new season');
    expect(keyMoment(league, { ...league, deadlineDay: { season: league.season!, round: 10, status: 'open', hour: 0, rumors: [], trades: [] } as unknown as League['deadlineDay'] })).toBe('Before Deadline Day');
    expect(keyMoment(league, league)).toBeNull();
  });
  it('saves a key moment before the draft and rewinds to it, keeping where you were', async () => {
    const { league, extras } = base();
    const id = await createSave('Rewind test', league, extras, null);
    await updateSave(id, { ...league, seasonPhase: 'draft' }, extras, null);
    const points = await listRestorePoints(id);
    const draft = points.find(p => p.label === 'Before the draft')!;
    expect(draft.key).toBe(true);
    const snap = await prepareRewind(id, draft.id);
    expect(snap.league.seasonPhase ?? 'regular_season').toBe('regular_season');
    const after = await listRestorePoints(id);
    expect(after.some(p => p.label === 'Before rewind' && p.key)).toBe(true);
    expect(after.filter(p => p.key).length).toBeLessThanOrEqual(MAX_KEY_POINTS);
  });
});

describe('reduce motion', () => {
  it('the in-game switch turns animations off', () => {
    setReduceMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
    setReduceMotion(false);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(false);
  });
});
