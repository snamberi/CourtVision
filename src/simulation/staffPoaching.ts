import type { League, LeagueTeam } from './league';
import type { CoachIdentity } from './coaching';
import { enrichCoach, staffBudget, staffSalary } from './staffManagement';
import { STAFF_LABELS, type StaffRole } from './coachingModel';

/*
 * Other teams poach good assistants. In the offseason, a team that needs a head coach goes after the best
 * head-ready assistant in the league (a development coach whose players grew, a strategist with a big rating)
 * before it looks at the open market. From an AI team he simply leaves; from yours, you get the call: give him a
 * raise to stay (it has to fit your staff budget) or let him take the job. Ignore it and he takes the job when the
 * season starts.
 */

export type AssistantRole = Exclude<StaffRole, 'head'>;
export interface PoachOffer { season: string; coachId: string; fromTeamId: string; toTeamId: string; role: AssistantRole; salary: number; status: 'pending' | 'kept' | 'left' }

const ASSISTANTS: AssistantRole[] = ['offense', 'defense', 'development', 'trainer'];
const HEAD_READY = 64;

/** How ready an assistant is to run his own bench. */
export function headReadiness(c: CoachIdentity): number {
  const p = enrichCoach(c, 'offense').profile!;
  return c.rating + (p.preferredRole === 'head' ? 8 : 0) + Math.min(6, p.experience) + (c.championships ? 4 : 0);
}

/** The head-coach salary a team offers an assistant it wants. */
export const poachSalary = (c: CoachIdentity) => Math.round(c.contract.annualSalary * 3);

function assistantsOf(t: LeagueTeam) {
  return ASSISTANTS.flatMap(role => (role !== 'trainer' && t.staff?.[role] ? [{ role, coach: t.staff[role]! }] : []));
}

function install(league: League, toTeamId: string, coach: CoachIdentity, salary: number, season: string, fromTeamId: string, role: AssistantRole): League {
  const displaced = league.teams.find(t => t.teamId === toTeamId)?.coachIdentity;
  const base = enrichCoach(coach, 'head');
  const head: CoachIdentity = { ...base, hiredSeason: season, contract: { annualSalary: salary, yearsRemaining: 3 },
    profile: { ...base.profile!, history: [...base.profile!.history.map(h => (h.to ? h : { ...h, to: season })), { teamId: toTeamId, role: 'head' as const, from: season }] } };
  const teams = league.teams.map(t => {
    if (t.teamId === fromTeamId) { const staff = { ...t.staff }; delete staff[role]; return { ...t, staff }; }
    if (t.teamId === toTeamId) return { ...t, coachIdentity: head };
    return t;
  });
  return { ...league, teams, staffMarket: [...(league.staffMarket ?? []).filter(c => c.coachId !== coach.coachId), ...(displaced ? [displaced] : [])] };
}

/**
 * Offseason poaching, before vacancies are filled from the market: each AI team without a head coach takes the
 * most head-ready assistant from another AI team, and teams also call about your best assistants.
 * Returns the league and the carousel lines for the moves made.
 */
export function poachAssistants(league: League, userTeamId: string | null, season: string): { league: League; moves: { teamId: string; coachId: string; detail: string }[] } {
  let next = league;
  const moves: { teamId: string; coachId: string; detail: string }[] = [];
  const keepFrom = Number(season) - 2;
  const offers: PoachOffer[] = [...(league.staffOffers ?? []).filter(o => Number(o.season) >= keepFrom)];
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const taken = new Set<string>();
  for (const team of league.teams) {
    if (team.teamId === userTeamId || next.teams.find(t => t.teamId === team.teamId)?.coachIdentity) continue;
    const pool = next.teams.filter(t => t.teamId !== team.teamId).flatMap(t => assistantsOf(t).map(a => ({ ...a, teamId: t.teamId })))
      .filter(a => !taken.has(a.coach.coachId) && headReadiness(a.coach) >= HEAD_READY)
      .sort((a, b) => headReadiness(b.coach) - headReadiness(a.coach));
    const best = pool[0];
    if (!best) continue;
    taken.add(best.coach.coachId);
    if (best.teamId === userTeamId) {
      if (!offers.some(o => o.coachId === best.coach.coachId && o.season === season))
        offers.push({ season, coachId: best.coach.coachId, fromTeamId: best.teamId, toTeamId: team.teamId, role: best.role, salary: poachSalary(best.coach), status: 'pending' });
      continue; // they fill the job from the market for now; if he comes, he replaces that hire
    }
    next = install(next, team.teamId, best.coach, poachSalary(best.coach), season, best.teamId, best.role);
    moves.push({ teamId: team.teamId, coachId: best.coach.coachId, detail: `Hired away from ${name(best.teamId)}, where he was the ${STAFF_LABELS[best.role].toLowerCase()}.` });
  }
  return { league: offers.length ? { ...next, staffOffers: offers } : next, moves };
}

export const pendingOffers = (league: League, teamId: string | null) => (league.staffOffers ?? []).filter(o => o.status === 'pending' && o.fromTeamId === teamId);

/** Your answer to a poaching call: keep him with a raise (must fit the staff budget), or let him go. */
export function answerPoach(league: League, coachId: string, keep: boolean): { league: League; message: string } {
  const offer = (league.staffOffers ?? []).find(o => o.coachId === coachId && o.status === 'pending');
  if (!offer) return { league, message: 'That offer is no longer on the table.' };
  const team = league.teams.find(t => t.teamId === offer.fromTeamId);
  const coach = team?.staff?.[offer.role];
  const mark = (l: League, status: PoachOffer['status']) => ({ ...l, staffOffers: (l.staffOffers ?? []).map(o => (o === offer ? { ...o, status } : o)) });
  if (!team || !coach || coach.coachId !== coachId) return { league: mark(league, 'left'), message: 'He is no longer on your staff.' };
  if (keep) {
    const raise = Math.round(coach.contract.annualSalary * 0.35);
    if (staffSalary(team) + raise > staffBudget(team)) return { league, message: `A raise of $${(raise / 1e6).toFixed(2)}M doesn't fit your staff budget. Raise the coaching budget, or let him go.` };
    const kept = { ...coach, contract: { annualSalary: coach.contract.annualSalary + raise, yearsRemaining: coach.contract.yearsRemaining + 2 } };
    const teams = league.teams.map(t => (t.teamId === team.teamId ? { ...t, staff: { ...t.staff, [offer.role]: kept } } : t));
    return { league: mark({ ...league, teams }, 'kept'), message: `${coachId} stays: a $${(raise / 1e6).toFixed(2)}M raise and two more years.` };
  }
  const moved = install(league, offer.toTeamId, coach, offer.salary, league.season ?? offer.season, team.teamId, offer.role);
  const name = league.teams.find(t => t.teamId === offer.toTeamId)?.name ?? offer.toTeamId;
  return { league: mark(moved, 'left'), message: `${coachId} leaves to become head coach of ${name}. Hire a replacement on the Staff page.` };
}

/** When the season starts, calls you never answered are settled: he takes the job. */
export function settleStaffOffers(league: League): League {
  let next = league;
  for (const o of league.staffOffers ?? []) if (o.status === 'pending') next = answerPoach(next, o.coachId, false).league;
  return next;
}
