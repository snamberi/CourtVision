import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateFullRound } from '../simulation/league';
import { storylines } from '../simulation/storylines';
import { emptySeasonMilestones, emptySeasonStatTotals, type CareerSeasonRecord } from '../simulation/types';
import type { League } from '../simulation/league';

function base(): League {
  const g = generateFullLeague(733, 6, 12, 30, '2026', { priorSeasons: false });
  let l = { ...g.league, settings: { ...g.league.settings, injuriesEnabled: false } };
  for (let i = 0; i < 6; i++) l = simulateFullRound(l, 733 + i);
  return l;
}
const past = (season: string, teamId: string, points: number): CareerSeasonRecord => ({ season, teamId, age: 30, overall: 70, stats: { ...emptySeasonStatTotals(), gamesPlayed: 70, points }, milestones: emptySeasonMilestones() });

describe('Storylines', () => {
  it('flags a player closing in on a career milestone', () => {
    const l = base();
    const t = l.teams[0], p = [...t.seasons].sort((a, b) => (b.seasonStats?.points ?? 0) - (a.seasonStats?.points ?? 0))[0];
    const games = p.seasonStats!.gamesPlayed;
    const needed = 20000 - p.seasonStats!.points - Math.round(p.seasonStats!.points / Math.max(1, games) * 3);
    const league = { ...l, teams: l.teams.map(x => x.teamId !== t.teamId ? x : { ...x, seasons: x.seasons.map(s => s.playerId === p.playerId ? { ...s, careerHistory: [past('2025', t.teamId, needed)] } : s) }) };
    const s = storylines(league, undefined, null).find(x => x.id.startsWith(`chase:points:${p.playerId}:20000`));
    expect(s?.headline).toMatch(/from 20,000$/);
  });

  it('flags a revenge game when a player faces a team he just left', () => {
    const l = base();
    const next = l.schedule.find(g => !g.played)!;
    const home = l.teams.find(t => t.teamId === next.homeTeamId)!;
    const p = home.seasons[0];
    // Three seasons there: a story even for a role player.
    const league = { ...l, teams: l.teams.map(x => x.teamId !== home.teamId ? x : { ...x, seasons: x.seasons.map(s => s.playerId === p.playerId ? { ...s, careerHistory: ['2023', '2024', '2025'].map(y => past(y, next.awayTeamId, 1500)) } : s) }) };
    const s = storylines(league, undefined, home.teamId).find(x => x.kind === 'revenge' && x.playerId === p.playerId);
    expect(s?.headline).toContain('his old team');
    expect(s?.teamIds).toEqual([home.teamId, next.awayTeamId]);
  });

  it('is quiet in the offseason and floats your team up', () => {
    const l = base();
    expect(storylines({ ...l, seasonPhase: 'draft' })).toEqual([]);
    const all = storylines(l, undefined, l.teams[2].teamId);
    const firstMine = all.findIndex(s => s.teamIds.includes(l.teams[2].teamId));
    const plain = storylines(l, undefined, null).findIndex(s => s.teamIds.includes(l.teams[2].teamId));
    if (firstMine >= 0) expect(firstMine).toBeLessThanOrEqual(plain);
  });
});
