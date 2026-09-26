import type { League } from './league';
import type { SeasonAwards, AwardWinner } from './awards';
import { simulateGame } from './engine/game';
import { defaultCoachTendencies } from './league';
import type { GameResult } from './boxscore';
import type { PlayerSeason } from './types';
import { previousSeasonsPlayed } from './rookieEligibility';

export interface AllStarSquad {
  name: string;
  playerIds: string[];
}

export interface AllStarGameResult {
  squadA: AllStarSquad;
  squadB: AllStarSquad;
  result: GameResult;
}

/** Snake-drafts the All-Star pool into two evenly-matched squads: 1-2-2-1-1-2-2-1... by descending score. */
function draftSquads(allStars: AwardWinner[]): [string[], string[]] {
  const sorted = [...allStars].sort((a, b) => b.score - a.score);
  const a: string[] = [];
  const b: string[] = [];
  sorted.forEach((w, i) => {
    const takeA = i % 4 === 0 || i % 4 === 3;
    (takeA ? a : b).push(w.playerId);
  });
  return [a, b];
}

/** An exhibition between two hand-picked squads: fast-paced, defense-optional, minutes shared out evenly. */
function playShowcase(league: League, seasonsA: PlayerSeason[], seasonsB: PlayerSeason[], seed: number): GameResult {
  const showcase = (roster: PlayerSeason[]) => roster.map((s, i) => ({ ...s, rotationRole: i < 5 ? 'starter' as const : 'bench' as const,
    minutes: { mode: 'TARGET' as const, target: league.settings.era.numberOfQuarters * league.settings.era.quarterLengthMinutes * 5 / roster.length } }));
  const allStarCoach = { ...defaultCoachTendencies(), paceTendency: 90, rotationDepth: Math.max(seasonsA.length, seasonsB.length), starUsage: 30, benchUsage: 80 }; // up-tempo, showcase-style pace
  return simulateGame({
    home: { teamId: 'ALLSTAR_A', seasons: showcase(seasonsA), coach: allStarCoach, chemistry: 60 },
    away: { teamId: 'ALLSTAR_B', seasons: showcase(seasonsB), coach: allStarCoach, chemistry: 60 },
    settings: { ...league.settings, seed, teamChemistryEnabled: false, injuriesEnabled: false },
    rules: league.rulesSettings,
  });
}

function findSeason(league: League, playerId: string): PlayerSeason | null {
  for (const t of league.teams) {
    const s = t.seasons.find((x) => x.playerId === playerId);
    if (s) return s;
  }
  return null;
}

/**
 * Simulates the All-Star Game as a real exhibition game: East vs. West when the All-Stars were picked by
 * conference, otherwise two squads snake-drafted from the pool. Uses a fast-paced, defense-optional
 * coaching profile (like the real event) rather than each player's actual team coach settings.
 */
export function simulateAllStarGame(league: League, awards: SeasonAwards, seed = Date.now()): AllStarGameResult | null {
  const selection = league.allStarWeekend?.season === (league.season ?? '') ? league.allStarWeekend.voting?.selected ?? awards.allStars : awards.allStars;
  if (selection.length < 10) return null;
  const byConference = selection.every((w) => w.conference);
  const [teamAIds, teamBIds] = byConference
    ? [selection.filter((w) => w.conference === 'east').map((w) => w.playerId), selection.filter((w) => w.conference === 'west').map((w) => w.playerId)]
    : draftSquads(selection);

  const seasonsA = teamAIds.map((id) => findSeason(league, id)).filter((s): s is PlayerSeason => s != null);
  const seasonsB = teamBIds.map((id) => findSeason(league, id)).filter((s): s is PlayerSeason => s != null);
  if (seasonsA.length < 5 || seasonsB.length < 5) return null;

  return {
    squadA: { name: byConference ? 'East' : 'Team ' + (seasonsA[0]?.playerId ?? 'A'), playerIds: teamAIds },
    squadB: { name: byConference ? 'West' : 'Team ' + (seasonsB[0]?.playerId ?? 'B'), playerIds: teamBIds },
    result: playShowcase(league, seasonsA, seasonsB, seed),
  };
}

/** First- and second-year players by production: the Rising Stars rosters. */
export function risingStarsRosters(league: League, perSquad = 8): { rookies: PlayerSeason[]; sophomores: PlayerSeason[] } {
  const all = league.teams.flatMap((t) => t.seasons).filter((s) => (s.seasonStats?.gamesPlayed ?? 0) > 0);
  const value = (s: PlayerSeason) => { const a = s.seasonStats!; const g = Math.max(1, a.gamesPlayed); return (a.points + (a.oreb + a.dreb) * 1.2 + a.ast * 1.5 + a.stl * 2 + a.blk * 2) / g; };
  const pick = (years: number) => all.filter((s) => previousSeasonsPlayed(s) === years).sort((a, b) => value(b) - value(a) || a.playerId.localeCompare(b.playerId)).slice(0, perSquad);
  return { rookies: pick(0), sophomores: pick(1) };
}

