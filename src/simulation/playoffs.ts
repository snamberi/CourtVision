import { prepareCoachingForGame, finishCoachingGame } from './playerDevelopment';
import { gameStaffCoach } from './staffManagement';
import { recordCoachResult, driftRelationships } from './coaching';
import type { League, InjuryRecord } from './league';
import { computeStandings, computeConferenceStandings, hasConferenceStructure, tickInjuriesForTeam } from './league';
import type { GameResult } from './boxscore';
import { simulateGame } from './engine/game';
import { applyGameResultToLeague } from './careerStats';
import { addDays, seasonStartDate, DAYS_PER_ROUND } from './calendar';

export interface PlayoffSeries {
  id: string;
  round: number;
  slot: number;
  teamAId: string | null;
  teamBId: string | null;
  teamAWins: number;
  teamBWins: number;
  gamesToWin: number;
  games: GameResult[];
  winnerTeamId: string | null;
}

export interface PlayoffBracket {
  rounds: PlayoffSeries[][];
  championTeamId: string | null;
  /** NBA-style play-in (seeds 7-10 of each conference). Absent on older brackets and small leagues. */
  playIn?: PlayInGame[];
  /** The title celebration has been shown for this bracket's champion. */
  celebrated?: boolean;
}
export type PlayInKind = '7v8' | '9v10' | 'final';
export interface PlayInGame {
  id: string; conference: 'east' | 'west'; kind: PlayInKind;
  teamAId: string | null; teamBId: string | null; // teamA is the higher seed and hosts
  result?: GameResult; winnerTeamId: string | null; loserTeamId: string | null;
  seedA?: number; seedB?: number;
}

/**
 * Seeds the top `size` teams by winPct into a standard single-elimination
 * bracket (1v8, 2v7, 3v6, 4v5 for size=8) and pre-builds empty placeholder
 * series for every later round so the bracket shape is visible up front.
 */
/** Picks a sensible forced bracket size from the current league's team count: 16 for a full-size league, scaling down for smaller sandboxes. */
export function pickPlayoffBracketSize(teamCount: number): 4 | 8 | 16 {
  if (teamCount >= 16) return 16;
  if (teamCount >= 8) return 8;
  return 4;
}

export function generatePlayoffBracket(league: League, size: 4 | 8 | 16 = 8, gamesToWin = 4): PlayoffBracket {
  const standings = computeStandings(league);
  const seeds = standings.slice(0, size).map((r) => r.teamId);

  const firstRound: PlayoffSeries[] = [];
  for (let i = 0; i < size / 2; i++) {
    firstRound.push({
      id: `r0-s${i}`, round: 0, slot: i,
      teamAId: seeds[i], teamBId: seeds[size - 1 - i],
      teamAWins: 0, teamBWins: 0, gamesToWin, games: [], winnerTeamId: null,
    });
  }

  const rounds: PlayoffSeries[][] = [firstRound];
  let roundSize = size / 2;
  let roundIdx = 1;
  while (roundSize > 1) {
    roundSize = roundSize / 2;
    const round: PlayoffSeries[] = [];
    for (let i = 0; i < roundSize; i++) {
      round.push({
        id: `r${roundIdx}-s${i}`, round: roundIdx, slot: i,
        teamAId: null, teamBId: null,
        teamAWins: 0, teamBWins: 0, gamesToWin, games: [], winnerTeamId: null,
      });
    }
    rounds.push(round);
    roundIdx++;
  }

  return { rounds, championTeamId: null };
}


/**
 * Builds a real conference-structured bracket: East's top 8 seeds play out an independent East bracket,
 * West's top 8 play out an independent West bracket, and the two conference champions meet in the Finals —
 * exactly like the real playoffs, rather than one flat 16-team pool. Falls back to the flat bracket if the
 * league doesn't have conference data yet (e.g. an older save, or a small sandbox league).
 */
