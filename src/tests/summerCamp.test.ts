import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
import { setSummerPlan, trainerSlots, applySummerCamp, campLabel } from '../simulation/summerCamp';
import { calculateOverall } from '../simulation/engine/overall';
import type { League } from '../simulation/league';

function setup() {
  const g = generateFullLeague(515, 6, 13, 10, '2026', { priorSeasons: false });
  const team = g.league.teams[0];
  const league: League = { ...g.league, coachingUserTeamId: team.teamId, teams: g.league.teams.map(t => t.teamId === team.teamId ? { ...t, expenseLevels: { ...t.expenseLevels!, coaching: 100 } } : t) };
  return { league, extras: g.extras, team: league.teams[0] };
}

describe('Summer camp', () => {
  it('trainers are limited by the coaching budget', () => {
    const { league, team } = setup();
    expect(trainerSlots(team)).toEqual({ skills: 6, elite: 3 });
    const low = { ...team, expenseLevels: { ...team.expenseLevels!, coaching: 0 } };
    expect(trainerSlots(low)).toEqual({ skills: 2, elite: 0 });
    let l = league;
    for (const p of team.seasons.slice(0, 3)) l = setSummerPlan(l, team.teamId, p.playerId, { focus: 'shooting', trainer: 'elite' }).league;
    const r = setSummerPlan(l, team.teamId, team.seasons[3].playerId, { focus: 'shooting', trainer: 'elite' });
    expect(r.error).toMatch(/booked/);
    expect(setSummerPlan(l, team.teamId, 'Nobody', { focus: 'rest', trainer: 'none' }).error).toBeTruthy();
  });

  it('runs at the new season on top of normal development and files a report', () => {
    const { league, extras, team } = setup();
    const young = [...team.seasons].sort((a, b) => a.age - b.age)[0];
    const planned = setSummerPlan(league, team.teamId, young.playerId, { focus: 'shooting', trainer: 'elite' }).league;
    const without = beginNewSeasonRoster(league, extras, 11).league;
    const withCamp = beginNewSeasonRoster(planned, extras, 11).league;
    const find = (l: League) => l.teams.flatMap(t => t.seasons).find(p => p.playerId === young.playerId)!;
    expect(find(withCamp).attributes.offense.threePoint).toBeGreaterThan(find(without).attributes.offense.threePoint);
    // Everyone else developed exactly the same.
    const other = team.seasons.find(p => p.playerId !== young.playerId && without.teams[0].seasons.some(x => x.playerId === p.playerId))!;
    expect(withCamp.teams[0].seasons.find(p => p.playerId === other.playerId)?.attributes).toEqual(without.teams[0].seasons.find(p => p.playerId === other.playerId)?.attributes);
    // The report: every player still on the team, with the camp noted.
    const report = withCamp.campReport!;
    expect(report.season).toBe(withCamp.season);
    const row = report.rows.find(r => r.playerId === young.playerId)!;
    expect(row.plan?.trainer).toBe('elite');
    expect(row.note).toMatch(/Shooting camp/);
    expect(row.after).toBe(calculateOverall(find(withCamp)));
    expect(withCamp.summerCamp).toBeUndefined();
    // AI teams are untouched by your camp.
    expect(withCamp.teams[1].seasons.map(p => p.attributes)).toEqual(without.teams[1].seasons.map(p => p.attributes));
  });

  it('young workers gain more than old ones; rest changes nothing', () => {
    const { team } = setup();
    const p = team.seasons[0];
    const gain = (age: number) => { const r = applySummerCamp({ ...p, age, development: { ...p.development, workEthic: 80 } }, { focus: 'playmaking', trainer: 'skills' }, 'k').player;
      return r.attributes.offense.ballHandling + r.attributes.offense.passing + r.attributes.offense.decisionMaking - p.attributes.offense.ballHandling - p.attributes.offense.passing - p.attributes.offense.decisionMaking; };
    expect(gain(20)).toBeGreaterThan(gain(33));
    expect(applySummerCamp(p, { focus: 'rest', trainer: 'none' }, 'k').player.attributes).toEqual(p.attributes);
    expect(campLabel(5)).toBe('Breakout');
    expect(campLabel(-5)).toBe('Regression');
    expect(campLabel(0)).toBe('Steady');
  });
});
