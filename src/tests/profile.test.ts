// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { levelFor, levelCost, totalXp, xpParts, equipped, equip, noteCareers, takeLevelUp, unlocksBetween, XP } from '../profile/profile';
import { goalsFor, updateDailyGoals, loadDaily, dailyGoalXp, GOALS, ALL_DONE_BONUS } from '../profile/dailyGoals';
import type { League, ScheduledGame } from '../simulation/league';
import type { PlayerStatLine } from '../simulation/boxscore';

beforeEach(() => localStorage.clear());

const line = (id: string, over: Partial<PlayerStatLine> = {}): PlayerStatLine => ({ playerId: id, minutes: 30, points: 10, fgm: 4, fga: 9, tpm: 1, tpa: 3, ftm: 1, fta: 2, oreb: 1, dreb: 4, ast: 3, stl: 1, blk: 0, tov: 2, pf: 2, ...over } as PlayerStatLine);
const game = (id: string, my: number, their: number, mine: PlayerStatLine[] = [line('a')], played = true): ScheduledGame => ({
  id, round: 1, homeTeamId: 'ME', awayTeamId: 'OPP', played,
  result: played ? { homeTeamId: 'ME', awayTeamId: 'OPP', homeScore: my, awayScore: their, homeBox: { teamId: 'ME', points: my, players: Object.fromEntries(mine.map(l => [l.playerId, l])) }, awayBox: { teamId: 'OPP', points: their, players: { z: line('z') } }, possessionLog: [], seed: 1, injuries: [] } : undefined,
});
const league = (schedule: ScheduledGame[]): League => ({ teams: [], schedule, settings: {} as League['settings'], season: '2026' });

describe('GM Profile', () => {
  it('levels: each costs 25 more than the last, up to 250', () => {
    expect(levelFor(0)).toEqual({ level: 1, into: 0, need: levelCost(1) });
    expect(levelFor(174).level).toBe(1);
    expect(levelFor(175).level).toBe(2);
    expect(levelFor(175 + 200 + 225).level).toBe(4);
    expect(levelFor(10_000_000).level).toBe(250);
  });

  it('XP comes from every mode\'s records, including old progress', () => {
    localStorage.setItem('cv-hunt-records', JSON.stringify({ runs: 3, wins: 1, bestStop: 10, daily: { '2026-09-01': { won: true, stop: 10, wins: 40, losses: 10 } } }));
    localStorage.setItem('cv-rebuild-records', JSON.stringify({ bulls99: { best: 1500, stars: 3, titleIn: 4, attempts: 2 } }));
    noteCareers([{ retired: { legacy: 80, hallOfFame: 'yes' } }, { retired: { legacy: 20, hallOfFame: 'no' } }, {}]);
    const parts = Object.fromEntries(xpParts().map(p => [p.id, p.xp]));
    expect(parts.hunt).toBe(3 * XP.huntRun + XP.huntWin + XP.huntDaily);
    expect(parts.rebuild).toBe(2 * XP.rebuildAttempt + 3 * XP.rebuildStar + XP.rebuildTitle);
    expect(parts.career).toBe(2 * XP.careerRetired + 100 + XP.careerHof);
    expect(totalXp()).toBeGreaterThan(1000);
  });

  it('cosmetics: only unlocked ones can be equipped (levels from the level road)', () => {
    equip({ frame: 'fire', floor: 'parquet' });
    expect(equipped(1)).toMatchObject({ frame: 'classic', floor: 'team', title: 'Rookie GM' });
    expect(equipped(150)).toMatchObject({ frame: 'fire', floor: 'parquet', title: 'Showrunner' });
    expect(unlocksBetween(15, 20)).toEqual(['the "Assistant GM" title', 'the Gold card frame']);
  });

  it('level-up note: not on the first visit, then once per new level', () => {
    expect(takeLevelUp(3)).toBeNull();
    expect(takeLevelUp(3)).toBeNull();
    expect(takeLevelUp(5)).toEqual({ from: 3, to: 5 });
    expect(takeLevelUp(5)).toBeNull();
  });
});

describe('daily goals', () => {
  it('three different goals a day, one of them about winning, the same for everyone', () => {
    for (const d of ['2026-09-27', '2026-09-28', '2027-01-01', '2027-06-15']) {
      const g = goalsFor(d);
      expect(new Set(g.map(x => x.id)).size).toBe(3);
      expect(g[0].kind).not.toBe('once');
      expect(goalsFor(d)).toEqual(g);
    }
  });

  it('only games after the goals were first seen count; goals pay XP once', () => {
    const date = '2026-09-28'; // goals: pick a known set
    const goals = goalsFor(date);
    const old = [game('g1', 120, 90), game('g2', 110, 100)];
    expect(updateDailyGoals('s1', league(old), 'ME', true, date)).toEqual([]); // baseline
    expect(loadDaily(date).goals.every(g => g.progress === 0)).toBe(true);
    const big = line('star', { points: 45, oreb: 3, dreb: 12, ast: 11, stl: 13 });
    const played = [...old, ...Array.from({ length: 6 }, (_, i) => game(`n${i}`, i === 0 ? 135 : 101, i === 0 ? 90 : 99, [big, ...Array.from({ length: 12 }, (_, k) => line(`p${k}`, { ast: 3 }))]))];
    const done = updateDailyGoals('s1', league(played), 'ME', true, date);
    const state = loadDaily(date);
    expect(done.length).toBe(state.goals.filter(g => g.done).length);
    expect(state.goals.find(g => g.id === goals[0].id)?.done).toBe(true); // 6 straight wins covers any win goal
    expect(updateDailyGoals('s1', league(played), 'ME', true, date)).toEqual([]); // nothing new
    const xp = dailyGoalXp().xp;
    expect(xp).toBe(done.reduce((n, g) => n + g.xp, 0) + (state.bonus ? ALL_DONE_BONUS : 0));
  });

  it('sandbox leagues do not pay out', () => {
    const date = '2026-09-29';
    updateDailyGoals('s2', league([]), 'ME', false, date);
    updateDailyGoals('s2', league(Array.from({ length: 6 }, (_, i) => game(`x${i}`, 150, 80))), 'ME', false, date);
    expect(loadDaily(date).goals.some(g => g.done)).toBe(false);
    expect(GOALS.length).toBeGreaterThan(8);
  });
});
