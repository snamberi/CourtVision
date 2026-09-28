import type { Attributes, PlayerId, PositionSuitability, RoleTendencies, PassingTendencies } from '../types';
import type { AggregatedFlags } from './effective';
import type { RNG } from './rng';
import { chooseBallHandler, computeBlockProbability, type BallHandlerCandidate } from './ballHandler';
import { chooseShotType, rollContestLevel, resolveShot, resolveFreeThrow, foulDrawProbability, andOneProbability, THREE_POINT_TYPES, RIM_TYPES, type ShotType } from './shot';
import { resolveTurnover, type TurnoverContext } from './turnover';
import { resolveRebound, type RebounderCandidate } from './rebound';
import type { PlayerStatLine } from '../boxscore';
import type { FatigueState } from './fatigue';
import { fatiguePenaltyMultiplier } from './fatigue';
import { NEUTRAL_RULE_MODS, type RuleMods } from './ruleMods';

export interface OnCourtPlayer {
  playerId: PlayerId;
  attributes: Attributes;
  positions: PositionSuitability;
  flags: AggregatedFlags;
  ballHandlerPriority: number;
  role: RoleTendencies;
  shotTendencies: Record<ShotType, number>;
  ballDominance: number;
  passing: PassingTendencies;
  threePointTarget?: number; // explicit user override, engine must respect it
  fatigue: FatigueState;
}

export interface PossessionInput {
  offense: OnCourtPlayer[]; // 5 players
  defense: OnCourtPlayer[]; // 5 players
  matchups: number[]; // for each offense index, the defense index assigned as primary defender (position-weighted, see matchups.ts)
  quarter: number;
  clockSeconds: number;
  isClutch: boolean;
  isPlayoffs: boolean;
  shootingVariance: number;
  turnoverFrequencyMultiplier: number;
  foulFrequencyMultiplier: number;
  doubleTeamProbability: number; // derived from coach aggression + ball dominance
  offenseTeamId: string;
  rng: RNG;
  ruleMods?: RuleMods; // League Rules multipliers - omitted entirely => identical to pre-League-Rules behavior
  /** A coach's play call for this trip (omitted => the offense plays its normal game, draw for draw). */
  playCall?: PlayCall;
  /** The defense sends a second defender whenever this player has the ball. */
  doubleTargetId?: PlayerId;
}

export type PlayKind = 'pnr' | 'iso' | 'post' | 'threes' | 'lastShot';
export type LastShotType = 'three' | 'drive' | 'mid' | 'post';
export interface PlayCall { kind: PlayKind; focusId?: PlayerId; shot?: LastShotType }

/** Which shot types each call looks for, and how much harder. A last-shot call only allows its shot. */
const CALL_SHOTS: Record<Exclude<PlayKind, 'lastShot'>, [ShotType[], number]> = {
  pnr: [['rim', 'layup', 'dunk', 'pullUp3', 'midrange'], 1.6],
  iso: [['stepback', 'midrange', 'fadeaway', 'pullUp3', 'layup'], 1.8],
  post: [['postShot', 'hook', 'fadeaway', 'close'], 4],
  threes: [['corner3', 'aboveBreak3', 'catchAndShoot3', 'pullUp3', 'stepback'], 2.5],
};
const LAST_SHOTS: Record<LastShotType, ShotType[]> = {
  three: ['aboveBreak3', 'pullUp3', 'stepback', 'corner3', 'catchAndShoot3'],
  drive: ['layup', 'dunk', 'rim', 'close'],
  mid: ['midrange', 'longMidrange', 'fadeaway'],
  post: ['postShot', 'hook'],
};
function calledShotWeights(weights: Record<ShotType, number>, call: PlayCall): Record<ShotType, number> {
  const out = { ...weights };
  if (call.kind === 'lastShot') {
    const allowed = LAST_SHOTS[call.shot ?? 'three'];
    for (const k of Object.keys(out) as ShotType[]) out[k] = allowed.includes(k) ? Math.max(1, out[k] ?? 0) : 0;
    for (const k of allowed) out[k] = Math.max(1, out[k] ?? 0);
    return out;
  }
  const [types, boost] = CALL_SHOTS[call.kind];
  for (const k of types) out[k] = Math.max(1, out[k] ?? 0) * boost;
  return out;
}

