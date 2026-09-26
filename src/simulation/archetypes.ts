import type { PositionSuitability } from './types';

/**
 * A player "build" — the shape of a real basketball identity rather than a flat stat block. Each
 * archetype declares which attribute groups it is strong/weak at, what positions it plays, and how
 * scarce it is, so a generated league fills up with recognizable player types (two-way stars,
 * defensive specialists, three-level scorers, glass cleaners) instead of interchangeable blobs.
 */
export interface Archetype {
  key: string;
  label: string;
  weight: number; // relative frequency in a generated league
  /** Per-attribute-group multipliers applied on top of the player's base caliber. 1.0 = at caliber. */
  groups: {
    finishing: number;      // closeShot, layup, dunks, touch
    postGame: number;       // hooks, fades, post control
    midrange: number;       // mid / long mid
    threePoint: number;     // all three-point attributes
    freeThrow: number;
    handling: number;       // ball handling, security, speed with ball
    passing: number;        // passing, accuracy, passing IQ
    offBall: number;        // catch and shoot, offensive IQ, shot IQ
    perimeterD: number;
    interiorD: number;
    steals: number;
    blocks: number;
    rebounding: number;
    defensiveIQ: number;
    athleticism: number;    // speed, vertical, acceleration, agility
    strength: number;
    size: number;           // height / wingspan / weight
  };
  positions: PositionSuitability;
  /** Role tendency hints — merged into the player's tendencies so behavior matches the build. */
  roleHints: Partial<Record<string, number>>;
  ballDominance: number;
  ballHandlerPriority: number;
  /** Minutes this archetype typically plays when healthy — starters vs bench pieces. */
  minutesBand: [number, number];
}

const P = (PG: number, SG: number, SF: number, PF: number, C: number): PositionSuitability => ({ PG, SG, SF, PF, C });

