// ============================================================================
// CANONICAL DATA MODEL — Phase 1
// Ratings describe what a player CAN do.
// Tendencies/roles/usage/minutes describe what a player ACTUALLY DOES.
// Every field is independently editable. Sandbox mode allows values > 100.
// ============================================================================

export type PlayerId = string;
export type TeamId = string;

// ---- Physical ----
export interface PhysicalAttributes {
  heightInches: number; // stored in inches, displayed as ft/in by UI layer
  weightLbs: number;
  wingspanInches: number;
  standingReachInches: number;
  vertical: number;
  speed: number;
  acceleration: number;
  strength: number;
  agility: number;
  balance: number;
  stamina: number;
  durability: number;
}

// ---- Offense ----
export interface OffensiveAttributes {
  closeShot: number;
  drivingLayup: number;
  drivingDunk: number;
  standingDunk: number;
  postHook: number;
  postFade: number;
  postControl: number;
  midrange: number;
  longMidrange: number;
  threePoint: number;
  corner3: number;
  aboveBreak3: number;
  pullUp3: number;
  catchAndShoot: number;
  freeThrow: number;
  ballHandling: number;
  ballSecurity: number;
  speedWithBall: number;
  passing: number;
  passingAccuracy: number;
  passingIQ: number;
  offensiveIQ: number;
  shotIQ: number;
  decisionMaking: number;
  finishing: number;
  touch: number;
  offensiveConsistency: number;
  offensiveRebounding: number;
}

// ---- Defense ----
export interface DefensiveAttributes {
  perimeterDefense: number;
  interiorDefense: number;
  defensiveIQ: number;
  helpDefense: number;
  pickAndRollDefense: number;
  closeout: number;
  contest: number;
  steal: number;
  stealIQ: number;
  onBallSteal: number;
  passingLaneSteal: number;
  block: number;
  blockIQ: number;
  blockTiming: number;
  rimProtection: number;
  defensiveRebounding: number;
  defensiveConsistency: number;
  defensiveAwareness: number;
  defensiveDiscipline: number;
}

// ---- Mental ----
export interface MentalAttributes {
  clutch: number;
  consistency: number;
  confidence: number;
  composure: number;
  discipline: number;
  aggression: number;
  effort: number;
  basketballIQ: number;
  playoffPerformance: number;
  pressurePerformance: number;
  leadership: number;
}

export interface Attributes {
  physical: PhysicalAttributes;
  offense: OffensiveAttributes;
  defense: DefensiveAttributes;
  mental: MentalAttributes;
}

// ---- Positional suitability (not a single locked position) ----
export interface PositionSuitability {
  PG: number;
  SG: number;
  SF: number;
  PF: number;
  C: number;
}

// ---- Shot tendencies (0-100 normal, 0-200+ sandbox) ----
export interface ShotTendencies {
  rim: number;
  close: number;
  midrange: number;
  longMidrange: number;
  corner3: number;
  aboveBreak3: number;
  pullUp3: number;
  catchAndShoot3: number;
  stepback: number;
  fadeaway: number;
  postShot: number;
  hook: number;
  dunk: number;
  layup: number;
}

export interface PassingTendencies {
  passFrequency: number;
  assistCreation: number;
  driveAndKick: number;
  extraPass: number;
  skipPass: number;
  lobPass: number;
  entryPass: number;
  kickout: number;
  pickAndRollPass: number;
  isolationPass: number;
  riskyPass: number;
  flashyPass: number;
}

export interface DrivingTendencies {
  driveFrequency: number;
  driveLeft: number;
  driveRight: number;
  straightDrive: number;
  attackCloseout: number;
  transitionDrive: number;
  contactFinish: number;
  kickout: number;
  driveAndKick: number;
  pullUpAfterDrive: number;
}

export interface RoleTendencies {
  primaryBallHandler: number;
  secondaryBallHandler: number;
  tertiaryBallHandler: number;
  shotCreator: number;
  catchAndShoot: number;
  pnrBallHandler: number;
  pnrScreener: number;
  isolation: number;
  postUp: number;
  cutter: number;
  spotUpShooter: number;
  transitionFinisher: number;
  offensiveRebounder: number;
  handOffReceiver: number;
}

