import { prepareCoachingForGame, finishCoachingGame, type GameEvidence } from './playerDevelopment';
import { advanceCup } from './cup';
import { isDeadlineDayBlocking } from './deadlineDay';
import { restsTonight, withMedicalRisk, afterGame, afterHealing } from './medical';
import { withContractYear } from './extensions';
import { gameStaffCoach } from './staffManagement';
import { reviewTeamRotation, type RotationReview } from './rotationReview';
import type { GameSettings, PlayerSeason } from './types';
import type { GameResult } from './boxscore';
import { simulateGame, type LiveCoachingCommand } from './engine/game';
import { applyGameResultToLeague } from './careerStats';
import { restoreMinutesIfHealthy } from './injuryReport';
import { addDays, seasonStartDate, DAYS_PER_ROUND } from './calendar';
import { advanceAwardRace } from './awardRace';
import { driftChemistryAfterGame } from './engine/chemistryEvolution';
import { appendHistoryEvent } from './playerHistory';
import type { SeasonAwards, AwardWinner } from './awards';
import type { LeagueRulesSettings } from './leagueRules';
import type { CoachIdentity } from './coaching';
import { recordCoachResult, driftRelationships } from './coaching';
import type { AllStarGameResult, ThreePointContestResult, DunkContestResult } from './allStarGame';
import type { AllStarVotingRecord } from './allStarVoting';
import { applyGameBonds, duoBoost } from './chemistryWeb';
import { homeCourtEdge } from './business';
import { travelEdge } from './travel';

/** Pulls a playerId -> minutes map out of one team's box score, for coach-relationship drift. */
function minutesFromBox(box: { players: Record<string, { minutes: number }> }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, line] of Object.entries(box.players)) out[id] = line.minutes;
  return out;
}

/** Logs an 'injury' history event onto each affected player's season record. Purely additive/display —
 * the actual active-injury tracking (recovery countdown) lives in the separate `injuries` map. */
function applyInjuryHistory(
  seasons: PlayerSeason[],
  injuredThisGame: Map<string, { teamId: string; severity: 'minor' | 'moderate' | 'severe'; recoveryGames: number }>,
): PlayerSeason[] {
  if (injuredThisGame.size === 0) return seasons;
  return seasons.map((s) => {
    const inj = injuredThisGame.get(s.playerId);
    if (!inj) return s;
    return appendHistoryEvent(s, 'injury', `${inj.severity[0].toUpperCase()}${inj.severity.slice(1)} injury — out an estimated ${inj.recoveryGames} game(s)`, inj.teamId);
  });
}

export interface CoachTendencies {
  rotationPolicy?: import('./coachingModel').RotationPolicy;
  autoRotation?: boolean;
  rotationReviewInterval?: number; // clamped to 5–10 team games; defaults to 7

  rotationDepth?: number;
  stintLengthMinutes?: number;
  offensiveSystem?: 'balanced' | 'pace-space' | 'pick-roll' | 'post' | 'motion' | 'isolation';
  defensiveScheme?: 'man' | 'switch' | 'zone' | 'pressure' | 'drop';
  trainingFocus?: 'balanced' | 'shooting' | 'defense' | 'playmaking';
  paceTendency: number; // 0-100, higher = wants to push pace
  threePointFrequency: number;
  starUsage: number;
  benchUsage: number;
  defensiveAggression: number;
  doubleTeamFrequency: number; // 0-100
  switchingFrequency: number;
  zoneFrequency: number;
  pnrFrequency: number;
  postFrequency: number;
}

export function defaultCoachTendencies(): CoachTendencies {
  return {
    paceTendency: 50, threePointFrequency: 50, starUsage: 50, benchUsage: 50,
    defensiveAggression: 50, doubleTeamFrequency: 20, switchingFrequency: 40,
    zoneFrequency: 10, pnrFrequency: 50, postFrequency: 30,
  };
}

export interface LeagueTeam {
  /** Ticket price, arena upgrades and their loans (see business.ts); set once the team's business is managed. */
  business?: import('./business').BusinessPlan;
  /** Chemistry web: bond strength (0-100) between two teammates, keyed "a|b" with the ids sorted (see chemistryWeb.ts). */
  bonds?: Record<string, number>;
  staff?: import('./coachingModel').AssistantStaff;
  coachingControl?: import('./coachingModel').CoachingControl;
  identity?: import('./teamIdentity').TeamIdentity;
  rotationReview?: RotationReview;

  teamId: string;
  name: string;
  seasons: PlayerSeason[];
  coach?: CoachTendencies;
  chemistry?: number; // 0-100, optional system (spec section 90); defaults to a neutral 70 if unset
  previousOverallAverage?: number; // team-wide average full-attribute Overall as of the last season rollover, for improve/decline tracking
  offseasonStartRosterIds?: string[]; // roster snapshot taken right as the offseason begins (post-retirement, pre-draft/FA), used to measure continuity for chemistry drift
  rotationOrder?: string[]; // explicit depth-chart order (drag-and-drop reorderable); first 5 are starters. Missing/new players are appended by minutes.target.
  conferenceId?: 'east' | 'west'; // absent on older saves / small sandbox leagues that predate conference support
  divisionId?: string; // e.g. "Atlantic" — always paired with a conferenceId when present
  marketSize?: number; // 0-100, how big/lucrative this team's market is — drives revenue and ownership spending willingness, independent of the league-wide salary cap
  expenseLevels?: TeamExpenseLevels; // budget dials the owner funds each season; each costs money and buys a real effect
  coachIdentity?: CoachIdentity; // the actual named head coach — separate from the `coach` style-tendency dials above, which the engine reads directly regardless of who's holding the clipboard
  retiredJerseys?: RetiredJersey[];
}

export interface RetiredJersey {
  number: number;
  playerId: string;
  season: string; // the season the number was retired
}

export function retireJerseyNumber(team: LeagueTeam, number: number, playerId: string, season: string): LeagueTeam {
  const withoutExisting = (team.retiredJerseys ?? []).filter((j) => j.number !== number);
  return { ...team, retiredJerseys: [...withoutExisting, { number, playerId, season }] };
}

