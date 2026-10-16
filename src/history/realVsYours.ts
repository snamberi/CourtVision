import type { NbaHistory } from './nbaHistoryData';
import type { League } from '../simulation/league';
import type { PlayerSeason } from '../simulation/types';
import { franchiseMapper } from './historicalLeague';

/* Real vs Yours: for each season this league has played that the NBA data covers, the real champion, MVP and #1 pick
 * next to this league's. The drift score is the share of those that came out differently. */

const NBA = new Set(['BAA', 'NBA']);

export interface DriftCell { real: string | null; yours: string | null; same: boolean }
export interface DriftRow { season: string; champion: DriftCell; mvp: DriftCell; topPick: DriftCell }
export interface DriftReport { rows: DriftRow[]; compared: number; same: number; drift: number }

const cell = (real: string | null, yours: string | null, same: boolean): DriftCell => ({ real, yours, same: !!real && !!yours && same });

/** Every player the league knows: rosters, free agents and retired players. */
export function everyPlayer(league: League, freeAgents: PlayerSeason[]): PlayerSeason[] {
  return [...league.teams.flatMap(t => t.seasons), ...freeAgents, ...(league.retiredPlayers ?? []).flatMap(r => (r.finalSeasonData ? [r.finalSeasonData] : []))];
}

export function realVsYours(h: NbaHistory, league: League, players: PlayerSeason[]): DriftReport {
  const meta = league.historical;
  if (!meta) return { rows: [], compared: 0, same: 0, drift: 0 };
  const { mapTeam, teamName } = franchiseMapper(h, meta.startYear + 1);
  const topPickBy = new Map<string, string>();
  for (const p of players) if (p.draftPick === 1 && p.draftYear) topPickBy.set(String(p.draftYear), p.playerId);
  const rows: DriftRow[] = [];
  for (const rec of league.franchiseHistory ?? []) {
    const start = Number(rec.season);
    if (rec.imported || start < meta.startYear || start > meta.lastDataStartYear) continue;
    const end = start + 1;
    const champ = h.champions.find(c => c.season === end);
    const mvp = h.awards.find(a => a.season === end && a.award === 'mvp' && a.winner);
    const pick = h.drafts.find(d => d.year === end && NBA.has(d.league) && d.pick === 1);
    const realPick = pick ? (pick.player != null ? h.players[pick.player].displayName : pick.name) : null;
    const yoursPick = topPickBy.get(String(end)) ?? null;
    rows.push({
      season: rec.season,
      champion: cell(champ ? teamName(champ.champion, end) : null, rec.championTeamName, !!champ && mapTeam(champ.champion) === rec.championTeamId),
      mvp: cell(mvp ? h.players[mvp.player].displayName : null, rec.mvpPlayerId, !!mvp && h.players[mvp.player].displayName === rec.mvpPlayerId),
      topPick: cell(realPick, yoursPick, realPick === yoursPick),
    });
  }
  let compared = 0, same = 0;
  for (const r of rows) for (const c of [r.champion, r.mvp, r.topPick]) if (c.real && c.yours) { compared++; if (c.same) same++; }
  return { rows, compared, same, drift: compared ? Math.round((1 - same / compared) * 100) : 0 };
}

/** A few words for the drift score. */
export function driftLabel(drift: number, compared: number): string {
  if (!compared) return 'No seasons played yet';
  if (drift <= 10) return 'History is repeating itself';
  if (drift <= 35) return 'Small ripples in the timeline';
  if (drift <= 65) return 'A different league is taking shape';
  if (drift <= 90) return 'History has been rewritten';
  return 'A whole new universe';
}
