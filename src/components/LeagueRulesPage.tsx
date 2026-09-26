import { useState } from 'react';
import { DEFAULT_LEAGUE_RULES, type LeagueRulesSettings } from '../simulation/leagueRules';

type FieldKey = keyof LeagueRulesSettings;

interface FieldOverride {
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: string[];
  label?: string;
}

// Fields whose real-world meaning needs a custom range/unit instead of the generic 0-100 "relative strength" slider.
const OVERRIDES: Partial<Record<FieldKey, FieldOverride>> = {
  minutesVariance: { label: 'Game-to-game minute variation', unit: '%' },
  rotationStintMinutes: { label: 'Default stint length', min: 2, max: 8, step: 0.5, unit: 'min' },
  blowoutBenchThreshold: { min: 10, max: 40, unit: 'pts' },
  personalFoulLimit: { min: 4, max: 10, unit: 'fouls' },
  coachingImpact: { min: 0, max: 200, unit: '%' },
  allStarBreakPercent: { min: 25, max: 80, unit: '% of season' },
  allStarFanWeight: { label: 'Fan vote weight' }, allStarPlayerWeight: { label: 'Player vote weight' },
  allStarCoachWeight: { label: 'Coach vote weight' },
  teamsPerConference: { min: 1, max: 20 }, numberOfConferences: { min: 1, max: 4 },
  teamsPerDivision: { min: 1, max: 10 }, numberOfDivisions: { min: 1, max: 12 },
  expansionFrequencyYears: { min: 1, max: 20, unit: 'yrs' }, expansionTeamCount: { min: 1, max: 6 },
  relocationFrequencyYears: { min: 1, max: 20, unit: 'yrs' }, contractionFrequencyYears: { min: 1, max: 20, unit: 'yrs' },
  minimumTeams: { min: 2, max: 32 }, maximumTeams: { min: 2, max: 32 },
  conferenceAlignment: { options: ['geographic', 'competitive', 'random'] },
  divisionAlignment: { options: ['geographic', 'competitive', 'random'] },
  leagueRealignmentFrequencyYears: { min: 0, max: 20, unit: 'yrs' },

  gamesPerSeason: { min: 20, max: 82, unit: 'games' }, minimumGamesPerTeam: { min: 20, max: 82, unit: 'games' },
  maximumGamesPerTeam: { min: 20, max: 82, unit: 'games' },
  maxConsecutiveRoadGames: { min: 1, max: 10, unit: 'games' }, maxConsecutiveHomeGames: { min: 1, max: 10, unit: 'games' },
  restDaysBetweenGames: { min: 0, max: 5, unit: 'days' },
  finalWeekSchedulingRules: { options: ['standard', 'seeding-priority', 'random'] },

  numberOfTimeouts: { min: 2, max: 10 }, teamFoulLimit: { min: 3, max: 8 },
  bonusRuleFoulCount: { min: 3, max: 8 }, doubleBonusFoulCount: { min: 5, max: 12 },
  overtimePossessionRules: { options: ['jump-ball', 'possession-arrow', 'coin-flip'] },

  ageDevelopmentCurve: { options: ['early-peak', 'standard', 'late-bloomer'] },
  peakAgeShiftYears: { min: -5, max: 5, unit: 'yrs' }, peakDurationYears: { min: 1, max: 10, unit: 'yrs' },
  declineStartingAgeShiftYears: { min: -5, max: 5, unit: 'yrs' }, retirementAgeShiftYears: { min: -5, max: 10, unit: 'yrs' },

  injuryReportingDetail: { options: ['basic', 'detailed'] },

  minimumTeamSalaryPct: { min: 0, max: 100, unit: '%' }, maximumContractLengthYears: { min: 1, max: 7, unit: 'yrs' },
  rookieContractLengthYears: { min: 1, max: 5, unit: 'yrs' },
  minimumSalary: { min: 500000, max: 5000000, step: 100000, unit: '$' },
  maximumSalary: { min: 10000000, max: 80000000, step: 1000000, unit: '$' },
  veteranMinimum: { min: 500000, max: 5000000, step: 100000, unit: '$' },
  midLevelExceptionAmount: { min: 1000000, max: 20000000, step: 500000, unit: '$' },
  biAnnualExceptionAmount: { min: 500000, max: 10000000, step: 250000, unit: '$' },
  contractInflationPct: { min: 0, max: 15, unit: '%' }, salaryGrowthPct: { min: 0, max: 15, unit: '%' },
  revenueGrowthPct: { min: 0, max: 15, unit: '%' },
};

interface Section {
  title: string;
  fields: FieldKey[];
}

