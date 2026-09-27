import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { generateDraftClass } from '../simulation/gm';
import { assignScout, scoutDept, looksOn, scoutCount, prospectRegion, specialtyNotes, scoutingDay } from '../simulation/scoutDept';
import { perceivedPotential, scoutingReport } from '../simulation/scouting';
import type { League } from '../simulation/league';

function setup() {
  const g = generateFullLeague(812, 8, 12, 30, '2026', { priorSeasons: false });
  const extras = { ...g.extras, draftClass: generateDraftClass(40, 99, '2027') };
  return { league: g.league, extras, team: g.league.teams[0].teamId };
}
/** Marks the first `rounds` days of the schedule as played (enough for the scouting clock). */
const playDays = (league: League, days: number): League => {
  const perDay = Math.floor(league.teams.length / 2);
  let n = days * perDay;
  return { ...league, schedule: league.schedule.map(g => (n-- > 0 ? { ...g, played: true } : g)) };
};

describe('Scouting department', () => {
  it('staff size follows the scouting budget', () => {
    const { league, team } = setup();
    const at = (v: number) => ({ ...league, teams: league.teams.map(t => t.teamId === team ? { ...t, expenseLevels: { ...t.expenseLevels!, scouting: v } } : t) });
    expect(scoutCount(at(0), team)).toBe(2);
    expect(scoutCount(at(100), team)).toBe(6);
  });

  it('looks pile up while a scout watches a prospect, and they narrow the read', () => {
    const { league, extras, team } = setup();
    const dept = scoutDept(league, extras, team);
    // The prospect whose read is furthest off: scouting him should move the read toward the truth.
    const worst = [...extras.draftClass].sort((a, b) => Math.abs(perceivedPotential(b, league, extras, team) - b.trueSeason.development.potential) - Math.abs(perceivedPotential(a, league, extras, team) - a.trueSeason.development.potential))[0];
    const before = Math.abs(perceivedPotential(worst, league, extras, team) - worst.trueSeason.development.potential);
    const home = dept.scouts.find(s => s.region === prospectRegion(worst)) ?? dept.scouts[0];
    let ex = assignScout(league, extras, team, home.id, worst.playerId);
    expect(looksOn(league, ex, team, worst.playerId)).toBe(0);
    const later = playDays(league, 30);
    expect(scoutingDay(later)).toBe(30);
    const looks = looksOn(later, ex, team, worst.playerId);
    expect(looks).toBeGreaterThan(3);
    const after = Math.abs(perceivedPotential(worst, later, ex, team) - worst.trueSeason.development.potential);
    expect(after).toBeLessThan(before);
    expect(scoutingReport(worst, later, ex, team).looks).toBeCloseTo(looks);
    // Bringing him home banks the looks.
    ex = assignScout(later, ex, team, home.id, null);
    expect(looksOn(playDays(league, 60), ex, team, worst.playerId)).toBeCloseTo(looks);
    // Other teams' reads are untouched by your scouts.
    const other = league.teams[1].teamId;
    expect(perceivedPotential(worst, later, ex, other)).toBe(perceivedPotential(worst, league, extras, other));
  });

  it('a scout with an eye for character reports it after a couple of looks', () => {
    const { league, extras, team } = setup();
    const dept = scoutDept(league, extras, team);
    const reader = dept.scouts.find(s => s.eye === 'character');
    if (!reader) return; // this staff has no character scout
    const p = extras.draftClass[0];
    const ex = assignScout(league, extras, team, reader.id, p.playerId);
    expect(specialtyNotes(league, ex, team, p)).toHaveLength(0);
    expect(specialtyNotes(playDays(league, 40), ex, team, p).some(n => n.startsWith('Character'))).toBe(true);
  });

  it('a new class starts a fresh board', () => {
    const { league, extras, team } = setup();
    const dept = scoutDept(league, extras, team);
    const ex = assignScout(league, extras, team, dept.scouts[0].id, extras.draftClass[0].playerId);
    const next = { ...ex, draftClass: generateDraftClass(40, 7, '2028') };
    expect(scoutDept(league, next, team).assignments).toEqual({});
  });
});
