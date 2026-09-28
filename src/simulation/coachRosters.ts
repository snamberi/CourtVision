import type { League } from './league';
import type { GMLeagueExtras } from './gm';
import { waiveToFreeAgency, computeTradeValue, computeAskingSalary, teamPayroll } from './gm';
import { signFreeAgentChecked, signingDecision } from './freeAgentDecision';
import { primaryPosition } from './teamStatus';
import { calculateOverall } from './engine/overall';
import { isStuck } from './sticky';

export const ROSTER_LIMITS = { minRosterSize: 10, maxRosterSize: 18 };

export function normalizeRosterRules(league: League, extras: GMLeagueExtras) {
  return { league: { ...league, rosterLimits: ROSTER_LIMITS }, extras: { ...extras, capSettings: { ...extras.capSettings, ...ROSTER_LIMITS } } };
}

/** Coaches handle emergency roster moves before regular-season play, including the user's team. */
export function manageCoachRosters(league: League, extras: GMLeagueExtras) {
  let current = { league, extras };
  const moves: { teamId: string; playerId: string; kind: 'signed' | 'waived' }[] = [];
  if ((league.seasonPhase ?? 'regular_season') !== 'regular_season') return { ...current, moves };
  const { minRosterSize: min, maxRosterSize: max } = extras.capSettings;
  // Release excess depth first so every team can draw from the same free-agent pool.
  for (const original of league.teams) {
    let team = current.league.teams.find(t => t.teamId === original.teamId)!;
    while (team.seasons.length > max) {
      const depth = (pos: ReturnType<typeof primaryPosition>) => team.seasons.filter(s => primaryPosition(s) === pos).length;
      const retain = (p: typeof team.seasons[number]) => computeTradeValue(p) + (depth(primaryPosition(p)) <= 2 ? 25 : 0);
      // Stuck players (Sandbox) can't be waived: cut from everyone else, and stop if no one can go (an unwaivable
      // pick used to leave this loop spinning forever, freezing Auto Play).
      const cut = team.seasons.filter(p => !isStuck(p)).sort((a, b) => retain(a) - retain(b) || a.playerId.localeCompare(b.playerId))[0];
      if (!cut) break;
      const waived = waiveToFreeAgency(current.league, current.extras, cut.playerId, team.teamId);
      if (waived.league === current.league) break;
      current = waived;
      moves.push({ teamId: team.teamId, playerId: cut.playerId, kind: 'waived' });
      team = current.league.teams.find(t => t.teamId === original.teamId)!;
    }
  }
  for (const original of league.teams) {
    let team = current.league.teams.find(t => t.teamId === original.teamId)!;
    while (team.seasons.length < min) {
      const cap = current.extras.capSettings;
      const room = cap.salaryCap - teamPayroll(current.extras.contracts, team);
      const salary = (p: typeof team.seasons[number]) => computeAskingSalary(calculateOverall(p), cap);
      const affordable = current.extras.freeAgents.filter(p => !cap.hardCapEnabled || salary(p) <= room);
      const fit = (p: typeof team.seasons[number]) => calculateOverall(p) + (team.seasons.filter(s => primaryPosition(s) === primaryPosition(p)).length < 2 ? 12 : 0);
      const ranked = affordable.sort((a, b) => fit(b) - fit(a) || a.playerId.localeCompare(b.playerId));
      if (!ranked.length) break;
      // Emergency signings follow the shared rules (the player must accept and gets his price; cap room is waived).
      // Only if nobody will come is the best candidate signed anyway, so the team can field the league minimum.
      const offerFor = (p: typeof ranked[number]) => ({ annualSalary: Math.max(salary(p), signingDecision(current.league, current.extras, p, team.teamId, undefined, { emergency: true }).required), yearsRemaining: 1, playerOption: false, teamOption: false });
      const willing = ranked.find(p => signingDecision(current.league, current.extras, p, team.teamId, offerFor(p), { emergency: true }).accepted);
      const player = willing ?? ranked[0];
      const signed = signFreeAgentChecked(current.league, current.extras, player.playerId, team.teamId, willing ? offerFor(player) : { annualSalary: salary(player), yearsRemaining: 1, playerOption: false, teamOption: false },
        { emergency: true, force: !willing });
      if (signed.league === current.league) break;
      current = { league: signed.league, extras: signed.extras };
      moves.push({ teamId: team.teamId, playerId: player.playerId, kind: 'signed' });
      team = current.league.teams.find(t => t.teamId === original.teamId)!;
    }
  }
  if (moves.length) {
    const moved = new Set(moves.map(m => m.playerId));
    current = { league: { ...current.league, teams: current.league.teams.map(t => ({ ...t, rotationOrder: t.rotationOrder?.filter(id => t.seasons.some(p => p.playerId === id)) })) },
      extras: { ...current.extras, tradeBlock: current.extras.tradeBlock.filter(id => !moved.has(id)),
        pendingTradeOffers: current.extras.pendingTradeOffers.filter(o => ![...o.playersFromA, ...o.playersFromB].some(id => moved.has(id))) } };
  }
  return { ...current, moves };
}
