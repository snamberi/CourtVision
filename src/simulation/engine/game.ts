import { playbackFromPossession } from '../gamePlayback';
import { topPlaysFor } from '../highlights';
import type { GameSettings, PlayerId, PlayerSeason, Badge } from '../types';
import type { CoachTendencies } from '../league';
import { defaultCoachTendencies } from '../league';
import type { LeagueRulesSettings } from '../leagueRules';
import { computeRuleMods } from './ruleMods';
import { RNG } from './rng';
import { resolveEffectivePlayer } from './effective';
import { simulatePossession, type OnCourtPlayer, type PlayCall, type LastShotType } from './possession';
import { computeMatchups } from './matchups';
import { LiveRotation } from './liveRotation';
import { applyCoachingPlan } from './coachingPlan';
import { freshFatigue, updateFatigue, type FatigueState } from './fatigue';
import { rollInjury } from './injuries';
import { emptyStatLine, type GameResult, type PlayerStatLine, type PossessionLogEntry, type TeamBoxScore } from '../boxscore';
import { coachPerformanceModifiers, type CoachIdentity } from '../coaching';
import type { ShotType } from './shot';

export interface TeamInput {
  teamId: string;
  rotationOrder?: string[];
  seasons: PlayerSeason[];
  coach?: CoachTendencies;
  chemistry?: number;
  coachIdentity?: CoachIdentity; // the named head coach — their traits/relationships modify in-game outcomes
}

export interface SimulateGameOptions {
  moraleImpact?: number;
  home: TeamInput;
  away: TeamInput;
  settings: GameSettings;
  customBadges?: Badge[];
  isPlayoffs?: boolean;
  rules?: LeagueRulesSettings; // League Rules panel - see engine/ruleMods.ts for exactly which fields this actually changes
  /** Watch-and-coach decisions. Each applies from `atPossession` onward, so every earlier possession
   * (same seed, same inputs) replays bit-for-bit identically and the live replay never jumps. */
  liveCoaching?: LiveCoachingCommand[];
}

export type LivePace = 'slow' | 'normal' | 'fast';
export type LiveDefense = NonNullable<CoachTendencies['defensiveScheme']>;
export type LiveCoachingCommand =
  | { kind: 'timeout'; atPossession: number; teamId: string }
  | { kind: 'lineup'; atPossession: number; teamId: string; lineup: PlayerId[] }
  | { kind: 'pace'; atPossession: number; teamId: string; pace: LivePace }
  | { kind: 'defense'; atPossession: number; teamId: string; defense: LiveDefense }
  /** A play call for this team's offense until changed ('motion' = back to the normal offense). */
  | { kind: 'play'; atPossession: number; teamId: string; play: 'motion' | 'pnr' | 'iso' | 'post' | 'threes'; focusId?: PlayerId }
  /** Double-team a player whenever he has the ball: 'hot' = the opponent's top scorer on the floor tonight. */
  | { kind: 'double'; atPossession: number; teamId: string; target: 'none' | 'hot' | PlayerId }
  /** Draw up the next shot: who takes it and what kind (applies to this team's next trip only). */
  | { kind: 'lastShot'; atPossession: number; teamId: string; shooterId: PlayerId; shot: LastShotType };
export const TIMEOUTS_PER_GAME = 7;
/** A run this long (unanswered points) gives the scoring team momentum; the other bench calls timeout at RUN_TIMEOUT. */
export const MOMENTUM_RUN = 8, RUN_TIMEOUT = 10;
const PACE_DURATION: Record<LivePace, number> = { slow: 1.22, normal: 1, fast: 0.8 };