export interface Tendencies {
  shot: ShotTendencies;
  passing: PassingTendencies;
  driving: DrivingTendencies;
  role: RoleTendencies;
  ballDominance: number; // 0-100: how much offense flows through the player
  threePointTargets?: {
    target?: number; // target attempts per game
    min?: number;
    max?: number;
  };
}

// ---- Minutes ----
export type MinutesMode = 'AI' | 'TARGET' | 'EXACT' | 'MANUAL';

export interface MinutesConfig {
  mode: MinutesMode;
  target: number; // total minutes desired
  min?: number;
  max?: number;
  perQuarter?: [number, number, number, number]; // Q1-Q4 desired minutes
  overtime?: number;
  baselineTarget?: number; // the pre-injury-redistribution target, so it can be restored once the team is healthy again
}

// ---- Badges ----
export type BadgeCategory =
  | 'shooting'
  | 'ballhandling'
  | 'defense'
  | 'finishing'
  | 'passing'
  | 'experimental'
  | 'custom';

export interface BadgeEffect {
  // Flat additive modifiers applied to specific attribute paths, e.g. "offense.threePoint": 20
  attributeModifiers?: Partial<Record<string, number>>;
  // Special engine-recognized flags for experimental/broken badges
  flags?: {
    perfectShooter?: boolean;
    perfectBlocker?: boolean;
    perfectStealer?: boolean;
    neverTurnover?: boolean;
    infiniteStamina?: boolean;
    unlimitedRange?: boolean;
    noInjury?: boolean;
    noFoul?: boolean;
    automaticAssist?: boolean;
    unblockableShot?: boolean;
    unstealableBall?: boolean;
    speedMultiplier?: number; // e.g. "God Speed"
    reboundMultiplier?: number;
    gravityMultiplier?: number; // pulls extra defensive attention
    verticalMultiplier?: number;
  };
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  effect: BadgeEffect;
  activationChance?: number; // 0-1, default 1 (always active once equipped)
  stackable?: boolean;
}

// ---- Development ----
export interface Development {
  potential: number; // independent of overall, can exceed 99 in sandbox
  developmentRate: number;
  developmentVariance: number;
  peakAge: number; // age the player's prime BEGINS
  primeLengthYears?: number; // how many years the prime lasts before decline starts (default 6, so 26 -> 32)
  declineRate: number;
  injuryRisk: number;
  workEthic: number;
}

// ---- Overall (summary only, not simulation-driving) ----
export interface OverallRatings {
  mode: 'AUTO' | 'MANUAL';
  manualOverall?: number;
  // computed/cached values (recalculated by calculateOverall, never hand-authored elsewhere)
  overall?: number;
  offensiveRating?: number;
  defensiveRating?: number;
  shootingRating?: number;
  creationRating?: number;
  playmakingRating?: number;
  reboundingRating?: number;
  physicalRating?: number;
}

