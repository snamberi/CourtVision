import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { runStarChaseAI, keepScore } from '../simulation/aiGM';
import { waiveToFreeAgency } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';

describe('AI free-agent star chase', () => {
  it('a star released into free agency gets signed, with a full roster cutting its weakest player', () => {
    const { league: base, extras: baseExtras } = generateFullLeague(33, 10, 15, 20, '2026', { priorSeasons: false });
    const all = base.teams.flatMap(t => t.seasons.map(p => ({ p, teamId: t.teamId })));
    const star = all.sort((a, b) => calculateOverall(b.p) - calculateOverall(a.p))[0];
    const released = waiveToFreeAgency(base, baseExtras, star.p.playerId, star.teamId);
    expect(released.extras.freeAgents.some(f => f.playerId === star.p.playerId)).toBe(true);
    const league = { ...released.league, rosterLimits: { minRosterSize: 8, maxRosterSize: 15 } };
    const extras = { ...released.extras, freeAgencyOpen: true, capSettings: { ...released.extras.capSettings, enforceCapOnTrades: false } };
    const result = runStarChaseAI(league, extras, null, 5, 3);
    const signing = result.signings.find(s => s.playerId === star.p.playerId);
    expect(signing).toBeDefined();
    const team = result.league.teams.find(t => t.teamId === signing!.teamId)!;
    expect(team.seasons.length).toBeLessThanOrEqual(15);
  });

  it('underperforming his rating lowers how much a team wants to keep a player', () => {
    const { league } = generateFullLeague(34, 4, 13, 10, '2026', { priorSeasons: false });
    const p = league.teams[0].seasons[0];
    const stats = { ...p.seasonStats!, gamesPlayed: 30, minutes: 600 };
    const productive = keepScore({ ...p, seasonStats: { ...stats, points: 400, oreb: 60, dreb: 140, ast: 90, stl: 25, blk: 20, tov: 30 } });
    const quiet = keepScore({ ...p, seasonStats: { ...stats, points: 90, oreb: 10, dreb: 30, ast: 15, stl: 5, blk: 2, tov: 40 } });
    expect(quiet).toBeLessThan(productive);
  });
});