const SECTIONS: Section[] = [
  { title: '0. Rotations, Coaching & All-Star', fields: ['minutesVariance', 'rotationStintMinutes', 'blowoutBenchThreshold', 'personalFoulLimit', 'coachingImpact', 'allStarEnabled', 'allStarBreakPercent', 'allStarFanWeight', 'allStarPlayerWeight', 'allStarCoachWeight'] },
  {
    title: '1. League Structure',
    fields: ['teamsPerConference', 'numberOfConferences', 'divisionsEnabled', 'teamsPerDivision', 'numberOfDivisions',
      'expansionEnabled', 'expansionFrequencyYears', 'expansionTeamCount', 'relocationEnabled', 'relocationFrequencyYears',
      'contractionEnabled', 'contractionFrequencyYears', 'minimumTeams', 'maximumTeams', 'conferenceAlignment',
      'divisionAlignment', 'protectedRivalries', 'rivalryScheduleFrequency', 'leagueRealignmentFrequencyYears'],
  },
  {
    title: '2. Schedule',
    fields: ['gamesPerSeason', 'minimumGamesPerTeam', 'maximumGamesPerTeam', 'homeAwayBalance', 'divisionGameFrequency',
      'conferenceGameFrequency', 'nonConferenceGameFrequency', 'rivalryGameFrequency', 'backToBackFrequency',
      'maxConsecutiveRoadGames', 'maxConsecutiveHomeGames', 'restDaysBetweenGames', 'travelDistanceConsideration',
      'travelFatigue', 'scheduleStrengthWeighting', 'scheduleRandomness', 'christmasGames', 'openingNightGames',
      'rivalryWeek', 'finalWeekSchedulingRules'],
  },
  {
    title: '3. Game Rules',
    fields: ['numberOfTimeouts', 'timeoutCarryover', 'teamFoulLimit', 'bonusRuleFoulCount', 'doubleBonusFoulCount',
      'defensiveThreeSecondsEnabled', 'offensiveThreeSecondsEnabled', 'fiveSecondInbound', 'eightSecondBackcourt',
      'backcourtViolationEnabled', 'goaltendingRules', 'basketInterference', 'travelingStrictness', 'carryingStrictness',
      'illegalScreenFrequency', 'floppingPenalties', 'technicalFoulFrequency', 'ejectionRulesStrictness',
      'overtimePossessionRules', 'jumpBallFrequency'],
  },
  {
    title: '4. Simulation Engine',
    fields: ['possessionsPerGame', 'offensiveEfficiency', 'defensiveEfficiency', 'shotFrequency', 'threePointFrequency',
      'midrangeFrequency', 'rimFrequency', 'dunkFrequency', 'layupFrequency', 'freeThrowFrequency',
      'offensiveReboundFrequency', 'defensiveReboundFrequency', 'assistFrequency', 'stealFrequency', 'blockFrequency',
      'fastBreakFrequency', 'transitionFrequency', 'isolationFrequency', 'pickAndRollFrequency', 'postUpFrequency',
      'offBallMovement', 'shotClockUsage'],
  },
  {
    title: '5. Shooting',
    fields: ['threePointDifficulty', 'midrangeDifficulty', 'layupDifficulty', 'dunkSuccessRate', 'freeThrowDifficulty',
      'contestedShotPenalty', 'openShotBonus', 'wideOpenShotBonus', 'defenderProximityImpact', 'shotCreationDifficulty',
      'pullUpShootingDifficulty', 'stepBackShootingDifficulty', 'fadeawayDifficulty', 'catchAndShootBonus',
      'cornerThreeBonus', 'aboveBreakThreeDifficulty', 'longTwoFrequency', 'heavilyContestedShotFrequency',
      'shotQualityImportance', 'hotColdStreakImpact'],
  },
  {
    title: '6. Defense',
    fields: ['perimeterDefenseImpact', 'interiorDefenseImpact', 'helpDefense', 'defensiveRotations',
      'closeoutEffectiveness', 'contestEffectiveness', 'stealSuccess', 'blockSuccess', 'chargeFrequency',
      'deflectionFrequency', 'screenNavigation', 'pickAndRollDefense', 'postDefense', 'rimProtection',
      'transitionDefense', 'defensiveCommunication', 'defensiveIQImpact', 'defensiveMatchupImportance',
      'positionMismatchPenalty', 'defensiveVersatility'],
  },
  {
    title: '7. Player Development',
    fields: ['developmentSpeed', 'developmentRandomness', 'potentialAccuracy', 'potentialVolatility',
      'ageDevelopmentCurve', 'rookieDevelopmentBonus', 'youngPlayerDevelopment', 'primeDevelopment',
      'veteranDevelopment', 'lateCareerDecline', 'athleticDecline', 'shootingDevelopment', 'finishingDevelopment',
      'passingDevelopment', 'defenseDevelopment', 'reboundingDevelopment', 'mentalDevelopment',
      'developmentFromPlayingTime', 'developmentFromCoaching', 'developmentFromTraining'],
  },
  {
    title: '8. Aging & Decline',
    fields: ['agingRandomness', 'peakAgeShiftYears', 'peakDurationYears', 'declineStartingAgeShiftYears',
      'declineSpeed', 'athleticDeclineRate', 'shootingDeclineRate', 'defensiveDeclineRate', 'durabilityDeclineRate',
      'injuryRelatedDecline', 'veteranConsistency', 'lateCareerResurgenceChance', 'retirementAgeShiftYears',
      'earlyRetirementChance', 'forcedRetirementChance'],
  },
  {
    title: '9. Injuries',
    fields: ['minorInjuryFrequency', 'majorInjuryFrequency', 'careerEndingInjuriesEnabled', 'injurySeverityRandomness',
      'recoveryTimeMultiplier', 'reinjuryChance', 'injuryProneImpact', 'durabilityAttributeImpact',
      'fatigueInjuryImpact', 'overuseInjuryImpact', 'playoffInjuryFrequency', 'practiceInjuryFrequency',
      'trainingInjuryFrequency', 'injuryTreatmentEffectiveness', 'medicalStaffImpact', 'injuryRecoveryDevelopment',
      'longTermInjuryEffects', 'injuryReportingDetail'],
  },
  {
    title: '10. Finances & Salary',
    fields: ['minimumTeamSalaryPct', 'maximumContractLengthYears', 'rookieContractLengthYears', 'minimumSalary',
      'maximumSalary', 'veteranMinimum', 'birdRightsEnabled', 'earlyBirdRightsEnabled', 'midLevelExceptionAmount',
      'biAnnualExceptionAmount', 'tradeExceptionsEnabled', 'contractInflationPct', 'salaryGrowthPct',
      'revenueGrowthPct', 'ticketRevenueWeight', 'merchandiseRevenueWeight', 'tvRevenueWeight',
      'sponsorshipRevenueWeight', 'teamProfitabilityImpact'],
  },
  {
    title: '11. Trades & Transactions',
    fields: ['tradeFrequency', 'tradeAIAggressiveness', 'tradeDeadlineEnabled', 'tradeRestrictionsEnabled',
      'noTradeClausesEnabled', 'playerTradeRequestsEnabled', 'playerTradeResistance', 'aiRebuildingTendency',
      'aiWinNowTendency', 'aiValueOfDraftPicks', 'aiValueOfProspects', 'aiValueOfVeterans', 'tradeRandomness',
      'tradeVetoSystemEnabled', 'tradeEvaluationStrictness', 'multiTeamTradesEnabled', 'signAndTradesEnabled',
      'draftPickProtectionsEnabled', 'futurePickTradingEnabled'],
  },
  {
    title: '12. Free Agency',
    fields: ['playerDemandVariance', 'playerLoyalty', 'homeTeamPreference', 'winningPreference', 'moneyPreference',
      'playingTimePreference', 'marketSizePreference', 'championshipPreference', 'teamReputationImpact',
      'contractNegotiationDifficulty', 'freeAgentRandomness', 'aiFreeAgentAggressiveness', 'aiOverpayTendency',
      'freeAgentTamperingEnabled', 'signAndTradeFrequency', 'veteranDiscountTendency', 'maxContractFrequency',
      'freeAgentRetirementDecisions'],
  },
];