function possessionsPerQuarter(quarterLengthMinutes: number, pacePreset: GameSettings['pacePreset'], paceModifier: number, rulesPaceMultiplier = 1): number {
  // secPerPossession is the average seconds between one TEAM's own consecutive possessions
  // (i.e. the standard basketball "pace" cycle: my possession -> opponent's possession -> my next one).
  // Real NBA pace is ~96-102 team-possessions per 48 minutes, i.e. roughly 28-30 seconds per cycle.
  const paceSecondsPerPossession: Record<GameSettings['pacePreset'], number> = {
    realistic: 28,
    balanced: 27,
    arcade: 21,
    chaos: 16,
    simulation: 29,
    custom: 26,
  };
  const paceFactor = (1 - ((paceModifier - 50) / 50) * 0.15) / rulesPaceMultiplier;
  const secPerPoss = paceSecondsPerPossession[pacePreset] * paceFactor;
  // possessionsThisQuarter below counts each TEAM's own possessions in the quarter; the game loop
  // alternates offense so the quarter contains possessionsThisQuarter * 2 total possession events.
  return Math.max(4, Math.round((quarterLengthMinutes * 60) / secPerPoss));
}

type StaticOnCourt = Omit<OnCourtPlayer, 'fatigue'>;
/** Ratings, badges and chemistry are fixed for a whole game; resolve them once per player rather than every possession. */
function buildOnCourtPlayer(season: PlayerSeason, fatigueMap: Record<PlayerId, FatigueState>, customBadges: Badge[], sandboxMode: boolean, chemistryModifier: number, cache?: Map<PlayerId, StaticOnCourt>): OnCourtPlayer {
  const cached = cache?.get(season.playerId);
  if (cached) return { ...cached, fatigue: fatigueMap[season.playerId] ?? freshFatigue() };
  const built = buildStaticOnCourt(season, customBadges, sandboxMode, chemistryModifier);
  cache?.set(season.playerId, built);
  return { ...built, fatigue: fatigueMap[season.playerId] ?? freshFatigue() };
}
function buildStaticOnCourt(season: PlayerSeason, customBadges: Badge[], sandboxMode: boolean, chemistryModifier: number): StaticOnCourt {
  const eff = resolveEffectivePlayer(season, customBadges, sandboxMode);
  const clamp = (v: number) => Math.max(0, Math.min(sandboxMode ? 200 : season.careerPlayer ? 120 : 99, v));
  // Team chemistry nudges communication/decision-making attributes without overpowering raw ability.
  if (chemistryModifier !== 0) {
    eff.attributes.offense.passingIQ = clamp(eff.attributes.offense.passingIQ + chemistryModifier);
    eff.attributes.offense.decisionMaking = clamp(eff.attributes.offense.decisionMaking + chemistryModifier);
    eff.attributes.defense.helpDefense = clamp(eff.attributes.defense.helpDefense + chemistryModifier);
    eff.attributes.defense.defensiveAwareness = clamp(eff.attributes.defense.defensiveAwareness + chemistryModifier);
  }
  const shotTendencies: Record<ShotType, number> = {
    rim: season.tendencies.shot.rim,
    close: season.tendencies.shot.close,
    layup: season.tendencies.shot.layup,
    dunk: season.tendencies.shot.dunk,
    midrange: season.tendencies.shot.midrange,
    longMidrange: season.tendencies.shot.longMidrange,
    stepback: season.tendencies.shot.stepback,
    fadeaway: season.tendencies.shot.fadeaway,
    postShot: season.tendencies.shot.postShot,
    hook: season.tendencies.shot.hook,
    corner3: season.tendencies.shot.corner3,
    aboveBreak3: season.tendencies.shot.aboveBreak3,
    pullUp3: season.tendencies.shot.pullUp3,
    catchAndShoot3: season.tendencies.shot.catchAndShoot3,
  };
  return {
    playerId: season.playerId,
    attributes: eff.attributes,
    positions: season.positions,
    flags: eff.flags,
    ballHandlerPriority: season.ballHandlerPriority,
    role: season.tendencies.role,
    shotTendencies,
    ballDominance: season.tendencies.ballDominance,
    passing: season.tendencies.passing,
    threePointTarget: season.tendencies.threePointTargets?.target,
  };
}

