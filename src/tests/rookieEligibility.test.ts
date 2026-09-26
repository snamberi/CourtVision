import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { computeSeasonAwards } from '../simulation/awards';
import { isRookieEligible, previousSeasonsPlayed } from '../simulation/rookieEligibility';
import { emptySeasonStatTotals, emptySeasonMilestones, type PlayerSeason } from '../simulation/types';
const record = (season: string, gamesPlayed: number) => ({ season, teamId: 'A', age: 19, overall: 65, stats: { ...emptySeasonStatTotals(), gamesPlayed }, milestones: emptySeasonMilestones() });

describe('experience-based rookie eligibility', () => {
  it('awards a 24-year-old debutant rather than a dominant 20-year-old third-year player', () => {
    const { league } = generateFullLeague(34, 4, 10, 10, '2026', { priorSeasons: false });
    for (const t of league.teams) for (const s of t.seasons) s.careerHistory = [record('2025', 2)];
    const rookie = league.teams[0].seasons[0], veteran = league.teams[1].seasons[0];
    rookie.age = 24; rookie.careerHistory = []; rookie.draftYear = '2022';
    veteran.age = 20; veteran.careerHistory = [record('2024', 30), record('2025', 60)];
    for (const [s, points] of [[rookie, 150], [veteran, 600]] as [PlayerSeason, number][]) s.seasonStats = { ...emptySeasonStatTotals(), gamesPlayed: 10, minutes: 300, points, blk: 20, stl: 10 };
    const awards = computeSeasonAwards(league, { minGames: 5 });
    expect(awards.roy?.playerId).toBe(rookie.playerId);
    expect(awards.allRookie.flat().map(x => x.playerId)).toEqual([rookie.playerId]);
    expect(awards.ballots.roy.map(x => x.playerId)).toEqual([rookie.playerId]);
    expect(awards.rookieDefender?.playerId).toBe(rookie.playerId);
    expect(previousSeasonsPlayed(veteran)).toBe(2);
  });
  it('does not count DNP years, a current-season row or duplicate team stints as extra experience', () => {
    const { league } = generateFullLeague(2, 4, 10, 10, '2026', { priorSeasons: false });
    const s = league.teams[0].seasons[0];
    s.careerHistory = [record('2025', 0), record(s.season, 3)];
    expect(isRookieEligible(s)).toBe(true);
    s.careerHistory.push(record('2024', 1), record('2024', 2));
    expect(previousSeasonsPlayed(s)).toBe(1);
    expect(isRookieEligible(s)).toBe(false);
  });
  it('remains compatible with saves without history, and never awards a DNP player', () => {
    const { league } = generateFullLeague(2, 4, 10, 10, '2026', { priorSeasons: false });
    expect(isRookieEligible(league.teams[0].seasons[0])).toBe(true);
    expect(computeSeasonAwards(league, { minGames: 0 }).roy).toBeNull();
  });
});
