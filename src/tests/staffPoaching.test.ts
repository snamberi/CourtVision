import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { initializeCoaching, staffBudget } from '../simulation/staffManagement';
import { poachAssistants, answerPoach, pendingOffers, settleStaffOffers, headReadiness } from '../simulation/staffPoaching';
import type { League } from '../simulation/league';

/** A league where team 1 has no head coach and team 0 (yours) / team 2 each have a standout offensive assistant. */
function setup(): { league: League; user: string; hunter: string; ai: string } {
  const g = generateFullLeague(904, 6, 12, 10, '2026', { priorSeasons: false });
  let league = initializeCoaching(g.league, g.league.teams[0].teamId);
  const [user, hunter, ai] = league.teams.map(t => t.teamId);
  const star = (id: string) => { const t = league.teams.find(x => x.teamId === id)!; return { ...t.staff!.offense!, rating: 90 }; };
  league = { ...league, teams: league.teams.map(t => {
    if (t.teamId === hunter) return { ...t, coachIdentity: undefined };
    if (t.teamId === user || t.teamId === ai) return { ...t, staff: { ...t.staff, offense: star(t.teamId) } };
    return { ...t, staff: { ...t.staff, offense: t.staff!.offense ? { ...t.staff!.offense, rating: 40 } : undefined, defense: t.staff!.defense ? { ...t.staff!.defense, rating: 40 } : undefined, development: t.staff!.development ? { ...t.staff!.development, rating: 40 } : undefined } };
  }) };
  return { league, user, hunter, ai };
}

describe('Assistant poaching', () => {
  it('a team without a head coach hires the best AI assistant away', () => {
    const { league, user, hunter, ai } = setup();
    // Make the AI team's assistant the clear best.
    const tuned = { ...league, teams: league.teams.map(t => t.teamId === ai ? { ...t, staff: { ...t.staff, offense: { ...t.staff!.offense!, rating: 99 } } } : t) };
    const target = tuned.teams.find(t => t.teamId === ai)!.staff!.offense!;
    expect(headReadiness(target)).toBeGreaterThan(headReadiness(tuned.teams.find(t => t.teamId === user)!.staff!.offense!));
    const r = poachAssistants(tuned, user, '2026');
    expect(r.league.teams.find(t => t.teamId === hunter)!.coachIdentity?.coachId).toBe(target.coachId);
    expect(r.league.teams.find(t => t.teamId === ai)!.staff?.offense).toBeUndefined();
    expect(r.moves[0].detail).toMatch(/Hired away from/);
    expect(pendingOffers(r.league, user)).toHaveLength(0);
  });

  it('your assistant: a call you can answer with a raise, or let him go', () => {
    const { league, user, hunter } = setup();
    const tuned = { ...league, teams: league.teams.map(t => t.teamId === user ? { ...t, staff: { ...t.staff, offense: { ...t.staff!.offense!, rating: 99 } }, expenseLevels: { ...t.expenseLevels!, coaching: 100 } } : t) };
    const mine = tuned.teams.find(t => t.teamId === user)!.staff!.offense!;
    const r = poachAssistants(tuned, user, '2026');
    expect(r.league.teams.find(t => t.teamId === user)!.staff!.offense!.coachId).toBe(mine.coachId); // not taken without asking
    const [offer] = pendingOffers(r.league, user);
    expect(offer).toMatchObject({ coachId: mine.coachId, toTeamId: hunter, status: 'pending' });

    const team = r.league.teams.find(t => t.teamId === user)!;
    expect(staffBudget(team)).toBeGreaterThan(0);
    const kept = answerPoach(r.league, mine.coachId, true);
    expect(kept.league.teams.find(t => t.teamId === user)!.staff!.offense!.contract.annualSalary).toBeGreaterThan(mine.contract.annualSalary);
    expect(pendingOffers(kept.league, user)).toHaveLength(0);

    const gone = answerPoach(r.league, mine.coachId, false);
    expect(gone.league.teams.find(t => t.teamId === user)!.staff?.offense).toBeUndefined();
    expect(gone.league.teams.find(t => t.teamId === hunter)!.coachIdentity?.coachId).toBe(mine.coachId);

    // Unanswered calls: he takes the job when the season starts.
    const settled = settleStaffOffers(r.league);
    expect(settled.teams.find(t => t.teamId === hunter)!.coachIdentity?.coachId).toBe(mine.coachId);
  });
});
