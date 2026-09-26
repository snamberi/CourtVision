import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateNextGame } from '../simulation/league';
import { computePowerRankings, computeRatingsTable, RATING_RANK_CATEGORIES } from '../simulation/powerRankings';
import { collectLeagueTransactions } from '../simulation/transactions';
import { computeTeamStats } from '../simulation/teamStats';
import { toggleWatchList } from '../simulation/gm';

function playSomeGames(league: ReturnType<typeof generateFullLeague>['league'], n: number) {
  let l = league;
  for (let i = 0; i < n; i++) {
    if (!l.schedule.some((g) => !g.played)) break;
    l = simulateNextGame(l, i + 1);
  }
  return l;
}

describe('power rankings', () => {
  it('ranks every team exactly once, best record/diff first', () => {
    const { league: fresh } = generateFullLeague(3, 8, 8, 15);
    const league = playSomeGames(fresh, 40);
    const rankings = computePowerRankings(league);
    expect(rankings.length).toBe(8);
    expect(new Set(rankings.map((r) => r.rank)).size).toBe(8);
    expect(rankings[0].rank).toBe(1);
    // Best team's win% should be >= last team's.
    expect(rankings[0].winPct).toBeGreaterThanOrEqual(rankings[rankings.length - 1].winPct);
  });

  it('says so plainly when no games have been played yet', () => {
    const { league } = generateFullLeague(3, 4, 8, 10);
    const rankings = computePowerRankings(league);
    expect(rankings.every((r) => r.blurb.includes('too early'))).toBe(true);
  });
});

describe('ratings table (full power rankings)', () => {
  it('assigns each rank category as a clean 1..N permutation across teams', () => {
    const { league } = generateFullLeague(12, 10, 8, 5);
    const table = computeRatingsTable(league);
    expect(table.length).toBe(10);
    for (const cat of RATING_RANK_CATEGORIES) {
      const ranksForCat = table.map((r) => r.ranks[cat.key]).sort((a, b) => a - b);
      expect(ranksForCat).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    }
  });

  it('sorts by team rating, highest first', () => {
    const { league } = generateFullLeague(13, 8, 8, 5);
    const table = computeRatingsTable(league);
    for (let i = 1; i < table.length; i++) expect(table[i - 1].rating).toBeGreaterThanOrEqual(table[i].rating);
  });
});

describe('league transactions feed', () => {
  it('collects drafted/signed/traded/waived events from every team into one list', () => {
    const { league } = generateFullLeague(5, 6, 8, 10);
    const extras: any = { freeAgents: [] };
    // Manually inject a couple of history events to verify collection, since a fresh league has none yet.
    const patchedTeams = league.teams.map((t, i) => i === 0
      ? { ...t, seasons: t.seasons.map((s, j) => j === 0 ? { ...s, history: [{ season: league.season ?? '2026-27', type: 'signed' as const, description: 'Test signing', teamId: t.teamId }] } : s) }
      : t);
    const patchedLeague = { ...league, teams: patchedTeams };
    const entries = collectLeagueTransactions(patchedLeague, extras);
    expect(entries.length).toBe(1);
    expect(entries[0].type).toBe('signed');
    expect(entries[0].teamName).toBe(patchedTeams[0].name);
  });
});

describe('team stats', () => {
  it('computes a sane, non-crashing points-for/against per team after some games', () => {
    const { league: fresh } = generateFullLeague(9, 6, 10, 15);
    const league = playSomeGames(fresh, 30);
    const rows = computeTeamStats(league);
    expect(rows.length).toBe(6);
    for (const r of rows) {
      if (r.gamesPlayed > 0) {
        expect(r.ppg).toBeGreaterThan(50);
        expect(r.ppg).toBeLessThan(200);
        expect(r.netRating).toBeCloseTo(r.ppg - r.oppPpg, 5);
      }
    }
  });
});

describe('watch list', () => {
  it('toggles a player on and back off', () => {
    const extras: any = { watchList: [] };
    const added = toggleWatchList(extras, 'Some Player');
    expect(added.watchList).toContain('Some Player');
    const removed = toggleWatchList(added, 'Some Player');
    expect(removed.watchList).not.toContain('Some Player');
  });
});

describe('news feed', () => {
  it('generates feat headlines for standout single-game performances without crashing', async () => {
    const { generateNewsFeed } = await import('../simulation/news');
    const { league } = generateFullLeague(31, 8, 10, 20);
    let l = league;
    for (let i = 0; i < 40; i++) {
      if (!l.schedule.some((g) => !g.played)) break;
      l = simulateNextGame(l, i + 1);
    }
    const extras: any = { freeAgents: [] };
    const items = generateNewsFeed(l, extras);
    expect(Array.isArray(items)).toBe(true);
    for (const item of items) {
      expect(typeof item.headline).toBe('string');
      expect(item.headline.length).toBeGreaterThan(0);
    }
  });
});
