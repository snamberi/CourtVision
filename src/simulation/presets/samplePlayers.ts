import type {
  Attributes, DefensiveAttributes, MentalAttributes, OffensiveAttributes,
  PhysicalAttributes, PlayerSeason, PositionSuitability, Tendencies,
} from '../types';

function offense(overrides: Partial<OffensiveAttributes> = {}): OffensiveAttributes {
  return {
    closeShot: 70, drivingLayup: 70, drivingDunk: 60, standingDunk: 55,
    postHook: 40, postFade: 40, postControl: 40,
    midrange: 65, longMidrange: 65, threePoint: 65, corner3: 65, aboveBreak3: 65,
    pullUp3: 60, catchAndShoot: 65, freeThrow: 75,
    ballHandling: 60, ballSecurity: 60, speedWithBall: 60,
    passing: 55, passingAccuracy: 60, passingIQ: 55,
    offensiveIQ: 65, shotIQ: 60, decisionMaking: 60,
    finishing: 65, touch: 60, offensiveConsistency: 60, offensiveRebounding: 40,
    ...overrides,
  };
}

function defense(overrides: Partial<DefensiveAttributes> = {}): DefensiveAttributes {
  return {
    perimeterDefense: 60, interiorDefense: 55, defensiveIQ: 60, helpDefense: 55,
    pickAndRollDefense: 55, closeout: 55, contest: 55,
    steal: 50, stealIQ: 50, onBallSteal: 50, passingLaneSteal: 50,
    block: 40, blockIQ: 40, blockTiming: 40, rimProtection: 40,
    defensiveRebounding: 55, defensiveConsistency: 55, defensiveAwareness: 55, defensiveDiscipline: 55,
    ...overrides,
  };
}

function mental(overrides: Partial<MentalAttributes> = {}): MentalAttributes {
  return {
    clutch: 60, consistency: 60, confidence: 60, composure: 60, discipline: 60,
    aggression: 55, effort: 70, basketballIQ: 60, playoffPerformance: 60,
    pressurePerformance: 60, leadership: 55,
    ...overrides,
  };
}

function physical(overrides: Partial<PhysicalAttributes> = {}): PhysicalAttributes {
  return {
    heightInches: 78, weightLbs: 210, wingspanInches: 80, standingReachInches: 104,
    vertical: 60, speed: 65, acceleration: 65, strength: 60, agility: 60,
    balance: 60, stamina: 80, durability: 80,
    ...overrides,
  };
}

function positions(overrides: Partial<PositionSuitability> = {}): PositionSuitability {
  return { PG: 20, SG: 30, SF: 60, PF: 60, C: 30, ...overrides };
}

function tendencies(overrides: Partial<Tendencies> = {}): Tendencies {
  return {
    shot: {
      rim: 20, close: 15, midrange: 15, longMidrange: 10, corner3: 10, aboveBreak3: 15,
      pullUp3: 10, catchAndShoot3: 15, stepback: 5, fadeaway: 5, postShot: 5, hook: 5, dunk: 10, layup: 15,
    },
    passing: {
      passFrequency: 50, assistCreation: 40, driveAndKick: 40, extraPass: 40, skipPass: 20,
      lobPass: 20, entryPass: 30, kickout: 30, pickAndRollPass: 30, isolationPass: 20, riskyPass: 20, flashyPass: 15,
    },
    driving: {
      driveFrequency: 40, driveLeft: 40, driveRight: 60, straightDrive: 30, attackCloseout: 40,
      transitionDrive: 30, contactFinish: 30, kickout: 30, driveAndKick: 30, pullUpAfterDrive: 30,
    },
    role: {
      primaryBallHandler: 30, secondaryBallHandler: 30, tertiaryBallHandler: 30, shotCreator: 30,
      catchAndShoot: 40, pnrBallHandler: 30, pnrScreener: 20, isolation: 25, postUp: 15, cutter: 20,
      spotUpShooter: 40, transitionFinisher: 30, offensiveRebounder: 20, handOffReceiver: 20,
    },
    ballDominance: 30,
    ...overrides,
  };
}

export function makeDefaultSeason(playerId: string, season: string, teamId: string | null = null, age = 25): PlayerSeason {
  const attributes: Attributes = { physical: physical(), offense: offense(), defense: defense(), mental: mental() };
  return {
    playerId,
    season,
    teamId,
    age,
    attributes,
    positions: positions(),
    tendencies: tendencies(),
    minutes: { mode: 'AI', target: 24 },
    badges: [],
    development: {
      potential: 75, developmentRate: 60, developmentVariance: 10, peakAge: 27,
      declineRate: 50, injuryRisk: 30, workEthic: 60,
    },
    overall: { mode: 'AUTO' },
    ballHandlerPriority: 40,
    source: 'generated',
  };
}

