export interface LeagueRulesSettings {
  // Clock rotations, coaching and the annual All-Star vote; optional for older saves.
  minutesVariance?: number;
  rotationStintMinutes?: number;
  blowoutBenchThreshold?: number;
  personalFoulLimit?: number;
  coachingImpact?: number;
  allStarEnabled?: boolean;
  allStarBreakPercent?: number;
  allStarFanWeight?: number;
  allStarPlayerWeight?: number;
  allStarCoachWeight?: number;

  // ---- 1. League Structure ----
  teamsPerConference: number;
  numberOfConferences: number;
  divisionsEnabled: boolean;
  teamsPerDivision: number;
  numberOfDivisions: number;
  expansionEnabled: boolean;
  expansionFrequencyYears: number;
  expansionTeamCount: number;
  relocationEnabled: boolean;
  relocationFrequencyYears: number;
  contractionEnabled: boolean;
  contractionFrequencyYears: number;
  minimumTeams: number;
  maximumTeams: number;
  conferenceAlignment: 'geographic' | 'competitive' | 'random';
  divisionAlignment: 'geographic' | 'competitive' | 'random';
  protectedRivalries: boolean;
  rivalryScheduleFrequency: number;
  leagueRealignmentFrequencyYears: number;

  // ---- 2. Schedule ----
  gamesPerSeason: number;
  minimumGamesPerTeam: number;
  maximumGamesPerTeam: number;
  homeAwayBalance: number;
  divisionGameFrequency: number;
  conferenceGameFrequency: number;
  nonConferenceGameFrequency: number;
  rivalryGameFrequency: number;
  backToBackFrequency: number;
  maxConsecutiveRoadGames: number;
  maxConsecutiveHomeGames: number;
  restDaysBetweenGames: number;
  travelDistanceConsideration: boolean;
  travelFatigue: number;
  scheduleStrengthWeighting: number;
  scheduleRandomness: number;
  christmasGames: boolean;
  openingNightGames: boolean;
  rivalryWeek: boolean;
  finalWeekSchedulingRules: 'standard' | 'seeding-priority' | 'random';

  // ---- 3. Game Rules ----
  numberOfTimeouts: number;
  timeoutCarryover: boolean;
  teamFoulLimit: number;
  bonusRuleFoulCount: number;
  doubleBonusFoulCount: number;
  defensiveThreeSecondsEnabled: boolean;
  offensiveThreeSecondsEnabled: boolean;
  fiveSecondInbound: boolean;
  eightSecondBackcourt: boolean;
  backcourtViolationEnabled: boolean;
  goaltendingRules: boolean;
  basketInterference: boolean;
  travelingStrictness: number;
  carryingStrictness: number;
  illegalScreenFrequency: number;
  floppingPenalties: boolean;
  technicalFoulFrequency: number;
  ejectionRulesStrictness: number;
  overtimePossessionRules: 'jump-ball' | 'possession-arrow' | 'coin-flip';
  jumpBallFrequency: number;

  // ---- 4. Simulation Engine ----
  possessionsPerGame: number;
  offensiveEfficiency: number;
  defensiveEfficiency: number;
  shotFrequency: number;
  threePointFrequency: number;
  midrangeFrequency: number;
  rimFrequency: number;
  dunkFrequency: number;
  layupFrequency: number;
  freeThrowFrequency: number;
  offensiveReboundFrequency: number;
  defensiveReboundFrequency: number;
  assistFrequency: number;
  stealFrequency: number;
  blockFrequency: number;
  fastBreakFrequency: number;
  transitionFrequency: number;
  isolationFrequency: number;
  pickAndRollFrequency: number;
  postUpFrequency: number;
  offBallMovement: number;
  shotClockUsage: number;

  // ---- 5. Shooting ----
  threePointDifficulty: number;
  midrangeDifficulty: number;
  layupDifficulty: number;
  dunkSuccessRate: number;
  freeThrowDifficulty: number;
  contestedShotPenalty: number;
  openShotBonus: number;
  wideOpenShotBonus: number;
  defenderProximityImpact: number;
  shotCreationDifficulty: number;
  pullUpShootingDifficulty: number;
  stepBackShootingDifficulty: number;
  fadeawayDifficulty: number;
  catchAndShootBonus: number;
  cornerThreeBonus: number;
  aboveBreakThreeDifficulty: number;
  longTwoFrequency: number;
  heavilyContestedShotFrequency: number;
  shotQualityImportance: number;
  hotColdStreakImpact: number;

