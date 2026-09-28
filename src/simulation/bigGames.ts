import type { GameResult } from './boxscore';
import type { PlayoffBracket, PlayoffSeries } from './playoffs';
import { simulateNextPlayoffGame } from './playoffs';
import type { League } from './league';

/*
 * Big-game presentation: what's at stake in a playoff or Cup game ("Conference Finals · Game 7"), so the watch
 * view and the crowd can rise to the occasion, and a way to play the bracket up to your own team's next game.
 */

export type Stakes = 'game7' | 'final' | 'elimination' | 'playoff' | 'cup' | 'cupFinal';
export interface Occasion { eyebrow: string; title: string; subtitle: string; stakes: Stakes }

export function roundName(bracket: PlayoffBracket, round: number): string {
  const total = bracket.rounds.length;
  const conference = total === 4 && bracket.rounds[0].length === 8;
  const fromEnd = total - 1 - round;
  if (fromEnd === 0) return conference ? 'NBA Finals' : 'Finals';
  if (fromEnd === 1) return conference ? 'Conference Finals' : 'Semifinals';
  if (fromEnd === 2) return conference ? 'Conference Semifinals' : 'Quarterfinals';
  return conference ? 'First Round' : `Round ${round + 1}`;
}

/** The series a played game belongs to, and its game number. */
export function findSeriesGame(bracket: PlayoffBracket, game: GameResult): { series: PlayoffSeries; index: number } | null {
  for (const series of bracket.rounds.flat()) {
    const index = series.games.findIndex(g => g === game || (g.seed === game.seed && g.homeTeamId === game.homeTeamId && g.awayTeamId === game.awayTeamId));
    if (index >= 0) return { series, index };
  }
  return null;
}

/** Series score before game `index` (0-based), from team A's side. */
function scoreBefore(series: PlayoffSeries, index: number): [number, number] {
  let a = 0, b = 0;
  for (const g of series.games.slice(0, index)) {
    const winner = g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId;
    if (winner === series.teamAId) a++; else b++;
  }
  return [a, b];
}

export function playoffOccasion(bracket: PlayoffBracket, game: GameResult, name: (id: string | null) => string): Occasion | null {
  const found = findSeriesGame(bracket, game);
  if (!found) return null;
  const { series, index } = found;
  const [a, b] = scoreBefore(series, index);
  const need = series.gamesToWin;
  const round = roundName(bracket, series.round);
  const gameNo = index + 1;
  const decider = a === need - 1 && b === need - 1;
  const elimination = a === need - 1 || b === need - 1;
  const leader = a === b ? null : a > b ? series.teamAId : series.teamBId;
  const state = a === b ? (a === 0 ? 'Series opener' : `Series tied ${a}-${b}`) : `${name(leader)} lead ${Math.max(a, b)}-${Math.min(a, b)}`;
  const isFinals = series.round === bracket.rounds.length - 1;
  const stakes: Stakes = decider ? 'game7' : isFinals ? 'final' : elimination ? 'elimination' : 'playoff';
  return {
    eyebrow: `${round.toUpperCase()} · GAME ${gameNo}`,
    title: decider ? (need === 4 ? 'GAME 7' : `GAME ${gameNo}: WINNER TAKES ALL`) : isFinals && elimination ? 'FOR THE TITLE' : `${name(series.teamAId)} vs ${name(series.teamBId)}`,
    subtitle: decider ? `${name(series.teamAId)} vs ${name(series.teamBId)}. Win or go home.` : elimination ? `${state}. One more win ends it.` : state + '.',
    stakes,
  };
}

/**
 * Plays the bracket forward until your team's next game has been played (other series' games in between are
 * simulated as they come). Returns that game, or null if your team is out or the bracket is done.
 */
export function playToTeamGame(bracket: PlayoffBracket, league: League, teamId: string, seedBase = 1000): { bracket: PlayoffBracket; league: League; game: GameResult | null } {
  let b = bracket, l = league;
  for (let guard = 0; guard < 200 && !b.championTeamId; guard++) {
    const alive = b.rounds.flat().some(s => !s.winnerTeamId && (s.teamAId === teamId || s.teamBId === teamId))
      || (b.playIn ?? []).some(g => !g.winnerTeamId && (g.teamAId === teamId || g.teamBId === teamId));
    const mine = b.rounds.flat().filter(s => s.teamAId === teamId || s.teamBId === teamId);
    const eliminated = mine.some(s => s.winnerTeamId && s.winnerTeamId !== teamId)
      || (b.playIn ?? []).some(g => g.loserTeamId === teamId && (g.kind === 'final' || g.kind === '9v10'));
    // Won a series and waiting for the next round's matchup to be set.
    const waiting = !eliminated && mine.some(s => s.winnerTeamId === teamId);
    if (eliminated || (!alive && !waiting)) return { bracket: b, league: l, game: null };
    const before = new Map(b.rounds.flat().map(s => [s.id, s.games.length]));
    const beforePlayIn = new Set((b.playIn ?? []).filter(g => g.result).map(g => g.id));
    const step = simulateNextPlayoffGame(b, l, seedBase);
    if (step.bracket === b) return { bracket: b, league: l, game: null };
    b = step.bracket; l = step.league;
    const series = b.rounds.flat().find(s => s.games.length > (before.get(s.id) ?? 0) && (s.teamAId === teamId || s.teamBId === teamId));
    if (series) return { bracket: b, league: l, game: series.games[series.games.length - 1] };
    const playIn = (b.playIn ?? []).find(g => g.result && !beforePlayIn.has(g.id) && (g.teamAId === teamId || g.teamBId === teamId));
    if (playIn?.result) return { bracket: b, league: l, game: playIn.result };
  }
  return { bracket: b, league: l, game: null };
}