export interface PossessionResult {
  ballHandlerId: PlayerId;
  events: string[];
  result: 'MAKE' | 'MISS' | 'TURNOVER' | 'FOUL';
  statDeltas: Record<PlayerId, Partial<PlayerStatLine>>;
  debug: Record<string, unknown>;
  pointsScored: number;
}

type Action = 'isolation' | 'pnr' | 'postUp' | 'drive' | 'catchAndShoot' | 'transition';

function chooseAction(bh: OnCourtPlayer, rng: RNG, mods: RuleMods): Action {
  const weights: [Action, number][] = [
    ['isolation', bh.role.isolation * mods.action.isolation],
    ['pnr', bh.role.pnrBallHandler * mods.action.pnr],
    ['postUp', bh.role.postUp * mods.action.postUp],
    ['drive', bh.role.primaryBallHandler * 0.5 + 10],
    ['catchAndShoot', bh.role.spotUpShooter + bh.role.catchAndShoot],
    ['transition', bh.role.transitionFinisher * 0.5 * mods.action.transition],
  ];
  const idx = rng.weightedPick(weights.map(([, w]) => Math.max(1, w)));
  return weights[idx][0];
}

function addDelta(deltas: Record<PlayerId, Partial<PlayerStatLine>>, id: PlayerId, patch: Partial<PlayerStatLine>) {
  const existing = deltas[id] ?? {};
  // for…in over a plain object literal: same keys and order as Object.entries, without allocating pairs.
  for (const k in patch) {
    const v = (patch as any)[k];
    if (typeof v === 'number') {
      (existing as any)[k] = ((existing as any)[k] ?? 0) + v;
    }
  }
  deltas[id] = existing;
}

/** Adjusts raw shot-type tendency weights so an explicit target-3PA override is respected over many possessions. */
function applyThreePointOverride(weights: Record<ShotType, number>, target: number | undefined): Record<ShotType, number> {
  if (target == null) return weights;
  const boosted = { ...weights };
  for (const t of THREE_POINT_TYPES) {
    boosted[t] = (boosted[t] ?? 1) * (1 + target / 8); // heavier explicit target => heavier three-weight
  }
  return boosted;
}