// ---- Player-season record ----
export interface PlayerSeason {
  training?: import('./coachingModel').PlayerTraining;
  playerId: PlayerId;
  season: string; // e.g. "2015-16"
  teamId: TeamId | null;
  age: number;
  attributes: Attributes;
  positions: PositionSuitability;
  tendencies: Tendencies;
  minutes: MinutesConfig;
  badges: string[]; // badge ids equipped this season
  development: Development;
  overall: OverallRatings;
  ballHandlerPriority: number; // 0-100, engine uses this to pick who has the ball
  source: 'historical' | 'generated' | 'user'; // data provenance, never fabricate as official
  previousOverall?: number; // set by developOffseasonPlayer to show improvement/decline deltas (headline Overall)
  previousFullOverall?: number; // same idea, but for the full-attribute composite used by league analytics
  rotationRole?: 'starter' | 'bench'; // manual rotation override; when unset, the top 5 by minutes.target are treated as starters
  seasonStats?: SeasonStatTotals; // regular-season games this season (older saves may include playoff games)
  playoffStats?: SeasonStatTotals; // postseason games this season, kept apart so regular-season numbers, awards and records stay clean
  seasonMilestones?: SeasonMilestones; // double/triple/quad/quint-double counts + single-game highs, THIS season only
  careerHistory?: CareerSeasonRecord[]; // prior seasons' final stat lines, archived (never overwritten) when a season rolls over
  morale?: PlayerMorale; // latest morale snapshot (see personality.ts); refreshed by the league AI pass
  seasonStints?: SeasonStint[]; // this season's closed stints with teams he has left (see stints.ts); seasonStats stays the full-season total
  /** Real (historical) player link: canonical id, rating provenance and hidden reference trajectory (see history/realPlayers.ts). */
  real?: import('../history/realPlayers').RealPlayerInfo;
  /** Sandbox stick: never leaves this team, or follows this player wherever he goes; stuck players never retire (see sticky.ts). */
  stick?: import('./sticky').StickRule;
  /** Brought in from NBA history by the sandbox importer, as he was in this season (END year). He keeps his own career from here. */
  importedFrom?: { season: number; realId: string };
  /** Playing for his next contract: last year of his deal, no extension (see extensions.ts). */
  contractYear?: boolean;
  /** Career Mode's player: he retires only when his career says so, never on the league's random rolls. */
  careerPlayer?: boolean;
  /** Can carry ratings past 99 (up to 120): Career Mode's player, in his career or brought into a league. */
  highRatings?: boolean;
  /** Honours won in real NBA history before this league's start (imported, never simulated). */
  historicalAwards?: HistoricalAward[];

  // ---- Identity / biographical (fully editable in Sandbox mode) ----
  firstName?: string;
  lastName?: string;
  archetype?: string;       // machine key of the build this player was generated as
  archetypeLabel?: string;  // human-readable build name, e.g. "Two-Way Star"
  jerseyNumber?: number;
  /** Look chosen in Edit Player (skin, hair, beard, headwear); unset keeps the look the player's id gives him. */
  appearance?: import('../visuals/playerSprite').Appearance;
  college?: string;
  nationality?: string;
  birthDate?: string; // ISO date, real players only
  draftYear?: string | null; // the season string the player was drafted in, e.g. "2024-25"; null/undefined for undrafted
  draftRound?: number | null; // 1 or 2; null for undrafted
  draftPick?: number | null; // overall pick number (1-indexed); null for undrafted
  draftTeamId?: string | null; // team that originally drafted them, kept even after trades

  /** Append-only career event log — contract signings, trades, waives, injuries — never cleared on season rollover. */
  history?: PlayerHistoryEvent[];
}

export type PlayerHistoryEventType = 'drafted' | 'signed' | 'traded' | 'waived' | 'resigned' | 'injury' | 'created' | 'renamed' | 'moved' | 'trade_request';

/** Morale snapshot. Personality traits themselves are derived (stable per player), so only outcomes are stored. */
export interface PlayerMorale {
  score: number;          // 0-100
  season: string;         // season the snapshot belongs to
  teamId: string | null;  // team he was on when it was taken
  games: number;          // team games played at the snapshot, used to pace locker-room chemistry drift
  tradeRequest?: string;  // season in which he asked out (cleared when withdrawn)
  grudges?: string[];     // teams that traded or waived him when he didn't want to go (they pay more to sign him)
  fondOf?: string[];      // teams he was happy with (a small discount to come back)
}

export interface PlayerHistoryEvent {
  season: string;
  type: PlayerHistoryEventType;
  description: string;
  teamId?: string | null;
}

/** Accumulated box-score totals stored directly on the player's profile (spec section 65/126). */
export interface SeasonStatTotals {
  gamesPlayed: number;
  minutes: number;
  points: number;
  fgm: number; fga: number;
  tpm: number; tpa: number;
  ftm: number; fta: number;
  oreb: number; dreb: number;
  ast: number; stl: number; blk: number; tov: number;
  pf: number;
  ba: number; // times this player's own shot attempt was blocked
  blkAtt: number; // shots faced as the primary defender ("block attempts") — blk / blkAtt = block success rate
  clutchPoints: number; // points scored in clutch situations, drives Clutch Player of the Year
}

