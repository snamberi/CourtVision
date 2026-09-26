import type { PlayerId } from './types';

export interface PlayerStatLine {
  playerId: PlayerId;
  minutes: number;
  points: number;
  fgm: number;
  fga: number;
  tpm: number; // three-pointers made
  tpa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  ba: number; // times this player's shot attempt was blocked
  blkAtt: number; // shots faced as the primary defender ("block attempts"); blk / blkAtt = block success rate
  clutchPoints: number; // points scored in clutch situations (close game, late), drives Clutch Player of the Year
  // shot-location breakdown for transparency / debug
  rimAttempts: number;
  rimMakes: number;
  midrangeAttempts: number;
  midrangeMakes: number;
  touches: number;
  possessionsUsed: number;
  turnoverBreakdown: Record<string, number>;
}

export function emptyStatLine(playerId: PlayerId): PlayerStatLine {
  return {
    playerId,
    minutes: 0,
    points: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    ba: 0,
    blkAtt: 0,
    clutchPoints: 0,
    rimAttempts: 0,
    rimMakes: 0,
    midrangeAttempts: 0,
    midrangeMakes: 0,
    touches: 0,
    possessionsUsed: 0,
    turnoverBreakdown: {},
  };
}

export interface TeamBoxScore {
  teamId: string;
  points: number;
  players: Record<PlayerId, PlayerStatLine>;
}

export interface PossessionPlayback {
  shooterId?: PlayerId;
  passerId?: PlayerId;
  rebounderId?: PlayerId;
  stealerId?: PlayerId;
  blockerId?: PlayerId;
  assistId?: PlayerId; // recorded for the live box score; absent in older saves
  foulerId?: PlayerId;
  shotType?: string;
  shotMade?: boolean;
  freeThrows?: { made: number; attempted: number; outcomes?: boolean[] };
}

export interface PossessionLogEntry {
  playback?: PossessionPlayback; // typed events for the court viewer; optional for old saves

  quarter: number;
  durationSeconds?: number; // actual elapsed clock; absent in older saved games
  clockSeconds: number; // seconds remaining in quarter at possession start
  offenseTeamId: string;
  ballHandlerId: PlayerId;
  action: string;
  events: string[]; // human-readable event trace, e.g. ["Pick-and-roll with Draymond", "Defense switches", "Stepback three", "MAKE"]
  result: 'MAKE' | 'MISS' | 'TURNOVER' | 'FOUL' | 'AND1' | 'REBOUND_CONTINUATION';
  debug?: Record<string, unknown>; // raw probabilities/inputs for Debug Mode
  onCourtHome: PlayerId[]; // who was on the floor for the home team this possession (enables on/off analysis)
  onCourtAway: PlayerId[];
  homeScoreAfter: number;
  awayScoreAfter: number;
  /** True when this trip started with the offense's own rebound (a second-chance possession). */
  secondChance?: boolean;
}

export interface TopPlay {
  possession: number; kind: string; score: number; playerId: string; teamId: string; quarter: number; clockSeconds: number;
  text: string; homeScoreAfter: number; awayScoreAfter: number;
}

export interface GameResult {
  regulationPeriods?: number; // preserve the rules used by this game for replay

  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeBox: TeamBoxScore;
  awayBox: TeamBoxScore;
  possessionLog: PossessionLogEntry[];
  /** Deflated + base64 copy of `possessionLog` for older games (then `possessionLog` is empty). Read via `gameLog()`. */
  packedLog?: string;
  /** Up to three standout plays, found when the game is simulated; feeds the news wire without unpacking logs. */
  topPlays?: TopPlay[];
  seed: number;
  injuries: { playerId: PlayerId; severity: string; quarter: number; recoveryGamesEstimate: number }[];
}

export function derivedStats(line: PlayerStatLine) {
  const fgPct = line.fga > 0 ? line.fgm / line.fga : 0;
  const tpPct = line.tpa > 0 ? line.tpm / line.tpa : 0;
  const ftPct = line.fta > 0 ? line.ftm / line.fta : 0;
  const tsAttempts = line.fga + 0.44 * line.fta;
  const tsPct = tsAttempts > 0 ? line.points / (2 * tsAttempts) : 0;
  const efgPct = line.fga > 0 ? (line.fgm + 0.5 * line.tpm) / line.fga : 0;
  return { fgPct, tpPct, ftPct, tsPct, efgPct };
}

/** Round once to seconds, then divide: never renders 12:60 or rounds 12:33 up to 13:33. */
export function formatPlayingTime(minutes: number): string {
  const seconds = Math.max(0, Math.round((Number.isFinite(minutes) ? minutes : 0) * 60));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