export function unretireJerseyNumber(team: LeagueTeam, number: number): LeagueTeam {
  return { ...team, retiredJerseys: (team.retiredJerseys ?? []).filter((j) => j.number !== number) };
}

/** Per-team budget dials (0-100). Each costs real money against revenue and buys a concrete effect. */
export interface TeamExpenseLevels {
  scouting: number;   // accuracy of draft-prospect scouted potential
  coaching: number;   // boosts player development, positive and negative progressions
  health: number;     // shortens injury recovery time
  facilities: number; // raises player mood and ticket demand
}

export function defaultExpenseLevels(): TeamExpenseLevels {
  return { scouting: 50, coaching: 50, health: 50, facilities: 50 };
}

/** What one expense level costs per season. Level 50 is roughly league-average spend. */
export function expenseAnnualCost(level: number): number {
  return Math.round(8_000_000 + (level / 100) * 55_000_000);
}

/** The concrete in-sim effects a given expense level buys, for display and for the engine to read. */
export function expenseEffects(levels: TeamExpenseLevels | undefined) {
  const l = levels ?? defaultExpenseLevels();
  return {
    scoutingAccuracy: 0.5 + (l.scouting / 100) * 0.5,        // 0.5x-1.0x noise reduction on scouted potential
    developmentMultiplier: 1 + (l.coaching - 50) / 250,       // +/-20% progression at the extremes
    injuryDurationMultiplier: 1 - (l.health - 50) / 250,      // better health staff -> shorter absences
    moodBonus: (l.facilities - 50) / 25,                      // +/-2 player mood
    ticketDemandMultiplier: 1 + (l.facilities - 50) / 300,
  };
}

export const DIVISION_NAMES: Record<'east' | 'west', string[]> = {
  east: ['Atlantic', 'Central', 'Southeast'],
  west: ['Northwest', 'Pacific', 'Southwest'],
};

/** True once every team in the league has a conference assigned — gates conference-aware standings/playoffs UI. */
export function hasConferenceStructure(league: League): boolean {
  return league.teams.length > 0 && league.teams.every((t) => t.conferenceId != null);
}

/** Splits a fresh list of teams into East/West conferences (as even as possible) and 3 divisions per
 * conference (fewer if the conference is too small to support 3), returning new team objects. */
export function assignConferencesAndDivisions(teams: LeagueTeam[]): LeagueTeam[] {
  const half = Math.ceil(teams.length / 2);
  return teams.map((t, i) => {
    const conferenceId: 'east' | 'west' = i < half ? 'east' : 'west';
    const withinConference = i < half ? i : i - half;
    const conferenceSize = i < half ? half : teams.length - half;
    const divisionCount = Math.max(1, Math.min(3, Math.ceil(conferenceSize / 5)));
    const divisionNames = DIVISION_NAMES[conferenceId];
    const divisionId = divisionNames[withinConference % divisionCount] ?? divisionNames[0];
    return { ...t, conferenceId, divisionId };
  });
}

/** Assigns each team a market size (0-100) with a realistic spread — a handful of huge markets, plenty
 * of mid-size ones, and a few small ones — independent of the shared league-wide salary cap. */
export function assignMarketSizes(teams: LeagueTeam[], rng: { next: () => number }): LeagueTeam[] {
  return teams.map((t) => {
    // Box-Muller-ish via two uniforms for a rough bell curve, spread wide enough to create real haves/have-nots.
    const u1 = Math.max(1e-9, rng.next());
    const u2 = rng.next();
    const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const marketSize = Math.round(Math.max(5, Math.min(100, 50 + gaussian * 22)));
    return { ...t, marketSize };
  });
}

export interface ScheduledGame {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  result?: GameResult;
  /** In-Season Cup group this regular-season game also counts for (see cup.ts). */
  cupGroupId?: string;
}

export type SeasonPhase = 'regular_season' | 'all_star' | 'playoffs' | 'awards_recap' | 'draft' | 'resign_waive' | 'free_agency' | 'preseason';

export interface League {
  /** The Owner's Box: you own a team and an AI GM runs it (see ownerBox.ts). */
  owner?: import('./ownerBox').OwnerState;
  /** League office: rule votes, expansion bids, relocations (see ownerBox.ts). */
  leagueOffice?: import('./ownerBox').LeagueOffice;
  /** How the league was built (kind, season, options, seed): its league code (see retention/leagueCode.ts). */
  origin?: import('../retention/leagueCode').LeagueOrigin;
  /** Rebuild Challenge: the scenario this league is playing (see rebuildChallenge.ts). */
  rebuildChallenge?: import('./rebuildChallenge').RebuildChallengeConfig;
  coachingVersion?: 1;
  coachingUserTeamId?: string | null;
  staffMarket?: CoachIdentity[];
  coachingSettings?: import('./coachingModel').CoachingSettings;
  newsArchive?: import('./news').NewsItem[];
  rivalries?: Record<string, import('./rivalry').RivalryRecord>;
  /** Present when this league was started from real NBA history (see history/historicalLeague.ts). */
  /** Set on leagues made by the All-Time Draft. */
  allTimeDraft?: { seed: number; eraId: string; weekly?: string };
  historical?: import('../history/historicalLeague').HistoricalLeagueMeta; // past seasons' rivalry history, decayed each rollover (see rivalry.ts)
  playoffBracket?: import('./playoffs').PlayoffBracket;
  /** Press conferences, fan mood and what you've said this season (see press.ts). */
  press?: import('./press').PressState;
  /** This season's two Rivalry Week games against your biggest rival, the build-up and the fallout (see rivalryWeek.ts). */
  rivalryWeek?: import('./rivalryWeek').RivalryWeekState;
  /** Halftime speeches you gave this season and last (see halftime.ts); the best turnarounds make the season reel. */
  halftimeSpeeches?: import('./halftime').SpeechRecord[];
  /** How you're handling this season's road trips (rest, team dinner, push through; see travel.ts). */
  travel?: import('./travel').TravelState;
  /** Three named AI GMs with personalities who remember your trades (see gmRivals.ts). */
  gmRivals?: import('./gmRivals').GmRivalsState;
  /** Fragile returning players and load management (see medical.ts). */
  medical?: import('./medical').MedicalState;

