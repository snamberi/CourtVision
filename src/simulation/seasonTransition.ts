import { rollBusinessSeason } from './business';
import { enforceSticky, isStuck } from './sticky';
import { lotteryResult, consensusBoard } from './draftNight';
import { extensionTakesOver, markContractYears } from './extensions';
import { archiveRivalries } from './rivalry';
import { setupCup, cupArchive } from './cup';
import { reviewSeason, ensureSeasonGoals, type OwnerReview } from './frontOffice';
import { compactBracket, conferenceSeeds } from './almanac';
import { primaryPosition } from './teamStatus';
import { seasonAdvancedWithStints, regularSeasonContext, type PlayerAdvanced, type SeasonContext } from './advancedStats';
import { seasonStintsFor } from './stints';
import type { PlayoffFinish, TeamSeasonRosterLine, TeamSeasonSummary } from './league';
import { initializeCoaching, teachingQuality, advanceStaffSeason } from './staffManagement';
import { recordOffseasonDevelopment, offseasonTrainingCamp } from './playerDevelopment';
import { applySummerCamp, reportRow, type CampReportRow } from './summerCamp';
import { calculateOverall as staffOverall } from './engine/overall';
import { generateNewsFeed } from './news';
import { coachPerformanceModifiers } from './coaching';
import { expenseEffects } from './league';
import type { CareerSeasonRecord, PlayerSeason, SeasonStatTotals, SeasonStint } from './types';
import { emptySeasonStatTotals, emptySeasonMilestones } from './types';
import type { League, LeagueTeam, RetiredPlayerRecord, FranchiseHistoryRecord } from './league';
import { generateSeasonSchedule, totalGamesForTeam } from './league';
import { seasonStartDate } from './calendar';
import { driftChemistryForRosterContinuity } from './engine/chemistryEvolution';
import { RNG } from './engine/rng';
import { calculateOverall, calculateFullAttributeOverall } from './engine/overall';
import { developOffseasonPlayer } from './engine/development';
import {
  generateDraftClass, buildTwoRoundDraftOrder, pickDraftClassSize, resolveTradedPicksIntoOrder,
  rollFutureDraftPicksForward, FUTURE_PICK_WINDOW_YEARS, priorTeamId, type GMLeagueExtras, type Contract,
} from './gm';
import { appendHistoryEvent } from './playerHistory';
import { resignVerdict } from './freeAgentDecision';
import { retireLegendJerseys } from './jerseyRetirement';
import { offseasonCarousel } from './coachingCarousel';
import { settleStaffOffers } from './staffPoaching';
import { collectPlayerIds } from './playerIds';
import { computeSeasonAwards, type SeasonAwards, type SeasonAwardsOptions, type AwardWinner } from './awards';
import type { LeagueRulesSettings } from './leagueRules';
import { realDevelopmentOn } from './realDevelopmentGate';
import { applyRealDevelopment, markRealFallback, realCareerContinues, realDevelopmentNote } from '../history/realDevelopment';
import { historicalDraftClass, historicalDebuts } from '../history/realRollover';

export interface ChampionshipInfo {
  teamId: string | null;
  teamName: string | null;
  fmvp: AwardWinner | null;
}

/**
 * Advances a season label forward one year. Handles the common "YYYY-YY"
 * format (e.g. "2026-27" -> "2027-28") used throughout this project, a plain
 * 4-digit year ("2026" -> "2027"), and falls back to appending "-next" for
 * anything unrecognized so the pipeline never throws on odd/legacy labels.
 */
export function nextSeasonLabel(label: string | undefined): string {
  if (!label) return '2025';
  const rangeMatch = label.match(/^(\d{4})-(\d{2})$/);
  if (rangeMatch) {
    const startYear = parseInt(rangeMatch[1], 10) + 1;
    const endSuffix = (startYear + 1) % 100;
    return `${startYear}-${endSuffix.toString().padStart(2, '0')}`;
  }
  const yearMatch = label.match(/^(\d{4})$/);
  if (yearMatch) return `${parseInt(yearMatch[1], 10) + 1}`;
  return `${label}-next`;
}

/** Retirement odds increase sharply past a player's peak age, moderated by how good they still are. Tunable via League Settings' retirementAgeShiftYears/earlyRetirementChance/forcedRetirementChance. */
/**
 * Carries unsigned free agents into the new season exactly like rostered players: whatever they played is archived to
 * their career, current totals reset, they age and develop (no team, so no facilities or coaching boost), and they can
 * retire. Fringe players who can't find a team for a while leave the league so the pool doesn't grow forever.
 * Idempotent: a player already labelled with the new season is left alone. Uses its own random stream so the rest of
 * the rollover stays seeded exactly as before.
 */