  // ---- 6. Defense ----
  perimeterDefenseImpact: number;
  interiorDefenseImpact: number;
  helpDefense: number;
  defensiveRotations: number;
  closeoutEffectiveness: number;
  contestEffectiveness: number;
  stealSuccess: number;
  blockSuccess: number;
  chargeFrequency: number;
  deflectionFrequency: number;
  screenNavigation: number;
  pickAndRollDefense: number;
  postDefense: number;
  rimProtection: number;
  transitionDefense: number;
  defensiveCommunication: number;
  defensiveIQImpact: number;
  defensiveMatchupImportance: number;
  positionMismatchPenalty: number;
  defensiveVersatility: number;

  // ---- 7. Player Development ----
  developmentSpeed: number;
  developmentRandomness: number;
  potentialAccuracy: number;
  potentialVolatility: number;
  ageDevelopmentCurve: 'early-peak' | 'standard' | 'late-bloomer';
  rookieDevelopmentBonus: number;
  youngPlayerDevelopment: number;
  primeDevelopment: number;
  veteranDevelopment: number;
  lateCareerDecline: number;
  athleticDecline: number;
  shootingDevelopment: number;
  finishingDevelopment: number;
  passingDevelopment: number;
  defenseDevelopment: number;
  reboundingDevelopment: number;
  mentalDevelopment: number;
  developmentFromPlayingTime: number;
  developmentFromCoaching: number;
  developmentFromTraining: number;

  // ---- 8. Aging & Decline ----
  agingRandomness: number;
  peakAgeShiftYears: number;
  peakDurationYears: number;
  declineStartingAgeShiftYears: number;
  declineSpeed: number;
  athleticDeclineRate: number;
  shootingDeclineRate: number;
  defensiveDeclineRate: number;
  durabilityDeclineRate: number;
  injuryRelatedDecline: number;
  veteranConsistency: number;
  lateCareerResurgenceChance: number;
  retirementAgeShiftYears: number;
  earlyRetirementChance: number;
  forcedRetirementChance: number;

  // ---- 9. Injuries ----
  minorInjuryFrequency: number;
  majorInjuryFrequency: number;
  careerEndingInjuriesEnabled: boolean;
  injurySeverityRandomness: number;
  recoveryTimeMultiplier: number;
  reinjuryChance: number;
  injuryProneImpact: number;
  durabilityAttributeImpact: number;
  fatigueInjuryImpact: number;
  overuseInjuryImpact: number;
  playoffInjuryFrequency: number;
  practiceInjuryFrequency: number;
  trainingInjuryFrequency: number;
  injuryTreatmentEffectiveness: number;
  medicalStaffImpact: number;
  injuryRecoveryDevelopment: number;
  longTermInjuryEffects: boolean;
  injuryReportingDetail: 'basic' | 'detailed';

  // ---- 10. Finances & Salary ----
  minimumTeamSalaryPct: number;
  maximumContractLengthYears: number;
  rookieContractLengthYears: number;
  minimumSalary: number;
  maximumSalary: number;
  veteranMinimum: number;
  birdRightsEnabled: boolean;
  earlyBirdRightsEnabled: boolean;
  midLevelExceptionAmount: number;
  biAnnualExceptionAmount: number;
  tradeExceptionsEnabled: boolean;
  contractInflationPct: number;
  salaryGrowthPct: number;
  revenueGrowthPct: number;
  ticketRevenueWeight: number;
  merchandiseRevenueWeight: number;
  tvRevenueWeight: number;
  sponsorshipRevenueWeight: number;
  teamProfitabilityImpact: number;

  // ---- 11. Trades & Transactions ----
  tradeFrequency: number;
  tradeAIAggressiveness: number;
  tradeDeadlineEnabled: boolean;
  tradeRestrictionsEnabled: boolean;
  noTradeClausesEnabled: boolean;
  playerTradeRequestsEnabled: boolean;
  playerTradeResistance: number;
  aiRebuildingTendency: number;
  aiWinNowTendency: number;
  aiValueOfDraftPicks: number;
  aiValueOfProspects: number;
  aiValueOfVeterans: number;
  tradeRandomness: number;
  tradeVetoSystemEnabled: boolean;
  tradeEvaluationStrictness: number;
  multiTeamTradesEnabled: boolean;
  signAndTradesEnabled: boolean;
  draftPickProtectionsEnabled: boolean;
  futurePickTradingEnabled: boolean;