/** 1.0 is "at the player's overall caliber"; >1 is a strength, <1 is a real weakness. */
export const ARCHETYPES: Archetype[] = [
  {
    key: 'twoWayStar', label: 'Two-Way Star', weight: 4,
    groups: { finishing: 1.15, postGame: 0.95, midrange: 1.1, threePoint: 1.05, freeThrow: 1.05, handling: 1.1, passing: 1.05, offBall: 1.1, perimeterD: 1.15, interiorD: 1.0, steals: 1.1, blocks: 1.0, rebounding: 1.0, defensiveIQ: 1.15, athleticism: 1.15, strength: 1.05, size: 1.02 },
    positions: P(25, 70, 80, 40, 5), roleHints: { shotCreator: 78, primaryBallHandler: 60, perimeterDefender: 80 },
    ballDominance: 72, ballHandlerPriority: 78, minutesBand: [32, 38],
  },
  {
    key: 'threeLevelScorer', label: 'Three-Level Scorer', weight: 6,
    groups: { finishing: 1.15, postGame: 1.0, midrange: 1.2, threePoint: 1.15, freeThrow: 1.1, handling: 1.15, passing: 0.9, offBall: 1.05, perimeterD: 0.85, interiorD: 0.8, steals: 0.9, blocks: 0.8, rebounding: 0.85, defensiveIQ: 0.85, athleticism: 1.1, strength: 0.95, size: 1.0 },
    positions: P(30, 80, 65, 20, 0), roleHints: { shotCreator: 88, isolationScorer: 85, primaryBallHandler: 55 },
    ballDominance: 80, ballHandlerPriority: 80, minutesBand: [30, 37],
  },
  {
    key: 'floorGeneral', label: 'Floor General', weight: 6,
    groups: { finishing: 0.95, postGame: 0.8, midrange: 1.0, threePoint: 1.0, freeThrow: 1.1, handling: 1.25, passing: 1.3, offBall: 1.15, perimeterD: 0.95, interiorD: 0.75, steals: 1.1, blocks: 0.7, rebounding: 0.8, defensiveIQ: 1.05, athleticism: 1.0, strength: 0.85, size: 0.88 },
    positions: P(90, 40, 10, 0, 0), roleHints: { primaryBallHandler: 92, playmaker: 90, pnrBallHandler: 85 },
    ballDominance: 82, ballHandlerPriority: 90, minutesBand: [29, 36],
  },
  {
    key: 'threeAndD', label: '3&D Wing', weight: 9,
    groups: { finishing: 0.95, postGame: 0.8, midrange: 0.9, threePoint: 1.25, freeThrow: 1.05, handling: 0.85, passing: 0.85, offBall: 1.25, perimeterD: 1.25, interiorD: 0.9, steals: 1.15, blocks: 0.9, rebounding: 0.9, defensiveIQ: 1.2, athleticism: 1.05, strength: 1.0, size: 1.0 },
    positions: P(10, 60, 85, 35, 0), roleHints: { spotUpShooter: 88, catchAndShoot: 88, perimeterDefender: 88 },
    ballDominance: 30, ballHandlerPriority: 25, minutesBand: [26, 34],
  },
  {
    key: 'defensiveSpecialist', label: 'Defensive Specialist', weight: 6,
    groups: { finishing: 0.85, postGame: 0.75, midrange: 0.75, threePoint: 0.75, freeThrow: 0.85, handling: 0.85, passing: 0.9, offBall: 0.95, perimeterD: 1.35, interiorD: 1.15, steals: 1.3, blocks: 1.05, rebounding: 1.0, defensiveIQ: 1.35, athleticism: 1.15, strength: 1.1, size: 1.0 },
    positions: P(45, 70, 60, 20, 0), roleHints: { perimeterDefender: 95, pointOfAttackDefender: 92 },
    ballDominance: 22, ballHandlerPriority: 20, minutesBand: [22, 31],
  },
  {
    key: 'rimProtector', label: 'Rim Protector', weight: 7,
    groups: { finishing: 1.05, postGame: 0.95, midrange: 0.7, threePoint: 0.55, freeThrow: 0.75, handling: 0.6, passing: 0.75, offBall: 0.9, perimeterD: 0.75, interiorD: 1.35, steals: 0.8, blocks: 1.45, rebounding: 1.3, defensiveIQ: 1.2, athleticism: 0.95, strength: 1.25, size: 1.2 },
    positions: P(0, 0, 5, 45, 92), roleHints: { rimProtector: 95, pnrScreener: 82, interiorDefender: 92 },
    ballDominance: 20, ballHandlerPriority: 10, minutesBand: [24, 33],
  },
  {
    key: 'stretchBig', label: 'Stretch Big', weight: 6,
    groups: { finishing: 1.0, postGame: 0.95, midrange: 1.1, threePoint: 1.2, freeThrow: 1.05, handling: 0.8, passing: 0.95, offBall: 1.15, perimeterD: 0.8, interiorD: 0.95, steals: 0.85, blocks: 1.0, rebounding: 1.1, defensiveIQ: 0.95, athleticism: 0.9, strength: 1.1, size: 1.15 },
    positions: P(0, 5, 25, 80, 60), roleHints: { spotUpShooter: 82, pnrScreener: 75, stretchBig: 90 },
    ballDominance: 28, ballHandlerPriority: 15, minutesBand: [24, 33],
  },
  {
    key: 'glassCleaner', label: 'Glass Cleaner', weight: 5,
    groups: { finishing: 1.1, postGame: 1.05, midrange: 0.7, threePoint: 0.5, freeThrow: 0.7, handling: 0.6, passing: 0.75, offBall: 0.9, perimeterD: 0.7, interiorD: 1.2, steals: 0.85, blocks: 1.1, rebounding: 1.45, defensiveIQ: 1.0, athleticism: 1.05, strength: 1.3, size: 1.18 },
    positions: P(0, 0, 8, 65, 85), roleHints: { rebounder: 95, pnrScreener: 78, interiorDefender: 85 },
    ballDominance: 20, ballHandlerPriority: 8, minutesBand: [22, 31],
  },
  {
    key: 'slasher', label: 'Slasher', weight: 7,
    groups: { finishing: 1.3, postGame: 0.9, midrange: 0.95, threePoint: 0.7, freeThrow: 0.95, handling: 1.1, passing: 0.95, offBall: 1.0, perimeterD: 1.0, interiorD: 0.9, steals: 1.05, blocks: 0.9, rebounding: 0.95, defensiveIQ: 0.95, athleticism: 1.3, strength: 1.05, size: 0.98 },
    positions: P(20, 65, 80, 30, 0), roleHints: { slasher: 92, cutter: 85, shotCreator: 65 },
    ballDominance: 58, ballHandlerPriority: 55, minutesBand: [26, 34],
  },
  {
    key: 'sharpshooter', label: 'Sharpshooter', weight: 7,
    groups: { finishing: 0.85, postGame: 0.7, midrange: 1.15, threePoint: 1.35, freeThrow: 1.2, handling: 0.9, passing: 0.9, offBall: 1.3, perimeterD: 0.8, interiorD: 0.7, steals: 0.9, blocks: 0.7, rebounding: 0.8, defensiveIQ: 0.9, athleticism: 0.95, strength: 0.9, size: 0.95 },
    positions: P(25, 85, 55, 10, 0), roleHints: { spotUpShooter: 92, catchAndShoot: 95, movementShooter: 88 },
    ballDominance: 32, ballHandlerPriority: 28, minutesBand: [24, 33],
  },
  {
    key: 'pointForward', label: 'Point Forward', weight: 4,
    groups: { finishing: 1.1, postGame: 1.0, midrange: 1.05, threePoint: 0.95, freeThrow: 1.0, handling: 1.15, passing: 1.25, offBall: 1.1, perimeterD: 1.0, interiorD: 0.95, steals: 1.0, blocks: 0.9, rebounding: 1.1, defensiveIQ: 1.05, athleticism: 1.05, strength: 1.1, size: 1.08 },
    positions: P(35, 45, 85, 60, 10), roleHints: { primaryBallHandler: 78, playmaker: 85, shotCreator: 70 },
    ballDominance: 70, ballHandlerPriority: 72, minutesBand: [28, 36],
  },
  {
    key: 'sixthMan', label: 'Sixth Man', weight: 8,
    groups: { finishing: 1.05, postGame: 0.85, midrange: 1.1, threePoint: 1.1, freeThrow: 1.05, handling: 1.1, passing: 1.0, offBall: 1.05, perimeterD: 0.9, interiorD: 0.8, steals: 0.95, blocks: 0.8, rebounding: 0.85, defensiveIQ: 0.9, athleticism: 1.05, strength: 0.95, size: 0.97 },
    positions: P(45, 75, 55, 15, 0), roleHints: { shotCreator: 72, spotUpShooter: 65, sparkPlug: 88 },
    ballDominance: 58, ballHandlerPriority: 52, minutesBand: [18, 26],
  },
  {
    key: 'energyBig', label: 'Energy Big', weight: 6,
    groups: { finishing: 1.15, postGame: 0.85, midrange: 0.65, threePoint: 0.45, freeThrow: 0.7, handling: 0.6, passing: 0.7, offBall: 0.9, perimeterD: 0.75, interiorD: 1.1, steals: 0.85, blocks: 1.05, rebounding: 1.25, defensiveIQ: 0.95, athleticism: 1.15, strength: 1.2, size: 1.12 },
    positions: P(0, 0, 10, 70, 75), roleHints: { rebounder: 85, cutter: 80, pnrScreener: 80 },
    ballDominance: 18, ballHandlerPriority: 8, minutesBand: [14, 24],
  },
  {
    key: 'connector', label: 'Connector', weight: 8,
    groups: { finishing: 1.0, postGame: 0.85, midrange: 1.0, threePoint: 1.05, freeThrow: 1.0, handling: 1.0, passing: 1.15, offBall: 1.15, perimeterD: 1.05, interiorD: 0.95, steals: 1.05, blocks: 0.9, rebounding: 1.0, defensiveIQ: 1.15, athleticism: 1.0, strength: 1.0, size: 1.0 },
    positions: P(30, 55, 75, 45, 5), roleHints: { spotUpShooter: 72, playmaker: 70, perimeterDefender: 72 },
    ballDominance: 40, ballHandlerPriority: 38, minutesBand: [22, 30],
  },
  {
    key: 'rawProspect', label: 'Raw Prospect', weight: 7,
    groups: { finishing: 0.95, postGame: 0.8, midrange: 0.8, threePoint: 0.8, freeThrow: 0.85, handling: 0.9, passing: 0.85, offBall: 0.85, perimeterD: 0.9, interiorD: 0.9, steals: 0.9, blocks: 0.95, rebounding: 0.95, defensiveIQ: 0.75, athleticism: 1.25, strength: 0.95, size: 1.05 },
    positions: P(25, 55, 60, 40, 15), roleHints: { slasher: 60, cutter: 60 },
    ballDominance: 35, ballHandlerPriority: 30, minutesBand: [10, 20],
  },
  {
    key: 'journeyman', label: 'Journeyman', weight: 10,
    groups: { finishing: 0.92, postGame: 0.88, midrange: 0.92, threePoint: 0.9, freeThrow: 0.95, handling: 0.9, passing: 0.92, offBall: 0.95, perimeterD: 0.92, interiorD: 0.9, steals: 0.92, blocks: 0.88, rebounding: 0.92, defensiveIQ: 0.95, athleticism: 0.9, strength: 0.95, size: 1.0 },
    positions: P(35, 55, 60, 40, 15), roleHints: {},
    ballDominance: 30, ballHandlerPriority: 25, minutesBand: [8, 18],
  },
];