/** Exhibition results are kept for the box score only: no replay log in the save. */
export function withoutLog(game: AllStarGameResult | null): AllStarGameResult | null {
  return game ? { ...game, result: { ...game.result, possessionLog: [], packedLog: undefined } } : null;
}

/** The Rising Stars game: this season's rookies against last year's rookies. Null when either side can't field five. */
export function simulateRisingStars(league: League, seed = Date.now()): AllStarGameResult | null {
  const { rookies, sophomores } = risingStarsRosters(league);
  if (rookies.length < 5 || sophomores.length < 5) return null;
  return {
    squadA: { name: 'Rookies', playerIds: rookies.map((s) => s.playerId) },
    squadB: { name: 'Sophomores', playerIds: sophomores.map((s) => s.playerId) },
    result: playShowcase(league, rookies, sophomores, seed),
  };
}

export interface ThreePointContestResult {
  order: string[]; // entrants in the order they competed
  scores: Record<string, number>; // total points for their best rack (25 balls, last ball of each rack worth 2, like the real "money ball")
  winner: string;
}

/**
 * Simplified single-round 3-point contest: each entrant shoots one 25-ball rack (5 racks of 5,
 * the last ball of each rack worth 2 like the real "money ball"), scored from their actual
 * 3-point shooting rating with the same kind of random variance a real contest has. Highest
 * total wins; ties broken by a negligible deterministic-but-fair jitter.
 */
export function simulateThreePointContest(entrantSeasons: { playerId: string; threePoint: number }[], rng: () => number): ThreePointContestResult {
  const scores: Record<string, number> = {};
  for (const e of entrantSeasons) {
    let total = 0;
    for (let rack = 0; rack < 5; rack++) {
      for (let ball = 0; ball < 5; ball++) {
        const isMoneyBall = ball === 4;
        const makeChance = Math.max(0.15, Math.min(0.92, 0.25 + e.threePoint * 0.007));
        if (rng() < makeChance) total += isMoneyBall ? 2 : 1;
      }
    }
    scores[e.playerId] = total;
  }
  const order = entrantSeasons.map((e) => e.playerId);
  let winner = order[0];
  let best = -1;
  for (const id of order) {
    const s = scores[id] + rng() * 0.001;
    if (s > best) { best = s; winner = id; }
  }
  return { order, scores, winner };
}

export interface DunkContestResult {
  order: string[];
  scores: Record<string, number>; // best judged score out of 50 across two dunks
  winner: string;
}

/**
 * Simplified dunk contest: each entrant gets a judged score out of 50 for their best of two
 * dunks, built from vertical/agility/finishing (the closest things to "hops and body control" in
 * the attribute model) plus real showmanship variance, since dunk contests are famously judged on
 * flair as much as physical tools.
 */
export function simulateDunkContest(
  entrantSeasons: { playerId: string; vertical: number; agility: number; finishing: number }[],
  rng: () => number,
): DunkContestResult {
  const scores: Record<string, number> = {};
  for (const e of entrantSeasons) {
    const ability = (e.vertical * 0.4 + e.agility * 0.3 + e.finishing * 0.3) / 100;
    let best = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      const showmanship = rng() * 20;
      const score = Math.round(Math.min(50, Math.max(20, 25 + ability * 20 + showmanship - 10)));
      if (score > best) best = score;
    }
    scores[e.playerId] = best;
  }
  const order = entrantSeasons.map((e) => e.playerId);
  let winner = order[0];
  let best = -1;
  for (const id of order) {
    const s = scores[id] + rng() * 0.001;
    if (s > best) { best = s; winner = id; }
  }
  return { order, scores, winner };
}

/** Picks the All-Star Game MVP: best combined stat line among players on the winning squad (falls back to the whole game if somehow no one qualifies). */
export function computeAllStarGameMVP(gameResult: AllStarGameResult): AwardWinner | null {
  const winningSquad = gameResult.result.homeScore >= gameResult.result.awayScore ? gameResult.squadA : gameResult.squadB;
  const winningIds = new Set(winningSquad.playerIds);
  const allPlayers = { ...gameResult.result.homeBox.players, ...gameResult.result.awayBox.players };
  let best: AwardWinner | null = null;
  let bestScore = -Infinity;
  for (const [playerId, line] of Object.entries(allPlayers)) {
    if (!winningIds.has(playerId)) continue;
    const score = line.points * 1 + (line.oreb + line.dreb) * 0.7 + line.ast * 0.8 + line.stl * 1.2 + line.blk * 1.2;
    if (score > bestScore) { bestScore = score; best = { playerId, teamId: null, teamName: winningSquad.name, score }; }
  }
  return best;
}

/** Picks the top N candidates for a skills-contest field by a scoring function, across the whole league (not just All-Stars — real 3pt/dunk contests often include non-All-Stars). */
export function pickContestEntrants(
  league: League,
  count: number,
  score: (season: import('./types').PlayerSeason) => number,
): import('./types').PlayerSeason[] {
  const all = league.teams.flatMap((t) => t.seasons);
  return all
    .filter((s) => (s.seasonStats?.gamesPlayed ?? 0) > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, count);
}
