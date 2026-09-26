import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { teamLeader, effectiveRotation, setRotationRole } from '../simulation/teamStatus';
import { calculateOverall } from '../simulation/engine/overall';

describe('teamLeader', () => {
  it('returns the player with the highest current overall', () => {
    const { league } = generateFullLeague(1, 4, 8, 10, '2026-27');
    const team = league.teams[0];
    const leader = teamLeader(team);
    expect(leader).not.toBeNull();
    const maxOverall = Math.max(...team.seasons.map((s) => calculateOverall(s)));
    expect(calculateOverall(leader!)).toBe(maxOverall);
  });

  it('returns null for an empty roster', () => {
    const { league } = generateFullLeague(2, 4, 8, 10, '2026-27');
    const emptyTeam = { ...league.teams[0], seasons: [] };
    expect(teamLeader(emptyTeam)).toBeNull();
  });
});

describe('effectiveRotation', () => {
  it('auto-assigns exactly 5 starters (or fewer if the roster is smaller) when nothing is manually set', () => {
    const { league } = generateFullLeague(3, 4, 10, 12, '2026-27');
    const team = league.teams[0];
    const rotation = effectiveRotation(team);
    const starterCount = Object.values(rotation).filter((r) => r === 'starter').length;
    expect(starterCount).toBe(Math.min(5, team.seasons.length));
  });

  it('the auto-assigned starters are exactly the top-5-by-minutes-target players', () => {
    const { league } = generateFullLeague(4, 4, 10, 12, '2026-27');
    const team = league.teams[0];
    const rotation = effectiveRotation(team);
    const sortedByMinutes = [...team.seasons].sort((a, b) => b.minutes.target - a.minutes.target);
    const expectedStarterIds = new Set(sortedByMinutes.slice(0, 5).map((s) => s.playerId));
    for (const s of team.seasons) {
      expect(rotation[s.playerId]).toBe(expectedStarterIds.has(s.playerId) ? 'starter' : 'bench');
    }
  });

  it('a manual bench override keeps that player benched even with a high minutes target', () => {
    const { league } = generateFullLeague(5, 4, 10, 12, '2026-27');
    const team = league.teams[0];
    const topMinutesPlayer = [...team.seasons].sort((a, b) => b.minutes.target - a.minutes.target)[0];
    const benched = { ...team, seasons: team.seasons.map((s) => (s.playerId === topMinutesPlayer.playerId ? { ...s, rotationRole: 'bench' as const } : s)) };
    const rotation = effectiveRotation(benched);
    expect(rotation[topMinutesPlayer.playerId]).toBe('bench');
  });
});

describe('setRotationRole', () => {
  it('promoting a 6th player to starter demotes the lowest-minutes existing starter, keeping exactly 5 starters', () => {
    const { league } = generateFullLeague(6, 4, 10, 12, '2026-27');
    const team = league.teams[0];
    const rotationBefore = effectiveRotation(team);
    const benchPlayer = team.seasons.find((s) => rotationBefore[s.playerId] === 'bench');
    expect(benchPlayer).toBeDefined();

    const updated = setRotationRole(team, benchPlayer!.playerId, 'starter');
    const rotationAfter = effectiveRotation(updated);
    const starterCount = Object.values(rotationAfter).filter((r) => r === 'starter').length;
    expect(starterCount).toBe(5);
    expect(rotationAfter[benchPlayer!.playerId]).toBe('starter');
  });
});