export function rollFreeAgentsForward(league: League, freeAgents: PlayerSeason[], previousSeason: string, newSeason: string, seed: number,
  advanced: Map<string, PlayerAdvanced> = new Map(), stintSplits: Map<string, SeasonStint[]> = new Map()): { freeAgents: PlayerSeason[]; retired: RetiredPlayerRecord[] } {
  const rng = new RNG(seed + 7_331);
  const out: PlayerSeason[] = [], retired: RetiredPlayerRecord[] = [];
  const teamName = (id: string | null) => (id && league.teams.find(t => t.teamId === id)?.name) || 'Free agent';
  for (const fa of freeAgents) {
    if (fa.season === newSeason) { out.push(fa); continue; }
    const lastTeam = fa.seasonStints?.at(-1)?.teamId ?? priorTeamId(fa);
    const stats = fa.seasonStats;
    const played = !!stats && (stats.gamesPlayed > 0 || (fa.playoffStats?.gamesPlayed ?? 0) > 0);
    const archived: CareerSeasonRecord | null = played ? {
      season: fa.season, teamId: lastTeam, age: fa.age, overall: calculateOverall(fa), // his own season label (older saves could be a year behind)
      stats: stats ?? emptySeasonStatTotals(), milestones: fa.seasonMilestones ?? emptySeasonMilestones(),
      ...(fa.playoffStats ? { playoffStats: fa.playoffStats } : {}),
      ...(advanced.get(fa.playerId) ? { advanced: advanced.get(fa.playerId) } : {}),
      ...(stintSplits.get(fa.playerId) ? { stints: stintSplits.get(fa.playerId) } : {}),
    } : null;
    // Real Player Development: a real player follows his reference trajectory; everyone else (and real players past
    // their trajectory) develops through Court Vision.
    const realStep = realDevelopmentOn(league) && fa.real ? applyRealDevelopment(fa, newSeason) : null;
    let developed = realStep ?? developOffseasonPlayer(fa, rng, league.rulesSettings, 0.9, 'balanced', league.settings.sandboxMode ? 200 : 100);
    if (!realStep && realDevelopmentOn(league) && fa.real) developed = markRealFallback(developed, newSeason);
    const next: PlayerSeason = { ...developed, season: newSeason, seasonStats: undefined, seasonMilestones: undefined, playoffStats: undefined, seasonStints: undefined,
      careerHistory: archived ? [...(fa.careerHistory ?? []), archived] : fa.careerHistory };
    const overall = calculateOverall(next);
    // A real player who really played this season stays in the league while his trajectory continues.
    if (realStep && realCareerContinues(fa, newSeason)) { out.push(next); continue; }
    const leavesLeague = next.age >= 24 && (overall < 45 ? rng.chance(0.5) : overall < 52 ? rng.chance(0.2) : false);
    if (!isStuck(next) && !next.careerPlayer && (shouldRetire(next, rng, league.rulesSettings) || leavesLeague)) {
      retired.push({ playerId: next.playerId, finalTeamId: lastTeam ?? '', finalTeamName: teamName(lastTeam), finalSeason: previousSeason,
        finalAge: next.age, finalOverall: overall, finalSeasonData: next });
      continue;
    }
    out.push(next);
  }
  return { freeAgents: out, retired };
}

function shouldRetire(next: PlayerSeason, rng: RNG, rules?: LeagueRulesSettings): boolean {
  const forcedAge = 41 + (rules?.retirementAgeShiftYears ?? 0);
  if (next.age >= forcedAge) return true;
  const rampStartAge = 34 + (rules?.retirementAgeShiftYears ?? 0);
  if (next.age < rampStartAge) return false;
  const overall = calculateOverall(next);
  const yearsPastRampStart = next.age - rampStartAge;
  const baseChance = 0.06 * yearsPastRampStart * yearsPastRampStart;
  const abilityRelief = Math.max(0, overall - 55) * 0.01;
  const earlyRetirementBonus = (rules?.earlyRetirementChance ?? 0) / 100;
  const forcedRetirementBonus = (rules?.forcedRetirementChance ?? 0) / 100;
  const chance = Math.max(0, Math.min(0.97, baseChance - abilityRelief + earlyRetirementBonus + forcedRetirementBonus));
  return rng.chance(chance);
}

/**
 * An AI team re-signs an expiring player it builds around: one of its best five, or anyone 70+, while he is still
 * worth a long look (not old and fading). The player has to be willing (unhappy players and grudges refuse, see
 * resignVerdict) and gets his asking price; the hard cap still applies. Stars stay far more often than role players.
 */
