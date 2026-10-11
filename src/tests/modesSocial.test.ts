// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { challengeFor, challengeDone, claimChallenge, readChallenge, challengeStreak, mergeChallenge, CHALLENGE_KEY, CHALLENGE_ROTATION } from '../retention/dailyChallenge';
import { headToHead } from '../cloud/rivals';
import { clubPass, CLUB_PASS_TIER_XP } from '../cloud/clubs';
import { decadeView, startDecade, DECADE_FINISH_POINTS } from '../simulation/decadeChallenge';
import type { League } from '../simulation/league';

beforeEach(() => localStorage.clear());

describe('Daily Challenge', () => {
  it('rotates through the dailies, one a day', () => {
    const days = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'].map(challengeFor);
    expect(new Set(days)).toEqual(new Set(CHALLENGE_ROTATION));
    expect(challengeFor('2026-10-15')).toBe(challengeFor('2026-10-11'));
  });
  it('pays once when the day is finished and counts a streak', () => {
    const day = CHALLENGE_ROTATION.map((_, i) => `2026-10-${11 + i}`).find(d => challengeFor(d) === 'hunt')!;
    expect(challengeDone(day)).toBe(false);
    expect(claimChallenge(day)).toBe(false);
    localStorage.setItem('cv-hunt-records', JSON.stringify({ runs: 1, wins: 0, bestStop: 2, daily: { [day]: { won: false, stop: 2, wins: 5, losses: 4 } } }));
    expect(challengeDone(day)).toBe(true);
    expect(claimChallenge(day)).toBe(true);
    expect(claimChallenge(day)).toBe(false);
    localStorage.setItem(CHALLENGE_KEY, JSON.stringify({ days: ['2026-10-09', '2026-10-10', day] }));
    expect(challengeStreak(readChallenge(), '2026-10-11')).toBeGreaterThanOrEqual(2);
    expect(mergeChallenge({ days: ['a-1'] as string[] }, { days: ['2026-10-01'] }).days).toContain('2026-10-01');
  });
});

describe('weekly rival', () => {
  it('scores each board as a round', () => {
    const rows = [
      { user_id: 'me', username: 'me', score: 900, board: 'hunt' }, { user_id: 'r', username: 'r', score: 800, board: 'hunt' },
      { user_id: 'r', username: 'r', score: 50, board: 'perfect' },
      { user_id: 'me', username: 'me', score: 10, board: 'career' }, { user_id: 'r', username: 'r', score: 10, board: 'career' },
    ];
    const h = headToHead('me', 'r', rows);
    expect(h.wins).toBe(1);
    expect(h.losses).toBe(1);
    expect(h.boards.find(b => b.board === 'career')).toMatchObject({ mine: 10, theirs: 10 });
  });
});

describe('club pass', () => {
  it('fills from club XP and unlocks banners', () => {
    expect(clubPass(0)).toMatchObject({ tier: 0, banners: [] });
    const p = clubPass(CLUB_PASS_TIER_XP * 12 + 100);
    expect(p.tier).toBe(12);
    expect(p.into).toBe(100);
    expect(p.banners.map(b => b.tier)).toEqual([5, 10]);
    expect(p.next?.tier).toBe(20);
    expect(clubPass(1e9).tier).toBe(50);
  });
});

describe('10-Season Dynasty', () => {
  it('scores wins and playoff finishes for your team, ten seasons only', () => {
    const season = (y: number, finish: 'Champion' | 'Missed Playoffs') => ({ season: `${y}`, championTeamId: null, championTeamName: null, mvpPlayerId: null, mvpTeamName: null, dpoyPlayerId: null, royPlayerId: null, fmvpPlayerId: null,
      teamSeasons: [{ teamId: 'T', teamName: 'T', wins: 50, losses: 32, ppg: 0, oppPpg: 0, ortg: 0, drtg: 0, pace: 0, tpmPg: 0, apg: 0, rpg: 0, spg: 0, bpg: 0, playoffFinish: finish, playoffWins: 0, playoffLosses: 0, roster: [] }] });
    const base = startDecade({ season: '2026', teams: [], schedule: [] } as unknown as League);
    const league = { ...base, franchiseHistory: Array.from({ length: 12 }, (_, i) => season(2026 + i, i === 0 ? 'Champion' : 'Missed Playoffs')) } as unknown as League;
    const v = decadeView(league, 'T')!;
    expect(v.played).toBe(10);
    expect(v.done).toBe(true);
    expect(v.titles).toBe(1);
    expect(v.score).toBe(10 * 500 + DECADE_FINISH_POINTS.Champion);
    expect(v.stars).toBe(2); // 6,000 is the second star
    expect(decadeView({ ...league, decade: undefined } as League, 'T')).toBeNull();
  });
});