// Additional builds inherit a complete attribute shape and specialize both ability and role.
{
  const base = ARCHETYPES.find(a => a.key === 'floorGeneral')!;
  ARCHETYPES.push({ ...base, key: 'deepRangeCreator', label: 'Deep Range Creator', weight: 4,
    groups: { ...base.groups, ...{ threePoint: 1.38, handling: 1.28, passing: 1.12, finishing: 0.92, perimeterD: 0.82 } }, positions: P(90, 70, 15, 0, 0),
    roleHints: { ...base.roleHints, ...{ shotCreator: 95, pnrBallHandler: 92, primaryBallHandler: 92 } }, ballDominance: 88, ballHandlerPriority: 94, minutesBand: [30, 37],
  });
}
{
  const base = ARCHETYPES.find(a => a.key === 'stretchBig')!;
  ARCHETYPES.push({ ...base, key: 'pointCenter', label: 'Point Center', weight: 3,
    groups: { ...base.groups, ...{ passing: 1.38, postGame: 1.2, handling: 0.98, rebounding: 1.18, athleticism: 0.82 } }, positions: P(15, 0, 15, 65, 95),
    roleHints: { ...base.roleHints, ...{ playmaker: 95, postScorer: 82, pnrScreener: 80 } }, ballDominance: 75, ballHandlerPriority: 76, minutesBand: [29, 36],
  });
}
{
  const base = ARCHETYPES.find(a => a.key === 'rimProtector')!;
  ARCHETYPES.push({ ...base, key: 'switchBig', label: 'Switch Defender', weight: 5,
    groups: { ...base.groups, ...{ perimeterD: 1.25, interiorD: 1.25, athleticism: 1.18, blocks: 1.15, threePoint: 0.72, strength: 1.12 } }, positions: P(0, 10, 55, 92, 75),
    roleHints: { ...base.roleHints, ...{ perimeterDefender: 88, interiorDefender: 90, pointOfAttackDefender: 80 } }, ballDominance: 25, ballHandlerPriority: 18, minutesBand: [24, 32],
  });
}
{
  const base = ARCHETYPES.find(a => a.key === 'glassCleaner')!;
  ARCHETYPES.push({ ...base, key: 'postTechnician', label: 'Post Technician', weight: 4,
    groups: { ...base.groups, ...{ postGame: 1.4, finishing: 1.2, midrange: 1.18, passing: 1.05, rebounding: 1.12, athleticism: 0.78 } }, positions: P(0, 0, 20, 90, 80),
    roleHints: { ...base.roleHints, ...{ postScorer: 96, isolationScorer: 78, pnrScreener: 70 } }, ballDominance: 67, ballHandlerPriority: 45, minutesBand: [26, 34],
  });
}
{
  const base = ARCHETYPES.find(a => a.key === 'sharpshooter')!;
  ARCHETYPES.push({ ...base, key: 'movementSniper', label: 'Movement Sniper', weight: 5,
    groups: { ...base.groups, ...{ offBall: 1.42, threePoint: 1.3, athleticism: 1.15, handling: 0.82, passing: 0.85 } }, positions: P(15, 95, 65, 5, 0),
    roleHints: { ...base.roleHints, ...{ movementShooter: 99, catchAndShoot: 96, spotUpShooter: 75, cutter: 80 } }, ballDominance: 34, ballHandlerPriority: 20, minutesBand: [23, 32],
  });
}
{
  const base = ARCHETYPES.find(a => a.key === 'connector')!;
  ARCHETYPES.push({ ...base, key: 'defensivePlaymaker', label: 'Defensive Playmaker', weight: 4,
    groups: { ...base.groups, ...{ passing: 1.26, defensiveIQ: 1.32, perimeterD: 1.22, steals: 1.22, threePoint: 0.85, midrange: 0.88 } }, positions: P(70, 60, 75, 35, 0),
    roleHints: { ...base.roleHints, ...{ playmaker: 87, pointOfAttackDefender: 90, perimeterDefender: 88 } }, ballDominance: 46, ballHandlerPriority: 60, minutesBand: [24, 33],
  });
}

export function pickArchetype(roll: number): Archetype {
  const total = ARCHETYPES.reduce((s, a) => s + a.weight, 0);
  let r = roll * total;
  for (const a of ARCHETYPES) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return ARCHETYPES[ARCHETYPES.length - 1];
}

export function archetypeByKey(key: string): Archetype | undefined {
  return ARCHETYPES.find((a) => a.key === key);
}
