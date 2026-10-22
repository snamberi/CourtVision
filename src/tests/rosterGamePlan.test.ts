import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds, type League, type LeagueTeam } from '../simulation/league';
import { calculateOverall } from '../simulation/engine/overall';
import { setScoringOption, withScoringOptions } from '../simulation/scoringOptions';
import { redistributeMinutesForInjuries } from '../simulation/injuryReport';
import type { PlayerSeason } from '../simulation/types';

const base = generateFullLeague(8, 8, 13, 20).league as League;
const team = base.teams[0];
const ranked = [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a));
const exact = (s: PlayerSeason, target: number): PlayerSeason => ({ ...s, minutes: { ...s.minutes, mode: 'EXACT', target } });
const withTeam = (seasons: PlayerSeason[]): League => ({ ...base, teams: base.teams.map(t => t.teamId === team.teamId ? { ...t, seasons } : t) });
const after = (l: League, rounds = 12): LeagueTeam => simulateRounds(l, rounds, 5).teams.find(t => t.teamId === team.teamId)!;

describe('scoring options', () => {
  it('one player per option, one option per player', () => {
    let o = setScoringOption(undefined, ranked[0].playerId, 1);
    o = setScoringOption(o, ranked[1].playerId, 1);
    expect(o).toEqual({ 1: ranked[1].playerId });
    o = setScoringOption(o, ranked[1].playerId, 2);
    expect(o).toEqual({ 2: ranked[1].playerId });
    expect(setScoringOption(o, ranked[1].playerId, null)).toEqual({});
  });

  it('a team without options, or whose options left the roster, plays exactly as before', () => {
    expect(withScoringOptions(team.seasons, undefined)).toBe(team.seasons);
    expect(withScoringOptions(team.seasons, { 1: 'Someone Who Was Traded' })).toBe(team.seasons);
  });

  it('the 1st option takes the most shots and the 2nd the next most, even as role players', () => {
    const scoringOptions = { 1: ranked[5].playerId, 2: ranked[8].playerId };
    const seasons = team.seasons.map(s => s.playerId === ranked[5].playerId || s.playerId === ranked[8].playerId ? exact(s, 34) : s);
    const league: League = { ...base, teams: base.teams.map(t => t.teamId === team.teamId ? { ...t, seasons, scoringOptions } : t) };
    const byShots = [...after(league).seasons].sort((a, b) => (b.seasonStats?.fga ?? 0) - (a.seasonStats?.fga ?? 0));
    expect(byShots[0].playerId).toBe(ranked[5].playerId);
    expect(byShots[1].playerId).toBe(ranked[8].playerId);
  });
});

describe('playtime', () => {
  it('a set playtime is played every game, from 0 to a full 48', () => {
    const plan: Record<string, number> = { [ranked[0].playerId]: 48, [ranked[1].playerId]: 20, [ranked[9].playerId]: 8, [ranked[2].playerId]: 0 };
    const played = simulateRounds(withTeam(team.seasons.map(s => plan[s.playerId] != null ? exact(s, plan[s.playerId]) : s)), 8, 5);
    for (const g of played.schedule.filter(x => x.result && (x.homeTeamId === team.teamId || x.awayTeamId === team.teamId))) {
      const box = g.homeTeamId === team.teamId ? g.result!.homeBox : g.result!.awayBox;
      for (const [id, want] of Object.entries(plan)) expect(Math.abs((box.players[id]?.minutes ?? 0) - want)).toBeLessThanOrEqual(1);
    }
  });

  it('injury cover leaves set playtimes alone and gives the minutes to the others', () => {
    const fixed = ranked[1].playerId, hurt = ranked[0].playerId;
    // Light targets, so losing a starter leaves minutes to hand out.
    const t: LeagueTeam = { ...team, seasons: team.seasons.map(s => s.playerId === fixed ? exact(s, 22) : { ...s, minutes: { ...s.minutes, mode: 'AI' as const, target: 12 } }) };
    const covered = redistributeMinutesForInjuries(t, { [hurt]: { gamesRemaining: 5 } as never });
    expect(covered.seasons.find(s => s.playerId === fixed)!.minutes.target).toBe(22);
    expect(covered.seasons.some(s => s.playerId !== fixed && s.playerId !== hurt && s.minutes.target !== t.seasons.find(o => o.playerId === s.playerId)!.minutes.target)).toBe(true);
  });
});
