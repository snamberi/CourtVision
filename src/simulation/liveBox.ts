import type { PossessionLogEntry } from './boxscore';
import { playbackForEntry } from './gamePlayback';

export interface LiveLine {
  playerId: string; seconds: number; pts: number; fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number;
  oreb: number; dreb: number; ast: number; stl: number; blk: number; tov: number; pf: number; pm: number; onCourt: boolean;
}
export interface LiveTeam { teamId: string; lines: LiveLine[]; teamFouls: number; timeoutsUsed: number; points: number }
const THREES = ['corner3', 'aboveBreak3', 'pullUp3', 'catchAndShoot3', 'stepback'];

/**
 * Box score of the game so far, rebuilt only from possessions already shown (never spoils what comes next).
 * Newer games record assist and foul credit on each possession; older saves fall back to the event text.
 */
export function liveBoxScore(log: PossessionLogEntry[], completed: number, homeTeamId: string, awayTeamId: string,
  rosterOrder: { home: string[]; away: string[] }): { home: LiveTeam; away: LiveTeam } {
  const lines = new Map<string, LiveLine>();
  const line = (id: string) => {
    let l = lines.get(id);
    if (!l) { l = { playerId: id, seconds: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pm: 0, onCourt: false }; lines.set(id, l); }
    return l;
  };
  const homeIds = new Set(rosterOrder.home), fouls = { home: 0, away: 0 }, timeouts = { home: 0, away: 0 };
  const shown = log.slice(0, Math.max(0, Math.min(log.length, Math.floor(completed))));
  const currentQuarter = log[Math.min(log.length - 1, Math.floor(completed))]?.quarter ?? 1;
  let prevHome = 0, prevAway = 0;
  shown.forEach((e, i) => {
    for (const id of e.onCourtHome) homeIds.add(id);
    const p = playbackForEntry(e);
    const next = log[i + 1];
    const duration = e.durationSeconds ?? (next?.quarter === e.quarter ? Math.max(0, e.clockSeconds - next.clockSeconds) : e.clockSeconds);
    for (const id of [...e.onCourtHome, ...e.onCourtAway]) line(id).seconds += duration;
    const swing = (e.homeScoreAfter - prevHome) - (e.awayScoreAfter - prevAway);
    for (const id of e.onCourtHome) line(id).pm += swing;
    for (const id of e.onCourtAway) line(id).pm -= swing;
    prevHome = e.homeScoreAfter; prevAway = e.awayScoreAfter;
    const three = THREES.includes(p.shotType ?? '');
    if (p.shooterId && e.result !== 'TURNOVER' && e.result !== 'FOUL') {
      const s = line(p.shooterId); s.fga++; if (three) s.tpa++;
      if (p.shotMade) { s.fgm++; s.pts += three ? (e.events.some(ev => ev.includes(' MAKE (+4)')) ? 4 : 3) : 2; if (three) s.tpm++; }
    }
    if (p.shooterId && p.freeThrows) { const s = line(p.shooterId); s.fta += p.freeThrows.attempted; s.ftm += p.freeThrows.made; s.pts += p.freeThrows.made; }
    if (p.rebounderId) { const offense = e.offenseTeamId === homeTeamId ? e.onCourtHome : e.onCourtAway; if (offense.includes(p.rebounderId)) line(p.rebounderId).oreb++; else line(p.rebounderId).dreb++; }
    const assist = p.assistId ?? [...e.onCourtHome, ...e.onCourtAway].find(id => e.events.includes(`${id} AST`));
    if (assist) line(assist).ast++;
    if (p.stealerId) line(p.stealerId).stl++;
    if (p.blockerId) line(p.blockerId).blk++;
    if (e.result === 'TURNOVER') line(e.ballHandlerId).tov++;
    const legacyFouler = p.foulerId ?? [...e.onCourtHome, ...e.onCourtAway].find(id => e.events.some(ev => ev.startsWith(`${id} shooting foul on `)));
    for (const fouler of p.foulerIds ?? (legacyFouler ? [legacyFouler] : [])) {
      line(fouler).pf++;
      if (e.quarter === currentQuarter) fouls[e.onCourtHome.includes(fouler) ? 'home' : 'away']++;
    }
    for (const ev of e.events) { if (ev === `${homeTeamId} timeout`) timeouts.home++; else if (ev === `${awayTeamId} timeout`) timeouts.away++; }
  });
  const current = log[Math.min(log.length - 1, Math.floor(completed))];
  if (current && completed < log.length) { for (const id of current.onCourtHome) { homeIds.add(id); line(id).onCourt = true; } for (const id of current.onCourtAway) line(id).onCourt = true; }
  const order = (ids: string[], home: boolean) => {
    const known = [...ids, ...[...lines.keys()].filter(id => homeIds.has(id) === home && !ids.includes(id))];
    return known.map(id => line(id));
  };
  const team = (home: boolean): LiveTeam => {
    const ls = order(home ? rosterOrder.home : rosterOrder.away, home);
    return { teamId: home ? homeTeamId : awayTeamId, lines: ls, teamFouls: home ? fouls.home : fouls.away, timeoutsUsed: home ? timeouts.home : timeouts.away, points: ls.reduce((n, l) => n + l.pts, 0) };
  };
  return { home: team(true), away: team(false) };
}