  // ---- 12. Free Agency ----
  playerDemandVariance: number;
  playerLoyalty: number;
  homeTeamPreference: number;
  winningPreference: number;
  moneyPreference: number;
  playingTimePreference: number;
  marketSizePreference: number;
  championshipPreference: number;
  teamReputationImpact: number;
  contractNegotiationDifficulty: number;
  freeAgentRandomness: number;
  aiFreeAgentAggressiveness: number;
  aiOverpayTendency: number;
  freeAgentTamperingEnabled: boolean;
  signAndTradeFrequency: number;
  veteranDiscountTendency: number;
  maxContractFrequency: number;
  freeAgentRetirementDecisions: boolean;
}

export const DEFAULT_LEAGUE_RULES: LeagueRulesSettings = {
  minutesVariance: 50, rotationStintMinutes: 5, blowoutBenchThreshold: 22, personalFoulLimit: 6,
  coachingImpact: 100, allStarEnabled: true, allStarBreakPercent: 58,
  allStarFanWeight: 50, allStarPlayerWeight: 25, allStarCoachWeight: 25,
  teamsPerConference: 15, numberOfConferences: 2, divisionsEnabled: true, teamsPerDivision: 5, numberOfDivisions: 6,
  expansionEnabled: false, expansionFrequencyYears: 5, expansionTeamCount: 1, relocationEnabled: false,
  relocationFrequencyYears: 10, contractionEnabled: false, contractionFrequencyYears: 10, minimumTeams: 4,
  maximumTeams: 32, conferenceAlignment: 'geographic', divisionAlignment: 'geographic', protectedRivalries: true,
  rivalryScheduleFrequency: 50, leagueRealignmentFrequencyYears: 0,

  gamesPerSeason: 82, minimumGamesPerTeam: 82, maximumGamesPerTeam: 82, homeAwayBalance: 50,
  divisionGameFrequency: 50, conferenceGameFrequency: 60, nonConferenceGameFrequency: 40, rivalryGameFrequency: 50,
  backToBackFrequency: 50, maxConsecutiveRoadGames: 5, maxConsecutiveHomeGames: 5, restDaysBetweenGames: 1,
  travelDistanceConsideration: false, travelFatigue: 30, scheduleStrengthWeighting: 50, scheduleRandomness: 50,
  christmasGames: true, openingNightGames: true, rivalryWeek: false, finalWeekSchedulingRules: 'standard',

  numberOfTimeouts: 7, timeoutCarryover: false, teamFoulLimit: 5, bonusRuleFoulCount: 5, doubleBonusFoulCount: 10,
  defensiveThreeSecondsEnabled: true, offensiveThreeSecondsEnabled: true, fiveSecondInbound: true,
  eightSecondBackcourt: true, backcourtViolationEnabled: true, goaltendingRules: true, basketInterference: true,
  travelingStrictness: 50, carryingStrictness: 50, illegalScreenFrequency: 50, floppingPenalties: true,
  technicalFoulFrequency: 50, ejectionRulesStrictness: 50, overtimePossessionRules: 'jump-ball', jumpBallFrequency: 50,

  possessionsPerGame: 100, offensiveEfficiency: 50, defensiveEfficiency: 50, shotFrequency: 50,
  threePointFrequency: 50, midrangeFrequency: 50, rimFrequency: 50, dunkFrequency: 50, layupFrequency: 50,
  freeThrowFrequency: 50, offensiveReboundFrequency: 50, defensiveReboundFrequency: 50, assistFrequency: 50,
  stealFrequency: 50, blockFrequency: 50, fastBreakFrequency: 50, transitionFrequency: 50, isolationFrequency: 50,
  pickAndRollFrequency: 50, postUpFrequency: 50, offBallMovement: 50, shotClockUsage: 50,

  threePointDifficulty: 50, midrangeDifficulty: 50, layupDifficulty: 50, dunkSuccessRate: 70,
  freeThrowDifficulty: 50, contestedShotPenalty: 50, openShotBonus: 50, wideOpenShotBonus: 60,
  defenderProximityImpact: 50, shotCreationDifficulty: 50, pullUpShootingDifficulty: 50, stepBackShootingDifficulty: 50,
  fadeawayDifficulty: 50, catchAndShootBonus: 50, cornerThreeBonus: 50, aboveBreakThreeDifficulty: 50,
  longTwoFrequency: 30, heavilyContestedShotFrequency: 40, shotQualityImportance: 50, hotColdStreakImpact: 30,

  perimeterDefenseImpact: 50, interiorDefenseImpact: 50, helpDefense: 50, defensiveRotations: 50,
  closeoutEffectiveness: 50, contestEffectiveness: 50, stealSuccess: 50, blockSuccess: 50, chargeFrequency: 30,
  deflectionFrequency: 40, screenNavigation: 50, pickAndRollDefense: 50, postDefense: 50, rimProtection: 50,
  transitionDefense: 50, defensiveCommunication: 50, defensiveIQImpact: 50, defensiveMatchupImportance: 50,
  positionMismatchPenalty: 50, defensiveVersatility: 50,

  developmentSpeed: 100, developmentRandomness: 100, potentialAccuracy: 70, potentialVolatility: 30,
  ageDevelopmentCurve: 'standard', rookieDevelopmentBonus: 100, youngPlayerDevelopment: 100, primeDevelopment: 100,
  veteranDevelopment: 100, lateCareerDecline: 100, athleticDecline: 50, shootingDevelopment: 50,
  finishingDevelopment: 50, passingDevelopment: 50, defenseDevelopment: 50, reboundingDevelopment: 50,
  mentalDevelopment: 50, developmentFromPlayingTime: 100, developmentFromCoaching: 50, developmentFromTraining: 50,

  agingRandomness: 50, peakAgeShiftYears: 0, peakDurationYears: 3, declineStartingAgeShiftYears: 0,
  declineSpeed: 100, athleticDeclineRate: 50, shootingDeclineRate: 40, defensiveDeclineRate: 45,
  durabilityDeclineRate: 40, injuryRelatedDecline: 50, veteranConsistency: 50, lateCareerResurgenceChance: 10,
  retirementAgeShiftYears: 0, earlyRetirementChance: 0, forcedRetirementChance: 0,

  minorInjuryFrequency: 50, majorInjuryFrequency: 20, careerEndingInjuriesEnabled: false, injurySeverityRandomness: 50,
  recoveryTimeMultiplier: 100, reinjuryChance: 20, injuryProneImpact: 50, durabilityAttributeImpact: 50,
  fatigueInjuryImpact: 50, overuseInjuryImpact: 50, playoffInjuryFrequency: 50, practiceInjuryFrequency: 20,
  trainingInjuryFrequency: 20, injuryTreatmentEffectiveness: 50, medicalStaffImpact: 50, injuryRecoveryDevelopment: 30,
  longTermInjuryEffects: false, injuryReportingDetail: 'detailed',

  minimumTeamSalaryPct: 90, maximumContractLengthYears: 5, rookieContractLengthYears: 4, minimumSalary: 1200000,
  maximumSalary: 55000000, veteranMinimum: 2500000, birdRightsEnabled: true, earlyBirdRightsEnabled: true,
  midLevelExceptionAmount: 12800000, biAnnualExceptionAmount: 4500000, tradeExceptionsEnabled: true,
  contractInflationPct: 3, salaryGrowthPct: 3, revenueGrowthPct: 3, ticketRevenueWeight: 40,
  merchandiseRevenueWeight: 20, tvRevenueWeight: 30, sponsorshipRevenueWeight: 10, teamProfitabilityImpact: 30,

  tradeFrequency: 50, tradeAIAggressiveness: 50, tradeDeadlineEnabled: true, tradeRestrictionsEnabled: true,
  noTradeClausesEnabled: false, playerTradeRequestsEnabled: false, playerTradeResistance: 50,
  aiRebuildingTendency: 50, aiWinNowTendency: 50, aiValueOfDraftPicks: 50, aiValueOfProspects: 50,
  aiValueOfVeterans: 50, tradeRandomness: 30, tradeVetoSystemEnabled: false, tradeEvaluationStrictness: 50,
  multiTeamTradesEnabled: false, signAndTradesEnabled: false, draftPickProtectionsEnabled: false,
  futurePickTradingEnabled: false,

  playerDemandVariance: 50, playerLoyalty: 50, homeTeamPreference: 50, winningPreference: 50, moneyPreference: 50,
  playingTimePreference: 50, marketSizePreference: 30, championshipPreference: 50, teamReputationImpact: 30,
  contractNegotiationDifficulty: 50, freeAgentRandomness: 50, aiFreeAgentAggressiveness: 50, aiOverpayTendency: 30,
  freeAgentTamperingEnabled: false, signAndTradeFrequency: 20, veteranDiscountTendency: 30, maxContractFrequency: 20,
  freeAgentRetirementDecisions: true,
};
