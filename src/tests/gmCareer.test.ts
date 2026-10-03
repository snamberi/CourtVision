import { describe, it, expect } from 'vitest';
import { startGmCareer, joinTeam, gmCareerSeasonEnd, takeGmOffer, aiUserTeam, ROLE_LOCKED } from '../simulation/gmCareer';
import type { League } from '../simulation/league';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';

const base = { teams: [{ teamId: 'A', name: 'Alphas', seasons: [] }, { teamId: 'B', name: 'Betas', seasons: [] }], schedule: [], settings: { ...DEFAULT_GAME_SETTINGS }, season: '2030' } as unknown as League;
const rows = (aw: number) => [{ teamId: 'A', teamName: 'Alphas', wins: aw, losses: 82 - aw }, { teamId: 'B', teamName: 'Betas', wins: 20, losses: 62 }];

describe('GM Career', () => {
  it('scout, then assistant GM, then GM', () => {
    let l = joinTeam(startGmCareer(base), 'A');
    expect(l.gmCareer!.role).toBe('scout');
    expect(aiUserTeam(l, 'A')).toBeNull();
    expect(ROLE_LOCKED.scout).toContain('trade');
    l = gmCareerSeasonEnd(l, rows(30), '2030');
    expect(l.gmCareer!.role).toBe('assistant');
    expect(aiUserTeam(l, 'A')).toBe('A');
    l = gmCareerSeasonEnd(l, rows(50), '2031');
    expect(l.gmCareer!.role).toBe('gm');
  });
  it('a losing assistant gets an offer from the worst team', () => {
    let l = joinTeam(startGmCareer(base), 'A');
    l = gmCareerSeasonEnd(l, rows(30), '2030');
    l = gmCareerSeasonEnd(l, rows(25), '2031');
    expect(l.gmCareer!.role).toBe('assistant');
    expect(l.gmCareer!.offer?.teamId).toBe('B');
    l = takeGmOffer(l);
    expect(l.gmCareer!.role).toBe('gm');
    expect(l.gmCareer!.teamId).toBe('B');
  });
});
