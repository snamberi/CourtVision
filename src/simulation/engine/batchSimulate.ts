import type { TeamInput } from './game';
import { simulateGame } from './game';
import type { GameSettings } from '../types';
import type { LeagueRulesSettings } from '../leagueRules';
import { derivedStats } from '../boxscore';
import { computeOnOffSplit, mergeOnOffSplits, type OnOffSplit } from './onOff';

export interface BatchSimulationRequest {
  home: TeamInput;
  away: TeamInput;
  settings: GameSettings;
  games: number;
  focusPlayerId: string;
  seedBase?: number;
  rules?: LeagueRulesSettings;
}

export interface BatchSimulationResult {
  games: number;
  ppg: number; rpg: number; apg: number; spg: number; bpg: number;
  fgPct: number; tpPct: number; tpa: number; tov: number; tsPct: number;
  teamWinPct: number;
  onOff: OnOffSplit;
}

/**
 * Runs `request.games` full simulated games and aggregates averages for
 * `focusPlayerId`. Synchronous and side-effect-free — safe to call either
 * directly (small batches on the main thread) or from inside a Web Worker
 * (large batches, so the UI thread never blocks). `onProgress` is called
 * periodically with a 0-100 percentage if provided.
 */
export function runBatchSimulation(
  request: BatchSimulationRequest,
  onProgress?: (pct: number) => void,
): BatchSimulationResult {
  const { home, away, settings, games, focusPlayerId } = request;
  const seedBase = request.seedBase ?? 1;

  let pts = 0, reb = 0, ast = 0, stl = 0, blk = 0, fgm = 0, fga = 0, tpm = 0, tpa = 0, tov = 0, ts = 0, wins = 0;
  const onOffSplits: OnOffSplit[] = [];
  const focusOnHome = home.seasons.some((s) => s.playerId === focusPlayerId);

  const progressEvery = Math.max(1, Math.floor(games / 50));

  for (let i = 0; i < games; i++) {
    const game = simulateGame({ home, away, settings: { ...settings, seed: seedBase + i }, rules: request.rules });
    const line = game.homeBox.players[focusPlayerId] ?? game.awayBox.players[focusPlayerId];
    if (line) {
      pts += line.points;
      reb += line.oreb + line.dreb;
      ast += line.ast;
      stl += line.stl;
      blk += line.blk;
      fgm += line.fgm; fga += line.fga;
      tpm += line.tpm; tpa += line.tpa;
      tov += line.tov;
      ts += derivedStats(line).tsPct;
    }
    const focusTeamWon = focusOnHome ? game.homeScore > game.awayScore : game.awayScore > game.homeScore;
    if (focusTeamWon) wins++;

    onOffSplits.push(computeOnOffSplit(game.possessionLog, focusOnHome ? 'home' : 'away', focusPlayerId));

    if (onProgress && i % progressEvery === 0) onProgress(Math.round((i / games) * 100));
  }

  if (onProgress) onProgress(100);

  return {
    games,
    ppg: pts / games, rpg: reb / games, apg: ast / games, spg: stl / games, bpg: blk / games,
    fgPct: fga > 0 ? fgm / fga : 0, tpPct: tpa > 0 ? tpm / tpa : 0, tpa: tpa / games,
    tov: tov / games, tsPct: ts / games, teamWinPct: wins / games,
    onOff: mergeOnOffSplits(onOffSplits),
  };
}