// Fields the simulation actually reads today - everything else is stored and displayed but not yet wired into
// engine behavior. Shown as a small "Live" tag so the panel doesn't overstate what's simulated.
const WIRED_FIELDS = new Set<FieldKey>([
  'minutesVariance', 'rotationStintMinutes', 'blowoutBenchThreshold', 'personalFoulLimit', 'coachingImpact',
  'allStarEnabled', 'allStarBreakPercent', 'allStarFanWeight', 'allStarPlayerWeight', 'allStarCoachWeight',
  // Player development & aging (engine/development.ts)
  'gamesPerSeason', 'developmentSpeed', 'developmentRandomness', 'rookieDevelopmentBonus', 'youngPlayerDevelopment',
  'primeDevelopment', 'veteranDevelopment', 'lateCareerDecline', 'developmentFromPlayingTime', 'peakAgeShiftYears',
  'declineSpeed', 'agingRandomness', 'athleticDeclineRate', 'shootingDevelopment', 'finishingDevelopment',
  'passingDevelopment', 'defenseDevelopment', 'mentalDevelopment', 'retirementAgeShiftYears',
  'earlyRetirementChance', 'forcedRetirementChance', 'recoveryTimeMultiplier',
  // AI front-office behavior (aiGM.ts)
  'aiFreeAgentAggressiveness', 'tradeAIAggressiveness', 'aiWinNowTendency', 'aiRebuildingTendency',
  // Team finances (finances.ts)
  'ticketRevenueWeight', 'merchandiseRevenueWeight', 'tvRevenueWeight', 'sponsorshipRevenueWeight', 'teamProfitabilityImpact',
  // Live in-game simulation engine (engine/ruleMods.ts, consumed by game.ts/possession.ts/shot.ts/turnover.ts/rebound.ts/ballHandler.ts)
  'possessionsPerGame', 'offensiveEfficiency', 'defensiveEfficiency',
  'threePointFrequency', 'midrangeFrequency', 'rimFrequency', 'dunkFrequency', 'layupFrequency', 'longTwoFrequency',
  'freeThrowFrequency', 'offensiveReboundFrequency', 'defensiveReboundFrequency', 'assistFrequency',
  'stealFrequency', 'blockFrequency', 'fastBreakFrequency', 'transitionFrequency', 'isolationFrequency',
  'pickAndRollFrequency', 'postUpFrequency',
  'threePointDifficulty', 'midrangeDifficulty', 'layupDifficulty', 'dunkSuccessRate', 'freeThrowDifficulty',
  'contestedShotPenalty', 'openShotBonus', 'wideOpenShotBonus', 'defenderProximityImpact', 'shotCreationDifficulty',
  'pullUpShootingDifficulty', 'stepBackShootingDifficulty', 'fadeawayDifficulty', 'catchAndShootBonus',
  'cornerThreeBonus', 'aboveBreakThreeDifficulty', 'heavilyContestedShotFrequency', 'shotQualityImportance',
  'perimeterDefenseImpact', 'interiorDefenseImpact', 'helpDefense', 'defensiveRotations',
  'closeoutEffectiveness', 'contestEffectiveness', 'stealSuccess', 'blockSuccess', 'chargeFrequency',
  'pickAndRollDefense', 'postDefense', 'rimProtection', 'transitionDefense', 'defensiveIQImpact',
]);

function humanize(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).replace(/\bAi\b/g, 'AI').replace(/\bIq\b/g, 'IQ');
}

