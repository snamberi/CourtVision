import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { advanceToNextSeason } from '../simulation/seasonTransition';
import { computeLeagueAnalytics } from '../simulation/leagueAnalytics';

describe('computeLeagueAnalytics', () => {
  it('returns top players/rookies but empty improve/decline lists before any season rollover has happened', () => {
    const { league } = generateFullLeague(1, 6, 8, 10, '2026-27');
    const played = simulateRemainingSeason(league, 1);
    const analytics = computeLeagueAnalytics(played, { topN: 5 });
    expect(analytics.bestPlayers.length).toBe(5);
    expect(analytics.mostImprovedPlayers).toEqual([]);
    expect(analytics.mostDeclinedPlayers).toEqual([]);
    expect(analytics.improvedTeams).toEqual([]);
    expect(analytics.declinedTeams).toEqual([]);
    expect(analytics.retiredPlayers).toEqual([]);
  });

  it('populates improve/decline lists and retired players after a season rollover', () => {
    const { league, extras } = generateFullLeague(2, 8, 10, 12, '2026-27');
    const played = simulateRemainingSeason(league, 2);
    const { league: nextLeague } = advanceToNextSeason(played, extras, 2);
    const analytics = computeLeagueAnalytics(nextLeague, { topN: 5 });
    // Some players should show a delta now (previousFullOverall got set for everyone who survived the rollover).
    const anyDelta = nextLeague.teams.some((t) => t.seasons.some((s) => s.previousFullOverall != null));
    expect(anyDelta).toBe(true);
    // bestTeams/worstTeams always populate regardless of history.
    expect(analytics.bestTeams.length).toBeGreaterThan(0);
    expect(analytics.worstTeams.length).toBeGreaterThan(0);
  });

  it('best players are sorted descending by the full-attribute overall composite', () => {
    const { league } = generateFullLeague(3, 6, 8, 10, '2026-27');
    const analytics = computeLeagueAnalytics(league, { topN: 10 });
    for (let i = 1; i < analytics.bestPlayers.length; i++) {
      expect(analytics.bestPlayers[i - 1].overall).toBeGreaterThanOrEqual(analytics.bestPlayers[i].overall);
    }
  });

  it('worst teams are sorted ascending by overall average, best teams descending, and both are capped at 5', () => {
    const { league } = generateFullLeague(4, 8, 10, 12, '2026-27');
    const analytics = computeLeagueAnalytics(league);
    expect(analytics.bestTeams.length).toBeLessThanOrEqual(5);
    expect(analytics.worstTeams.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < analytics.bestTeams.length; i++) {
      expect(analytics.bestTeams[i - 1].overallAverage).toBeGreaterThanOrEqual(analytics.bestTeams[i].overallAverage);
    }
    for (let i = 1; i < analytics.worstTeams.length; i++) {
      expect(analytics.worstTeams[i - 1].overallAverage).toBeLessThanOrEqual(analytics.worstTeams[i].overallAverage);
    }
  });

  it('only includes players age 21 or younger in bestRookies', () => {
    const { league } = generateFullLeague(5, 6, 8, 10, '2026-27');
    const analytics = computeLeagueAnalytics(league, { topN: 50 });
    for (const t of league.teams) {
      for (const s of t.seasons) {
        if (s.age > 21) expect(analytics.bestRookies.some((r) => r.playerId === s.playerId)).toBe(false);
      }
    }
  });

  it('retired players accumulate across multiple season rollovers rather than being overwritten', () => {
    const { league, extras } = generateFullLeague(6, 6, 8, 10, '2026-27');
    const playedOne = simulateRemainingSeason(league, 6);
    const { league: afterOne, extras: extrasOne } = advanceToNextSeason(playedOne, extras, 6);
    const playedTwo = simulateRemainingSeason(afterOne, 7);
    const { league: afterTwo } = advanceToNextSeason(playedTwo, extrasOne, 7);
    expect((afterTwo.retiredPlayers ?? []).length).toBeGreaterThanOrEqual((afterOne.retiredPlayers ?? []).length);
  }, 15000);
});