function aiResign(team: LeagueTeam, player: PlayerSeason, rank: number, extras: GMLeagueExtras, contracts: Record<string, Contract>, rng: RNG): Contract | null {
  const overall = calculateOverall(player);
  const core = rank < 5 || overall >= 70;
  if (!core || (player.age >= 34 && overall < 72) || player.age >= 37) return null;
  const verdict = resignVerdict(extras, player, team.teamId);
  if (verdict.refuses) return null;
  const chance = (rank < 2 || overall >= 75 ? 0.9 : rank < 5 ? 0.7 : 0.6) * (0.55 + verdict.interest / 160);
  if (rng.next() >= chance) return null;
  const payroll = team.seasons.reduce((n, s) => n + (s.playerId === player.playerId ? 0 : contracts[s.playerId]?.annualSalary ?? 0), 0);
  if (extras.capSettings.hardCapEnabled && payroll + verdict.required > extras.capSettings.salaryCap) return null;
  const years = Math.max(1, Math.min(5, (player.age <= 26 ? 4 : player.age <= 29 ? 3 : player.age <= 32 ? 2 : 1) + (rng.next() < 0.3 ? 1 : 0)));
  return { playerId: player.playerId, teamId: team.teamId, annualSalary: verdict.required, yearsRemaining: years, playerOption: false, teamOption: false };
}

/**
 * Decides what happens to a contract that just hit 0 years remaining:
 *  - a team option is exercised (1-year extension at the same salary) unless the
 *    player has become poor value (low overall, or old and mediocre) - in which
 *    case the team declines and the player hits free agency.
 *  - a player option is declined (player opts out to test free agency) if
 *    they're still good and young enough to expect a better deal elsewhere;
 *    otherwise they opt in and stay for one more year.
 *  - a plain expiring contract (no options) always tests free agency, as before.
 * Options are single-use: once resolved, the resulting 1-year extension carries no option.
 */
function resolveExpiringContract(contract: Contract, overall: number, age: number): { retained: boolean; extended?: Contract } {
  if (contract.teamOption) {
    const teamDeclines = overall < 50 || (age >= 33 && overall < 65);
    if (teamDeclines) return { retained: false };
    return { retained: true, extended: { ...contract, yearsRemaining: 1, teamOption: false } };
  }
  if (contract.playerOption) {
    const playerOptsOut = overall >= 70 && age <= 29;
    if (playerOptsOut) return { retained: false };
    return { retained: true, extended: { ...contract, yearsRemaining: 1, playerOption: false } };
  }
  return { retained: false };
}

export interface SeasonTransitionSummary {
  previousSeason: string;
  newSeason: string;
  retiredPlayerIds: string[];
  expiredToFreeAgencyIds: string[];
  retainedViaOptionIds: string[];
  newDraftClassSize: number;
  seasonAwards: SeasonAwards;
  totalPlayersAged: number;
  pickProtectionsTriggered: { originalTeamId: string; round: 1 | 2 }[];
  /** The owner's end-of-season review of your front office, and achievements it unlocked. */
  ownerReview?: OwnerReview | null;
  newAchievements?: string[];
}

export interface SeasonTransitionResult {
  league: League;
  extras: GMLeagueExtras;
  summary: SeasonTransitionSummary;
}

/**
 * The roster-side half of the offseason: archives every player's finished
 * seasonStats into `careerHistory` (never overwritten), ages/develops every
 * player one year, retires players who roll badly against age-scaled odds,
 * and resolves every expiring contract's options. Leaves the schedule alone
 * and does NOT reopen free agency - this is the step used right after the
 * season/playoffs recap, before the draft, in the guided season-flow UI.
 * Sets `seasonPhase: 'draft'` and opens the draft window.
 */