  rosterLimits?: { minRosterSize: number; maxRosterSize: number };
  teams: LeagueTeam[];
  schedule: ScheduledGame[];
  settings: GameSettings;
  season?: string; // current season label, e.g. "2026-27"; absent on older/imported saves
  injuries?: Record<string, InjuryRecord>; // keyed by playerId; absent/undefined players are fully healthy
  retiredPlayers?: RetiredPlayerRecord[]; // everyone who has ever retired in this league, most recent last
  /** Your summer development plans for the coming offseason (see summerCamp.ts). */
  summerCamp?: import('./summerCamp').SummerCampState;
  /** Other teams' calls about your assistants (and past answers). */
  staffOffers?: import('./staffPoaching').PoachOffer[];
  /** The latest Training Camp Report: how your players came back from the summer. */
  campReport?: import('./summerCamp').CampReport;
  /** Single-game bests, updated after every game (see simulation/records.ts). */
  recordBook?: import('./records').RecordBook;
  franchiseHistory?: FranchiseHistoryRecord[]; // one entry per completed season, most recent last
  seasonPhase?: SeasonPhase; // where the league sits in the season lifecycle; absent/undefined means 'regular_season'
  calendarDate?: string; // in-universe ISO date (YYYY-MM-DD); absent on older saves until the next game simulated
  calendarRound?: number; // last schedule round the calendar has been advanced through, so re-simulating the same round twice doesn't double-count days
  rulesSettings?: LeagueRulesSettings; // the full league-rules panel; a curated subset is actually read by the simulation (see leagueRules.ts)
  allStarWeekend?: AllStarWeekendRecord; // this season's forced All-Star break - set once completed, checked to unblock the regular season
  /** Tutorial, menu mode and unlock progress; absent on leagues made before the tutorial (Full menu, nothing locked). */
  tutorial?: import('../tutorial/tutorialState').TutorialState;
  /** Award eligibility, All-Star count and the MVP/DPOY formulas; absent on older leagues (defaults apply). */
  awardSettings?: import('./awards').AwardSettings;
  /** This season's weekly award ladder and Players of the Week/Month (see awardRace.ts). */
  awardRace?: import('./awardRace').AwardRaceState;
  /** Owners, goals, your job security, reviews and achievements (see frontOffice.ts); absent on older leagues until loaded. */
  frontOffice?: import('./frontOffice').FrontOfficeState;
  /** This season's In-Season Cup: groups, knockout results and honors (see cup.ts). */
  cup?: import('./cup').CupState;
  /** This season's Trade Deadline Day: the clock, rumors, calls and every deal made (see deadlineDay.ts). */
  deadlineDay?: import('./deadlineDay').DeadlineDayState;
  /** Head coaches fired and hired around the league (see coachingCarousel.ts); a few seasons are kept. */
  coachingCarousel?: import('./coachingCarousel').CoachingCarouselState;
  /** The latest offseason's Summer League (see draftSeason.ts); replaced each year. */
  summerLeague?: import('./draftSeason').SummerLeagueRecord;
}

/** This season's All-Star Weekend results, once played - checked against `league.season` so a fresh season always requires a fresh weekend. */
export interface AllStarWeekendRecord {
  voting?: AllStarVotingRecord;
  threePoint?: ThreePointContestResult;
  dunk?: DunkContestResult;
  gameSkipped?: boolean;
  season: string;
  completed: boolean;
  gameResult?: AllStarGameResult;
  mvp?: AwardWinner;
  threePointChampionId?: string;
  dunkChampionId?: string;
  /** Rising Stars game (first- and second-year players), played before the All-Star Game. */
  risingStars?: import('./allStarGame').AllStarGameResult;
  risingStarsMvp?: AwardWinner;
  /** All-Star Game format: conference vs conference (default) or a captains draft. */
  format?: 'conference' | 'captains';
  draft?: import('./allStarEvents').CaptainsDraft;
  /** The contests shot by shot and dunk by dunk (the summaries above stay for history). */
  threePointShow?: import('./allStarEvents').ThreePointShow;
  dunkShow?: import('./allStarEvents').DunkShow;
}

/** Archived per-season headline results — the backbone of a franchise history page. */
export interface FranchiseHistoryRecord {
  season: string;
  championTeamId: string | null;
  championTeamName: string | null;
  championPlayerIds?: string[]; // championship roster, retained after trades, free agency and retirement
  mvpPlayerId: string | null;
  mvpTeamName: string | null;
  dpoyPlayerId: string | null;
  royPlayerId: string | null;
  fmvpPlayerId: string | null;
  allStarGameMVPPlayerId?: string | null;
  threePointChampionId?: string | null;
  dunkChampionId?: string | null;
  risingStarsMVPPlayerId?: string | null;
  /** The complete computed award slate for this season (MVP/DPOY/ROY/MIP/6MOY/COY, All-NBA/Defense/Rookie teams, All-Stars) - not just the headline names above. This is what lets a player's profile show every award they ever won. */
  fullAwards?: SeasonAwards;
  /** Every team's season: record, ratings, playoff finish and roster. Absent for seasons before this was archived. */
  teamSeasons?: TeamSeasonSummary[];
  /** Compact playoff bracket (series results and play-in, no box scores) and conference seeds, for the almanac. */
  bracket?: import('./playoffs').PlayoffBracket;
  seeds?: Record<string, number>;
  /** Imported from real NBA history before this league's start (not simulated). */
  imported?: boolean;
  /** The season's In-Season Cup result. */
  cup?: import('./cup').CupArchive;
}

