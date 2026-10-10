import type { League } from './league';

/*
 * The owner's mid-season demand. When your team is losing (a losing record a third of the way in, a five-game skid,
 * or a GM already on thin ice), the owner sets a short-term target: win so many of the next ten games. Meet it and
 * your job security climbs; miss it and you're on the hot seat. One demand at a time, and never in the last ten
 * games of the season. Pure functions: `tickOwnerDemand` runs after games and returns the same league when nothing
 * changes.
 */

export interface OwnerDemand {
  season: string;
  /** Your team's games played when it was issued. */
  issuedAt: number;
  games: number;
  need: number;
  status: 'active' | 'met' | 'failed';
  /** The owner's words. */
  text: string;
  /** Wins in the window once it's decided. */
  won?: number;
}

const WINDOW = 10;
const COOLDOWN = 15;
const MET_SECURITY = 8;
const FAILED_SECURITY = -12;

/** Your team's results this season, in schedule order (true = win). */
export function teamResults(league: League, teamId: string): boolean[] {
  const out: boolean[] = [];
  for (const g of league.schedule) {
    if (!g.played || !g.result || (g.homeTeamId !== teamId && g.awayTeamId !== teamId)) continue;
    const home = g.homeTeamId === teamId;
    out.push(home ? g.result.homeScore > g.result.awayScore : g.result.awayScore > g.result.homeScore);
  }
  return out;
}

/** Wins and games so far in the demand's window. */
export function demandProgress(league: League, d: OwnerDemand, teamId: string): { won: number; played: number } {
  const window = teamResults(league, teamId).slice(d.issuedAt, d.issuedAt + d.games);
  return { won: window.filter(Boolean).length, played: window.length };
}

export function tickOwnerDemand(league: League): { league: League; news?: { text: string; tone: 'good' | 'bad' | 'info' } } {
  const fo = league.frontOffice;
  if (!fo || fo.status !== 'employed' || !fo.teamId || (league.seasonPhase ?? 'regular_season') !== 'regular_season' || !league.season) return { league };
  const teamId = fo.teamId;
  const results = teamResults(league, teamId);
  const total = league.schedule.filter(g => g.homeTeamId === teamId || g.awayTeamId === teamId).length;
  const d = fo.demand && fo.demand.season === league.season ? fo.demand : undefined;
  const owner = fo.owners[teamId]?.name ?? 'The owner';

  if (d?.status === 'active') {
    const { won, played } = demandProgress(league, d, teamId);
    const left = d.games - played;
    const decided = won >= d.need ? 'met' : won + left < d.need ? 'failed' : null;
    if (!decided) return { league };
    const security = Math.max(0, Math.min(100, fo.security + (decided === 'met' ? MET_SECURITY : FAILED_SECURITY)));
    const demand: OwnerDemand = { ...d, status: decided, won };
    const next = { ...league, frontOffice: { ...fo, security, demand, ...(decided === 'failed' ? { warned: true } : {}) } };
    return { league: next, news: decided === 'met'
      ? { text: `${owner} is satisfied: you won ${won} of the ${d.games} games demanded. Job security up.`, tone: 'good' }
      : { text: `${owner} is not happy: you missed the demand (${won} wins, ${d.need} needed). You're on the hot seat.`, tone: 'bad' } };
  }

  // A new demand: a third of the way in or later, not in the last ten games, and not right after the last one.
  const played = results.length;
  if (played < Math.max(12, Math.round(total / 3)) || total - played < WINDOW) return { league };
  if (d && played - (d.issuedAt + d.games) < COOLDOWN) return { league };
  const wins = results.filter(Boolean).length, losses = played - wins;
  let skid = 0;
  for (let i = results.length - 1; i >= 0 && !results[i]; i--) skid++;
  const losing = wins / played < 0.45, sliding = skid >= 5, shaky = fo.security < 40;
  if (!losing && !sliding && !shaky) return { league };
  const need = wins / played >= 0.5 ? 7 : 6;
  const why = sliding ? `${skid} straight losses` : losing ? `${wins}-${losses}` : 'what I\'m seeing';
  const text = `${owner}: "${why[0].toUpperCase()}${why.slice(1)}. That's not acceptable. Win ${need} of the next ${WINDOW}, or we'll be having a different conversation."`;
  const demand: OwnerDemand = { season: league.season, issuedAt: played, games: WINDOW, need, status: 'active', text };
  return { league: { ...league, frontOffice: { ...fo, demand } }, news: { text: `The owner wants results: win ${need} of your next ${WINDOW} games.`, tone: 'info' } };
}
