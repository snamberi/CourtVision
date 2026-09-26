import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import type { GameResult, PossessionLogEntry } from './boxscore';
import type { League } from './league';

/*
 * Possession logs are ~90% of a league's size (≈150 KB per game, over 200 MB for a full season) and never
 * change after a game is played. Older games keep their log as a deflated base64 string (`packedLog`,
 * ≈13 KB) so saves, backups, worker hand-offs and memory stay small. `gameLog()` restores it losslessly.
 */
const decoded = new WeakMap<GameResult, PossessionLogEntry[]>();
const packedCache = new WeakMap<PossessionLogEntry[], string>();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function fromBase64(text: string): Uint8Array {
  const binary = atob(text), out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
export function packLog(log: PossessionLogEntry[]): string {
  const hit = packedCache.get(log);
  if (hit) return hit;
  const packed = toBase64(deflateSync(strToU8(JSON.stringify(log)), { level: 3 }));
  packedCache.set(log, packed);
  return packed;
}
export function unpackLog(packed: string): PossessionLogEntry[] {
  return JSON.parse(strFromU8(inflateSync(fromBase64(packed))));
}
/** The possession log of any game, packed or not. Decoding is cached per result object. */
export function gameLog(result: GameResult): PossessionLogEntry[] {
  if (!result.packedLog) return result.possessionLog;
  const hit = decoded.get(result);
  if (hit) return hit;
  let log: PossessionLogEntry[] = [];
  try { log = unpackLog(result.packedLog); } catch { log = []; }
  decoded.set(result, log);
  return log;
}
export const hasGameLog = (result: GameResult) => !!result.packedLog || result.possessionLog.length > 0;
/** Same result with its log expanded — for replay, play-by-play and anything that reads `possessionLog`. */
export function withGameLog(result: GameResult): GameResult {
  return result.packedLog ? { ...result, possessionLog: gameLog(result), packedLog: undefined } : result;
}
const packedResults = new WeakMap<GameResult, GameResult>();
export function packResult(result: GameResult): GameResult {
  if (result.packedLog || result.possessionLog.length === 0) return result;
  const hit = packedResults.get(result);
  if (hit) return hit;
  const packed = { ...result, possessionLog: [], packedLog: packLog(result.possessionLog) };
  decoded.set(packed, result.possessionLog); // expanding it again this session costs nothing
  packedResults.set(result, packed);
  return packed;
}

/**
 * Packs every played game except those in the most recent `keepRecentRounds` rounds.
 * Returns the same league object when there is nothing new to pack, so React state stays stable.
 */
export function compactLeagueLogs(league: League, keepRecentRounds = 1): League {
  const played = league.schedule.filter(g => g.played && g.result);
  if (!played.length) return compactBracket(league, keepRecentRounds === 0);
  const lastRound = Math.max(...played.map(g => g.round));
  let changed = false;
  const schedule = league.schedule.map(g => {
    if (!g.result || g.result.packedLog || !g.result.possessionLog.length || g.round > lastRound - keepRecentRounds) return g;
    changed = true;
    return { ...g, result: packResult(g.result) };
  });
  return compactBracket(changed ? { ...league, schedule } : league, keepRecentRounds === 0);
}
function compactBracket(league: League, all: boolean): League {
  const bracket = league.playoffBracket;
  if (!bracket) return league;
  let changed = false;
  const latest = bracket.rounds.reduce((last, round, ri) => round.some(s => s.games.length) ? ri : last, -1);
  const rounds = bracket.rounds.map((round, ri) => round.map(series => {
    // Keep the latest playoff round expanded during the session; saves pack everything.
    if (!all && ri === latest) return series;
    if (!series.games.some(g => !g.packedLog && g.possessionLog.length)) return series;
    changed = true;
    return { ...series, games: series.games.map(packResult) };
  }));
  return changed ? { ...league, playoffBracket: { ...bracket, rounds } } : league;
}