export function emptySeasonStatTotals(): SeasonStatTotals {
  return {
    gamesPlayed: 0, minutes: 0, points: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
    oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, ba: 0, blkAtt: 0, clutchPoints: 0,
  };
}

/** Games where a player hit double figures in N of {points, rebounds, assists, steals, blocks} in a single game.
 * Follows standard stat-keeping convention: a triple-double game also counts toward the double-double total,
 * a quadruple-double also counts toward triple+double, and so on — these are cumulative, not exclusive buckets. */
export interface SeasonMilestones {
  doubleDoubles: number;
  tripleDoubles: number;
  quadrupleDoubles: number; // "4-double"
  quintupleDoubles: number; // "5-double" (5x5 game — double figures in every one of the five categories)
  gameHighPoints: number;
  gameHighRebounds: number;
  gameHighAssists: number;
  gameHighSteals: number;
  gameHighBlocks: number;
}

export function emptySeasonMilestones(): SeasonMilestones {
  return {
    doubleDoubles: 0, tripleDoubles: 0, quadrupleDoubles: 0, quintupleDoubles: 0,
    gameHighPoints: 0, gameHighRebounds: 0, gameHighAssists: 0, gameHighSteals: 0, gameHighBlocks: 0,
  };
}

/** One archived past season's line, pushed onto `careerHistory` when a season rolls over instead of being overwritten. */
export interface HistoricalAward { season: string; label: string; detail?: string }

/** One team's share of a player's regular season. */
export interface SeasonStint { teamId: string; stats: SeasonStatTotals; advanced?: import('./advancedStats').PlayerAdvanced; teamLabel?: string }

export interface CareerSeasonRecord {
  season: string; // the season string that just ended, e.g. "2026-27"
  teamId: TeamId | null;
  age: number;
  overall: number;
  stats: SeasonStatTotals;
  milestones: SeasonMilestones;
  playoffStats?: SeasonStatTotals; // absent for seasons archived before playoff splits existed
  advanced?: import('./advancedStats').PlayerAdvanced; // PER, win shares, usage… computed with that season's team context
  /** Per-team split when he played for more than one team that season (totals above are the combined season). */
  stints?: SeasonStint[];
  /** Imported from real NBA history (never simulated). */
  imported?: boolean;
  /** Stat fields the era did not record — shown as "—", never as 0. */
  missing?: MissingStat[];
  /** Team label as it was that season (e.g. SEA) when it differs from today's franchise id. */
  teamLabel?: string;
  /** Start-of-season Overall (Court Vision's own, from statistics) and its provenance, for imported seasons. */
  rating?: { ovr: number; source: string };
}

/** A stat an imported historical season did not record. rebSplit = total rebounds known, offensive/defensive split not. */
export type MissingStat = keyof SeasonStatTotals | 'rebSplit' | 'gs' | 'doubleDoubles' | 'tripleDoubles' | 'gameHighs';

export interface PlayerIdentity {
  id: PlayerId;
  firstName: string;
  lastName: string;
  birthDate?: string;
  nationality?: string;
  draftYear?: number;
  draftPick?: number;
  draftTeamId?: TeamId;
  jerseyNumber?: number;
  handedness?: 'L' | 'R';
}

export interface Player {
  identity: PlayerIdentity;
  seasons: Record<string, PlayerSeason>; // keyed by season string
}

// ---- Team ----
export interface TeamSeason {
  teamId: TeamId;
  season: string;
  name: string;
  city: string;
  roster: PlayerId[];
  coach?: {
    paceTendency: number;
    threePointFrequency: number;
    starUsage: number;
    benchUsage: number;
    defensiveAggression: number;
    doubleTeamFrequency: number;
    switchingFrequency: number;
    zoneFrequency: number;
    pnrFrequency: number;
    postFrequency: number;
  };
  homeCourt?: string;
}

// ---- Game / rules settings ----
export interface EraRules {
  threePointLineDistance: number; // feet, 0 = no 3pt line
  shotClockSeconds: number; // 0 = no shot clock
  quarterLengthMinutes: number;
  numberOfQuarters: number;
  overtimeLengthMinutes: number;
  handChecking: boolean;
  zoneDefenseAllowed: boolean;
  defensiveThreeSeconds: boolean;
}