export type PlayoffFinish = 'Champion' | 'Finals' | 'Conference Finals' | 'Second Round' | 'First Round' | 'Play-In' | 'Playoffs' | 'Missed Playoffs'; // 'Playoffs' = qualified, round not recorded (imported history)
export interface TeamSeasonRosterLine {
  playerId: string; jerseyNumber?: number | null; position: string; age: number; overall: number;
  gp: number; min: number; pts: number; reb: number; ast: number; stl: number; blk: number; per: number; ws: number;
}
export interface TeamSeasonSummary {
  teamId: string; teamName: string; wins: number; losses: number;
  ppg: number; oppPpg: number; ortg: number; drtg: number; pace: number;
  tpmPg: number; apg: number; rpg: number; spg: number; bpg: number;
  playoffFinish: PlayoffFinish; playoffWins: number; playoffLosses: number;
  roster: TeamSeasonRosterLine[];
}

/** A player who has retired, archived so the "retired players" list survives past whatever season they left in. */
export interface RetiredPlayerRecord {
  playerId: string;
  finalTeamId: string;
  finalTeamName: string;
  finalSeason: string;
  finalAge: number;
  finalOverall: number;
  /** The player's complete final-season record, including careerHistory — kept so the Hall of Fame can
   * recompute a full career case from real data rather than a lossy snapshot. */
  finalSeasonData?: PlayerSeason;
  /**
   * A real player whose career ended before this historical league began (loaded from NBA history, not retired here).
   * His finalSeasonData is not saved: it is rebuilt from the NBA history data by `realId` when the league loads,
   * unless `keepData` is set (edited in Sandbox).
   */
  preStart?: boolean;
  realId?: string;
  keepData?: boolean;
}

/** A currently-active injury being tracked across games (not just within one boxscore). */
export interface InjuryRecord {
  playerId: string;
  teamId: string;
  severity: 'minor' | 'moderate' | 'severe';
  gamesRemaining: number; // games left before this player is available again
  totalGames: number; // the original recovery estimate, kept for "X of Y games" progress display
  /** The treatment chosen in the medical room (unset = not decided yet; AI teams and undecided injuries heal on the standard timeline). */
  treatment?: import('./medical').Treatment;
}

/**
 * Simple round-robin: every team plays every other team `gamesPerMatchup` times,
 * alternating home/away on repeat matchups. Uses the standard circle method so
 * each "round" is a valid set of simultaneous non-overlapping matchups.
 */
export function generateRoundRobinSchedule(teamIds: string[], gamesPerMatchup = 1): ScheduledGame[] {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push('__BYE__');
  const n = ids.length;
  const rounds: ScheduledGame[] = [];
  let gameCounter = 0;

  for (let cycle = 0; cycle < gamesPerMatchup; cycle++) {
    const arr = [...ids];
    for (let round = 0; round < n - 1; round++) {
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        if (a === '__BYE__' || b === '__BYE__') continue;
        const homeFirst = (cycle + round + i) % 2 === 0;
        const homeTeamId = homeFirst ? a : b;
        const awayTeamId = homeFirst ? b : a;
        rounds.push({
          id: `g${gameCounter++}`,
          round: cycle * (n - 1) + round,
          homeTeamId,
          awayTeamId,
          played: false,
        });
      }
      // rotate all but the first element
      arr.splice(1, 0, arr.pop()!);
    }
  }
  return rounds;
}

/**
 * Builds a schedule where every team plays exactly `gamesPerTeam` games
 * (e.g. 82), by taking full round-robin cycles plus a partial extra cycle.
 * Each round-robin "round" is a perfect matching (every team plays exactly
 * once per round), so a partial cycle of R rounds contributes exactly R
 * extra games per team — no team ends up short or over.
 */
export function generateSeasonSchedule(teamIds: string[], gamesPerTeam: number): ScheduledGame[] {
  return balanceHomeAway(teamIds.length % 2 !== 0 ? oddTeamSeasonSchedule(teamIds, gamesPerTeam) : evenTeamSeasonSchedule(teamIds, gamesPerTeam));
}

/**
 * Hands out home court so every team gets about half its games at home (the circle method alone gave some teams 53
 * of 82). The second, fourth… meeting of two teams swaps venue from the one before; every other meeting goes to the
 * team with fewer home games so far.
 */
function balanceHomeAway(games: ScheduledGame[]): ScheduledGame[] {
  const balance = new Map<string, number>(); // home games minus away games so far
  const meetings = new Map<string, { count: number; lastHome: string }>();
  return games.map((g) => {
    const a = g.homeTeamId, b = g.awayTeamId;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const met = meetings.get(key);
    const home = met && met.count % 2 === 1 ? (met.lastHome === a ? b : a)
      : (balance.get(b) ?? 0) < (balance.get(a) ?? 0) ? b : a;
    const away = home === a ? b : a;
    meetings.set(key, { count: (met?.count ?? 0) + 1, lastHome: home });
    balance.set(home, (balance.get(home) ?? 0) + 1);
    balance.set(away, (balance.get(away) ?? 0) - 1);
    return home === a ? g : { ...g, homeTeamId: home, awayTeamId: away };
  });
}

function evenTeamSeasonSchedule(teamIds: string[], gamesPerTeam: number): ScheduledGame[] {
  const ids = [...teamIds];
  const n = ids.length;
  const roundsPerCycle = n - 1;
  const fullCycles = Math.floor(gamesPerTeam / roundsPerCycle);
  const remainderRounds = gamesPerTeam % roundsPerCycle;
  const totalCycles = fullCycles + (remainderRounds > 0 ? 1 : 0);

  const games: ScheduledGame[] = [];
  let gameCounter = 0;

  for (let cycle = 0; cycle < totalCycles; cycle++) {
    const roundsThisCycle = cycle < fullCycles ? roundsPerCycle : remainderRounds;
    const arr = [...ids];
    for (let round = 0; round < roundsThisCycle; round++) {
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        if (a === '__BYE__' || b === '__BYE__') continue;
        const homeFirst = (cycle + round + i) % 2 === 0;
        const homeTeamId = homeFirst ? a : b;
        const awayTeamId = homeFirst ? b : a;
        games.push({
          id: `s${gameCounter++}`,
          round: cycle * roundsPerCycle + round,
          homeTeamId, awayTeamId, played: false,
        });
      }
      arr.splice(1, 0, arr.pop()!);
    }
  }
  return games;
}

