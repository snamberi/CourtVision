import { signingDecision } from './freeAgentDecision';
import { ensureUpcomingDraftClass } from './draftSeason';
import { rosterComplianceIssues } from './rosterRequirements';
import { manageCoachRosters } from './coachRosters';
import { lockAllStarVoting, currentAllStarWeekend } from './allStarVoting';
import type { League } from './league';
import { simulateRemainingSeason, isAllStarBreakPending } from './league';
import { simulateFullPlayoffs, autoGeneratePlayoffBracket } from './playoffs';
import { awardOptions as optionsFrom, computeFinalsMVP, computeSeasonAwards, type AwardSettings, type SeasonAwards } from './awards';
import {
  beginNewSeasonRoster, finalizeNewSeasonSchedule, type ChampionshipInfo,
} from './seasonTransition';
import {
  simulateAllStarGame, simulateRisingStars, withoutLog, computeAllStarGameMVP, simulateThreePointContest, simulateDunkContest, pickContestEntrants,
} from './allStarGame';
import { RNG } from './engine/rng';
import {
  type GMLeagueExtras, capSpaceRemaining, signFreeAgent, computeTradeValue, hasRosterRoom,
} from './gm';
import { runFreeAgencyAI, simEntireDraft, weakestPositions } from './aiGM';
import { primaryPosition } from './teamStatus';

export interface AutoPlaySeasonSummary {
  season: string;
  championTeamName: string | null;
  mvpPlayerId: string | null;
  allStarGameMVPPlayerId: string | null;
  threePointChampionId: string | null;
  dunkChampionId: string | null;
  controlledTeamDraftPicks: string[];
  controlledTeamSignings: string[];
}

/** Auto-completes the forced All-Star Weekend (3pt contest, dunk contest, the game itself) using the same simulation the manual page uses, so Auto Play doesn't get permanently stuck at the break. */
export function autoRunAllStarWeekend(league: League, awardSettings: AwardSettings, seed: number): {
  league: League;
  mvpPlayerId: string | null;
  threePointChampionId: string | null;
  dunkChampionId: string | null;
} {
  league = lockAllStarVoting(league, optionsFrom(awardSettings).allStarCount);
  const existing = currentAllStarWeekend(league);
  const awards = computeSeasonAwards(league, optionsFrom(awardSettings));

  const threeEntrants = pickContestEntrants(league, 8, (s) => s.attributes.offense.threePoint);
  const threeRng = new RNG(seed + 1);
  const threePoint = existing.threePoint ?? simulateThreePointContest(
    threeEntrants.map((s) => ({ playerId: s.playerId, threePoint: s.attributes.offense.threePoint })),
    () => threeRng.next(),
  );

  const dunkEntrants = pickContestEntrants(league, 8, (s) => s.attributes.physical.vertical * 0.4 + s.attributes.physical.agility * 0.3 + s.attributes.offense.finishing * 0.3);
  const dunkRng = new RNG(seed + 2);
  const dunk = existing.dunk ?? simulateDunkContest(
    dunkEntrants.map((s) => ({ playerId: s.playerId, vertical: s.attributes.physical.vertical, agility: s.attributes.physical.agility, finishing: s.attributes.offense.finishing })),
    () => dunkRng.next(),
  );

  const risingStars = existing.risingStars ?? withoutLog(simulateRisingStars(league, seed + 4));
  const risingStarsMvp = existing.risingStarsMvp ?? (risingStars ? computeAllStarGameMVP(risingStars) : null);
  const gameResult = existing.gameResult ?? simulateAllStarGame(league, awards, seed + 3);
  const mvp = gameResult ? computeAllStarGameMVP(gameResult) : null;

  return {
    league: {
      ...league,
      seasonPhase: 'regular_season',
      allStarWeekend: {
        ...existing, threePoint, dunk, gameSkipped: !gameResult,
        season: league.season ?? '',
        completed: true,
        gameResult: gameResult ?? undefined,
        mvp: mvp ?? undefined,
        threePointChampionId: threePoint.winner,
        dunkChampionId: dunk.winner,
        ...(risingStars ? { risingStars } : {}),
        ...(risingStarsMvp ? { risingStarsMvp } : {}),
      },
    },
    mvpPlayerId: mvp?.playerId ?? null,
    threePointChampionId: threePoint.winner,
    dunkChampionId: dunk.winner,
  };
}

