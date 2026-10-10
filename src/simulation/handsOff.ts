import type { League } from './league';
import { pressState, answerPress } from './press';
import { pendingDecisions, chooseTreatment } from './medical';
import { pendingOffers, answerPoach } from './staffPoaching';

/*
 * Hands-off mode (Franchise): for players who just want to watch the seasons roll by. Everything that would wait for
 * you at your desk is answered the way a sensible GM would, so nothing piles up and nothing costs you for being
 * ignored. All-Star Weekend and Trade Deadline Day are simmed by the Play flow (their own auto switches).
 *
 *  - Press conferences: the answer with the best overall effect (no "no comment" penalty with the fans).
 *  - Injuries: the doctors' standard recovery; surgery for a severe injury to a player under 30.
 *  - Staff poaching calls: keep the assistant with a raise when it fits the budget, otherwise let him go.
 */

export interface DeskResult { league: League; notes: string[] }

const effectScore = (e: Record<string, number | undefined>) =>
  (e.team ?? 0) + (e.owner ?? 0) * 1.2 + (e.fans ?? 0) + (e.player ?? 0) * 0.6 + (e.hype ?? 0) * 0.3;

export function hasDeskWork(league: League, teamId: string | null): boolean {
  if (!teamId) return false;
  return (league.press?.pending.length ?? 0) > 0 || pendingDecisions(league, teamId).length > 0 || pendingOffers(league, teamId).length > 0;
}

export function autoHandleDesk(league: League, teamId: string | null): DeskResult {
  if (!teamId) return { league, notes: [] };
  const notes: string[] = [];
  let next = league;

  const press = pressState(next).pending;
  for (const c of press) {
    const best = [...c.answers].sort((a, b) => effectScore(b.effects as Record<string, number>) - effectScore(a.effects as Record<string, number>))[0];
    if (best) next = answerPress(next, c.id, best.id, teamId);
  }
  if (press.length) notes.push(`${press.length} press question${press.length === 1 ? '' : 's'} answered`);

  const injuries = pendingDecisions(next, teamId);
  for (const rec of injuries) {
    const age = next.teams.find(t => t.teamId === teamId)?.seasons.find(p => p.playerId === rec.playerId)?.age ?? 30;
    next = chooseTreatment(next, rec.playerId, rec.severity === 'severe' && age < 30 ? 'surgery' : 'standard');
  }
  if (injuries.length) notes.push(`${injuries.length} injur${injuries.length === 1 ? 'y' : 'ies'} sent to the doctors' plan`);

  const offers = pendingOffers(next, teamId);
  for (const o of offers) {
    const kept = answerPoach(next, o.coachId, true);
    next = kept.league.staffOffers?.some(x => x.coachId === o.coachId && x.status === 'pending') ? answerPoach(next, o.coachId, false).league : kept.league;
  }
  if (offers.length) notes.push(`${offers.length} staff call${offers.length === 1 ? '' : 's'} answered`);

  return { league: next, notes };
}