/**
 * Odd team counts: one team sits out each round, so a round-robin cycle gives every team N−1 games, and a partial
 * cycle would leave the teams whose rest day fell inside it a game short. Full cycles come first; the remaining games
 * pair each team with its nearest neighbours around a circle (every team gets the same number, half at home), packed
 * into game days where no team plays twice. When the team count and the game count are both odd, an even total is
 * impossible and exactly one team plays one game fewer.
 */
function oddTeamSeasonSchedule(teamIds: string[], gamesPerTeam: number): ScheduledGame[] {
  const n = teamIds.length;
  if (n < 2 || gamesPerTeam <= 0) return [];
  const fullCycles = Math.floor(gamesPerTeam / (n - 1));
  const rest = gamesPerTeam - fullCycles * (n - 1);
  const games = fullCycles ? generateRoundRobinSchedule(teamIds, fullCycles) : [];
  const pairs: [string, string][] = [];
  for (let d = 1; d <= Math.floor(rest / 2); d++) {
    for (let i = 0; i < n; i++) pairs.push([teamIds[i], teamIds[(i + d) % n]]);
  }
  if (rest % 2 === 1) {
    // Every other edge of the cycle 0 → d → 2d → … (d = (n−1)/2 is coprime with n and unused above): one more game for all but one team.
    const d = (n - 1) / 2;
    for (let j = 0; j + 1 < n; j += 2) {
      const a = teamIds[(j * d) % n], b = teamIds[((j + 1) * d) % n];
      pairs.push(j % 4 === 0 ? [a, b] : [b, a]);
    }
  }
  const start = games.length ? games[games.length - 1].round + 1 : 0;
  const busy: Set<string>[] = [];
  const extra: ScheduledGame[] = [];
  for (const [homeTeamId, awayTeamId] of pairs) {
    let r = 0;
    while (busy[r]?.has(homeTeamId) || busy[r]?.has(awayTeamId)) r++;
    (busy[r] ??= new Set()).add(homeTeamId).add(awayTeamId);
    extra.push({ id: '', round: start + r, homeTeamId, awayTeamId, played: false });
  }
  extra.sort((a, b) => a.round - b.round);
  return [...games, ...extra].map((g, i) => ({ ...g, id: `s${i}` }));
}

export interface StandingsRow {
  teamId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winPct: number;
}

export function computeStandings(league: League): StandingsRow[] {
  const rows: Record<string, StandingsRow> = {};
  for (const t of league.teams) {
    rows[t.teamId] = { teamId: t.teamId, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0, winPct: 0 };
  }
  for (const g of league.schedule) {
    if (!g.played || !g.result) continue;
    const home = rows[g.homeTeamId];
    const away = rows[g.awayTeamId];
    if (!home || !away) continue;
    home.pointsFor += g.result.homeScore;
    home.pointsAgainst += g.result.awayScore;
    away.pointsFor += g.result.awayScore;
    away.pointsAgainst += g.result.homeScore;
    if (g.result.homeScore > g.result.awayScore) { home.wins++; away.losses++; }
    else { away.wins++; home.losses++; }
  }
  for (const r of Object.values(rows)) {
    r.pointDiff = r.pointsFor - r.pointsAgainst;
    const total = r.wins + r.losses;
    r.winPct = total > 0 ? r.wins / total : 0;
  }
  return Object.values(rows).sort((a, b) => b.winPct - a.winPct || b.pointDiff - a.pointDiff);
}

export interface ConferenceStandings {
  east: StandingsRow[]; // sorted best to worst, i.e. index 0 is the #1 seed
  west: StandingsRow[];
}

/** Standings split into conferences, each internally sorted by seed (win% then point differential). */
export function computeConferenceStandings(league: League): ConferenceStandings {
  const all = computeStandings(league);
  const confByTeam = new Map(league.teams.map((t) => [t.teamId, t.conferenceId]));
  return {
    east: all.filter((r) => confByTeam.get(r.teamId) === 'east'),
    west: all.filter((r) => confByTeam.get(r.teamId) === 'west'),
  };
}

export interface DivisionStandingsGroup {
  divisionId: string;
  conferenceId: 'east' | 'west';
  rows: StandingsRow[];
}

/** Standings grouped by division, each group internally seeded — used for the "Division" standings view. */
export function computeDivisionStandings(league: League): DivisionStandingsGroup[] {
  const all = computeStandings(league);
  const teamById = new Map(league.teams.map((t) => [t.teamId, t]));
  const groups = new Map<string, DivisionStandingsGroup>();
  for (const r of all) {
    const t = teamById.get(r.teamId);
    if (!t?.divisionId || !t.conferenceId) continue;
    if (!groups.has(t.divisionId)) groups.set(t.divisionId, { divisionId: t.divisionId, conferenceId: t.conferenceId, rows: [] });
    groups.get(t.divisionId)!.rows.push(r);
  }
  return [...groups.values()];
}

/** Ticks every active injury on one team's roster down by one game, dropping any that have fully healed. */
export function tickInjuriesForTeam(injuries: Record<string, InjuryRecord>, teamId: string): Record<string, InjuryRecord> {
  const next = { ...injuries };
  for (const [playerId, rec] of Object.entries(next)) {
    if (rec.teamId !== teamId) continue;
    const gamesRemaining = rec.gamesRemaining - 1;
    if (gamesRemaining <= 0) delete next[playerId];
    else next[playerId] = { ...rec, gamesRemaining };
  }
  return next;
}

/**
 * Where the All-Star break falls in the schedule - roughly 58% of the way through the regular
 * season, matching the real NBA's mid-February placement in an Oct-June season. Once the schedule
 * reaches this round, `simulateNextGame` refuses to simulate any further games for the season
 * until `league.allStarWeekend` shows this season's weekend as completed - the break can't be
 * skipped or simulated through by accident.
 */