/** Signs free agents for the CONTROLLED team specifically (runFreeAgencyAI deliberately skips it, since normally a human manages it) - same best-fit-by-need heuristic as the AI, so Auto Play doesn't leave your own roster half-empty. */
export function autoSignForControlledTeam(
  league: League, extras: GMLeagueExtras, controlledTeamId: string, targetRosterSize: number, seed: number,
): { league: League; extras: GMLeagueExtras; signings: string[] } {
  const rng = new RNG(seed);
  const ready = manageCoachRosters(league, extras);
  if ((ready.league.seasonPhase ?? 'regular_season') === 'regular_season' && rosterComplianceIssues(ready.league, ready.extras.capSettings).length) throw new Error('Regular-season rosters need available free agents or hard-cap room.');
  let currentLeague = ready.league;
  let currentExtras = ready.extras;
  const signings: string[] = [];

  for (let i = 0; i < 15; i++) {
    const team = currentLeague.teams.find((t) => t.teamId === controlledTeamId);
    if (!team || team.seasons.length >= targetRosterSize || !hasRosterRoom(team, currentExtras.capSettings)) break;
    if (currentExtras.freeAgents.length === 0) break;
    const space = capSpaceRemaining(currentExtras.contracts, team, currentExtras.capSettings);
    if (currentExtras.capSettings.enforceCapOnTrades && space <= 0) break;

    const need = weakestPositions(team);
    const ranked = [...currentExtras.freeAgents].sort((a, b) => {
      const scoreA = computeTradeValue(a) + (need.includes(primaryPosition(a)) ? 8 : 0);
      const scoreB = computeTradeValue(b) + (need.includes(primaryPosition(b)) ? 8 : 0);
      return scoreB - scoreA;
    });
    // Your team plays by the same rules as everyone else: the player has to accept and the deal has to fit.
    const years = 1 + rng.nextInt(3);
    let best: (typeof ranked)[number] | undefined, annualSalary = 0;
    for (const candidate of ranked) {
      const quote = signingDecision(currentLeague, currentExtras, candidate, controlledTeamId);
      if (quote.refuses) continue;
      const salary = Math.max(quote.required, Math.max(1_500_000, Math.min(Math.round(computeTradeValue(candidate) * 250_000), Math.max(2_000_000, space))));
      if (signingDecision(currentLeague, currentExtras, candidate, controlledTeamId, { annualSalary: salary, yearsRemaining: years }).accepted) { best = candidate; annualSalary = salary; break; }
    }
    if (!best) break;
    const { league: nextLeague, extras: nextExtras } = signFreeAgent(currentLeague, currentExtras, best.playerId, controlledTeamId, {
      annualSalary, yearsRemaining: years, playerOption: false, teamOption: false,
    });
    if (nextLeague === currentLeague && nextExtras === currentExtras) break; // signing didn't go through, stop rather than loop
    currentLeague = nextLeague;
    currentExtras = nextExtras;
    signings.push(best.playerId);
  }

  return { league: currentLeague, extras: currentExtras, signings };
}

/**
 * Plays out exactly one full season end-to-end: finishes the regular season (auto-completing the
 * forced All-Star Weekend along the way), simulates the playoffs to a champion, ages/retires
 * players and archives awards into franchise history, runs the entire draft (every team,
 * including yours, drafts best-player-available), then free agency (AI teams via the existing
 * logic, your team via a matching best-fit-by-need heuristic), and finally opens the next regular
 * season's schedule. This is the one building block Auto Play repeats N times.
 */
export function autoPlayOneSeason(
  league: League, extras: GMLeagueExtras, controlledTeamId: string | null, awardSettings: AwardSettings, seed: number,
): { league: League; extras: GMLeagueExtras; summary: AutoPlaySeasonSummary } {
  const weekend: AllStarOutcome = { allStarGameMVPPlayerId: null, threePointChampionId: null, dunkChampionId: null };
  let currentLeague = withoutDeadlineStop(league);
  // 1. Regular season, auto-completing the forced All-Star break as many times as it's hit (once, in practice).
  for (let guard = 0; guard < 5; guard++) {
    currentLeague = simulateRemainingSeason(currentLeague, seed);
    if (!isAllStarBreakPending(currentLeague)) break;
    currentLeague = playAllStarBreak(currentLeague, awardSettings, seed, guard, weekend);
  }
  return finishAutoSeason(currentLeague, extras, controlledTeamId, awardSettings, seed, weekend);
}

/**
 * The same season as `autoPlayOneSeason`, with each game day run by `simulateRound` (engine workers in parallel,
 * see simulateRoundPhased). Results are identical.
 */
export async function autoPlayOneSeasonAsync(
  league: League, extras: GMLeagueExtras, controlledTeamId: string | null, awardSettings: AwardSettings, seed: number,
  simulateRound: (league: League, seedBase: number) => Promise<League>,
): Promise<{ league: League; extras: GMLeagueExtras; summary: AutoPlaySeasonSummary }> {
  const weekend: AllStarOutcome = { allStarGameMVPPlayerId: null, threePointChampionId: null, dunkChampionId: null };
  let currentLeague = withoutDeadlineStop(league);
  for (let guard = 0; guard < 5; guard++) {
    while (currentLeague.schedule.some((g) => !g.played)) {
      const next = await simulateRound(currentLeague, seed);
      if (next === currentLeague) break; // blocked (All-Star break pending)
      currentLeague = next;
    }
    if (!isAllStarBreakPending(currentLeague)) break;
    currentLeague = playAllStarBreak(currentLeague, awardSettings, seed, guard, weekend);
  }
  return finishAutoSeason(currentLeague, extras, controlledTeamId, awardSettings, seed, weekend);
}

