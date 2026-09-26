import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { generateFullLeague } from '../../src/simulation/leagueGenerator';
import { calculateOverall } from '../../src/simulation/engine/overall';

/* Measures Court Vision's own Overall distribution: the players of freshly generated 30-team leagues (18-man rosters,
 * exactly what "Random League" creates), ranked best to worst and averaged rank by rank over 20 leagues.
 * The NBA history builder maps each real season's Nth-best player (by our production score) to the Nth value here,
 * so a historical league has the same talent spread the game engine is tuned for. No outside ratings are involved. */
it('measures the generated-league Overall distribution', () => {
  const LEAGUES = 20;
  const byRank: number[][] = [];
  for (let seed = 1; seed <= LEAGUES; seed++) {
    const { league } = generateFullLeague(seed, 30, 18, 82, '2026', { priorSeasons: false });
    const overalls = league.teams.flatMap(t => t.seasons).map(p => calculateOverall(p)).sort((a, b) => b - a);
    overalls.forEach((v, i) => (byRank[i] ??= []).push(v));
  }
  const ranks = byRank.map(vals => Math.round(vals.reduce((n, v) => n + v, 0) / vals.length * 10) / 10);
  writeFileSync('scripts/nba-history/sources/cv_overall_distribution.json', JSON.stringify({
    description: 'Court Vision Overall by rank (best first) in generated 30-team, 18-man-roster leagues, averaged over 20 seeds.',
    generator: 'generateFullLeague(seed 1..20, 30 teams, 18 players, 82 games, priorSeasons: false)',
    teams: 30, ranks,
  }, null, 1));
});