export function beginNewSeasonRoster(
  league: League,
  extras: GMLeagueExtras,
  seed = Date.now(),
  awardOptions: SeasonAwardsOptions = {},
  championship: ChampionshipInfo | null = null,
): SeasonTransitionResult {
  league = initializeCoaching(league);
  const rng = new RNG(seed);
  const previousSeason = league.season ?? league.teams[0]?.seasons[0]?.season ?? '2025';
  const newSeason = nextSeasonLabel(previousSeason);
  const seasonAwards = computeSeasonAwards(league, awardOptions);
  // Advanced stats need this season's team context, which is gone once the schedule rolls over — archive them now.
  const seasonContext = regularSeasonContext(league);
  const { combined: seasonAdvanced, stints: seasonStintSplits } = seasonAdvancedWithStints(league, seasonContext, extras.freeAgents);
  const teamSeasons = buildTeamSeasonSummaries(league, seasonContext, seasonAdvanced, championship?.teamId, extras.freeAgents, seasonStintSplits);
  // The owner reviews the season as it ended, before aging and retirements change the roster.
  const foReview = reviewSeason({ league, extras, teamSeasons, awards: seasonAwards, season: previousSeason, nextSeason: newSeason,
    championTeamId: championship?.teamId ?? null, fmvpId: championship?.fmvp?.playerId ?? null });
  league = offseasonTrainingCamp(league);

  const retiredPlayerIds: string[] = [];
  const expiredToFreeAgencyIds: string[] = [];
  const retainedViaOptionIds: string[] = [];
  const freeAgentsFromExpiry: PlayerSeason[] = [];
  const newlyRetired: RetiredPlayerRecord[] = [];
  const contracts = { ...extras.contracts };
  const userTeamId = league.frontOffice?.teamId ?? league.coachingUserTeamId ?? null;
  const resignedIds: string[] = [];
  const camp = userTeamId && league.summerCamp?.teamId === userTeamId && league.summerCamp.season === previousSeason ? league.summerCamp : null;
  const campRows: CampReportRow[] = [];

  const teams: LeagueTeam[] = league.teams.map((team) => {
    const keptSeasons: PlayerSeason[] = [];
    const fullOverallsBeforeAging: number[] = [];
    const rank = new Map([...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a)).map((s, i) => [s.playerId, i] as const));

    for (const season of team.seasons) {
      const overallBeforeAging = calculateOverall(season);
      fullOverallsBeforeAging.push(calculateFullAttributeOverall(season));
      const archived: CareerSeasonRecord = {
        season: season.season,
        teamId: season.teamId,
        age: season.age,
        overall: overallBeforeAging,
        stats: season.seasonStats ?? emptySeasonStatTotals(),
        milestones: season.seasonMilestones ?? emptySeasonMilestones(),
        ...(season.playoffStats ? { playoffStats: season.playoffStats } : {}),
        ...(seasonAdvanced.get(season.playerId) ? { advanced: seasonAdvanced.get(season.playerId) } : {}),
        ...(seasonStintSplits.get(season.playerId) ? { stints: seasonStintSplits.get(season.playerId) } : {}),
      };

      const coachDevelopment = coachPerformanceModifiers(team.coachIdentity, team.seasons).development;
      const developmentMultiplier = expenseEffects(team.expenseLevels).developmentMultiplier * (1 + (coachDevelopment - 1) * (league.rulesSettings?.coachingImpact ?? 100) / 100)
        * (1 + (team.business?.arena.practice ?? 0) * 0.02); // a better practice facility
      const realStep = realDevelopmentOn(league) && season.real ? applyRealDevelopment(season, newSeason) : null;
      let developed = realStep ?? developOffseasonPlayer(season, rng, league.rulesSettings, developmentMultiplier * (1 + (teachingQuality(team, season.training?.plan.coachId) - 1) * (league.rulesSettings?.coachingImpact ?? 100) / 100), team.coach?.trainingFocus, league.settings.sandboxMode ? 200 : 100);
      if (!realStep && realDevelopmentOn(league) && season.real) developed = markRealFallback(developed, newSeason);
      if (team.teamId === userTeamId) {
        // Your summer camp, on top of normal development (real players on Real Player Development follow their real careers).
        const plan = camp?.plans[season.playerId];
        const locked = realDevelopmentOn(league) && !!season.real;
        const ran = plan && !locked ? applySummerCamp(developed, plan, `${season.playerId}|${newSeason}`, teachingQuality(team)) : null;
        const campGain = ran ? calculateOverall(ran.player) - calculateOverall(developed) : 0;
        if (ran) developed = ran.player;
        campRows.push(reportRow(season, developed, campGain, plan, ran?.note ?? (plan ? '' : 'No summer plan.'), plan && locked ? 'Real Player Development: his ratings follow his real career.' : undefined));
      }
      const aged = recordOffseasonDevelopment(season, developed, team, league.calendarDate ?? previousSeason, realDevelopmentOn(league) && season.real ? realDevelopmentNote(developed, !!realStep) : undefined);
      const withHistory: PlayerSeason = {
        ...aged,
        season: newSeason,
        seasonStats: undefined,
        seasonMilestones: undefined,
        playoffStats: undefined,
        seasonStints: undefined,
        careerHistory: [...(season.careerHistory ?? []), archived],
      };

      if (!isStuck(withHistory) && !withHistory.careerPlayer && !(realStep && realCareerContinues(season, newSeason)) && shouldRetire(withHistory, rng, league.rulesSettings)) {
        retiredPlayerIds.push(withHistory.playerId);
        delete contracts[withHistory.playerId];
        newlyRetired.push({
          playerId: withHistory.playerId,
          finalTeamId: team.teamId,
          finalTeamName: team.name,
          finalSeason: previousSeason,
          finalAge: withHistory.age,
          finalOverall: calculateOverall(withHistory),
          finalSeasonData: withHistory,
        });
        continue;
      }

      const contract = contracts[withHistory.playerId];
      if (contract) {
        const yearsRemaining = contract.yearsRemaining - 1;
        const extended = yearsRemaining <= 0 ? extensionTakesOver(contract) : null;
        if (extended) {
          // An in-season extension starts now.
          contracts[withHistory.playerId] = extended;
          keptSeasons.push(appendHistoryEvent(withHistory, 'resigned', `Extension begins with ${team.name}: ${extended.yearsRemaining} years, $${(extended.annualSalary / 1e6).toFixed(1)}M a year`, team.teamId));
          continue;
        }
        if (yearsRemaining <= 0 && isStuck(withHistory)) {
          // Stuck players (Sandbox) never hit free agency: the deal rolls over.
          contracts[withHistory.playerId] = { ...contract, yearsRemaining: 2 };
          keptSeasons.push(withHistory);
          continue;
        }
        if (yearsRemaining <= 0) {
          const resolution = resolveExpiringContract(contract, calculateOverall(withHistory), withHistory.age);
          if (resolution.retained && resolution.extended) {
            contracts[withHistory.playerId] = resolution.extended;
            retainedViaOptionIds.push(withHistory.playerId);
            keptSeasons.push(withHistory);
            continue;
          }
          // AI teams keep the players they build around (your own team decides in the re-sign phase).
          const extension = team.teamId !== userTeamId ? aiResign(team, withHistory, rank.get(season.playerId) ?? 99, extras, contracts, rng) : null;
          if (extension) {
            contracts[withHistory.playerId] = extension;
            resignedIds.push(withHistory.playerId);
            keptSeasons.push(appendHistoryEvent(withHistory, 'resigned', `Re-signed with ${team.name}: ${extension.yearsRemaining} year${extension.yearsRemaining === 1 ? '' : 's'}, $${(extension.annualSalary / 1e6).toFixed(1)}M a year`, team.teamId));
            continue;
          }
          expiredToFreeAgencyIds.push(withHistory.playerId);
          delete contracts[withHistory.playerId];
          freeAgentsFromExpiry.push(appendHistoryEvent({ ...withHistory, teamId: null }, 'waived', `Contract expired with ${team.name} — entered free agency`, team.teamId));
          continue;
        }
        contracts[withHistory.playerId] = { ...contract, yearsRemaining };
      }

      keptSeasons.push(withHistory);
    }

    const previousOverallAverage = fullOverallsBeforeAging.length > 0
      ? fullOverallsBeforeAging.reduce((a, b) => a + b, 0) / fullOverallsBeforeAging.length
      : team.previousOverallAverage;

    const items = keptSeasons.map(p => `${p.playerId}: OVR ${p.previousOverall?.toFixed(1)} → ${staffOverall(p).toFixed(1)}. ${p.training?.plan.targetRole ?? 'balanced'} role recommended; ${p.training?.project?.status ?? 'no project'}.`);
    const control = { ...team.coachingControl!, lastPracticeDate: undefined, reportBaseline: Object.fromEntries(keptSeasons.map(p=>[p.playerId,staffOverall(p)])), reports: [{date:league.calendarDate??previousSeason,season:previousSeason,kind:'offseason' as const,summary:'Permanent offseason changes. Player development histories retain the full attribute breakdown.',items},...(team.coachingControl?.reports??[])].slice(0,104) };
    const coachIdentity = team.coachIdentity?.profile ? {...team.coachIdentity,profile:{...team.coachIdentity.profile,developmentHistory:[...team.coachIdentity.profile.developmentHistory,...keptSeasons.map(p=>({playerId:p.playerId,season:previousSeason,before:p.previousOverall??staffOverall(p),after:staffOverall(p)}))]}} : team.coachIdentity;
    return { ...team, coachIdentity, coachingControl:control, seasons: keptSeasons, previousOverallAverage, offseasonStartRosterIds: keptSeasons.map((s) => s.playerId) };
  });

  // Unsigned free agents live through the offseason too (they used to stay frozen in last season's age and stats).
  const faResult = rollFreeAgentsForward(league, extras.freeAgents, previousSeason, newSeason, seed, seasonAdvanced, seasonStintSplits);
  retiredPlayerIds.push(...faResult.retired.map(r => r.playerId));
  newlyRetired.push(...faResult.retired);

  const generateClass = () => generateDraftClass(pickDraftClassSize(teams.length, rng), Math.floor(rng.next() * 1_000_000), newSeason, collectPlayerIds(league, extras));
  // Historical leagues: this offseason's real draft class, and real players whose NBA debut is this season.
  let historical = league.historical;
  let draftClass: ReturnType<typeof generateDraftClass>;
  const debutants: PlayerSeason[] = [];
  if (historical) {
    const drafted = historicalDraftClass(historical, newSeason, generateClass);
    draftClass = drafted.draftClass;
    const debuts = historicalDebuts(drafted.meta, newSeason, collectPlayerIds(league, extras));
    debutants.push(...debuts.players);
    historical = debuts.meta;
  } else {
    // The class on the board all season (see draftSeason.ts) is the one that gets drafted; generate only if none.
    const scouted = extras.draftClass.length > 0 && extras.draftClass.every(p => p.trueSeason.season === newSeason);
    draftClass = scouted ? extras.draftClass : generateClass();
  }
  const keepWorkouts = !historical && draftClass === extras.draftClass;
  const standingsDraftOrder = buildTwoRoundDraftOrder(league, Math.floor(rng.next() * 1_000_000));
  const draftYear = parseInt(newSeason.slice(0, 4), 10);
  const { order: draftOrder, protectionsTriggered } = resolveTradedPicksIntoOrder(standingsDraftOrder, draftYear, extras.futurePicks ?? []);
  const lottery = lotteryResult(league, standingsDraftOrder.slice(0, teams.length), newSeason);
  const futurePicks = rollFutureDraftPicksForward(extras.futurePicks ?? [], teams.map((t) => t.teamId), draftYear, FUTURE_PICK_WINDOW_YEARS);

  const historyRecord: FranchiseHistoryRecord = {
    season: previousSeason,
    championTeamId: championship?.teamId ?? null,
    championTeamName: championship?.teamName ?? null,
    championPlayerIds: league.teams.find(t => t.teamId === championship?.teamId)?.seasons.map(s => s.playerId) ?? [],
    mvpPlayerId: seasonAwards.mvp?.playerId ?? null,
    mvpTeamName: seasonAwards.mvp?.teamName ?? null,
    dpoyPlayerId: seasonAwards.dpoy?.playerId ?? null,
    royPlayerId: seasonAwards.roy?.playerId ?? null,
    fmvpPlayerId: championship?.fmvp?.playerId ?? null,
    allStarGameMVPPlayerId: league.allStarWeekend?.season === previousSeason ? league.allStarWeekend.mvp?.playerId ?? null : null,
    threePointChampionId: league.allStarWeekend?.season === previousSeason ? league.allStarWeekend.threePointChampionId ?? null : null,
    dunkChampionId: league.allStarWeekend?.season === previousSeason ? league.allStarWeekend.dunkChampionId ?? null : null,
    risingStarsMVPPlayerId: league.allStarWeekend?.season === previousSeason ? league.allStarWeekend.risingStarsMvp?.playerId ?? null : null,
    fullAwards: seasonAwards,
    teamSeasons,
    ...(league.cup?.season === previousSeason ? { cup: cupArchive(league.cup) } : {}),
    ...(league.playoffBracket ? { bracket: compactBracket(league.playoffBracket), seeds: conferenceSeeds(league) } : {}),
  };

  const legendLeague = retireLegendJerseys({ ...league, teams, franchiseHistory: [...(league.franchiseHistory ?? []), historyRecord] }, newlyRetired, userTeamId, previousSeason).league;
  const nextLeague: League = {
    ...league,
    teams: legendLeague.teams.map(rollBusinessSeason), // one payment made on every arena upgrade
    season: newSeason,
    seasonPhase: 'draft',
    playoffBracket: undefined,
    awardRace: undefined, // its honors are in this season's fullAwards now
    cup: undefined, // archived with the season's history record
    newsArchive: generateNewsFeed(foReview ? { ...league, frontOffice: foReview.state } : league, extras, 200),
    ...(foReview ? { frontOffice: foReview.state, ...(foReview.state.status !== 'employed' ? { coachingUserTeamId: null } : {}) } : {}),
    rivalries: archiveRivalries(league),
    retiredPlayers: [...(league.retiredPlayers ?? []), ...newlyRetired],
    summerCamp: undefined,
    ...(userTeamId && campRows.length ? { campReport: { season: newSeason, teamId: userTeamId, rows: campRows.filter(r => !retiredPlayerIds.includes(r.playerId) && !expiredToFreeAgencyIds.includes(r.playerId)).sort((a, b) => (b.after - b.before) - (a.after - a.before)) } } : {}),
    franchiseHistory: [...(league.franchiseHistory ?? []), historyRecord],
    ...(historical ? { historical } : {}),
  };
  const nextExtras: GMLeagueExtras = {
    ...extras,
    contracts,
    freeAgents: [...faResult.freeAgents, ...freeAgentsFromExpiry, ...debutants],
    draftClass,
    draftWorkouts: keepWorkouts ? extras.draftWorkouts ?? {} : {},
    draftOrder,
    futurePicks,
    draftDayOpen: true,
    freeAgencyOpen: false,
    tradeBlock: [],
    draftPickIndex: 0,
    draftPicksMade: [],
    draftBoard: consensusBoard(draftClass),
    lottery,
    pendingTradeOffers: [],
    negotiations: {},
    extensionTalks: {},
  };

  // Stuck players (Sandbox) settle where their rule puts them; last-year players are in a contract year.
  const stuck = enforceSticky(nextLeague, nextExtras);
  const settled = { ...stuck, league: markContractYears(stuck.league, stuck.extras.contracts) };
  return {
    // Coaches age and contracts run out, then AI owners review their head coaches (the coaching carousel).
    league: offseasonCarousel(advanceStaffSeason(settled.league, previousSeason, championship?.teamId ?? undefined, seasonAwards.coy?.coachName ?? undefined), previousSeason, userTeamId,
      new Map(settled.league.teams.map(t => [t.teamId, t.coachIdentity?.coachId]))),
    extras: settled.extras,
    summary: {
      previousSeason,
      newSeason,
      retiredPlayerIds,
      expiredToFreeAgencyIds,
      retainedViaOptionIds,
      newDraftClassSize: draftClass.length,
      seasonAwards,
      totalPlayersAged: league.teams.reduce((sum, t) => sum + t.seasons.length, 0),
      pickProtectionsTriggered: protectionsTriggered,
      ownerReview: foReview?.review ?? null,
      newAchievements: foReview?.newAchievements ?? [],
    },
  };
}