export interface GameSettings {
  era: EraRules;
  pacePreset: 'realistic' | 'balanced' | 'arcade' | 'chaos' | 'simulation' | 'custom';
  shootingVariance: number; // 0-1, low = predictable, high = chaotic
  foulFrequency: number; // multiplier, 1.0 = baseline
  turnoverFrequencyMultiplier: number; // 1.0 = baseline, tunable
  injuriesEnabled: boolean;
  injuryFrequencyMultiplier: number;
  fatigueEnabled: boolean;
  homeCourtAdvantage: number; // 0-1
  refereeStrictness: number; // 0-1
  sandboxMode: boolean; // allows >100 ratings, broken badges, exact minutes overrides
  teamChemistryEnabled: boolean; // optional system per spec section 90 - can be disabled without overpowering raw ability
  seed?: number; // deterministic simulation seed
  tradeDeadlinePct?: number; // fraction of the schedule played (0-1) at which the trade deadline hits; defaults to 0.65
  gamesPerSeason?: number; // used by finalizeNewSeasonSchedule for next season's schedule length once set
  freeAgencyDurationDays?: number; // length of the guided free-agency window; defaults to 30
}

export const REALISTIC_ERA_MODERN: EraRules = {
  threePointLineDistance: 23.75,
  shotClockSeconds: 24,
  quarterLengthMinutes: 12,
  numberOfQuarters: 4,
  overtimeLengthMinutes: 5,
  handChecking: false,
  zoneDefenseAllowed: true,
  defensiveThreeSeconds: true,
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  era: REALISTIC_ERA_MODERN,
  pacePreset: 'realistic',
  shootingVariance: 0.5,
  foulFrequency: 1.0,
  turnoverFrequencyMultiplier: 1.0,
  injuriesEnabled: false,
  injuryFrequencyMultiplier: 1.0,
  fatigueEnabled: true,
  homeCourtAdvantage: 0.03,
  refereeStrictness: 0.5,
  sandboxMode: false,
  teamChemistryEnabled: true,
};

// ---- Era presets (spec §39) ----
export const ERA_PRESETS: Record<string, EraRules> = {
  '1960s': { threePointLineDistance: 0, shotClockSeconds: 24, quarterLengthMinutes: 12, numberOfQuarters: 4, overtimeLengthMinutes: 5, handChecking: true, zoneDefenseAllowed: false, defensiveThreeSeconds: false },
  '1970s': { threePointLineDistance: 0, shotClockSeconds: 24, quarterLengthMinutes: 12, numberOfQuarters: 4, overtimeLengthMinutes: 5, handChecking: true, zoneDefenseAllowed: false, defensiveThreeSeconds: false },
  '1980s': { threePointLineDistance: 23.75, shotClockSeconds: 24, quarterLengthMinutes: 12, numberOfQuarters: 4, overtimeLengthMinutes: 5, handChecking: true, zoneDefenseAllowed: false, defensiveThreeSeconds: false },
  '1990s': { threePointLineDistance: 22.0, shotClockSeconds: 24, quarterLengthMinutes: 12, numberOfQuarters: 4, overtimeLengthMinutes: 5, handChecking: true, zoneDefenseAllowed: false, defensiveThreeSeconds: false },
  '2000s': { threePointLineDistance: 23.75, shotClockSeconds: 24, quarterLengthMinutes: 12, numberOfQuarters: 4, overtimeLengthMinutes: 5, handChecking: true, zoneDefenseAllowed: true, defensiveThreeSeconds: false },
  '2010s': { threePointLineDistance: 23.75, shotClockSeconds: 24, quarterLengthMinutes: 12, numberOfQuarters: 4, overtimeLengthMinutes: 5, handChecking: false, zoneDefenseAllowed: true, defensiveThreeSeconds: true },
  '2020s': { threePointLineDistance: 23.75, shotClockSeconds: 24, quarterLengthMinutes: 12, numberOfQuarters: 4, overtimeLengthMinutes: 5, handChecking: false, zoneDefenseAllowed: true, defensiveThreeSeconds: true },
  'modern': REALISTIC_ERA_MODERN,
};