export function simulatePossession(input: PossessionInput): PossessionResult {
  const { rng, offense, defense } = input;
  const mods = input.ruleMods ?? NEUTRAL_RULE_MODS;
  const events: string[] = [];
  const statDeltas: Record<PlayerId, Partial<PlayerStatLine>> = {};

  const bhCandidates: BallHandlerCandidate[] = offense.map((p) => ({
    playerId: p.playerId,
    priority: p.ballHandlerPriority,
    fatigueLevel: p.fatigue.level,
    onCourt: true,
  }));
  const call = input.playCall;
  const focus = call?.focusId ? offense.find(p => p.playerId === call.focusId) : undefined;
  // Isolations, post-ups and last shots go to the player the coach named.
  const ballHandlerId = focus && (call!.kind === 'iso' || call!.kind === 'post' || call!.kind === 'lastShot') ? focus.playerId : chooseBallHandler(bhCandidates, rng);
  const bh = offense.find((p) => p.playerId === ballHandlerId)!;
  const bhIndex = offense.indexOf(bh);
  const primaryDefender = defense[input.matchups[bhIndex]] ?? defense[0];

  addDelta(statDeltas, bh.playerId, { touches: 1 });
  events.push(`${bh.playerId} has the ball`);

  const action: Action = !call || call.kind === 'threes' ? chooseAction(bh, rng, mods)
    : call.kind === 'pnr' ? 'pnr' : call.kind === 'iso' ? 'isolation' : call.kind === 'post' ? 'postUp'
    : call.shot === 'post' ? 'postUp' : call.shot === 'drive' ? 'drive' : 'isolation';
  const doubleTeamed = input.doubleTargetId === bh.playerId || rng.chance(input.doubleTeamProbability * mods.doubleTeamFrequency * (bh.ballDominance / 100));
  if (doubleTeamed) events.push('Double team');

  // --- Decision: pass (leading to a teammate's shot) vs shoot-it-yourself vs turn it over on the handle ---
  // Driven by the ball handler's own passing dial + playmaking IQ, tempered by how shot-hungry their
  // role/usage is. Real offenses route the large majority of possessions through at least one purposeful
  // pass before the shot goes up, so the baseline here sits well above a coin flip.
  const passTend = bh.passing?.passFrequency ?? 50;
  const playmakingIQ = (bh.attributes.offense.passingIQ + bh.attributes.offense.offensiveIQ + bh.attributes.offense.decisionMaking) / 3;
  let passFrequency = 48 + passTend * 0.42 + (playmakingIQ - 50) * 0.2;
  if (action === 'isolation' || action === 'postUp') passFrequency -= 14;
  if (action === 'pnr' || action === 'drive') passFrequency += 8;
  if (action === 'catchAndShoot') passFrequency -= 6; // they already got theirs off a prior pass; less likely to move it again
  passFrequency -= Math.max(0, bh.ballDominance - 60) * 0.35; // go-to scorers still shoot it themselves more often
  if (doubleTeamed) passFrequency += 20; // giving it up under pressure is the smart read
  if (call?.kind === 'threes') passFrequency += 10; // swing it for the open three
  passFrequency = Math.max(12, Math.min(90, passFrequency));
  // A called isolation, post-up or last shot stays with the man it was drawn up for (unless he's doubled).
  const keepIt = !!focus && focus === bh && !doubleTeamed && (call!.kind === 'iso' || call!.kind === 'post' || call!.kind === 'lastShot');
  const willPass = !keepIt && rng.chance(passFrequency / 100) && offense.length > 1;

  const turnoverCtx: TurnoverContext = {
    action: action === 'pnr' ? 'pnrHandle' : action === 'postUp' ? 'postUp' : action === 'catchAndShoot' ? 'catchAndShoot' : action === 'transition' ? 'transition' : willPass ? 'pass' : 'drive',
    isPass: willPass,
    defenderPerimeterDefense: primaryDefender.attributes.defense.perimeterDefense,
    defenderStealIQ: primaryDefender.attributes.defense.stealIQ,
    defenderOnBallSteal: primaryDefender.attributes.defense.onBallSteal,
    defenderPassingLaneSteal: primaryDefender.attributes.defense.passingLaneSteal,
    defensivePressure: doubleTeamed ? 0.6 : 0.15,
    doubleTeamed,
    fatigueLevel: bh.fatigue.level,
    turnoverFrequencyMultiplier: input.turnoverFrequencyMultiplier,
    stealFrequencyMultiplier: mods.turnover.stealFrequency * mods.turnover.stealSuccess,
    chargeFrequencyMultiplier: mods.turnover.chargeFrequency,
    perimeterDefenseImpactMultiplier: mods.turnover.perimeterDefenseImpact,
  };

  const tov = resolveTurnover(bh.attributes, turnoverCtx, bh.flags, rng);
  if (tov.occurred) {
    events.push(`Turnover: ${tov.type}`);
    // Charges, offensive fouls and illegal screens are personal fouls as well as turnovers.
    const offensiveFoul = tov.type === 'OFFENSIVE_FOUL' || tov.type === 'CHARGE' || tov.type === 'ILLEGAL_SCREEN';
    addDelta(statDeltas, bh.playerId, { tov: 1, [`turnoverBreakdown.${tov.type}` as any]: 1, ...(offensiveFoul ? { pf: 1 } : {}) });
    if (tov.causedBySteal) {
      // Passing-lane steals go mostly to the defenders who read the lanes best.
      const stealer = tov.stealerCredit === 'ON_BALL' ? primaryDefender
        : defense[rng.weightedPick(defense.map(d => 4 + Math.pow(Math.max(1, d.attributes.defense.passingLaneSteal + d.attributes.defense.stealIQ) / 20, 2)))];
      addDelta(statDeltas, stealer.playerId, { stl: 1 });
      events.push(`${stealer.playerId} STEAL`);
    }
    return { ballHandlerId: bh.playerId, events, result: 'TURNOVER', statDeltas, pointsScored: 0, debug: { turnoverProbability: tov.probability, action } };
  }

  // Non-shooting fouls: reach-ins, holds and loose-ball fouls (about 6-7 a team game in the NBA). In the bonus the
  // ball handler shoots two; otherwise the offense simply keeps the ball and the possession goes on.
  const nsFoulProb = Math.max(0, (NON_SHOOTING_FOUL_BASE + (50 - primaryDefender.attributes.mental.discipline) * 0.0006) * input.foulFrequencyMultiplier);
  if (rng.chance(nsFoulProb)) {
    const fouler = rng.chance(0.65) ? primaryDefender : defense[rng.nextInt(defense.length)];
    addDelta(statDeltas, fouler.playerId, { pf: 1 });
    if (rng.chance(BONUS_SHARE)) {
      const freeThrowOutcomes: boolean[] = [];
      let ftMakes = 0;
      for (let i = 0; i < 2; i++) {
        const made = resolveFreeThrow(bh.attributes.offense.freeThrow, rng, mods.shot.freeThrowDifficulty);
        freeThrowOutcomes.push(made);
        if (made) ftMakes++;
      }
      addDelta(statDeltas, bh.playerId, { fta: 2, ftm: ftMakes, points: ftMakes, possessionsUsed: 1, clutchPoints: input.isClutch ? ftMakes : 0 });
      events.push(`${fouler.playerId} foul on ${bh.playerId}, in the bonus (${ftMakes}/2 FT)`);
      return { ballHandlerId: bh.playerId, events, result: 'FOUL', statDeltas, pointsScored: ftMakes, debug: { foulProbability: nsFoulProb, freeThrowOutcomes } };
    }
    events.push(`${fouler.playerId} non-shooting foul on ${bh.playerId}`);
  }

  // Determine who actually shoots (could be a teammate if a pass went out).
  let shooter = bh;
  let assistCandidate: OnCourtPlayer | null = null;
  if (willPass) {
    const teammates = offense.filter((p) => p.playerId !== bh.playerId);
    const weights = teammates.map((p) => {
      const defenderIdx = input.matchups[offense.indexOf(p)];
      const defender = defense[defenderIdx];
      // Lower defender contest/closeout = more "open" = more likely to be the pass target.
      const openness = defender ? Math.max(5, 100 - (defender.attributes.defense.contest + defender.attributes.defense.closeout) / 2) : 40;
      return 1 + p.role.spotUpShooter * 0.35 + p.role.catchAndShoot * 0.35 + p.role.cutter * 0.15 + openness * 0.5;
    });
    shooter = teammates[rng.weightedPick(weights)];
    assistCandidate = bh;
    events.push(`Pass to ${shooter.playerId}`);
  }
  const shooterDefender = defense[input.matchups[offense.indexOf(shooter)]] ?? primaryDefender;

  const rawShotWeights = shooter.shotTendencies;
  const overridden = applyThreePointOverride(rawShotWeights, shooter.threePointTarget);
  const adjustedShotWeights = call ? calledShotWeights(overridden as Record<ShotType, number>, call) : overridden;
  const shotType = chooseShotType(adjustedShotWeights as any, shooter.attributes.offense, rng, mods.shotTypeWeight);
  const isThree = THREE_POINT_TYPES.includes(shotType);

  const contest = rollContestLevel(
    shooterDefender.attributes.defense.contest, shooterDefender.attributes.defense.closeout, rng,
    mods.shot.contestEffectiveness, mods.shot.closeoutEffectiveness, mods.shot.heavilyContestedShotFrequency,
  );

  // Block check happens before the make/miss roll. At the rim, the defense's best shot-blocker often rotates over
  // to challenge (weak-side help), which is why real blocks concentrate on centers.
  const isRimShot = RIM_TYPES.includes(shotType) || shotType === 'postShot' || shotType === 'hook';
  const helper = isRimShot ? defense.reduce((best, d) => blockSkill(d) > blockSkill(best) ? d : best, defense[0]) : shooterDefender;
  const blocker = helper && helper !== shooterDefender && rng.chance(HELP_BLOCK_SHARE) ? helper : shooterDefender;
  const blockProb = computeBlockProbability(
    blocker.attributes, shotType, shooter.attributes.offense.finishing, blocker.flags,
    mods.blockFrequency * mods.blockSuccess, mods.rimProtection,
  );
  addDelta(statDeltas, blocker.playerId, { blkAtt: 1 });
  if (rng.chance(blockProb)) {
    events.push(`${blocker.playerId} BLOCK`);
    addDelta(statDeltas, blocker.playerId, { blk: 1 });
    addDelta(statDeltas, shooter.playerId, {
      fga: 1,
      tpa: isThree ? 1 : 0,
      rimAttempts: isThree ? 0 : 1,
      possessionsUsed: 1,
      ba: 1,
    });
    const { winnerId: reboundWinner, credited } = resolveReboundStep(offense, defense, isThree, rng, statDeltas, mods);
    const offensiveRebound = offense.some(p => p.playerId === reboundWinner);
    events.push(credited ? `Rebound: ${reboundWinner}` : 'Out of bounds: team rebound');
    if (offensiveRebound) events.push(`Offensive rebound: ${credited ? reboundWinner : 'the offense'} keeps it alive`);
    return { ballHandlerId: bh.playerId, events, result: 'MISS', statDeltas, pointsScored: 0, debug: { blockProbability: blockProb, shotType, offensiveRebound } };
  }

  // Shooting foul check: a foul here sends the shooter to the line without the shot counting
  // as a field goal attempt, matching real basketball scoring rules.
  const foulProb = foulDrawProbability(shotType, contest, shooterDefender.attributes.mental.discipline, input.foulFrequencyMultiplier, mods.freeThrowFrequency);
  if (rng.chance(foulProb)) {
    addDelta(statDeltas, shooterDefender.playerId, { pf: 1 });
    const ftAttempts = isThree ? 3 : 2;
    let ftMakes = 0;
    const freeThrowOutcomes: boolean[] = [];
    for (let i = 0; i < ftAttempts; i++) {
      const made = resolveFreeThrow(shooter.attributes.offense.freeThrow, rng, mods.shot.freeThrowDifficulty);
      freeThrowOutcomes.push(made);
      if (made) ftMakes++;
    }
    addDelta(statDeltas, shooter.playerId, { fta: ftAttempts, ftm: ftMakes, points: ftMakes, possessionsUsed: 1, clutchPoints: input.isClutch ? ftMakes : 0 });
    events.push(`${shooterDefender.playerId} shooting foul on ${shooter.playerId} (${ftMakes}/${ftAttempts} FT)`);
    return { ballHandlerId: bh.playerId, events, result: 'FOUL', statDeltas, pointsScored: ftMakes, debug: { foulProbability: foulProb, shotType, contest, freeThrowOutcomes } };
  }

  const fatigueMult = fatiguePenaltyMultiplier(shooter.fatigue, shooter.flags);
  // Fatigue scales the offensive block only (defense/mental untouched for shot math). A fresh player shoots with
  // his ratings as they are; otherwise only the offense numbers are copied (this used to deep-copy every rating).
  let effectiveAttrsForShot: Attributes = shooter.attributes;
  if (fatigueMult !== 1) {
    const offense = {} as Attributes['offense'];
    const source = shooter.attributes.offense as unknown as Record<string, unknown>;
    for (const k in source) (offense as unknown as Record<string, unknown>)[k] = typeof source[k] === 'number' ? (source[k] as number) * fatigueMult : source[k];
    effectiveAttrsForShot = { ...shooter.attributes, offense };
  }

  const shotResult = resolveShot(
    effectiveAttrsForShot,
    {
      type: shotType, contest, fatigueLevel: shooter.fatigue.level, isClutch: input.isClutch, isPlayoffs: input.isPlayoffs,
      shootingVariance: input.shootingVariance, action, wasAssisted: assistCandidate != null,
      defenderDefensiveIQ: shooterDefender.attributes.defense.defensiveIQ, ruleMods: mods.shot,
    },
    shooter.flags,
    rng,
  );

  addDelta(statDeltas, shooter.playerId, {
    fga: 1,
    tpa: isThree ? 1 : 0,
    possessionsUsed: 1,
  });

  if (shotResult.made) {
    let points = isThree ? 3 : 2;
    const freeThrowOutcomes: boolean[] = [];
    events.push(`${shooter.playerId} ${shotType} MAKE (+${points})`);
    addDelta(statDeltas, shooter.playerId, { points, fgm: 1, tpm: isThree ? 1 : 0, clutchPoints: input.isClutch ? points : 0 });

    // And-1: made shot despite contact draws the foul for a bonus free throw.
    if (rng.chance(andOneProbability(shotType, contest))) {
      addDelta(statDeltas, shooterDefender.playerId, { pf: 1 });
      const bonusMade = resolveFreeThrow(shooter.attributes.offense.freeThrow, rng, mods.shot.freeThrowDifficulty);
      freeThrowOutcomes.push(bonusMade);
      addDelta(statDeltas, shooter.playerId, { fta: 1, ftm: bonusMade ? 1 : 0, points: bonusMade ? 1 : 0 });
      if (bonusMade) points += 1;
      events.push(`${shooter.playerId} AND-1 (${bonusMade ? 'made' : 'missed'} FT)`);
    }

    if (assistCandidate) {
      const assistChance = Math.min(0.94, (0.63 + assistCandidate.attributes.offense.passingIQ * 0.005 + assistCandidate.role.primaryBallHandler * 0.0012) * mods.assistFrequency);
      if (assistCandidate.flags.automaticAssist || rng.chance(assistChance)) {
        addDelta(statDeltas, assistCandidate.playerId, { ast: 1 });
        events.push(`${assistCandidate.playerId} AST`);
      }
    }
    return { ballHandlerId: bh.playerId, events, result: 'MAKE', statDeltas, pointsScored: points, debug: { makeProbability: shotResult.probability, shotType, contest, freeThrowOutcomes } };
  }

  events.push(`${shooter.playerId} ${shotType} MISS`);
  const { winnerId: reboundWinner, credited } = resolveReboundStep(offense, defense, isThree, rng, statDeltas, mods);
  const offensiveRebound = offense.some(p => p.playerId === reboundWinner);
  events.push(credited ? `Rebound: ${reboundWinner}` : 'Out of bounds: team rebound');
  if (offensiveRebound) events.push(`Offensive rebound: ${credited ? reboundWinner : 'the offense'} keeps it alive`);
  return { ballHandlerId: bh.playerId, events, result: 'MISS', statDeltas, pointsScored: 0, debug: { makeProbability: shotResult.probability, shotType, contest, offensiveRebound } };
}