export function generateConferencePlayoffBracket(league: League, gamesToWin = 4): PlayoffBracket {
  if (!hasConferenceStructure(league)) return generatePlayoffBracket(league, pickPlayoffBracketSize(league.teams.length), gamesToWin);

  const { east, west } = computeConferenceStandings(league);
  if (east.length < 8 || west.length < 8) return generatePlayoffBracket(league, pickPlayoffBracketSize(league.teams.length), gamesToWin);

  const makeSeries = (round: number, slot: number, teamAId: string | null, teamBId: string | null): PlayoffSeries => ({
    id: `r${round}-s${slot}`, round, slot, teamAId, teamBId, teamAWins: 0, teamBWins: 0, gamesToWin, games: [], winnerTeamId: null,
  });
  // With 10+ teams per conference, seeds 7-10 earn the last two spots in a play-in; otherwise the top 8 go straight in.
  const withPlayIn = east.length >= 10 && west.length >= 10;
  const seeds = (rows: typeof east) => rows.slice(0, 10).map((r) => r.teamId);
  const eastSeeds = seeds(east), westSeeds = seeds(west);
  // Round 0 in NBA bracket order per conference: 1v8, 4v5 (top half) then 3v6, 2v7 (bottom half), so the
  // winners of 1v8 and 4v5 meet in the semifinals, as do 3v6 and 2v7. East fills slots 0-3, West 4-7.
  const pairs = (s: string[]): [string, string | null][] => [[s[0], withPlayIn ? null : s[7]], [s[3], s[4]], [s[2], s[5]], [s[1], withPlayIn ? null : s[6]]];
  const round0 = [
    ...pairs(eastSeeds).map(([a, b], i) => makeSeries(0, i, a, b)),
    ...pairs(westSeeds).map(([a, b], i) => makeSeries(0, 4 + i, a, b)),
  ];
  const round1 = [0, 1, 2, 3].map((slot) => makeSeries(1, slot, null, null)); // conference semifinals
  const round2 = [0, 1].map((slot) => makeSeries(2, slot, null, null)); // conference finals (slot 0 = East, slot 1 = West)
  const round3 = [makeSeries(3, 0, null, null)]; // Finals
  const playIn: PlayInGame[] | undefined = withPlayIn ? (['east', 'west'] as const).flatMap(conference => {
    const s = conference === 'east' ? eastSeeds : westSeeds, c = conference[0].toUpperCase();
    return [
      { id: `pi-${c}-78`, conference, kind: '7v8' as const, teamAId: s[6], teamBId: s[7], seedA: 7, seedB: 8, winnerTeamId: null, loserTeamId: null },
      { id: `pi-${c}-910`, conference, kind: '9v10' as const, teamAId: s[8], teamBId: s[9], seedA: 9, seedB: 10, winnerTeamId: null, loserTeamId: null },
      { id: `pi-${c}-final`, conference, kind: 'final' as const, teamAId: null, teamBId: null, winnerTeamId: null, loserTeamId: null },
    ];
  }) : undefined;
  return { rounds: [round0, round1, round2, round3], championTeamId: null, ...(playIn ? { playIn } : {}) };
}

/** Always call this to start the playoffs — picks the conference-structured bracket when possible, falling
 * back gracefully for leagues without conference data. This is the only entry point the app should use;
 * there is no user-facing bracket-size choice, the postseason always seeds from the real standings. */
export function autoGeneratePlayoffBracket(league: League, gamesToWin = 4): PlayoffBracket {
  return generateConferencePlayoffBracket(league, gamesToWin);
}

function findNextSeries(bracket: PlayoffBracket): PlayoffSeries | null {
  for (const round of bracket.rounds) {
    for (const series of round) {
      if (series.winnerTeamId) continue;
      if (series.teamAId == null || series.teamBId == null) continue;
      return series;
    }
  }
  return null;
}

export interface PlayoffGameStepResult {
  bracket: PlayoffBracket;
  league: League;
}

/**
 * Simulates exactly one game in whichever series is next up, updates the series, and advances the bracket if it just finished.
 * Injuries now tick down here exactly like the regular season: a player hurt during Round 1 can heal partway through Round 2
 * instead of being frozen "out" for the rest of the postseason. Because playoff series only involve the two teams playing,
 * the countdown only ticks for teamA/teamB's injuries — everyone else's stays exactly where it was.
 */
