import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateFullRound, type League } from '../simulation/league';
import { manageCoachRosters, normalizeRosterRules } from '../simulation/coachRosters';
import { waiveToFreeAgency, signFreeAgent, validateTrade, type GMLeagueExtras } from '../simulation/gm';

/** A regular-season league where the user's team (T0) is short and an AI team (T1) is overstuffed. */
function setup() {
  const g = generateFullLeague(9, 6, 13, 20, '2026', { priorSeasons: false });
  const n = normalizeRosterRules(g.league, g.extras);
  const [me, ai, donor] = n.league.teams;
  const extra = donor.seasons.slice(0, 8).map(p => ({ ...p, playerId: `${p.playerId} (copy)`, teamId: ai.teamId }));
  const league: League = { ...n.league, seasonPhase: 'regular_season', teams: n.league.teams.map(t => t.teamId === me.teamId ? { ...t, seasons: t.seasons.slice(0, 7) } : t.teamId === ai.teamId ? { ...t, seasons: [...t.seasons, ...extra] } : t) };
  const contracts = { ...n.extras.contracts, ...Object.fromEntries(extra.map(p => [p.playerId, { ...n.extras.contracts[p.playerId.replace(' (copy)', '')], playerId: p.playerId, teamId: ai.teamId }])) };
  return { league, extras: { ...n.extras, contracts } as GMLeagueExtras, me: me.teamId, ai: ai.teamId };
}

describe('flexible rosters', () => {
  it('AI coaches fix their own rosters; yours is left as it is', () => {
    const { league, extras, me, ai } = setup();
    const r = manageCoachRosters(league, extras, [me]);
    const size = (id: string) => r.league.teams.find(t => t.teamId === id)!.seasons.length;
    expect(size(me)).toBe(7);
    expect(size(ai)).toBe(extras.capSettings.maxRosterSize);
    expect(r.moves.every(m => m.teamId !== me)).toBe(true);
  });
  it('games play with a short or oversized roster', () => {
    const { league } = setup();
    let l = league;
    for (let d = 0; d < 3; d++) l = simulateFullRound(l, d);
    expect(l.schedule.filter(g => g.played).length).toBeGreaterThan(0);
  });
  it('you can waive below the minimum, sign past the maximum, and trade either way', () => {
    const { league, extras, me } = setup();
    const short = league.teams.find(t => t.teamId === me)!;
    const w = waiveToFreeAgency(league, extras, short.seasons[0].playerId, me, me);
    expect(w.league.teams.find(t => t.teamId === me)!.seasons).toHaveLength(6);
    const fa = w.extras.freeAgents[0];
    const big = { ...w.league, teams: w.league.teams.map(t => t.teamId === me ? { ...t, seasons: [...t.seasons, ...league.teams[3].seasons.slice(0, 13).map(p => ({ ...p, playerId: `${p.playerId} (big)` }))] } : t) };
    const s = signFreeAgent(big, { ...w.extras, freeAgencyOpen: true }, fa.playerId, me, { annualSalary: extras.capSettings.minSalary, yearsRemaining: 1, playerOption: false, teamOption: false });
    expect(s.league.teams.find(t => t.teamId === me)!.seasons.length).toBe(20);
    const reasons = validateTrade(league, extras, { teamAId: me, teamBId: league.teams[4].teamId, playersFromA: [short.seasons[1].playerId, short.seasons[2].playerId], playersFromB: [] }).reasons;
    expect(reasons.some(r => /minimum|maximum/.test(r))).toBe(false);
  });
});
