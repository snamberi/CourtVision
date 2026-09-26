import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds } from '../simulation/league';
import { computeSeasonAwards } from '../simulation/awards';
import { panelVote } from '../simulation/awardVoting';

describe('award vote totals', () => {
  it('a saved ballot always adds up to every point the panel cast, even with many vote-getters', () => {
    for (const seed of [3, 11, 29]) {
      const { league } = generateFullLeague(seed, 20, 13, 30, '2026', { priorSeasons: false });
      const played = simulateRounds(league, 12, seed);
      const votes = computeSeasonAwards(played, { minGames: 1 }).votes!;
      for (const [key, vote] of Object.entries(votes)) {
        if (!vote || vote.teams || !vote.lines.length) continue; // selection teams (All-NBA...) are scored per slot; empty races have no ballot
        const total = vote.voters * vote.pointsByPlace.reduce((a, b) => a + b, 0);
        const counted = vote.lines.reduce((n, l) => n + l.points, 0);
        const firsts = vote.lines.reduce((n, l) => n + l.firstVotes, 0);
        expect(counted, `${seed} ${key}`).toBe(total);
        expect(firsts, `${seed} ${key}`).toBe(vote.voters);
      }
    }
  }, 60000);

  it('a wide-open race with 15 contenders keeps every vote-getter', () => {
    const cands = Array.from({ length: 15 }, (_, i) => ({ id: `P${i}`, teamId: `T${i}`, teamName: `T${i}`, score: 10 + (i % 3) * 0.01 }));
    const v = panelVote('open', cands, { voters: 100, points: [10, 7, 5, 3, 1], noise: 3 });
    expect(v.lines.length).toBeGreaterThan(12);
    expect(v.lines.reduce((n, l) => n + l.points, 0)).toBe(2600);
  });
});