/** Plays one postseason game between two teams and applies everything it changes (injuries, stats, coaching, calendar). */
function playPostseasonGame(league: League, teamAId: string, teamBId: string, teamAHosts: boolean, seed: number): { result: GameResult; league: League; aWon: boolean } {
  league = prepareCoachingForGame(league, [teamAId, teamBId], addDays(league.calendarDate ?? seasonStartDate(league.season), DAYS_PER_ROUND));
  const teamA = league.teams.find((t) => t.teamId === teamAId)!;
  const teamB = league.teams.find((t) => t.teamId === teamBId)!;
  const injuries = league.injuries ?? {};
  const isOut = (playerId: string) => (injuries[playerId]?.gamesRemaining ?? 0) > 0;
  const availableA = teamA.seasons.filter((s) => !isOut(s.playerId));
  const availableB = teamB.seasons.filter((s) => !isOut(s.playerId));
  const seasonsA = availableA.length >= 5 ? availableA : teamA.seasons;
  const seasonsB = availableB.length >= 5 ? availableB : teamB.seasons;
  const side = (t: typeof teamA, seasons: typeof seasonsA) => ({ teamId: t.teamId, seasons, coach: t.coach, chemistry: t.chemistry, coachIdentity: gameStaffCoach(t), rotationOrder: t.rotationOrder });
  const result = simulateGame({
    home: teamAHosts ? side(teamA, seasonsA) : side(teamB, seasonsB),
    away: teamAHosts ? side(teamB, seasonsB) : side(teamA, seasonsA),
    settings: { ...league.settings, seed },
    isPlayoffs: true,
    rules: league.rulesSettings, moraleImpact: league.coachingSettings?.moraleImpact,
  });
  const aWon = teamAHosts ? result.homeScore > result.awayScore : result.awayScore > result.homeScore;

  let nextInjuries = tickInjuriesForTeam(injuries, teamA.teamId);
  nextInjuries = tickInjuriesForTeam(nextInjuries, teamB.teamId);
  const homeIds = new Set(seasonsA.map((s) => s.playerId));
  for (const inj of result.injuries) {
    const teamId = homeIds.has(inj.playerId) ? teamA.teamId : teamB.teamId;
    nextInjuries[inj.playerId] = {
      playerId: inj.playerId, teamId, severity: inj.severity as InjuryRecord['severity'],
      gamesRemaining: inj.recoveryGamesEstimate, totalGames: inj.recoveryGamesEstimate,
    };
  }
  const calendarDate = addDays(league.calendarDate ?? seasonStartDate(league.season), DAYS_PER_ROUND);
  const teams = league.teams.map(t => {
    const box = t.teamId === result.homeTeamId ? result.homeBox : t.teamId === result.awayTeamId ? result.awayBox : null;
    if (!box) return t;
    const won = t.teamId === result.homeTeamId ? result.homeScore > result.awayScore : result.awayScore > result.homeScore;
    const minutes = Object.fromEntries(Object.entries(box.players).map(([id, line]) => [id, line.minutes]));
    return { ...t, coachIdentity: driftRelationships(recordCoachResult(t.coachIdentity, won), t.seasons, won, minutes) };
  });
  const nextLeague = finishCoachingGame(applyGameResultToLeague({ ...league, teams, injuries: nextInjuries, calendarDate }, result, { playoffs: true }), result, true);
  return { result, league: nextLeague, aWon };
}

/** The next play-in game that can be played, if any. */
export function nextPlayInGame(bracket: PlayoffBracket): PlayInGame | null {
  return bracket.playIn?.find(g => !g.winnerTeamId && g.teamAId && g.teamBId) ?? null;
}
export const playInPending = (bracket: PlayoffBracket) => !!bracket.playIn?.some(g => !g.winnerTeamId);

/** Plays one play-in game and feeds its result forward: 7v8 winner is the 7 seed, the final's winner is the 8 seed. */
function simulatePlayInGame(bracket: PlayoffBracket, league: League, game: PlayInGame, seedBase: number): PlayoffGameStepResult {
  const index = bracket.playIn!.indexOf(game);
  const played = playPostseasonGame(league, game.teamAId!, game.teamBId!, true, seedBase + 700 + index);
  const winner = played.aWon ? game.teamAId! : game.teamBId!, loser = played.aWon ? game.teamBId! : game.teamAId!;
  const c = game.conference[0].toUpperCase();
  let playIn = bracket.playIn!.map(g => g.id === game.id ? { ...g, result: played.result, winnerTeamId: winner, loserTeamId: loser } : g);
  let rounds = bracket.rounds;
  const base = game.conference === 'east' ? 0 : 4;
  const setSeed = (slot: number, teamId: string) => { rounds = rounds.map((round, ri) => ri === 0 ? round.map(sr => sr.slot === slot ? { ...sr, teamBId: teamId } : sr) : round); };
  if (game.kind === '7v8') {
    setSeed(base + 3, winner); // 2 vs 7
    playIn = playIn.map(g => g.id === `pi-${c}-final` ? { ...g, teamAId: loser, seedA: 8 } : g);
  } else if (game.kind === '9v10') {
    playIn = playIn.map(g => g.id === `pi-${c}-final` ? { ...g, teamBId: winner, seedB: game.seedA === undefined ? 9 : (played.aWon ? game.seedA : game.seedB) } : g);
  } else {
    setSeed(base, winner); // 1 vs 8
  }
  const updated: PlayoffBracket = { ...bracket, rounds, playIn };
  return { bracket: updated, league: { ...played.league, playoffBracket: updated } };
}

