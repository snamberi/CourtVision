import type { League } from '../simulation/league';
import { isOfficialLeague } from '../simulation/frontOffice';
import { computeHallOfFame } from '../simulation/hallOfFame';
import type { SecretId } from './relics';

/** Only managed, official seasons and drafts made by the player count. */
export function franchiseSecrets(league: League): SecretId[] {
  if (!isOfficialLeague(league)) return [];
  const reviews = (league.frontOffice?.reviews ?? []).filter(r => !r.unofficial);
  const out: SecretId[] = [];
  const teams = new Set(reviews.map(r => r.teamId));
  for (const team of teams) {
    const rows = reviews.filter(r => r.teamId === team);
    if (rows.filter(r => r.finish === 'Champion').length >= 5) out.push('loyaltyPays');
    if (rows.some(r => r.wins <= 20 && rows.some(later => later.season > r.season && later.finish === 'Champion'))) out.push('rebuilder');
  }
  const eligibleRetirees = (league.retiredPlayers ?? []).filter(r => !r.preStart && r.finalSeasonData?.draftedByUser);
  const inducted = new Set(computeHallOfFame({ ...league, retiredPlayers: eligibleRetirees }).filter(c => c.inducted).map(c => c.playerId));
  const drafted = new Map<string, Set<string>>();
  for (const record of eligibleRetirees) {
    const p = record.finalSeasonData;
    if (record.preStart || !p?.draftedByUser || !p.draftTeamId || !inducted.has(p.playerId)) continue;
    const group = drafted.get(p.draftTeamId) ?? new Set<string>();
    group.add(p.playerId); drafted.set(p.draftTeamId, group);
  }
  if ([...drafted.values()].some(ids => ids.size >= 3)) out.push('draftWhisperer');
  return [...new Set(out)];
}
