import type { League } from './league';
import { gameLog } from './logPacking';

/* Lineup Lab and shot charts, built from the possession logs of this season's games.
 * A lineup is five players on the floor together; its ratings are points scored and allowed per 100 possessions. */

export interface LineupRow { players: string[]; possessions: number; offPoss: number; defPoss: number; ptsFor: number; ptsAgainst: number; offRtg: number; defRtg: number; net: number }

export function teamLineups(league: League, teamId: string): LineupRow[] {
  const rows = new Map<string, LineupRow>();
  for (const g of league.schedule) {
    const r = g.result;
    if (!g.played || !r || (r.homeTeamId !== teamId && r.awayTeamId !== teamId)) continue;
    const home = r.homeTeamId === teamId;
    let prevHome = 0, prevAway = 0;
    for (const e of gameLog(r)) {
      const five = home ? e.onCourtHome : e.onCourtAway;
      const homeDelta = e.homeScoreAfter - prevHome, awayDelta = e.awayScoreAfter - prevAway;
      prevHome = e.homeScoreAfter; prevAway = e.awayScoreAfter;
      if (five.length !== 5) continue;
      const players = [...five].sort();
      const key = players.join('|');
      const row = rows.get(key) ?? { players, possessions: 0, offPoss: 0, defPoss: 0, ptsFor: 0, ptsAgainst: 0, offRtg: 0, defRtg: 0, net: 0 };
      row.possessions++;
      if (e.offenseTeamId === teamId) row.offPoss++; else row.defPoss++;
      row.ptsFor += home ? homeDelta : awayDelta;
      row.ptsAgainst += home ? awayDelta : homeDelta;
      rows.set(key, row);
    }
  }
  return [...rows.values()].map(r => {
    const offRtg = r.offPoss ? (r.ptsFor / r.offPoss) * 100 : 0, defRtg = r.defPoss ? (r.ptsAgainst / r.defPoss) * 100 : 0;
    return { ...r, offRtg, defRtg, net: offRtg - defRtg };
  }).sort((a, b) => b.possessions - a.possessions);
}

/** The best lineup with a real sample (at least `minPossessions`), by net rating. */
export function bestFive(rows: LineupRow[], minPossessions = 60): LineupRow | null {
  return rows.filter(r => r.possessions >= minPossessions).sort((a, b) => b.net - a.net)[0] ?? null;
}

export type ShotZone = 'rim' | 'paint' | 'mid' | 'long2' | 'corner3' | 'arc3';
export const ZONES: { id: ShotZone; label: string; points: 2 | 3 }[] = [
  { id: 'rim', label: 'At the rim', points: 2 }, { id: 'paint', label: 'Post / paint', points: 2 }, { id: 'mid', label: 'Midrange', points: 2 },
  { id: 'long2', label: 'Long two', points: 2 }, { id: 'corner3', label: 'Corner three', points: 3 }, { id: 'arc3', label: 'Above the break', points: 3 },
];
const ZONE_OF: Record<string, ShotZone> = {
  rim: 'rim', close: 'rim', layup: 'rim', dunk: 'rim', postShot: 'paint', hook: 'paint',
  midrange: 'mid', fadeaway: 'mid', longMidrange: 'long2', corner3: 'corner3',
  aboveBreak3: 'arc3', pullUp3: 'arc3', catchAndShoot3: 'arc3', stepback: 'arc3',
};
export type ZoneLine = { fga: number; fgm: number };
export type ShotChart = Record<ShotZone, ZoneLine>;
const empty = (): ShotChart => ({ rim: { fga: 0, fgm: 0 }, paint: { fga: 0, fgm: 0 }, mid: { fga: 0, fgm: 0 }, long2: { fga: 0, fgm: 0 }, corner3: { fga: 0, fgm: 0 }, arc3: { fga: 0, fgm: 0 } });

/** Field-goal attempts by zone this season: for one player, one team, or the whole league (no filter). */
export function shotChart(league: League, filter: { playerId?: string; teamId?: string } = {}): ShotChart {
  const chart = empty();
  for (const g of league.schedule) {
    const r = g.result;
    if (!g.played || !r) continue;
    if (filter.teamId && r.homeTeamId !== filter.teamId && r.awayTeamId !== filter.teamId) continue;
    for (const e of gameLog(r)) {
      const p = e.playback;
      if (!p?.shotType || !p.shooterId || p.shotMade == null) continue;
      if (e.result === 'FOUL' && !p.shotMade) continue; // fouled on a miss: free throws, not a field-goal attempt
      if (filter.playerId && p.shooterId !== filter.playerId) continue;
      if (filter.teamId && e.offenseTeamId !== filter.teamId) continue;
      const zone = ZONE_OF[p.shotType];
      if (!zone) continue;
      chart[zone].fga++;
      if (p.shotMade) chart[zone].fgm++;
    }
  }
  return chart;
}

export const zonePct = (z: ZoneLine) => (z.fga ? z.fgm / z.fga : 0);