export function allStarBreakRound(league: League): number | null {
  const maxRound = league.schedule.reduce((m, g) => Math.max(m, g.round), -1);
  if (maxRound < 0 || league.rulesSettings?.allStarEnabled === false) return null;
  return Math.floor(maxRound * Math.max(0.1, Math.min(0.9, (league.rulesSettings?.allStarBreakPercent ?? 58) / 100)));
}

/** True once the schedule has reached the All-Star break and this season's weekend hasn't been played yet. */
export function isAllStarBreakPending(league: League): boolean {
  const breakRound = allStarBreakRound(league);
  if (breakRound == null) return false;
  if (league.allStarWeekend?.season === (league.season ?? '') && league.allStarWeekend?.completed) return false;
  const next = league.schedule.find(g => !g.played);
  return !!next && next.round >= breakRound;
}

/** A team can never suit up fewer than 5 players; if injuries have wiped out the bench, the least-recently-hurt players play through it. */
function ensureMinimumAvailable(full: PlayerSeason[], available: PlayerSeason[], injuries: Record<string, InjuryRecord>, minSize = 5): PlayerSeason[] {
  if (available.length >= Math.min(minSize, full.length)) return available;
  const availableIds = new Set(available.map((s) => s.playerId));
  const sidelined = full
    .filter((s) => !availableIds.has(s.playerId))
    .sort((a, b) => (injuries[a.playerId]?.gamesRemaining ?? 0) - (injuries[b.playerId]?.gamesRemaining ?? 0));
  const needed = Math.min(minSize, full.length) - available.length;
  return [...available, ...sidelined.slice(0, needed)];
}

/** Everything a scheduled game needs once both teams have practised: the engine input and who suited up. */
export interface PreparedGame {
  idx: number;
  input: Parameters<typeof simulateGame>[0];
  homeAvailableIds: string[];
}

/** True when no regular-season game can be played yet: a roster outside the limits, the All-Star break or Trade Deadline Day is due. */
function gameBlocked(league: League, idx: number): boolean {
  if ((league.seasonPhase ?? 'regular_season') === 'regular_season' && league.rosterLimits && league.teams.some(t => t.seasons.length < league.rosterLimits!.minRosterSize || t.seasons.length > league.rosterLimits!.maxRosterSize)) return true;
  if (league.deadlineDay && league.schedule[idx].round >= league.deadlineDay.round && isDeadlineDayBlocking(league)) return true;
  const breakRound = allStarBreakRound(league);
  return breakRound != null && league.schedule[idx].round >= breakRound && isAllStarBreakPending(league);
}

/** A team as it would take the floor today: healthy players, its coach, chemistry and rotation. Used for games
 * outside the schedule (Cup knockouts). */
export function teamGameInput(league: League, teamId: string): PreparedGame['input']['home'] {
  const team = league.teams.find((t) => t.teamId === teamId)!;
  const injuries = league.injuries ?? {};
  const available = ensureMinimumAvailable(team.seasons, team.seasons.filter((s) => !((injuries[s.playerId]?.gamesRemaining ?? 0) > 0)), injuries);
  return { teamId, seasons: available, coach: team.coach, chemistry: team.chemistry, coachIdentity: gameStaffCoach(team), rotationOrder: team.rotationOrder };
}

/** Tonight's extra edge for a team: a strong duo whose partner dressed, and (at home) the arena's upgrades. */
export function gameBoost(league: League, team: LeagueTeam, dressedIds: string[], home: boolean, gameId?: string): { boost?: Record<string, number> } {
  const boost = league.settings.teamChemistryEnabled === false ? {} : duoBoost(team, dressedIds);
  const edge = (home ? homeCourtEdge(team) : 0) + (gameId ? travelEdge(league, team.teamId, gameId) : 0);
  if (edge !== 0) for (const id of dressedIds) boost[id] = (boost[id] ?? 0) + edge;
  return Object.keys(boost).length ? { boost } : {};
}

/** Practice up to game day, then pick who is available (`injuries` decides who is out). */
function prepareGame(league: League, idx: number, seedBase: number, injuries: Record<string, InjuryRecord>, liveCoaching?: LiveCoachingCommand[]): { league: League; prepared: PreparedGame } {
  const scheduled = league.schedule[idx];
  const trainingDate = addDays(league.calendarDate ?? seasonStartDate(league.season), Math.max(0, scheduled.round - (league.calendarRound ?? -1)) * DAYS_PER_ROUND);
  league = prepareCoachingForGame(league, [scheduled.homeTeamId, scheduled.awayTeamId], trainingDate);
  const g = league.schedule[idx];
  const home = league.teams.find((t) => t.teamId === g.homeTeamId)!;
  const away = league.teams.find((t) => t.teamId === g.awayTeamId)!;

  // Out: injured, or rested tonight by load management. Fragile returning players carry a raised injury risk.
  const gameNumber = (teamId: string) => league.schedule.filter(x => x.played && (x.homeTeamId === teamId || x.awayTeamId === teamId)).length + 1;
  const isOut = (playerId: string, teamId: string) => (injuries[playerId]?.gamesRemaining ?? 0) > 0 || restsTonight(league.medical, playerId, gameNumber(teamId), league.seasonPhase);
  let homeAvailable = home.seasons.filter((s) => !isOut(s.playerId, home.teamId)).map(s => withContractYear(withMedicalRisk(league.medical, s)));
  let awayAvailable = away.seasons.filter((s) => !isOut(s.playerId, away.teamId)).map(s => withContractYear(withMedicalRisk(league.medical, s)));
  homeAvailable = ensureMinimumAvailable(home.seasons, homeAvailable, injuries);
  awayAvailable = ensureMinimumAvailable(away.seasons, awayAvailable, injuries);

  const input: PreparedGame['input'] = {
    home: { teamId: home.teamId, seasons: homeAvailable, coach: home.coach, chemistry: home.chemistry, coachIdentity: gameStaffCoach(home), rotationOrder: home.rotationOrder, ...gameBoost(league, home, homeAvailable.map(s => s.playerId), true, g.id) },
    away: { teamId: away.teamId, seasons: awayAvailable, coach: away.coach, chemistry: away.chemistry, coachIdentity: gameStaffCoach(away), rotationOrder: away.rotationOrder, ...gameBoost(league, away, awayAvailable.map(s => s.playerId), false, g.id) },
    settings: { ...league.settings, seed: seedBase + idx },
    rules: league.rulesSettings, moraleImpact: league.coachingSettings?.moraleImpact,
    liveCoaching,
  };
  return { league, prepared: { idx, input, homeAvailableIds: homeAvailable.map((s) => s.playerId) } };
}

