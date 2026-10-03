import type { League } from './league';

/*
 * GM Career: start at the bottom of a front office. As the scout you run the draft and the scouting department while
 * the GM above you makes the trades and signings (the AI runs your team's roster moves). Do well and you are promoted
 * to assistant GM: free agency, extensions and the roster are yours, but trades are still the GM's call. Then the
 * GM job, with everything. If your team won't promote you, a struggling team calls with its GM job.
 */

export type GmRole = 'scout' | 'assistant' | 'gm';
export interface GmCareer { role: GmRole; teamId: string | null; startSeason: string; seasonsInRole: number; log: { season: string; text: string }[]; offer?: { teamId: string; teamName: string } }

export const ROLE_LABEL: Record<GmRole, string> = { scout: 'Scout', assistant: 'Assistant GM', gm: 'General Manager' };
export const ROLE_BLURB: Record<GmRole, string> = {
  scout: 'You run the draft and the scouting department. The GM makes the trades and signings.',
  assistant: 'Free agency, extensions and the roster are yours. Trades are still the GM\'s call.',
  gm: 'Everything is yours.',
};
/** Tabs a role can't use (the GM above you does those). */
export const ROLE_LOCKED: Record<GmRole, string[]> = {
  scout: ['trade', 'threeTeam', 'tradeBlock', 'tradeOffers', 'deadline', 'freeAgency', 'extensions'],
  assistant: ['trade', 'threeTeam', 'tradeBlock', 'tradeOffers', 'deadline'],
  gm: [],
};

export const startGmCareer = (league: League): League => ({ ...league, gmCareer: { role: 'scout', teamId: null, startSeason: league.season ?? '', seasonsInRole: 0, log: [] } });
/** The team you joined (set once you pick it). */
export const joinTeam = (league: League, teamId: string | null): League => (league.gmCareer && !league.gmCareer.teamId && teamId ? { ...league, gmCareer: { ...league.gmCareer, teamId } } : league);
export const gmRole = (league: League): GmRole => league.gmCareer?.role ?? 'gm';
/** Who the AI should treat as yours: as the scout, the GM above you runs the roster moves. */
export const aiUserTeam = (league: League, controlledTeamId: string | null) => (league.gmCareer?.role === 'scout' ? null : controlledTeamId);

/** End of a season: promotion, or an offer from a team that needs a GM. */
export function gmCareerSeasonEnd(league: League, teamSeasons: { teamId: string; teamName: string; wins: number; losses: number }[], previousSeason: string): League {
  const c = league.gmCareer;
  if (!c || !c.teamId || c.role === 'gm') return league;
  const row = teamSeasons.find(r => r.teamId === c.teamId);
  const pct = row ? row.wins / Math.max(1, row.wins + row.losses) : 0.5;
  const seasons = c.seasonsInRole + 1;
  const log = [...c.log];
  let role: GmRole = c.role, offer = c.offer;
  if (c.role === 'scout') {
    role = 'assistant';
    log.push({ season: previousSeason, text: `Promoted to assistant GM after a ${row ? `${row.wins}-${row.losses}` : ''} season. Free agency and the roster are yours now.` });
  } else if (pct >= 0.45 || seasons >= 3) {
    role = 'gm';
    log.push({ season: previousSeason, text: `The ${row?.teamName ?? 'team'} make you their general manager. Everything is yours.` });
  } else {
    // Not this year here, but someone else wants you: the team with the worst record.
    const worst = [...teamSeasons].filter(r => r.teamId !== c.teamId).sort((a, b) => a.wins / Math.max(1, a.wins + a.losses) - b.wins / Math.max(1, b.wins + b.losses))[0];
    if (worst) offer = { teamId: worst.teamId, teamName: worst.teamName };
    log.push({ season: previousSeason, text: `No promotion yet${worst ? `, but the ${worst.teamName} want you as their GM` : ''}.` });
  }
  return { ...league, gmCareer: { ...c, role, seasonsInRole: role === c.role ? seasons : 0, log: log.slice(-30), ...(role === 'gm' ? { offer: undefined } : offer ? { offer } : {}) } };
}

/** Taking another team's GM job (the App also switches the team you run). */
export const takeGmOffer = (league: League): League => (league.gmCareer?.offer ? { ...league, gmCareer: { ...league.gmCareer, role: 'gm', teamId: league.gmCareer.offer.teamId, seasonsInRole: 0, offer: undefined, log: [...league.gmCareer.log, { season: league.season ?? '', text: `Hired as GM of the ${league.gmCareer.offer.teamName}.` }] } } : league);