// One-line explanation of what each field represents, shown as a hover tooltip on its label so the
// (very long) settings grid stays scannable while still explaining every single control.
const DESCRIPTIONS: Partial<Record<FieldKey, string>> = {
  minutesVariance: 'Changes flexible minute targets slightly each game. Zero removes target variation; actual playing time still follows substitutions and game events.',
  rotationStintMinutes: 'Preferred stretch on court before a coach looks for rest. Individual team stint settings take priority.',
  blowoutBenchThreshold: 'Late in games with this score margin, coaches favor reserves. EXACT minute budgets still take priority when possible.',
  personalFoulLimit: 'A player leaves the game after reaching this number of personal fouls.',
  coachingImpact: 'Scales named coach effects and tactical scheme bonuses. 100% is normal; 0% removes these bonuses. Rotation and tempo preferences still apply.',
  allStarEnabled: 'Pause the regular season for voting results, contests and the All-Star exhibition. Disabling removes the pause and keeps existing results.',
  allStarBreakPercent: 'When the All-Star break falls in the schedule. Changing it affects the current season until the weekend is completed.',
  allStarFanWeight: 'Fans favor scoring, reputation and market size. All three vote weights are normalized to 100%; all zero restores a 50/25/25 split.',
  allStarPlayerWeight: 'Players favor production and ability. These votes help select the ten starters.',
  allStarCoachWeight: 'Coaches favor production, efficiency and winning. The coach vote also selects reserves.',

  // 1. League Structure
  teamsPerConference: 'How many teams belong to each conference.',
  numberOfConferences: 'How many conferences the league is split into.',
  divisionsEnabled: 'Whether teams are further grouped into divisions within each conference.',
  teamsPerDivision: 'How many teams belong to each division (when divisions are enabled).',
  numberOfDivisions: 'How many divisions each conference is split into.',
  expansionEnabled: 'Whether new expansion teams can join the league over time.',
  expansionFrequencyYears: 'How many years pass between new expansion teams joining.',
  expansionTeamCount: 'How many new teams join at once during an expansion event.',
  relocationEnabled: 'Whether a struggling franchise can relocate to a new city.',
  relocationFrequencyYears: 'How many years, on average, between team relocations.',
  contractionEnabled: 'Whether the league can shrink by folding a team entirely.',
  contractionFrequencyYears: 'How many years, on average, between contraction events.',
  minimumTeams: 'The floor the league will never shrink below.',
  maximumTeams: 'The ceiling the league will never grow past.',
  conferenceAlignment: 'How teams are assigned to conferences: by geography, by competitive balance, or randomly.',
  divisionAlignment: 'How teams are assigned to divisions: by geography, by competitive balance, or randomly.',
  protectedRivalries: 'Whether historic rivalry matchups are guaranteed a spot on the schedule every season.',
  rivalryScheduleFrequency: 'How often rivalry games are scheduled relative to other games.',
  leagueRealignmentFrequencyYears: 'How many years between full conference/division realignments (0 = never).',

  // 2. Schedule
  gamesPerSeason: 'How many games each team plays in a regular season.',
  minimumGamesPerTeam: 'The fewest games a team can be scheduled for, even with an uneven league size.',
  maximumGamesPerTeam: 'The most games a team can be scheduled for.',
  homeAwayBalance: 'How evenly each team\u2019s schedule is split between home and away games.',
  divisionGameFrequency: 'How often a team plays opponents from its own division relative to others.',
  conferenceGameFrequency: 'How often a team plays opponents from its own conference relative to others.',
  nonConferenceGameFrequency: 'How often a team plays opponents from the other conference.',
  rivalryGameFrequency: 'How often rivalry matchups appear in the schedule.',
  backToBackFrequency: 'How often teams are scheduled for back-to-back games with no rest day.',
  maxConsecutiveRoadGames: 'The longest road trip (consecutive away games) the schedule will create.',
  maxConsecutiveHomeGames: 'The longest home stand (consecutive home games) the schedule will create.',
  restDaysBetweenGames: 'The minimum days of rest guaranteed between a team\u2019s games.',
  travelDistanceConsideration: 'How much real travel distance between cities influences schedule construction.',
  travelFatigue: 'How much travel wears a team down (affects performance after long trips).',
  scheduleStrengthWeighting: 'How much strength-of-schedule balancing influences who plays whom.',
  scheduleRandomness: 'How much randomness is allowed in an otherwise-balanced schedule.',
  christmasGames: 'Whether marquee games are scheduled on Christmas Day.',
  openingNightGames: 'Whether marquee games are scheduled for opening night.',
  rivalryWeek: 'Whether a dedicated week of rivalry games is scheduled during the season.',
  finalWeekSchedulingRules: 'How the final week of the season is scheduled: standard, prioritizing playoff seeding, or random.',

  // 3. Game Rules
  numberOfTimeouts: 'How many timeouts each team gets per game.',
  timeoutCarryover: 'Whether unused timeouts carry over between halves/periods.',
  teamFoulLimit: 'How many team fouls per period before bonus free throws kick in.',
  bonusRuleFoulCount: 'The team-foul count that puts the other team into the bonus.',
  doubleBonusFoulCount: 'The team-foul count that puts the other team into the double bonus.',
  defensiveThreeSecondsEnabled: 'Whether defenders are penalized for camping in the paint too long.',
  offensiveThreeSecondsEnabled: 'Whether offensive players are penalized for camping in the paint too long.',
  fiveSecondInbound: 'Whether the 5-second inbound violation is enforced.',
  eightSecondBackcourt: 'Whether the 8-second backcourt violation is enforced.',
  backcourtViolationEnabled: 'Whether it\u2019s a violation for the offense to return the ball to the backcourt.',
  goaltendingRules: 'How strictly goaltending is called on blocked shots.',
  basketInterference: 'How strictly basket interference is called around the rim.',
  travelingStrictness: 'How strictly traveling violations are called.',
  carryingStrictness: 'How strictly carrying/palming violations are called.',
  illegalScreenFrequency: 'How often illegal screens get called during possessions.',
  floppingPenalties: 'How harshly flopping is penalized.',
  technicalFoulFrequency: 'How often technical fouls are handed out.',
  ejectionRulesStrictness: 'How strict the rules are around ejecting a player for accumulated fouls/technicals.',
  overtimePossessionRules: 'How the opening possession of overtime is decided.',
  jumpBallFrequency: 'How often jump-ball situations occur (held balls, start of game/overtime).',

  // 4. Simulation Engine
  possessionsPerGame: 'The target pace \u2014 roughly how many possessions each team gets per game.',
  offensiveEfficiency: 'A global multiplier on how efficiently offenses convert possessions into points.',
  defensiveEfficiency: 'A global multiplier on how effective defenses are at preventing points.',
  shotFrequency: 'How often possessions end in a shot attempt rather than a turnover or other outcome.',
  threePointFrequency: 'How often three-pointers are attempted relative to other shot types.',
  midrangeFrequency: 'How often mid-range shots are attempted relative to other shot types.',
  rimFrequency: 'How often shots at the rim are attempted relative to other shot types.',
  dunkFrequency: 'How often rim attempts are dunks specifically.',
  layupFrequency: 'How often rim attempts are layups specifically.',
  freeThrowFrequency: 'How often possessions result in free throw attempts.',
  offensiveReboundFrequency: 'How often the offense recovers its own missed shots.',
  defensiveReboundFrequency: 'How often the defense secures a rebound on a miss.',
  assistFrequency: 'How often made baskets are credited with an assist.',
  stealFrequency: 'How often defenders come away with a steal.',
  blockFrequency: 'How often defenders come away with a blocked shot.',
  fastBreakFrequency: 'How often possessions turn into fast-break opportunities.',
  transitionFrequency: 'How often the offense plays in transition rather than a set half-court possession.',
  isolationFrequency: 'How often possessions are built around one-on-one isolation play.',
  pickAndRollFrequency: 'How often possessions are built around a pick-and-roll action.',
  postUpFrequency: 'How often possessions are built around a post-up.',
  offBallMovement: 'How much off-ball movement (cuts, relocations) factors into shot creation.',
  shotClockUsage: 'How much of the shot clock offenses tend to use before shooting.',

  // 5. Shooting
  threePointDifficulty: 'How hard three-point shots are to make, all else equal.',
  midrangeDifficulty: 'How hard mid-range shots are to make, all else equal.',
  layupDifficulty: 'How hard layups are to make, all else equal.',
  dunkSuccessRate: 'The baseline make rate on dunk attempts.',
  freeThrowDifficulty: 'How hard free throws are to make, all else equal.',
  contestedShotPenalty: 'How much a contested shot\u2019s success chance is reduced versus an open one.',
  openShotBonus: 'How much an open shot\u2019s success chance is boosted.',
  wideOpenShotBonus: 'How much a wide-open shot\u2019s success chance is boosted, on top of the open-shot bonus.',
  defenderProximityImpact: 'How much a nearby defender affects shot quality, distinct from being formally \u201ccontested.\u201d',
  shotCreationDifficulty: 'How hard it is to create a good look for yourself off the dribble.',
  pullUpShootingDifficulty: 'How hard pull-up jumpers are to make relative to a catch-and-shoot look.',
  stepBackShootingDifficulty: 'How hard step-back jumpers are to make.',
  fadeawayDifficulty: 'How hard fadeaway jumpers are to make.',
  catchAndShootBonus: 'How much easier a catch-and-shoot look is than a self-created one.',
  cornerThreeBonus: 'How much easier a corner three is than an above-the-break three.',
  aboveBreakThreeDifficulty: 'How hard above-the-break threes are to make relative to corner threes.',
  longTwoFrequency: 'How often mid-range attempts specifically come from long-two range.',
  heavilyContestedShotFrequency: 'How often shots go up with a defender draped on the shooter.',
  shotQualityImportance: 'How much overall shot quality (not just contest level) swings the make chance.',
  hotColdStreakImpact: 'How much a shooter\u2019s recent makes/misses affect their next attempt (hot/cold streaks).',

  // 6. Defense
  perimeterDefenseImpact: 'How much a defender\u2019s perimeter defense rating affects outside shot difficulty.',
  interiorDefenseImpact: 'How much a defender\u2019s interior defense rating affects shots near the rim.',
  helpDefense: 'How aggressively teammates rotate over to help on defense.',
  defensiveRotations: 'How quickly and cleanly a defense rotates when the ball moves.',
  closeoutEffectiveness: 'How effective defenders are at closing out on shooters.',
  contestEffectiveness: 'How much a defender\u2019s contest actually suppresses the shooter\u2019s chances.',
  stealSuccess: 'The baseline success rate on steal attempts.',
  blockSuccess: 'The baseline success rate on block attempts.',
  chargeFrequency: 'How often defenders draw a charging foul.',
  deflectionFrequency: 'How often defenders get a hand on the ball without a clean steal.',
  screenNavigation: 'How well defenders fight through or around off-ball screens.',
  pickAndRollDefense: 'How well defenses handle pick-and-roll actions specifically.',
  postDefense: 'How well defenders handle post-up attempts.',
  rimProtection: 'How much interior defenders suppress shots directly at the rim.',
  transitionDefense: 'How well a defense gets back and sets up in transition.',
  defensiveCommunication: 'How well a defense communicates (affects rotations and switches).',
  defensiveIQImpact: 'How much a player\u2019s defensive IQ attribute factors into outcomes versus raw physical tools.',
  defensiveMatchupImportance: 'How much a specific matchup (who\u2019s guarding whom) affects the play, versus team-wide defense.',
  positionMismatchPenalty: 'How much being guarded by the wrong position (a size or speed mismatch) helps the offense.',
  defensiveVersatility: 'How much credit a defender gets for being able to guard multiple positions well.',

  // 7. Player Development
  developmentSpeed: 'A global multiplier on how fast players grow toward their potential each offseason.',
  developmentRandomness: 'How much random variance there is in a player\u2019s year-to-year development.',
  potentialAccuracy: 'How closely a player\u2019s generated potential predicts what they actually become.',
  potentialVolatility: 'How much a player\u2019s true potential can drift from its original projection over time.',
  ageDevelopmentCurve: 'The overall shape of the aging curve: peaks early, follows a standard curve, or peaks late.',
  rookieDevelopmentBonus: 'An extra growth multiplier applied to players aged 21 and under.',
  youngPlayerDevelopment: 'An extra growth multiplier applied to players aged 22\u201324.',
  primeDevelopment: 'How much upside a player retains once they\u2019ve already reached their prime years.',
  veteranDevelopment: 'How well veterans hold onto their game and resist decline once past their prime.',
  lateCareerDecline: 'A multiplier on how sharply skills fall off late in a player\u2019s career.',
  athleticDecline: 'How much athletic (as opposed to skill-based) attributes are affected by aging specifically.',
  shootingDevelopment: 'A growth multiplier specifically for shooting-related attributes.',
  finishingDevelopment: 'A growth multiplier specifically for finishing-at-the-rim attributes.',
  passingDevelopment: 'A growth multiplier specifically for passing/playmaking attributes.',
  defenseDevelopment: 'A growth multiplier specifically for defensive attributes.',
  reboundingDevelopment: 'A growth multiplier specifically for rebounding attributes.',
  mentalDevelopment: 'A growth multiplier specifically for mental attributes (IQ, composure, leadership).',
  developmentFromPlayingTime: 'How much actual minutes played (versus riding the bench) accelerates development.',
  developmentFromCoaching: 'How much a team\u2019s coaching quality accelerates player development.',
  developmentFromTraining: 'How much a team\u2019s training/practice facilities accelerate player development.',

  // 8. Aging & Decline
  agingRandomness: 'How much random variance there is in how gracefully or badly a player ages.',
  peakAgeShiftYears: 'Shifts every player\u2019s prime window earlier or later by this many years.',
  peakDurationYears: 'How many years a player\u2019s prime window lasts before decline begins.',
  declineStartingAgeShiftYears: 'Shifts the age decline begins at, independent of the prime window itself.',
  declineSpeed: 'A global multiplier on how fast skills fall off once decline begins.',
  athleticDeclineRate: 'How much faster athletic attributes (speed, vertical, agility) decline than skill attributes.',
  shootingDeclineRate: 'How fast shooting attributes specifically decline with age.',
  defensiveDeclineRate: 'How fast defensive attributes specifically decline with age.',
  durabilityDeclineRate: 'How fast a player\u2019s durability attribute itself erodes with age.',
  injuryRelatedDecline: 'How much a history of injuries accelerates a player\u2019s overall decline.',
  veteranConsistency: 'How much less year-to-year variance veterans have compared to younger players.',
  lateCareerResurgenceChance: 'The odds an older player has a surprise bounce-back season instead of declining.',
  retirementAgeShiftYears: 'Shifts the age at which players tend to retire, earlier or later.',
  earlyRetirementChance: 'The odds a player retires earlier than their normal expected age.',
  forcedRetirementChance: 'The odds a badly declined player is forced into retirement regardless of age.',

  // 9. Injuries
  minorInjuryFrequency: 'How often minor (short recovery) injuries occur.',
  majorInjuryFrequency: 'How often major (long recovery) injuries occur.',
  careerEndingInjuriesEnabled: 'Whether a catastrophic, career-ending injury can occur at all.',
  injurySeverityRandomness: 'How much variance there is in how severe a given injury turns out to be.',
  recoveryTimeMultiplier: 'A global multiplier on how long players take to recover from injuries.',
  reinjuryChance: 'The odds a recently-returned player re-aggravates the same injury.',
  injuryProneImpact: 'How much a player\u2019s \u201cinjury prone\u201d trait raises their actual injury odds.',
  durabilityAttributeImpact: 'How much a player\u2019s durability attribute lowers their injury odds.',
  fatigueInjuryImpact: 'How much accumulated fatigue raises injury risk.',
  overuseInjuryImpact: 'How much heavy minutes over time raises injury risk, independent of single-game fatigue.',
  playoffInjuryFrequency: 'How injury frequency changes specifically during the playoffs.',
  practiceInjuryFrequency: 'How often injuries occur during practice, off the game floor.',
  trainingInjuryFrequency: 'How often injuries occur during offseason training.',
  injuryTreatmentEffectiveness: 'How much good medical treatment shortens recovery time.',
  medicalStaffImpact: 'How much a team\u2019s medical staff quality affects recovery and re-injury odds.',
  injuryRecoveryDevelopment: 'Whether/how much a player can still develop while recovering from injury.',
  longTermInjuryEffects: 'Whether serious injuries leave a lingering attribute penalty even after recovery.',
  injuryReportingDetail: 'How much detail the injury report UI shows: basic status or a detailed breakdown.',

  // 10. Finances & Salary
  minimumTeamSalaryPct: 'The minimum payroll a team must carry, as a percentage of the salary cap.',
  maximumContractLengthYears: 'The longest contract a team is allowed to offer.',
  rookieContractLengthYears: 'The standard length of a rookie-scale contract.',
  minimumSalary: 'The league-minimum salary any player can be signed for.',
  maximumSalary: 'The largest salary a team can offer on a max contract.',
  veteranMinimum: 'The minimum salary specifically for veteran free agents.',
  birdRightsEnabled: 'Whether a team can re-sign its own free agent above the cap using Bird rights.',
  earlyBirdRightsEnabled: 'Whether a team can use early Bird rights to re-sign a player with less tenure.',
  midLevelExceptionAmount: 'How much cap space the mid-level exception grants a team already over the cap.',
  biAnnualExceptionAmount: 'How much cap space the bi-annual exception grants.',
  tradeExceptionsEnabled: 'Whether trade exceptions (banked cap space from an uneven trade) are usable.',
  contractInflationPct: 'How much year-over-year the general cost of contracts inflates.',
  salaryGrowthPct: 'How much the salary cap itself grows year over year.',
  revenueGrowthPct: 'How much league-wide revenue grows year over year.',
  ticketRevenueWeight: 'How heavily ticket sales factor into a team\u2019s total revenue.',
  merchandiseRevenueWeight: 'How heavily merchandise sales factor into a team\u2019s total revenue.',
  tvRevenueWeight: 'How heavily TV/media rights factor into a team\u2019s total revenue.',
  sponsorshipRevenueWeight: 'How heavily sponsorships factor into a team\u2019s total revenue.',
  teamProfitabilityImpact: 'How much a team\u2019s profitability feeds back into its available spending.',

  // 11. Trades & Transactions
  tradeFrequency: 'How often AI teams look to make trades with each other.',
  tradeAIAggressiveness: 'How aggressively the AI pursues trades it thinks improve its team.',
  tradeDeadlineEnabled: 'Whether trading locks at a deadline partway through the season.',
  tradeRestrictionsEnabled: 'Whether real-world-style trade restrictions (salary matching, etc.) are enforced.',
  noTradeClausesEnabled: 'Whether a player can have a no-trade clause blocking certain deals.',
  playerTradeRequestsEnabled: 'Whether an unhappy player can formally request a trade.',
  playerTradeResistance: 'How reluctant players are to accept/waive protections around being traded.',
  aiRebuildingTendency: 'How readily the AI leans into rebuilding (selling veterans for picks/prospects) when it makes sense to.',
  aiWinNowTendency: 'How readily the AI leans into win-now moves (trading picks/prospects for immediate help).',
  aiValueOfDraftPicks: 'How much the AI values draft picks relative to established players in trade talks.',
  aiValueOfProspects: 'How much the AI values young prospects relative to proven veterans in trade talks.',
  aiValueOfVeterans: 'How much the AI values proven veterans relative to youth in trade talks.',
  tradeRandomness: 'How much randomness/unpredictability there is in which trades the AI decides to make.',
  tradeVetoSystemEnabled: 'Whether a trade can be vetoed as too lopsided instead of just flagged.',
  tradeEvaluationStrictness: 'How strictly incoming/outgoing value has to match for a trade to be accepted.',
  multiTeamTradesEnabled: 'Whether three-or-more-team trades are allowed.',
  signAndTradesEnabled: 'Whether a sign-and-trade (signing a free agent then immediately trading them) is allowed.',
  draftPickProtectionsEnabled: 'Whether traded draft picks can carry protections (see the Trade page).',
  futurePickTradingEnabled: 'Whether future (not-yet-drafted) picks can be traded at all.',

  // 12. Free Agency
  playerDemandVariance: 'How much variance there is in what different free agents demand for similar production.',
  playerLoyalty: 'How much a player favors staying with their current team, all else equal.',
  homeTeamPreference: 'How much a player favors signing near their hometown/home region.',
  winningPreference: 'How much a player favors joining a team that\u2019s currently winning.',
  moneyPreference: 'How much a player favors the highest dollar offer over other factors.',
  playingTimePreference: 'How much a player favors a team that offers them more playing time.',
  marketSizePreference: 'How much a player favors signing in a bigger media market.',
  championshipPreference: 'How much a player favors a team with strong championship odds.',
  teamReputationImpact: 'How much a team\u2019s overall reputation/history affects its free-agent pull.',
  contractNegotiationDifficulty: 'How hard it is to close a free-agent deal at favorable terms.',
  freeAgentRandomness: 'How much randomness there is in where a given free agent ultimately signs.',
  aiFreeAgentAggressiveness: 'How aggressively AI teams pursue and overpay for free agents.',
  aiOverpayTendency: 'How willing the AI is to overpay market value to land a target.',
  freeAgentTamperingEnabled: 'Whether tampering (pre-negotiating before free agency opens) can occur.',
  signAndTradeFrequency: 'How often sign-and-trade deals actually happen around the league.',
  veteranDiscountTendency: 'How willing veterans are to take a discount to chase a ring or a preferred situation.',
  maxContractFrequency: 'How often teams actually hand out max-value contracts.',
  freeAgentRetirementDecisions: 'Whether an aging free agent can choose to retire instead of signing anywhere.',
};