/** Applies a finished game: injuries, chemistry, calendar, stats and records, then post-game development and rotation review. */
function commitGame(league: League, prepared: PreparedGame, result: GameResult, evidence?: GameEvidence): League {
  const { idx } = prepared;
  const g = league.schedule[idx];
  const home = league.teams.find((t) => t.teamId === g.homeTeamId)!;
  const away = league.teams.find((t) => t.teamId === g.awayTeamId)!;
  const injuries = league.injuries ?? {};
  const isOut = (playerId: string) => (injuries[playerId]?.gamesRemaining ?? 0) > 0;

  let nextInjuries = tickInjuriesForTeam(injuries, home.teamId);
  nextInjuries = tickInjuriesForTeam(nextInjuries, away.teamId);
  // Healed tonight: the treatment decides how fragile he comes back. Everyone who played wears fragility off.
  const healed = Object.values(injuries).filter(r => (r.teamId === home.teamId || r.teamId === away.teamId) && !nextInjuries[r.playerId]);
  const playedIds = [...Object.values(result.homeBox.players), ...Object.values(result.awayBox.players)].filter(l => l.minutes > 0).map(l => l.playerId);
  const medical = league.medical ? afterGame(afterHealing(league.medical, healed), playedIds) : healed.length ? afterHealing({ fragile: {}, rest: {} }, healed) : undefined;
  const homeIds = new Set(prepared.homeAvailableIds);
  const recoveryMult = (league.rulesSettings?.recoveryTimeMultiplier ?? 100) / 100;
  const injuredThisGame = new Map<string, { teamId: string; severity: InjuryRecord['severity']; recoveryGames: number }>();
  for (const inj of result.injuries) {
    const teamId = homeIds.has(inj.playerId) ? home.teamId : away.teamId;
    const injuredTeam = league.teams.find((t) => t.teamId === teamId);
    const healthMult = expenseEffects(injuredTeam?.expenseLevels).injuryDurationMultiplier * (1 - (injuredTeam?.staff?.trainer?.profile?.attributes.playerDevelopment ?? 0) / 700);
    const recoveryGames = Math.max(1, Math.round(inj.recoveryGamesEstimate * recoveryMult * healthMult));
    nextInjuries[inj.playerId] = {
      playerId: inj.playerId, teamId, severity: inj.severity as InjuryRecord['severity'],
      gamesRemaining: recoveryGames, totalGames: recoveryGames,
    };
    injuredThisGame.set(inj.playerId, { teamId, severity: inj.severity as InjuryRecord['severity'], recoveryGames });
  }

  const schedule = [...league.schedule];
  schedule[idx] = { ...g, played: true, result };

  const homeStillInjured = Object.values(nextInjuries).some((r) => r.teamId === home.teamId);
  const awayStillInjured = Object.values(nextInjuries).some((r) => r.teamId === away.teamId);
  const homeWon = result.homeScore > result.awayScore;
  let teams = league.teams;
  teams = teams.map((t) => {
    if (t.teamId === home.teamId) {
      const chemistry = driftChemistryAfterGame(t.chemistry, homeWon);
      const base = homeStillInjured ? { ...t, chemistry } : { ...restoreMinutesIfHealthy(t), chemistry };
      return {
        ...base,
        seasons: applyInjuryHistory(base.seasons, injuredThisGame),
        coachIdentity: driftRelationships(recordCoachResult(base.coachIdentity, homeWon), base.seasons, homeWon, minutesFromBox(result.homeBox), new Set(base.seasons.filter(s => isOut(s.playerId)).map(s => s.playerId))),
      };
    }
    if (t.teamId === away.teamId) {
      const chemistry = driftChemistryAfterGame(t.chemistry, !homeWon);
      const base = awayStillInjured ? { ...t, chemistry } : { ...restoreMinutesIfHealthy(t), chemistry };
      return {
        ...base,
        seasons: applyInjuryHistory(base.seasons, injuredThisGame),
        coachIdentity: driftRelationships(recordCoachResult(base.coachIdentity, !homeWon), base.seasons, !homeWon, minutesFromBox(result.awayBox), new Set(base.seasons.filter(s => isOut(s.playerId)).map(s => s.playerId))),
      };
    }
    return t;
  });

  // Advance the calendar once per round crossed (a round is a full matching, so many games can share the same round/day).
  const lastRound = league.calendarRound ?? -1;
  let calendarDate = league.calendarDate ?? seasonStartDate(league.season);
  let calendarRound = lastRound;
  if (g.round > lastRound) {
    calendarDate = addDays(calendarDate, (g.round - lastRound) * DAYS_PER_ROUND);
    calendarRound = g.round;
  }

  teams = applyGameBonds(teams, result);
  const updated = applyGameResultToLeague({ ...league, teams, schedule, injuries: nextInjuries, calendarDate, calendarRound, ...(medical ? { medical } : {}) }, result);
  // The last game of a game day moves the award races along (weekly ladder, Players of the Week/Month).
  // The same night decides the Cup: once the last group game is in, the knockout rounds are played (see cup.ts).
  const dayDone = (l: League) => l.schedule.some((x) => !x.played && x.round === g.round) ? l : advanceCup(advanceAwardRace(l, g.round));
  if ((updated.seasonPhase ?? 'regular_season') !== 'regular_season') return dayDone(updated);
  return dayDone(finishCoachingGame({ ...updated, teams: updated.teams.map(t => t.teamId === home.teamId || t.teamId === away.teamId ? reviewTeamRotation(t, updated) : t) }, result, false, evidence));
}