/**
 * The schedule-side half of the offseason: regenerates a fresh, fully
 * unplayed schedule (same games-per-team as before) and clears any leftover
 * injuries, since nobody carries an injury into a brand new season. This is
 * the very last step of the guided season-flow UI, called when preseason
 * ends - it's what actually starts the new regular season.
 */
export function finalizeNewSeasonSchedule(league: League): League {
  const gamesPerTeam = league.settings.gamesPerSeason
    ?? (league.teams[0] ? totalGamesForTeam(league, league.teams[0].teamId) || 82 : 82);
  const schedule = generateSeasonSchedule(league.teams.map((t) => t.teamId), gamesPerTeam);
  const teams = league.teams.map((t) => {
    const before = t.offseasonStartRosterIds;
    if (!before) return t;
    const chemistry = driftChemistryForRosterContinuity(t.chemistry, before, t.seasons.map((s) => s.playerId));
    return { ...t, chemistry, offseasonStartRosterIds: undefined };
  });
  // The In-Season Cup draw happens with the new schedule; owners set goals knowing the season ahead.
  return ensureSeasonGoals(setupCup({
    ...settleStaffOffers(league), teams, schedule, seasonPhase: 'regular_season', injuries: {}, playoffBracket: undefined,
    calendarDate: seasonStartDate(league.season), calendarRound: -1,
  }));
}