/** Auto Play doesn't stop for Trade Deadline Day: a day that hasn't finished is dropped and the deadline passes on the calendar. */
function withoutDeadlineStop(league: League): League {
  if (!league.deadlineDay || league.deadlineDay.status === 'closed') return league;
  const { deadlineDay: _skipped, ...rest } = league;
  return rest;
}

interface AllStarOutcome { allStarGameMVPPlayerId: string | null; threePointChampionId: string | null; dunkChampionId: string | null }
function playAllStarBreak(league: League, awardSettings: AwardSettings, seed: number, guard: number, into: AllStarOutcome): League {
  const asg = autoRunAllStarWeekend(league, awardSettings, seed + 90_000 + guard);
  into.allStarGameMVPPlayerId = asg.mvpPlayerId;
  into.threePointChampionId = asg.threePointChampionId;
  into.dunkChampionId = asg.dunkChampionId;
  return asg.league;
}

/** Everything after the regular season: playoffs, awards, rollover, draft, free agency and the new schedule. */
function finishAutoSeason(
  league: League, extras: GMLeagueExtras, controlledTeamId: string | null, awardSettings: AwardSettings, seed: number, weekend: AllStarOutcome,
): { league: League; extras: GMLeagueExtras; summary: AutoPlaySeasonSummary } {
  let currentLeague = league;
  let currentExtras = extras;
  const { allStarGameMVPPlayerId, threePointChampionId, dunkChampionId } = weekend;

  // 2. Playoffs.
  const bracket = autoGeneratePlayoffBracket(currentLeague);
  const playoffResult = simulateFullPlayoffs(bracket, currentLeague, seed + 1000);
  currentLeague = playoffResult.league;
  const finals = playoffResult.bracket.rounds[playoffResult.bracket.rounds.length - 1]?.[0];
  const fmvp = finals ? computeFinalsMVP(finals, currentLeague) : null;
  const championTeam = playoffResult.bracket.championTeamId
    ? currentLeague.teams.find((t) => t.teamId === playoffResult.bracket.championTeamId)
    : null;
  const championship: ChampionshipInfo = {
    teamId: playoffResult.bracket.championTeamId ?? null,
    teamName: championTeam?.name ?? null,
    fmvp,
  };

  // 3. Season transition: aging, retirements, awards archived to franchise history, fresh draft class.
  const roster = beginNewSeasonRoster(currentLeague, currentExtras, seed + 7777, optionsFrom(awardSettings), championship);
  const seasonAwards: SeasonAwards = roster.summary.seasonAwards;
  currentLeague = roster.league;
  currentExtras = roster.extras;
  // A fired GM no longer runs the team's draft and free agency.
  if (currentLeague.frontOffice && currentLeague.frontOffice.status !== 'employed') controlledTeamId = null;

  // 4. Draft - every team, including yours, drafts best-player-available.
  const draftResult = simEntireDraft(currentLeague, currentExtras);
  currentLeague = draftResult.league;
  currentExtras = draftResult.extras;
  const controlledTeamDraftPicks = controlledTeamId
    ? draftResult.picks.filter((p) => p.teamId === controlledTeamId).map((p) => p.playerId)
    : [];

  // 5. Free agency - AI teams via the existing logic, your team via a matching heuristic, for the full window.
  currentExtras = { ...currentExtras, freeAgencyOpen: true, freeAgencyDaysRemaining: currentLeague.settings.freeAgencyDurationDays ?? 30 };
  const controlledTeamSignings: string[] = [];
  const days = currentExtras.freeAgencyDaysRemaining ?? 30;
  for (let day = 0; day < days; day++) {
    const aiResult = runFreeAgencyAI(currentLeague, currentExtras, controlledTeamId, seed + 20_000 + day);
    currentLeague = aiResult.league;
    currentExtras = aiResult.extras;
    if (controlledTeamId) {
      const mine = autoSignForControlledTeam(currentLeague, currentExtras, controlledTeamId, 13, seed + 30_000 + day);
      currentLeague = mine.league;
      currentExtras = mine.extras;
      controlledTeamSignings.push(...mine.signings);
    }
  }
  currentExtras = { ...currentExtras, freeAgencyOpen: false, freeAgencyDaysRemaining: 0 };

  // 6. Preseason -> open the fresh regular-season schedule.
  currentLeague = finalizeNewSeasonSchedule({ ...currentLeague, seasonPhase: 'regular_season' });
  const prepared = manageCoachRosters(currentLeague, currentExtras);
  currentLeague = prepared.league;
  currentExtras = prepared.extras;
  // Next summer's class goes on the board for the new season.
  currentExtras = ensureUpcomingDraftClass(currentLeague, currentExtras);

  return {
    league: currentLeague,
    extras: currentExtras,
    summary: {
      season: roster.summary.previousSeason,
      championTeamName: championTeam?.name ?? null,
      mvpPlayerId: seasonAwards.mvp?.playerId ?? null,
      allStarGameMVPPlayerId,
      threePointChampionId,
      dunkChampionId,
      controlledTeamDraftPicks,
      controlledTeamSignings,
    },
  };
}
