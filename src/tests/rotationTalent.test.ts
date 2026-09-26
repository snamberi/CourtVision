import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds } from '../simulation/league';
import { calculateOverall } from '../simulation/engine/overall';
import { ensureTalentInRotation } from '../simulation/rotationReview';

describe('talent check in the rotation', () => {
  it('a newly arrived star buried at the end of the bench gets real minutes within a few games', () => {
    const { league } = generateFullLeague(14, 6, 14, 20);
    const team = league.teams[0];
    const star = [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
    // Simulate what a signing/trade leaves behind: an old tiny minutes target and last place on the depth chart.
    const buried = { ...team, seasons: team.seasons.map(s => s.playerId === star.playerId ? { ...s, minutes: { ...s.minutes, mode: 'AI' as const, target: 2 } } : s),
      rotationOrder: [...team.seasons.map(s => s.playerId).filter(id => id !== star.playerId), star.playerId] };
    const fixed = ensureTalentInRotation(buried);
    expect(fixed.rotationOrder!.indexOf(star.playerId)).toBeLessThan(5);
    expect(fixed.seasons.find(s => s.playerId === star.playerId)!.minutes.target).toBeGreaterThanOrEqual(25);
    const played = simulateRounds({ ...league, teams: league.teams.map(t => t.teamId === team.teamId ? buried : t) }, 6, 2);
    const line = played.teams[0].seasons.find(s => s.playerId === star.playerId)!.seasonStats!;
    expect(line.minutes / line.gamesPlayed).toBeGreaterThan(20);
  });
  it('leaves manual rotations alone', () => {
    const { league } = generateFullLeague(15, 4, 12, 10);
    const team = { ...league.teams[0], coach: { ...league.teams[0].coach!, autoRotation: false } };
    expect(ensureTalentInRotation(team)).toBe(team);
  });
});
