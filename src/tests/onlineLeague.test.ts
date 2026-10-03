import { describe, it, expect } from 'vitest';
import { canAdvance, withHumans, statusLine, type OnlineLeague, type OnlineMember } from '../cloud/onlineLeague';
import { advancedSince, progressMark } from '../components/cloud/OnlineBar';
import type { League } from '../simulation/league';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';

const meta = (over: Partial<OnlineLeague> = {}): OnlineLeague => ({ id: 'L1', code: 'ABC123', name: 'Friends', commissioner: 'u1', teams: [], version: 3, statePath: 'L1/3-x.json.gz', season: '2026', phase: 'regular_season', statusLine: '', deadlineHours: 24, advancedAt: new Date('2026-10-01T00:00:00Z').toISOString(), savedBy: null, updatedAt: '', ...over });
const member = (userId: string, teamId: string, ready: boolean): OnlineMember => ({ userId, teamId, ready, username: userId });
const league = (played: number): League => ({ teams: [{ teamId: 'A', name: 'A', seasons: [] }, { teamId: 'B', name: 'B', seasons: [] }], settings: { ...DEFAULT_GAME_SETTINGS }, season: '2026', seasonPhase: 'regular_season',
  schedule: Array.from({ length: 4 }, (_, i) => ({ id: `g${i}`, homeTeamId: 'A', awayTeamId: 'B', round: i, played: i < played })) } as unknown as League);

describe('online leagues', () => {
  it('moves forward when everyone is ready, or once the deadline passes', () => {
    const at = Date.parse('2026-10-01T10:00:00Z');
    expect(canAdvance(meta(), [member('u1', 'A', true), member('u2', 'B', true)], at).ok).toBe(true);
    const waiting = canAdvance(meta(), [member('u1', 'A', true), member('u2', 'B', false)], at);
    expect(waiting.ok).toBe(false);
    expect(waiting.why).toContain('@u2');
    expect(canAdvance(meta(), [member('u1', 'A', true), member('u2', 'B', false)], Date.parse('2026-10-02T01:00:00Z')).ok).toBe(true);
  });
  it("marks every friend's team as run by a person", () => {
    const l = withHumans(league(0), meta(), [member('u1', 'A', false), member('u2', 'B', false)]);
    expect(l.online).toEqual({ leagueId: 'L1', code: 'ABC123', humans: ['A', 'B'] });
  });
  it('knows when the league moved forward since it was loaded', () => {
    const base = progressMark(league(1));
    expect(advancedSince(league(1), base)).toBe(false);
    expect(advancedSince(league(3), base)).toBe(true);
    expect(statusLine(league(3))).toBe('regular season · 3/4 games');
  });
});