/** A high-volume elite shooter/ball-handler archetype, useful for testing the 3PT-override and turnover systems. */
export function makeEliteShooterGuard(playerId: string, teamId: string | null, season = '2025'): PlayerSeason {
  const s = makeDefaultSeason(playerId, season, teamId);
  s.attributes.physical = physical({ heightInches: 74, speed: 82, acceleration: 85, stamina: 88, durability: 82 });
  s.attributes.offense = offense({
    threePoint: 99, corner3: 97, aboveBreak3: 98, pullUp3: 97, catchAndShoot: 97,
    ballHandling: 95, ballSecurity: 92, passing: 88, passingAccuracy: 90, passingIQ: 90,
    offensiveIQ: 95, shotIQ: 96, decisionMaking: 90, finishing: 78, freeThrow: 92,
  });
  s.attributes.mental = mental({ clutch: 95, playoffPerformance: 92, confidence: 90 });
  s.positions = positions({ PG: 100, SG: 90, SF: 20, PF: 5, C: 0 });
  s.tendencies = tendencies({
    shot: { rim: 10, close: 8, midrange: 10, longMidrange: 6, corner3: 18, aboveBreak3: 20, pullUp3: 18, catchAndShoot3: 20, stepback: 8, fadeaway: 2, postShot: 0, hook: 0, dunk: 3, layup: 10 },
    role: {
      primaryBallHandler: 95, secondaryBallHandler: 20, tertiaryBallHandler: 5, shotCreator: 90,
      catchAndShoot: 85, pnrBallHandler: 85, pnrScreener: 2, isolation: 55, postUp: 5, cutter: 20,
      spotUpShooter: 70, transitionFinisher: 40, offensiveRebounder: 10, handOffReceiver: 30,
    },
    ballDominance: 90,
  });
  s.minutes = { mode: 'TARGET', target: 34 };
  s.ballHandlerPriority = 92;
  return s;
}

export function makeThreeAndDWing(playerId: string, teamId: string | null, season = '2025'): PlayerSeason {
  const s = makeDefaultSeason(playerId, season, teamId);
  s.attributes.offense = offense({ threePoint: 88, corner3: 90, aboveBreak3: 85, catchAndShoot: 92, ballHandling: 55, passing: 45 });
  s.attributes.defense = defense({ perimeterDefense: 88, closeout: 85, stealIQ: 75, onBallSteal: 70, defensiveIQ: 82 });
  s.tendencies = tendencies({
    role: {
      primaryBallHandler: 10, secondaryBallHandler: 20, tertiaryBallHandler: 40, shotCreator: 15,
      catchAndShoot: 90, pnrBallHandler: 5, pnrScreener: 30, isolation: 5, postUp: 5, cutter: 40,
      spotUpShooter: 90, transitionFinisher: 40, offensiveRebounder: 25, handOffReceiver: 40,
    },
    ballDominance: 15,
  });
  s.minutes = { mode: 'TARGET', target: 30 };
  s.ballHandlerPriority = 15;
  return s;
}

export function makeRimProtectingBig(playerId: string, teamId: string | null, season = '2025'): PlayerSeason {
  const s = makeDefaultSeason(playerId, season, teamId);
  s.attributes.physical = physical({ heightInches: 84, vertical: 75, wingspanInches: 90, speed: 45, stamina: 70 });
  s.attributes.offense = offense({ closeShot: 75, drivingDunk: 88, standingDunk: 85, postHook: 60, threePoint: 25, ballHandling: 35, passing: 45 });
  s.attributes.defense = defense({ block: 92, blockIQ: 88, blockTiming: 90, rimProtection: 95, interiorDefense: 90, defensiveRebounding: 88 });
  s.positions = positions({ PG: 0, SG: 0, SF: 10, PF: 60, C: 100 });
  s.tendencies = tendencies({
    shot: { rim: 35, close: 20, midrange: 5, longMidrange: 2, corner3: 2, aboveBreak3: 1, pullUp3: 0, catchAndShoot3: 2, stepback: 0, fadeaway: 3, postShot: 15, hook: 10, dunk: 25, layup: 15 },
    role: {
      primaryBallHandler: 2, secondaryBallHandler: 5, tertiaryBallHandler: 20, shotCreator: 5,
      catchAndShoot: 10, pnrBallHandler: 2, pnrScreener: 90, isolation: 5, postUp: 40, cutter: 50,
      spotUpShooter: 10, transitionFinisher: 30, offensiveRebounder: 85, handOffReceiver: 10,
    },
    ballDominance: 10,
  });
  s.minutes = { mode: 'TARGET', target: 28 };
  s.ballHandlerPriority = 5;
  return s;
}

export function makeGenericStarter(playerId: string, teamId: string | null, season = '2025'): PlayerSeason {
  const s = makeDefaultSeason(playerId, season, teamId);
  s.minutes = { mode: 'TARGET', target: 26 };
  return s;
}

export function buildDemoTeam(teamId: string, label: string) {
  return {
    teamId,
    label,
    seasons: [
      makeEliteShooterGuard(`${teamId}-star`, teamId),
      makeThreeAndDWing(`${teamId}-wing1`, teamId),
      makeThreeAndDWing(`${teamId}-wing2`, teamId),
      makeGenericStarter(`${teamId}-forward`, teamId),
      makeRimProtectingBig(`${teamId}-center`, teamId),
    ],
  };
}