/**
 * Convenience one-shot version of the full offseason pipeline - runs
 * beginNewSeasonRoster immediately followed by finalizeNewSeasonSchedule and
 * reopens free agency, landing straight back in 'regular_season'. Used by
 * quick-advance flows (Simulation Lab, "just get me to next season") that
 * don't want to walk through the guided draft/resign/free-agency steps.
 */
export function advanceToNextSeason(league: League, extras: GMLeagueExtras, seed = Date.now(), awardOptions: SeasonAwardsOptions = {}): SeasonTransitionResult {
  const rosterResult = beginNewSeasonRoster(league, extras, seed, awardOptions);
  const finalizedLeague = finalizeNewSeasonSchedule(rosterResult.league);
  return {
    league: finalizedLeague,
    extras: { ...rosterResult.extras, draftDayOpen: false, freeAgencyOpen: true },
    summary: rosterResult.summary,
  };
}

/** Every team's season in one line: record, team ratings, how far it went in the playoffs and its roster. */
export function buildTeamSeasonSummaries(league: League, ctx: SeasonContext, advanced: Map<string, PlayerAdvanced>, championTeamId?: string | null,
  extraPlayers: PlayerSeason[] = [], stintAdvanced: Map<string, SeasonStint[]> = new Map()): TeamSeasonSummary[] {
  // Everyone who suited up for a team this season, with only the games he played there (traded and waived players included).
  const rosterLines = new Map<string, TeamSeasonRosterLine[]>();
  const push = (teamId: string, p: PlayerSeason, s: SeasonStatTotals, adv?: PlayerAdvanced) => {
    if (!teamId || s.gamesPlayed <= 0) return;
    const gp = Math.max(1, s.gamesPlayed);
    const list = rosterLines.get(teamId) ?? [];
    list.push({ playerId: p.playerId, jerseyNumber: p.jerseyNumber, position: primaryPosition(p), age: p.age, overall: calculateOverall(p), gp: s.gamesPlayed,
      min: s.minutes / gp, pts: s.points / gp, reb: (s.oreb + s.dreb) / gp, ast: s.ast / gp, stl: s.stl / gp, blk: s.blk / gp, per: adv?.per ?? 0, ws: adv?.ws ?? 0 });
    rosterLines.set(teamId, list);
  };
  const everyone = [...league.teams.flatMap(t => t.seasons.map(p => ({ p, teamId: t.teamId as string | null }))), ...extraPlayers.map(p => ({ p, teamId: null }))];
  for (const { p, teamId } of everyone) {
    const split = stintAdvanced.get(p.playerId);
    if (split?.length) { for (const r of split) push(r.teamId, p, r.stats, r.advanced); continue; }
    const rows = seasonStintsFor(p, teamId);
    const fallback = teamId ?? priorTeamId(p);
    if (!rows.length && fallback && p.seasonStats) push(fallback, p, p.seasonStats, advanced.get(p.playerId));
    else if (rows.length === 1) push(rows[0].teamId, p, rows[0].stats, advanced.get(p.playerId));
    else for (const r of rows) push(r.teamId, p, r.stats);
  }
  const bracket = league.playoffBracket;
  const rounds = bracket?.rounds ?? [];
  const finishFor = (teamId: string): { finish: PlayoffFinish; wins: number; losses: number } => {
    let reached = -1, wins = 0, losses = 0;
    rounds.forEach((round, ri) => round.forEach(series => {
      if (series.teamAId !== teamId && series.teamBId !== teamId) return;
      reached = Math.max(reached, ri);
      wins += series.teamAId === teamId ? series.teamAWins : series.teamBWins;
      losses += series.teamAId === teamId ? series.teamBWins : series.teamAWins;
    }));
    if (championTeamId === teamId || bracket?.championTeamId === teamId) return { finish: 'Champion', wins, losses };
    if (reached < 0) {
      const playIn = bracket?.playIn?.filter(g => g.teamAId === teamId || g.teamBId === teamId) ?? [];
      return { finish: playIn.length ? 'Play-In' : 'Missed Playoffs', wins: playIn.filter(g => g.winnerTeamId === teamId).length, losses: playIn.filter(g => g.loserTeamId === teamId).length };
    }
    const last = rounds.length - 1;
    if (bracket?.championTeamId === teamId) return { finish: 'Champion', wins, losses };
    const fromEnd = last - reached;
    const finish: PlayoffFinish = fromEnd === 0 ? 'Finals' : fromEnd === 1 ? 'Conference Finals' : fromEnd === 2 && rounds.length >= 4 ? 'Second Round' : 'First Round';
    return { finish, wins, losses };
  };
  return league.teams.map(team => {
    const t = ctx.teams.get(team.teamId);
    const g = Math.max(1, t?.games ?? 0);
    const f = finishFor(team.teamId);
    const roster: TeamSeasonRosterLine[] = [...(rosterLines.get(team.teamId) ?? [])].sort((a, b) => b.ws - a.ws || b.pts - a.pts);
    return { teamId: team.teamId, teamName: team.name, wins: t?.wins ?? 0, losses: t?.losses ?? 0,
      ppg: t ? t.pts / g : 0, oppPpg: t ? t.opp.pts / g : 0, ortg: t?.ortg ?? 0, drtg: t?.drtg ?? 0, pace: t?.pace ?? 0,
      tpmPg: t ? t.tpm / g : 0, apg: t ? t.ast / g : 0, rpg: t ? (t.oreb + t.dreb) / g : 0, spg: t ? t.stl / g : 0, bpg: t ? t.blk / g : 0,
      playoffFinish: f.finish, playoffWins: f.wins, playoffLosses: f.losses, roster };
  });
}