export function simulateGame(opts: SimulateGameOptions): GameResult {
  const { home, away, settings } = opts;
  const customBadges = opts.customBadges ?? [];
  const rng = new RNG(settings.seed);
  const ruleMods = computeRuleMods(opts.rules);
  const homeCoach = home.coach ?? defaultCoachTendencies();
  const awayCoach = away.coach ?? defaultCoachTendencies();
  const paceModifier = (homeCoach.paceTendency + awayCoach.paceTendency) / 2;
  const homeChemMod = settings.teamChemistryEnabled ? (((home.chemistry ?? 70) - 50) / 50) * 6 : 0;
  const awayChemMod = settings.teamChemistryEnabled ? (((away.chemistry ?? 70) - 50) / 50) * 6 : 0;

  const numQuarters = settings.era.numberOfQuarters;
  const qLen = settings.era.quarterLengthMinutes;
  const rotationRng = new RNG((settings.seed ?? 1) + 80321);
  const totalSeconds = Math.round(numQuarters * qLen * 60);
  const homeRotation = new LiveRotation(home.seasons, totalSeconds, homeCoach, opts.rules, rotationRng, home.rotationOrder, opts.isPlayoffs, away.seasons);
  const awayRotation = new LiveRotation(away.seasons, totalSeconds, awayCoach, opts.rules, rotationRng, away.rotationOrder, opts.isPlayoffs, home.seasons);
  const impact = opts.rules?.coachingImpact ?? 100;
  let hMods = applyCoachingPlan(ruleMods, homeCoach, awayCoach, home.coachIdentity, away.coachIdentity, home.seasons, away.seasons, impact, opts.moraleImpact);
  let aMods = applyCoachingPlan(ruleMods, awayCoach, homeCoach, away.coachIdentity, home.coachIdentity, away.seasons, home.seasons, impact, opts.moraleImpact);
  // Live coaching overrides (none unless a person is coaching this game while watching it).
  const commands = [...(opts.liveCoaching ?? [])].sort((a, b) => a.atPossession - b.atPossession);
  const applied = new Set<LiveCoachingCommand>();
  const livePace: Record<string, LivePace> = {};
  let homeDefenseCoach = homeCoach, awayDefenseCoach = awayCoach;
  const livePlay: Record<string, PlayCall | undefined> = {};
  const liveDouble: Record<string, 'none' | 'hot' | PlayerId> = {};
  const lastShot: Record<string, PlayCall | undefined> = {};
  const timeoutsUsed: Record<string, number> = { [home.teamId]: 0, [away.teamId]: 0 };
  // A team a person is coaching gets no automatic timeouts from its first decision on (its earlier ones replay as they were).
  const humanFrom: Record<string, number> = {};
  for (const c of commands) humanFrom[c.teamId] = Math.min(humanFrom[c.teamId] ?? Infinity, c.atPossession);
  // Momentum: unanswered points by one team.
  let run: { teamId: string | null; points: number } = { teamId: null, points: 0 };
  const staticCache = new Map<PlayerId, StaticOnCourt>();
  const hPerformance = coachPerformanceModifiers(home.coachIdentity, home.seasons);
  const aPerformance = coachPerformanceModifiers(away.coachIdentity, away.seasons);
  const coachingScale = (value: number) => 1 + (value - 1) * impact / 100;

  const fatigue: Record<PlayerId, FatigueState> = {};
  for (const s of [...home.seasons, ...away.seasons]) fatigue[s.playerId] = settings.fatigueEnabled ? {level: Math.min(.35,(s.training?.workload??0)/280)} : freshFatigue();

  const homeBox: TeamBoxScore = { teamId: home.teamId, points: 0, players: {} };
  const awayBox: TeamBoxScore = { teamId: away.teamId, points: 0, players: {} };
  for (const s of home.seasons) homeBox.players[s.playerId] = emptyStatLine(s.playerId);
  for (const s of away.seasons) awayBox.players[s.playerId] = emptyStatLine(s.playerId);

  // Fixed for the whole game, so worked out once rather than on every possession for every player.
  const allSeasons = [...home.seasons, ...away.seasons];
  const fatigueLoad = new Map(allSeasons.map((s) => {
    const isHome = !!homeBox.players[s.playerId];
    const coach = isHome ? homeCoach : awayCoach;
    return [s.playerId, 0.5 * coachingScale((isHome ? hPerformance : aPerformance).fatigue) * coachingScale(coach.offensiveSystem === 'pace-space' ? 1.08 : coach.offensiveSystem === 'isolation' && s.ballHandlerPriority > 65 ? 1.1 : 1)] as const;
  }));
  const noFlags = {} as any;

  const possessionLog: PossessionLogEntry[] = [];
  const homeBySeasonId = new Map(home.seasons.map((s) => [s.playerId, s]));
  const awayBySeasonId = new Map(away.seasons.map((s) => [s.playerId, s]));
  const injuredPlayers = new Set<PlayerId>();
  const injuries: GameResult['injuries'] = [];

  const applyDeltaRouted = (deltas: Record<PlayerId, Partial<PlayerStatLine>>) => {
    for (const pid in deltas) {
      const patch = deltas[pid];
      const box = homeBox.players[pid] ? homeBox : awayBox.players[pid] ? awayBox : null;
      if (!box) continue;
      const line = box.players[pid];
      for (const k in patch) {
        if (k === 'turnoverBreakdown') continue;
        const v = (patch as any)[k];
        if (typeof v === 'number') (line as any)[k] = ((line as any)[k] ?? 0) + v;
      }
      if (patch.points) box.points += patch.points;
    }
  };

  let elapsed = 0;
  // Overtime uses the same clock and substitution system; the safety cap handles degenerate sandbox rosters.
  for (let q = 0; q < numQuarters || (homeBox.points === awayBox.points && q < numQuarters + 6); q++) {
    const periodMinutes = q < numQuarters ? qLen : Math.max(1, settings.era.overtimeLengthMinutes);
    const periodSeconds = Math.round(periodMinutes * 60);
    const possessionsThisQuarter = possessionsPerQuarter(periodMinutes, settings.pacePreset, paceModifier, ruleMods.paceMultiplier);
    const averageDuration = periodSeconds / (possessionsThisQuarter * 2);
    let clock = periodSeconds;
    let poss = 0;
    // Home has the ball to open every period (as before). Possession flips on makes, turnovers, fouls and defensive
    // rebounds; an offensive rebound keeps it for a quick second-chance attempt.
    let offenseIsHome = true;
    let secondChance = false;
    let previousHome: string[] = [];
    let previousAway: string[] = [];
    while (clock > 0) {
      const timeoutEvents: string[] = [];
      for (const cmd of commands) {
        if (applied.has(cmd) || cmd.atPossession > possessionLog.length) continue;
        applied.add(cmd);
        const isHome = cmd.teamId === home.teamId;
        if (!isHome && cmd.teamId !== away.teamId) continue;
        if (cmd.kind === 'lineup') (isHome ? homeRotation : awayRotation).pin(cmd.lineup, q);
        else if (cmd.kind === 'pace') livePace[cmd.teamId] = cmd.pace;
        else if (cmd.kind === 'defense') {
          // A new scheme changes the opponent's shot quality and this team's foul/steal profile.
          if (isHome) { homeDefenseCoach = { ...homeCoach, defensiveScheme: cmd.defense }; aMods = applyCoachingPlan(ruleMods, awayCoach, homeDefenseCoach, away.coachIdentity, home.coachIdentity, away.seasons, home.seasons, impact, opts.moraleImpact); }
          else { awayDefenseCoach = { ...awayCoach, defensiveScheme: cmd.defense }; hMods = applyCoachingPlan(ruleMods, homeCoach, awayDefenseCoach, home.coachIdentity, away.coachIdentity, home.seasons, away.seasons, impact, opts.moraleImpact); }
        } else if (cmd.kind === 'timeout') {
          // A timeout is a rest: everyone on the calling team recovers some legs, and it stops the other side's run.
          for (const s of (isHome ? home : away).seasons) if (settings.fatigueEnabled && fatigue[s.playerId]) fatigue[s.playerId] = { ...fatigue[s.playerId], level: fatigue[s.playerId].level * 0.55 };
          timeoutEvents.push(`${cmd.teamId} timeout`);
          timeoutsUsed[cmd.teamId]++;
          if (run.teamId && run.teamId !== cmd.teamId) run = { teamId: run.teamId, points: 0 };
        } else if (cmd.kind === 'play') livePlay[cmd.teamId] = cmd.play === 'motion' ? undefined : { kind: cmd.play, focusId: cmd.focusId };
        else if (cmd.kind === 'double') liveDouble[cmd.teamId] = cmd.target;
        else if (cmd.kind === 'lastShot') lastShot[cmd.teamId] = { kind: 'lastShot', focusId: cmd.shooterId, shot: cmd.shot };
      }
      // AI benches call timeout to stop a big run (no random draws, so games stay reproducible).
      if (!secondChance && run.teamId && run.points >= RUN_TIMEOUT) {
        const other = run.teamId === home.teamId ? away.teamId : home.teamId;
        const human = humanFrom[other] != null && possessionLog.length >= humanFrom[other];
        if (!human && timeoutsUsed[other] < TIMEOUTS_PER_GAME) {
          timeoutEvents.push(`${other} timeout`);
          timeoutsUsed[other]++;
          run = { teamId: run.teamId, points: 0 };
        }
      }
      const margin = homeBox.points - awayBox.points;
      // The rotation still decides every trip (it reviews on an interval, so a change right on a putback is rare);
      // that keeps exact-minute budgets and injury replacements precise.
      const hOnCourtIds = homeRotation.choose(q, clock, qLen * 60, elapsed, margin, injuredPlayers, homeBox.players, fatigue);
      const aOnCourtIds = awayRotation.choose(q, clock, qLen * 60, elapsed, -margin, injuredPlayers, awayBox.players, fatigue);
      const offenseTeamId = offenseIsHome ? home.teamId : away.teamId;
      const paceFactor = PACE_DURATION[livePace[offenseTeamId] ?? 'normal'];
      // A putback or kick-out after an offensive board uses a fraction of a full trip (shot clock resets to 14).
      const durationScale = secondChance ? 0.18 + rotationRng.next() * 0.3 : (0.55 + rotationRng.next() * 0.9) * paceFactor;
      const secondsPerPossession = Math.max(1, Math.min(clock,
        Math.round(averageDuration * durationScale),
        homeRotation.limitDuration(hOnCourtIds, q, qLen * 60), awayRotation.limitDuration(aOnCourtIds, q, qLen * 60)));
      homeRotation.credit(hOnCourtIds, secondsPerPossession);
      awayRotation.credit(aOnCourtIds, secondsPerPossession);
      const offenseIds = offenseIsHome ? hOnCourtIds : aOnCourtIds;
      const defenseIds = offenseIsHome ? aOnCourtIds : hOnCourtIds;
      const offenseSeasons = offenseIds.map((id) => (offenseIsHome ? homeBySeasonId : awayBySeasonId).get(id)!).filter(Boolean);
      const defenseSeasons = defenseIds.map((id) => (offenseIsHome ? awayBySeasonId : homeBySeasonId).get(id)!).filter(Boolean);
      if (offenseSeasons.length < 1 || defenseSeasons.length < 1) { clock -= secondsPerPossession; elapsed += secondsPerPossession; poss++; offenseIsHome = !offenseIsHome; secondChance = false; continue; }

      const offenseOnCourt = offenseSeasons.map((s) => buildOnCourtPlayer(s, fatigue, customBadges, settings.sandboxMode, offenseIsHome ? homeChemMod : awayChemMod, staticCache));
      const defenseOnCourt = defenseSeasons.map((s) => buildOnCourtPlayer(s, fatigue, customBadges, settings.sandboxMode, offenseIsHome ? awayChemMod : homeChemMod, staticCache));
      const matchups = computeMatchups(offenseOnCourt, defenseOnCourt);

      const isClutch = q >= numQuarters - 1 && clock < 300 && Math.abs(homeBox.points - awayBox.points) <= 10;
      const defenseCoach = offenseIsHome ? awayDefenseCoach : homeDefenseCoach;
      const defenseTeamId = offenseIsHome ? away.teamId : home.teamId;
      // The coach's call: a drawn-up last shot first (used once), then the standing play call.
      const drawn = lastShot[offenseTeamId];
      const playCall = drawn && offenseIds.includes(drawn.focusId!) ? drawn : livePlay[offenseTeamId];
      if (drawn) lastShot[offenseTeamId] = undefined;
      const doubling = liveDouble[defenseTeamId];
      const offenseBox = offenseIsHome ? homeBox : awayBox;
      const doubleTargetId = !doubling || doubling === 'none' ? undefined
        : doubling === 'hot' ? [...offenseIds].sort((a, b) => (offenseBox.players[b]?.points ?? 0) - (offenseBox.players[a]?.points ?? 0))[0]
        : offenseIds.includes(doubling) ? doubling : undefined;
      // A team on a run plays with a little extra confidence.
      let possessionMods = offenseIsHome ? hMods : aMods;
      if (run.teamId === offenseTeamId && run.points >= MOMENTUM_RUN) possessionMods = { ...possessionMods, shot: { ...possessionMods.shot, offensiveEfficiency: possessionMods.shot.offensiveEfficiency * (1 + Math.min(0.03, (run.points - 6) * 0.004)) } };

      const result = simulatePossession({
        offense: offenseOnCourt,
        defense: defenseOnCourt,
        matchups,
        quarter: q + 1,
        clockSeconds: clock,
        isClutch,
        isPlayoffs: opts.isPlayoffs ?? false,
        shootingVariance: settings.shootingVariance,
        turnoverFrequencyMultiplier: settings.turnoverFrequencyMultiplier
          * coachingScale((offenseIsHome ? hPerformance : aPerformance).turnover) * (isClutch ? coachingScale(1 - (((offenseIsHome ? home : away).coachIdentity?.profile?.attributes.adjustments ?? 50) - 50) / 1500) : 1),
        foulFrequencyMultiplier: settings.foulFrequency * coachingScale((0.8 + defenseCoach.defensiveAggression / 250) * (defenseCoach.defensiveScheme === 'pressure' ? 1.18 : 1)),
        doubleTeamProbability: (defenseCoach.doubleTeamFrequency / 100) * 0.15,
        offenseTeamId: offenseIsHome ? home.teamId : away.teamId,
        rng,
        ruleMods: possessionMods,
        ...(playCall ? { playCall } : {}),
        ...(doubleTargetId ? { doubleTargetId } : {}),
      });
      if (result.pointsScored > 0) run = run.teamId === offenseTeamId ? { teamId: run.teamId, points: run.points + result.pointsScored } : { teamId: offenseTeamId, points: result.pointsScored };

      applyDeltaRouted(result.statDeltas);

      const extraEvents: string[] = [...timeoutEvents];
      for (const [side, current, previous] of [[home.teamId, hOnCourtIds, previousHome], [away.teamId, aOnCourtIds, previousAway]] as const) {
        const entered = current.filter(id => !previous.includes(id));
        if (previous.length && entered.length) extraEvents.push(`${side} substitution: ${entered.join(', ')} in; ${previous.filter(id => !current.includes(id)).join(', ')} out`);
      }
      previousHome = hOnCourtIds;
      previousAway = aOnCourtIds;

      // Direct lookups instead of scanning the on-court lists for every rostered player (the hottest loop in a game).
      const onCourtIds = new Set<PlayerId>(hOnCourtIds);
      for (const id of aOnCourtIds) onCourtIds.add(id);
      const onCourtById = new Map<PlayerId, OnCourtPlayer>();
      for (const p of offenseOnCourt) onCourtById.set(p.playerId, p);
      for (const p of defenseOnCourt) if (!onCourtById.has(p.playerId)) onCourtById.set(p.playerId, p);
      for (const s of allSeasons) {
        const onCourt = onCourtIds.has(s.playerId);
        const onCourtPlayer = onCourtById.get(s.playerId);
        const flags = onCourtPlayer?.flags;
        const current = fatigue[s.playerId];
        // A rested bench player stays at zero: keep his state rather than allocating a new one.
        if (!onCourt && current && current.level === 0) { /* unchanged */ }
        else fatigue[s.playerId] = settings.fatigueEnabled ? updateFatigue(current, onCourt, fatigueLoad.get(s.playerId)!, s.attributes.physical.stamina, flags ?? noFlags, secondsPerPossession) : freshFatigue();

        if (settings.injuriesEnabled && onCourt && onCourtPlayer && !injuredPlayers.has(s.playerId)) {
          const outcome = rollInjury(
            fatigue[s.playerId].level, s.attributes.physical.durability, s.development.injuryRisk,
            settings.injuryFrequencyMultiplier, onCourtPlayer.flags, rng,
          );
          if (outcome.occurred) {
            injuredPlayers.add(s.playerId);
            injuries.push({ playerId: s.playerId, severity: outcome.severity!, quarter: q + 1, recoveryGamesEstimate: outcome.recoveryGamesEstimate! });
            extraEvents.push(`${s.playerId} is INJURED (${outcome.severity})`);
          }
        }
      }

      possessionLog.push({
        quarter: q + 1,
        clockSeconds: Math.round(clock),
        durationSeconds: secondsPerPossession,
        offenseTeamId: offenseIsHome ? home.teamId : away.teamId,
        ballHandlerId: result.ballHandlerId,
        playback: playbackFromPossession(result),
        action: result.debug.action as string ?? result.debug.shotType as string ?? 'possession',
        events: extraEvents.length > 0 ? [...result.events, ...extraEvents] : result.events,
        result: result.result as PossessionLogEntry['result'],
        debug: result.debug,
        onCourtHome: hOnCourtIds,
        onCourtAway: aOnCourtIds,
        homeScoreAfter: homeBox.points,
        awayScoreAfter: awayBox.points,
        ...(secondChance ? { secondChance: true } : {}),
      });

      clock -= secondsPerPossession;
      elapsed += secondsPerPossession;
      poss++;
      // Offensive rebound: same team goes again. Anything else hands the ball over.
      const keptBall = result.result === 'MISS' && result.debug.offensiveRebound === true;
      secondChance = keptBall;
      if (!keptBall) offenseIsHome = !offenseIsHome;
    }
  }

  for (const [id, seconds] of Object.entries(homeRotation.seconds)) homeBox.players[id].minutes = seconds / 60;
  for (const [id, seconds] of Object.entries(awayRotation.seconds)) awayBox.players[id].minutes = seconds / 60;

  const result: GameResult = {
    regulationPeriods: numQuarters,
    homeTeamId: home.teamId,
    awayTeamId: away.teamId,
    homeScore: homeBox.points,
    awayScore: awayBox.points,
    homeBox,
    awayBox,
    possessionLog,
    seed: settings.seed ?? -1,
    injuries,
  };
  result.topPlays = topPlaysFor(result);
  return result;
}