interface Props {
  rules: LeagueRulesSettings;
  onChange: (rules: LeagueRulesSettings) => void;
  onSave?: () => void;
}

const sectionAnchorId = (title: string) => `rules-section-${title.split('.')[0].trim()}`;

/** Opens a section (they're collapsible) and scrolls it into view. */
function jumpToSection(title: string) {
  const el = document.getElementById(sectionAnchorId(title));
  if (!el) return;
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setAllSectionsOpen(open: boolean) {
  document.querySelectorAll<HTMLDetailsElement>('.league-rules-section').forEach((d) => { d.open = open; });
}

export function LeagueRulesPage({ rules, onChange, onSave }: Props) {
  const [query, setQuery] = useState('');
  const [liveOnly, setLiveOnly] = useState(true);
  const [changedOnly, setChangedOnly] = useState(false);
  const merged = { ...DEFAULT_LEAGUE_RULES, ...rules };
  const changedCount = Object.keys(DEFAULT_LEAGUE_RULES).filter(k => merged[k as FieldKey] !== DEFAULT_LEAGUE_RULES[k as FieldKey]).length;
  const sections = SECTIONS.map(section => ({ ...section, fields: section.fields.filter(key =>
    (!liveOnly || WIRED_FIELDS.has(key)) && (!changedOnly || merged[key] !== DEFAULT_LEAGUE_RULES[key]) &&
    `${OVERRIDES[key]?.label ?? humanize(key)} ${section.title} ${DESCRIPTIONS[key] ?? ''}`.toLowerCase().includes(query.toLowerCase())) })).filter(s => s.fields.length);
  const preset = (name: 'balanced' | 'showcase' | 'development') => {
    const common = { minutesVariance: 50, rotationStintMinutes: 5, blowoutBenchThreshold: 22, personalFoulLimit: 6, coachingImpact: 100, allStarEnabled: true, allStarBreakPercent: 58, allStarFanWeight: 50, allStarPlayerWeight: 25, allStarCoachWeight: 25, possessionsPerGame: 50, threePointFrequency: 50, developmentSpeed: 100 };
    const patch = name === 'showcase' ? { possessionsPerGame: 65, threePointFrequency: 65, personalFoulLimit: 8, minutesVariance: 75, allStarFanWeight: 70, allStarPlayerWeight: 15, allStarCoachWeight: 15 } : name === 'development' ? { developmentSpeed: 125, coachingImpact: 130, rotationStintMinutes: 4, blowoutBenchThreshold: 16 } : {};
    onChange({ ...merged, ...common, ...patch });
  };
  const set = (key: FieldKey, value: LeagueRulesSettings[FieldKey]) => onChange({ ...merged, [key]: value });
  const reset = () => onChange({ ...DEFAULT_LEAGUE_RULES });

  return (
    <div className="league-rules-page">
      <div className="code-mode-actions">
        <button className="primary" onClick={() => onSave?.()}>Save Settings</button>
        <button onClick={reset}>Reset All Rules to Default</button>
      </div>
      <div className="rules-presets"><span className="pixel-eyebrow">QUICK TUNING</span><button onClick={() => preset('balanced')}>Balanced Basketball</button><button onClick={() => preset('showcase')}>High-Scoring Showcase</button><button onClick={() => preset('development')}>Development League</button><span>{changedCount} custom settings</span></div>
      <p className="hint-text">Changes apply to future simulations immediately. Presets tune pace, rotations, coaching, development and All-Star voting. Save Settings keeps your current setup.</p>
      <div className="feature-toolbar rules-filters"><label>Search settings<input type="search" value={query} placeholder="Minutes, voting, defense…" onChange={e => setQuery(e.target.value)} /></label><label className="feature-check"><input type="checkbox" checked={liveOnly} onChange={e => setLiveOnly(e.target.checked)} />Active rules only</label><label className="feature-check"><input type="checkbox" checked={changedOnly} onChange={e => setChangedOnly(e.target.checked)} />Changed settings only</label><span>{sections.reduce((n, s) => n + s.fields.length, 0)} settings</span></div>
      {!liveOnly && <p className="hint-text">Rules without a Live tag are stored but do not yet affect gameplay.</p>}
      {!sections.length && <p className="empty-state">No settings match your filters.</p>}

      <nav className="league-rules-nav" aria-label="Jump to a rules section">
        <span className="hint-text">Jump to:</span>
        {sections.map((section) => (
          <button key={section.title} className="link-button" onClick={() => jumpToSection(section.title)}>
            {section.title.replace(/^\d+\.\s*/, '')}
          </button>
        ))}
        <span className="league-rules-nav-actions">
          <button className="link-button" onClick={() => setAllSectionsOpen(true)}>Expand all</button>
          <button className="link-button" onClick={() => setAllSectionsOpen(false)}>Collapse all</button>
        </span>
      </nav>

      {sections.map((section) => (
        <details key={section.title} id={sectionAnchorId(section.title)} className="league-rules-section" open={!!query || changedOnly || section.title.startsWith('0.')}>
          <summary>{section.title.replace(/^\d+\.\s*/, '')} <small>({section.fields.length})</small></summary>
          <button className="link-button rule-section-reset" onClick={() => { const patch = Object.fromEntries(SECTIONS.find(s => s.title === section.title)!.fields.map(k => [k, DEFAULT_LEAGUE_RULES[k]])); onChange({ ...merged, ...patch }); }}>Reset this section</button>
          <div className="league-rules-grid">
            {section.fields.map((key) => {
              const value = merged[key];
              const override = OVERRIDES[key] ?? {};
              const label = override.label ?? humanize(key);
              const isLive = WIRED_FIELDS.has(key);
              const description = DESCRIPTIONS[key];

              if (typeof value === 'boolean') {
                return (
                  <div key={key} className="league-rule-item">
                    <label className="league-rule-row league-rule-boolean">
                      <input type="checkbox" checked={value} onChange={(e) => set(key, e.target.checked)} />
                      <span>{label}</span>
                      {isLive && <span className="rule-live-tag">Live</span>}
                    </label>
                    {description && <p className="league-rule-description">{description}</p>}
                  </div>
                );
              }
              if (override.options) {
                return (
                  <div key={key} className="league-rule-item">
                    <label className="league-rule-row">
                      <span className="rating-label">{label}{isLive && <span className="rule-live-tag">Live</span>}</span>
                      <select value={value as string} onChange={(e) => set(key, e.target.value as never)}>
                        {override.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                    {description && <p className="league-rule-description">{description}</p>}
                  </div>
                );
              }
              const min = override.min ?? 0;
              const max = override.max ?? 100;
              const step = override.step ?? 1;
              return (
                <div key={key} className="league-rule-item">
                  <label className="league-rule-row">
                    <span className="rating-label">{label}{isLive && <span className="rule-live-tag">Live</span>}</span>
                    <input type="range" min={min} max={max} step={step} value={value as number} onChange={(e) => set(key, Number(e.target.value))} />
                    <span className="league-rule-value"><input aria-label={`${label} value`} type="number" min={min} max={max} step={step} value={value as number} onChange={e => { if (e.target.value !== '') set(key, Math.max(min, Math.min(max, Number(e.target.value)))); }} />{override.unit ? ` ${override.unit}` : ''}</span>
                  </label>
                  {description && <p className="league-rule-description">{description}</p>}
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