/** Chance per possession of a non-shooting defensive foul (average discipline), and how often one comes in the bonus. */
export const NON_SHOOTING_FOUL_BASE = 0.088;
export const BONUS_SHARE = 0.28;

/** How often a rim attempt is challenged by the best shot-blocker on the floor instead of the shooter's own man. */
export const HELP_BLOCK_SHARE = 0.38;
function blockSkill(p: OnCourtPlayer): number {
  const d = p.attributes.defense;
  return d.block * 0.35 + d.rimProtection * 0.2 + d.blockIQ * 0.15 + d.blockTiming * 0.15 + p.attributes.physical.vertical * 0.15;
}

/** Share of missed shots that end as uncredited team rebounds: out of bounds, tipped loose (NBA: roughly one in ten).
 * Tuned with the rebound weights so team rebounding lands near 42-43 a game with ~10 offensive. */
export const TEAM_REBOUND_SHARE = 0.09;

function resolveReboundStep(
  offense: OnCourtPlayer[],
  defense: OnCourtPlayer[],
  wasThree: boolean,
  rng: RNG,
  statDeltas: Record<PlayerId, Partial<PlayerStatLine>>,
  mods: RuleMods,
): { winnerId: PlayerId; credited: boolean } {
  const candidates: RebounderCandidate[] = [
    ...offense.map((p) => ({ playerId: p.playerId, attributes: p.attributes, flags: p.flags, isOffense: true })),
    ...defense.map((p) => ({ playerId: p.playerId, attributes: p.attributes, flags: p.flags, isOffense: false })),
  ];
  const winnerId = resolveRebound(candidates, wasThree, rng, mods.reboundOffense, mods.reboundDefense);
  const winnerIsOffense = offense.some((p) => p.playerId === winnerId);
  // Some misses go out of bounds or are tipped around: official stats credit those to the team, not a player.
  const credited = !rng.chance(TEAM_REBOUND_SHARE);
  if (credited) addDelta(statDeltas, winnerId, winnerIsOffense ? { oreb: 1 } : { dreb: 1 });
  return { winnerId, credited };
}