/** Simulates a single unplayed game (the next one in schedule order) and returns the updated league. Refuses to simulate past a pending, uncompleted All-Star break - see `isAllStarBreakPending`. */
export function simulateNextGame(league: League, seedBase = 1, liveCoaching?: Record<string, LiveCoachingCommand[]>): League {
  const idx = league.schedule.findIndex((g) => !g.played);
  if (idx === -1 || gameBlocked(league, idx)) return league;
  const { league: ready, prepared } = prepareGame(league, idx, seedBase, league.injuries ?? {}, liveCoaching?.[league.schedule[idx].id]);
  return commitGame(ready, prepared, simulateGame(prepared.input));
}

/** A game simulated by `runGames`: the result (possibly with its log already packed) and its development evidence. */
export interface SimulatedGame { result: GameResult; evidence?: GameEvidence }

/**
 * The same game day as `simulateFullRound`, with the engine runs handed to `runGames` so they can happen in parallel
 * (background engine workers). Games in a round involve different teams, so practising every team first, running
 * the games, then applying the results in schedule order produces exactly what one-game-at-a-time does. The only
 * cross-game link — an injury record still filed under a player's old team, ticked by that team's game — is
 * replayed while preparing. Returns the same league object when the round is blocked.
 */
export async function simulateRoundPhased(league: League, seedBase: number, runGames: (inputs: PreparedGame['input'][]) => Promise<SimulatedGame[]>): Promise<League> {
  const first = league.schedule.findIndex((g) => !g.played);
  if (first === -1 || gameBlocked(league, first)) return league;
  const round = league.schedule[first].round;
  const order: number[] = [];
  for (let i = first; i < league.schedule.length; i++) {
    const g = league.schedule[i];
    if (g.played) continue;
    if (g.round !== round) break;
    order.push(i);
  }

  const originalInjuries = league.injuries;
  let running = league.injuries ?? {};
  let current = league;
  const prepared: PreparedGame[] = [];
  for (const idx of order) {
    const ready = prepareGame({ ...current, injuries: running }, idx, seedBase, running);
    current = { ...ready.league, injuries: originalInjuries };
    prepared.push(ready.prepared);
    const g = league.schedule[idx];
    running = tickInjuriesForTeam(tickInjuriesForTeam(running, g.homeTeamId), g.awayTeamId);
  }
  if (originalInjuries === undefined) delete current.injuries;

  const simulated = await runGames(prepared.map((p) => p.input));
  for (let i = 0; i < prepared.length; i++) current = commitGame(current, prepared[i], simulated[i].result, simulated[i].evidence);
  return current;
}

/**
 * Simulates every game in the next unplayed round at once (a full league-wide game night — every
 * team that's scheduled plays once), rather than just the single next game in schedule order. This
 * is the "Play" button's primitive: one round = one day advanced, all around the league at once,
 * not just the team you happen to be watching. Stops (returning the league unchanged) if the round
 * is blocked by a pending All-Star break - see `isAllStarBreakPending`.
 */
export function simulateFullRound(league: League, seedBase = 1, liveCoaching?: Record<string, LiveCoachingCommand[]>): League {
  const targetRound = league.schedule.find((g) => !g.played)?.round;
  if (targetRound === undefined) return league;
  let current = league;
  while (current.schedule.find((g) => !g.played)?.round === targetRound) {
    const next = simulateNextGame(current, seedBase, liveCoaching);
    if (next === current) break; // blocked (All-Star break pending)
    current = next;
  }
  return current;
}

/** Simulates every remaining unplayed game in schedule order, stopping early (without erroring) if a pending All-Star break blocks further simulation - see `isAllStarBreakPending`. */
export function simulateRemainingSeason(league: League, seedBase = 1): League {
  let current = league;
  while (current.schedule.some((g) => !g.played)) {
    const next = simulateFullRound(current, seedBase);
    if (next === current) break; // blocked (All-Star break pending) - stop instead of spinning forever
    current = next;
  }
  return current;
}

/**
 * Simulates every unplayed game scheduled within the next `numberOfRounds` rounds
 * from wherever the schedule currently sits. Because generateSeasonSchedule builds
 * each round as a full round-robin matching, every team plays at most once per
 * round — so this is effectively "advance the whole league by N game-days" and is
 * used to power "simulate next week" (7 rounds) / "simulate next month" (~30 rounds).
 */
export function simulateRounds(league: League, numberOfRounds: number, seedBase = 1): League {
  const nextRound = league.schedule.find((g) => !g.played)?.round;
  if (nextRound === undefined) return league;
  const targetRound = nextRound + numberOfRounds;
  let current = league;
  while (current.schedule.some((g) => !g.played && g.round < targetRound)) {
    const next = simulateFullRound(current, seedBase);
    if (next === current) break; // blocked (All-Star break pending) - stop instead of spinning forever
    current = next;
  }
  return current;
}

/** Simulates roughly `numberOfDays` of in-universe calendar time (converted to schedule rounds via `DAYS_PER_ROUND`), one full day/round at a time - the shared primitive behind "next week", "next month", and similar bulk-advance actions, so they all actually advance the calendar amount they claim to. */
export function simulateDays(league: League, numberOfDays: number, seedBase = 1): League {
  const rounds = Math.max(1, Math.ceil(numberOfDays / DAYS_PER_ROUND));
  return simulateRounds(league, rounds, seedBase);
}

/** Number of games remaining for a single team (defaults to the whole league's remaining games when teamId is null). */
export function gamesRemainingForTeam(league: League, teamId: string | null): number {
  if (!teamId) return league.schedule.filter((g) => !g.played).length;
  return league.schedule.filter((g) => !g.played && (g.homeTeamId === teamId || g.awayTeamId === teamId)).length;
}

/** Total games on a single team's schedule (defaults to the whole league's game count when teamId is null). */
export function totalGamesForTeam(league: League, teamId: string | null): number {
  if (!teamId) return league.schedule.length;
  return league.schedule.filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId).length;
}
