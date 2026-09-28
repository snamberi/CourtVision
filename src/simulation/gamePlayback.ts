import type { GameResult, PossessionLogEntry, PossessionPlayback } from './boxscore';
import type { PossessionResult } from './engine/possession';

/** Capture actual engine participants; presentation never consumes the seeded simulation RNG. */
export function playbackFromPossession(result: PossessionResult): PossessionPlayback {
  const lines = Object.entries(result.statDeltas);
  const shooter = lines.find(([, s]) => (s.fga ?? 0) > 0 || (s.fta ?? 0) > 0);
  return {
    shooterId: shooter?.[0],
    passerId: shooter && shooter[0] !== result.ballHandlerId ? result.ballHandlerId : undefined,
    rebounderId: lines.find(([, s]) => (s.oreb ?? 0) + (s.dreb ?? 0) > 0)?.[0],
    stealerId: lines.find(([, s]) => (s.stl ?? 0) > 0)?.[0],
    blockerId: lines.find(([, s]) => (s.blk ?? 0) > 0)?.[0],
    assistId: lines.find(([, s]) => (s.ast ?? 0) > 0)?.[0],
    foulerId: lines.find(([, s]) => (s.pf ?? 0) > 0)?.[0],
    foulerIds: lines.flatMap(([id, s]) => Array((s.pf ?? 0) > 0 ? s.pf! : 0).fill(id) as string[]),
    shotType: typeof result.debug.shotType === 'string' ? result.debug.shotType : undefined,
    shotMade: shooter ? (shooter[1].fgm ?? 0) > 0 : undefined,
    ...(result.events.some(e => e.startsWith('Out of bounds') || e === 'Team rebound') ? { outOfBounds: true } : {}),
    freeThrows: shooter && (shooter[1].fta ?? 0) > 0 ? { made: shooter[1].ftm ?? 0, attempted: shooter[1].fta!, outcomes: Array.isArray(result.debug.freeThrowOutcomes) ? result.debug.freeThrowOutcomes.filter((v): v is boolean => typeof v === 'boolean') : undefined } : undefined,
  };
}

/** Old saved games retain their original event traces; recognize full IDs, including spaces. */
export function playbackForEntry(entry: PossessionLogEntry): PossessionPlayback {
  if (entry.playback) return entry.playback;
  const ids = [...entry.onCourtHome, ...entry.onCourtAway];
  const shooterId = ids.find(id => entry.events.some(e => e.startsWith(`${id} `) && / (MAKE|MISS)\b/.test(e)))
    ?? ids.find(id => entry.events.some(e => e.includes(`shooting foul on ${id} (`)));
  const handler = entry.events.find(e => e.endsWith(' has the ball'))?.slice(0, -13) ?? entry.ballHandlerId;
  const ftEvent = entry.events.find(e => /\(\d+\/\d+ FT\)/.test(e));
  const ft = ftEvent?.match(/\((\d+)\/(\d+) FT\)/);
  const andOne = entry.events.find(e=>e.includes(' AND-1 (')); 
  return { shooterId, passerId: shooterId && shooterId !== handler && entry.events.includes(`Pass to ${shooterId}`) ? handler : undefined,
    rebounderId: ids.find(id => entry.events.includes(`Rebound: ${id}`)),
    stealerId: ids.find(id => entry.events.includes(`${id} STEAL`)), blockerId: ids.find(id => entry.events.includes(`${id} BLOCK`)),
    shotType: typeof entry.debug?.shotType === 'string' ? entry.debug.shotType : entry.action,
    shotMade: entry.result === 'MAKE' || entry.result === 'AND1', ...(entry.events.some(e => e.startsWith('Out of bounds') || e === 'Team rebound') ? { outOfBounds: true } : {}), freeThrows: ft ? { made: +ft[1], attempted: +ft[2] } : andOne ? {made:andOne.includes('(made FT)')?1:0,attempted:1} : undefined };
}

export function playbackScore(game: GameResult, completed: number) {
  if (completed >= game.possessionLog.length) return { home: game.homeScore, away: game.awayScore };
  const last = game.possessionLog[Math.max(0, Math.floor(completed)) - 1];
  return { home: last?.homeScoreAfter ?? 0, away: last?.awayScoreAfter ?? 0 };
}

export function playbackClock(game: GameResult, index: number, progress: number) {
  const current = game.possessionLog[index];
  if (!current) return 'FINAL';
  const next = game.possessionLog[index + 1];
  const duration = current.durationSeconds ?? (next?.quarter === current.quarter ? Math.max(0, current.clockSeconds - next.clockSeconds) : current.clockSeconds);
  const seconds = Math.max(0, Math.ceil(current.clockSeconds - duration * progress));
  const regulation = game.regulationPeriods ?? 4;
  const period = current.quarter <= regulation ? `${regulation === 2 ? 'H' : 'Q'}${current.quarter}` : `OT${current.quarter - regulation}`;
  return `${period} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function hotHand(game: GameResult, completed: number): { playerId: string; threes: number } | null {
  // Count only revealed attempts, so a future hot streak can never leak into the live call.
  const streaks = new Map<string, number>();
  for (const entry of game.possessionLog.slice(0, completed)) {
    const p = playbackForEntry(entry);
    if (!p.shooterId || !p.shotType || !['corner3','aboveBreak3','pullUp3','catchAndShoot3','stepback'].includes(p.shotType) || entry.result === 'FOUL') continue;
    streaks.set(p.shooterId, p.shotMade ? (streaks.get(p.shooterId) ?? 0) + 1 : 0);
  }
  const leader = [...streaks].sort((a,b) => b[1] - a[1])[0];
  return leader && leader[1] >= 3 ? { playerId: leader[0], threes: leader[1] } : null;
}