export function simulateNextPlayoffGame(bracket: PlayoffBracket, league: League, seedBase = 1000): PlayoffGameStepResult {
  const playIn = nextPlayInGame(bracket);
  if (playIn) return simulatePlayInGame(bracket, league, playIn, seedBase);
  const next = findNextSeries(bracket);
  if (!next) return { bracket, league };

  const gameIndex = next.teamAWins + next.teamBWins;
  const teamAHosts = [0, 1, 4, 6].includes(gameIndex);
  const played = playPostseasonGame(league, next.teamAId!, next.teamBId!, teamAHosts, seedBase + gameIndex);
  const result = played.result, aWonThisGame = played.aWon;

  const updatedSeries: PlayoffSeries = {
    ...next,
    games: [...next.games, result],
    teamAWins: next.teamAWins + (aWonThisGame ? 1 : 0),
    teamBWins: next.teamBWins + (aWonThisGame ? 0 : 1),
  };
  if (updatedSeries.teamAWins >= updatedSeries.gamesToWin) updatedSeries.winnerTeamId = updatedSeries.teamAId;
  else if (updatedSeries.teamBWins >= updatedSeries.gamesToWin) updatedSeries.winnerTeamId = updatedSeries.teamBId;

  const rounds = bracket.rounds.map((round) => round.map((s) => (s.id === updatedSeries.id ? updatedSeries : s)));

  if (updatedSeries.winnerTeamId && updatedSeries.round + 1 < rounds.length) {
    const nextRound = rounds[updatedSeries.round + 1];
    const nextSlotIndex = Math.floor(updatedSeries.slot / 2);
    const nextSeries = { ...nextRound[nextSlotIndex] };
    if (updatedSeries.slot % 2 === 0) nextSeries.teamAId = updatedSeries.winnerTeamId;
    else nextSeries.teamBId = updatedSeries.winnerTeamId;
    rounds[updatedSeries.round + 1] = nextRound.map((s, i) => (i === nextSlotIndex ? nextSeries : s));
  }

  const finalRound = rounds[rounds.length - 1];
  const championTeamId = finalRound.length === 1 ? finalRound[0].winnerTeamId : null;
  const updatedBracket: PlayoffBracket = { ...bracket, rounds, championTeamId };
  return { bracket: updatedBracket, league: { ...played.league, playoffBracket: updatedBracket } };
}

/** Simulates the entire bracket to completion — synchronous, use a worker for large brackets in the UI. */
export function simulateFullPlayoffs(bracket: PlayoffBracket, league: League, seedBase = 1000): PlayoffGameStepResult {
  let currentBracket = bracket;
  let currentLeague = league;
  while (!currentBracket.championTeamId) {
    const before = currentBracket;
    const step = simulateNextPlayoffGame(currentBracket, currentLeague, seedBase);
    currentBracket = step.bracket;
    currentLeague = step.league;
    if (currentBracket === before) break;
  }
  return { bracket: currentBracket, league: currentLeague };
}

/** Simulates every remaining game in the current round only, then stops (used for "play one round at a time"). */
export function simulateCurrentPlayoffRound(bracket: PlayoffBracket, league: League, seedBase = 1000): PlayoffGameStepResult {
  let currentBracket = bracket;
  let currentLeague = league;
  if (playInPending(currentBracket)) {
    while (nextPlayInGame(currentBracket)) {
      const step = simulateNextPlayoffGame(currentBracket, currentLeague, seedBase);
      if (step.bracket === currentBracket) break;
      currentBracket = step.bracket; currentLeague = step.league;
    }
    return { bracket: currentBracket, league: currentLeague };
  }
  const startingRound = findNextSeries(currentBracket)?.round;
  if (startingRound == null) return { bracket: currentBracket, league: currentLeague };

  while (true) {
    const next = findNextSeries(currentBracket);
    if (!next || next.round !== startingRound) break;
    const step = simulateNextPlayoffGame(currentBracket, currentLeague, seedBase);
    if (step.bracket === currentBracket) break;
    currentBracket = step.bracket;
    currentLeague = step.league;
  }
  return { bracket: currentBracket, league: currentLeague };
}
