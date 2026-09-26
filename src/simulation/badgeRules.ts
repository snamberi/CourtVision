import type { PlayerSeason } from './types';

/*
 * Each normal badge has its own bar: the ratings it depends on (with its own threshold), a production test that
 * only a player who really does that thing will pass, the sample it needs, and how quickly qualifying games build
 * credit. Players therefore earn badges one at a time, for what they actually do on the floor.
 */

export interface BadgeEvidence {
  games: number; minutes: number; handling: number; defensiveReps: number;
  shots: Record<string, { attempts: number; makes: number }>;
}
export interface BadgeContext {
  ability: (paths: string[]) => number;
  stats: { minutes: number; gamesPlayed: number; points: number; fga: number; fgm: number; tpa: number; tpm: number; fta: number; ast: number; tov: number; stl: number; blk: number; oreb: number; dreb: number; pf: number };
  evidence: BadgeEvidence;
  workload: number;
  heightInches: number;
}
export interface BadgeRule {
  /** Ratings that must average at least `min`. */
  abilities: string[]; min: number;
  /** Games that must qualify (after the rule passes) before the badge is earned. */
  games: number;
  /** Credit per qualifying game (100 needed): harder badges build more slowly. */
  rate: number;
  test: (c: BadgeContext) => boolean;
  text: string;
}

const per36 = (c: BadgeContext, v: number) => (v / Math.max(1, c.stats.minutes)) * 36;
const shots = (c: BadgeContext, keys: string[]) => keys.reduce((a, k) => ({ att: a.att + (c.evidence.shots[k]?.attempts ?? 0), made: a.made + (c.evidence.shots[k]?.makes ?? 0) }), { att: 0, made: 0 });
const pct = (s: { att: number; made: number }) => s.made / Math.max(1, s.att);
const shooting = (keys: string[], att: number, rate: number) => (c: BadgeContext) => { const s = shots(c, keys); return s.att >= att && pct(s) >= rate; };

export const BADGE_RULES: Record<string, BadgeRule> = {
  // Shooting
  deep_range: { abilities: ['offense.threePoint', 'offense.aboveBreak3'], min: 74, games: 30, rate: 1.4,
    test: c => shooting(['aboveBreak3', 'pullUp3'], 110, .37)(c) && c.stats.tpa >= c.stats.fga * .4, text: '110+ above-the-break/pull-up threes at 37%+, with threes at least 40% of his shots.' },
  deadeye: { abilities: ['offense.shotIQ', 'offense.offensiveConsistency'], min: 73, games: 35, rate: 1.3,
    test: c => c.stats.fga >= 300 && (c.stats.fgm + .5 * c.stats.tpm) / Math.max(1, c.stats.fga) >= .56, text: '300+ shots at an effective FG% of 56% or better.' },
  quick_release: { abilities: ['offense.catchAndShoot', 'offense.offensiveIQ'], min: 71, games: 25, rate: 1.7,
    test: shooting(['catchAndShoot3'], 70, .38), text: '70+ catch-and-shoot threes at 38%+.' },
  catch_and_shoot: { abilities: ['offense.catchAndShoot', 'offense.corner3'], min: 75, games: 35, rate: 1.3,
    test: shooting(['catchAndShoot3', 'corner3'], 130, .39), text: '130+ catch-and-shoot and corner threes at 39%+.' },
  difficult_shots: { abilities: ['offense.midrange', 'offense.postFade', 'offense.shotIQ'], min: 73, games: 30, rate: 1.4,
    test: shooting(['midrange', 'longMidrange', 'fadeaway'], 130, .44), text: '130+ midrange and fadeaway shots at 44%+.' },
  pullup_specialist: { abilities: ['offense.pullUp3', 'offense.longMidrange'], min: 73, games: 30, rate: 1.5,
    test: shooting(['pullUp3'], 75, .35), text: '75+ pull-up threes at 35%+.' },
  corner_specialist: { abilities: ['offense.corner3', 'offense.catchAndShoot'], min: 70, games: 25, rate: 1.8,
    test: shooting(['corner3'], 50, .41), text: '50+ corner threes at 41%+.' },
  // Ball handling
  handles: { abilities: ['offense.ballHandling', 'offense.speedWithBall'], min: 75, games: 35, rate: 1.3,
    test: c => c.evidence.handling >= 650 && per36(c, c.stats.tov) <= 3.2, text: '650+ possessions with the ball and no more than 3.2 turnovers per 36.' },
  unpluckable: { abilities: ['offense.ballSecurity'], min: 73, games: 30, rate: 1.5,
    test: c => c.evidence.handling >= 400 && c.stats.tov / Math.max(1, c.evidence.handling) <= .05, text: '400+ possessions with the ball, turning it over on 5% or fewer.' },
  tight_handle: { abilities: ['offense.ballHandling', 'offense.decisionMaking'], min: 73, games: 30, rate: 1.4,
    test: c => c.evidence.handling >= 500 && c.stats.ast / Math.max(1, c.stats.tov) >= 2.2, text: '500+ possessions with the ball and an assist/turnover ratio of 2.2+.' },
  speed_booster: { abilities: ['offense.speedWithBall', 'physical.acceleration'], min: 77, games: 30, rate: 1.5,
    test: c => c.evidence.handling >= 300 && shots(c, ['layup', 'dunk', 'rim']).att >= 90, text: '300+ possessions with the ball and 90+ attempts at the rim off the dribble.' },
  // Passing
  dimer: { abilities: ['offense.passingIQ', 'offense.passing'], min: 74, games: 30, rate: 1.4,
    test: c => c.stats.ast >= 150 && per36(c, c.stats.ast) >= 7, text: '150+ assists at 7+ per 36 minutes.' },
  needle_threader: { abilities: ['offense.passingAccuracy', 'offense.passing'], min: 72, games: 30, rate: 1.5,
    test: c => c.stats.ast >= 100 && per36(c, c.stats.ast) >= 5.5 && c.stats.ast / Math.max(1, c.stats.tov) >= 2.4, text: '100+ assists at 5.5+ per 36 with an assist/turnover ratio of 2.4+.' },
  bail_out: { abilities: ['offense.decisionMaking', 'offense.passingAccuracy'], min: 70, games: 25, rate: 1.7,
    test: c => c.stats.ast >= 60 && per36(c, c.stats.tov) <= 2 && c.stats.minutes >= 500, text: '60+ assists with 2 or fewer turnovers per 36 over 500+ minutes.' },
  floor_general: { abilities: ['offense.passingIQ', 'offense.decisionMaking', 'offense.ballSecurity'], min: 77, games: 40, rate: 1.1,
    test: c => c.stats.ast >= 220 && per36(c, c.stats.ast) >= 8 && c.stats.ast / Math.max(1, c.stats.tov) >= 2.6, text: '220+ assists at 8+ per 36 with an assist/turnover ratio of 2.6+.' },
  // Defense
  rim_protector: { abilities: ['defense.rimProtection', 'defense.block'], min: 74, games: 30, rate: 1.4,
    test: c => c.stats.blk >= 45 && per36(c, c.stats.blk) >= 2, text: '45+ blocks at 2+ per 36 minutes.' },
  lockdown: { abilities: ['defense.perimeterDefense', 'defense.contest'], min: 75, games: 35, rate: 1.2,
    test: c => c.evidence.defensiveReps >= 900 && per36(c, c.stats.stl) >= 1.2 && per36(c, c.stats.pf) <= 4, text: '900+ defensive possessions, 1.2+ steals and at most 4 fouls per 36.' },
  interceptor: { abilities: ['defense.passingLaneSteal', 'defense.stealIQ'], min: 72, games: 30, rate: 1.5,
    test: c => c.stats.stl >= 35 && per36(c, c.stats.stl) >= 1.6, text: '35+ steals at 1.6+ per 36 minutes.' },
  pick_pocket: { abilities: ['defense.onBallSteal', 'defense.steal'], min: 76, games: 35, rate: 1.3,
    test: c => c.stats.stl >= 50 && per36(c, c.stats.stl) >= 2, text: '50+ steals at 2+ per 36 minutes.' },
  chase_down: { abilities: ['defense.blockTiming', 'physical.speed', 'physical.vertical'], min: 72, games: 30, rate: 1.5,
    test: c => c.heightInches <= 80 && c.stats.blk >= 25, text: '25+ blocks as a wing or guard (6\'8" or shorter).' },
  glass_cleaner: { abilities: ['defense.defensiveRebounding', 'offense.offensiveRebounding'], min: 74, games: 30, rate: 1.4,
    test: c => c.stats.oreb + c.stats.dreb >= 260 && per36(c, c.stats.oreb + c.stats.dreb) >= 11.5, text: '260+ rebounds at 11.5+ per 36 minutes.' },
  switchable: { abilities: ['defense.pickAndRollDefense', 'defense.perimeterDefense', 'defense.interiorDefense'], min: 72, games: 35, rate: 1.3,
    test: c => c.evidence.defensiveReps >= 1000 && per36(c, c.stats.stl + c.stats.blk) >= 2.3, text: '1,000+ defensive possessions with 2.3+ steals and blocks per 36.' },
  iron_man: { abilities: ['physical.stamina', 'physical.durability'], min: 72, games: 45, rate: 1.1,
    test: c => c.evidence.minutes >= 1100 && c.evidence.games >= 40 && c.workload < 65, text: '1,100+ minutes over 40+ games with a manageable workload.' },
  // Finishing
  contact_finisher: { abilities: ['offense.finishing', 'physical.strength'], min: 72, games: 30, rate: 1.4,
    test: c => shooting(['rim', 'close', 'layup', 'dunk'], 160, .6)(c) && c.stats.fta >= 90, text: '160+ shots at the rim at 60%+ and 90+ free-throw attempts.' },
  acrobat: { abilities: ['offense.drivingLayup', 'offense.touch'], min: 74, games: 30, rate: 1.5,
    test: shooting(['layup'], 90, .56), text: '90+ layups at 56%+.' },
  posterizer: { abilities: ['offense.drivingDunk', 'physical.vertical'], min: 77, games: 30, rate: 1.5,
    test: c => shots(c, ['dunk']).made >= 35, text: '35+ dunks.' },
  post_craft: { abilities: ['offense.postControl', 'offense.postHook', 'offense.postFade'], min: 72, games: 30, rate: 1.4,
    test: shooting(['post', 'hook', 'fadeaway'], 90, .48), text: '90+ post-ups, hooks and fadeaways at 48%+.' },
};

/** How many normal badges a player's overall can carry: role players 1–2, stars 5–6, all-time greats up to 8. */
export function badgeCapacity(overall: number): number {
  return Math.max(1, Math.min(8, Math.floor((overall - 52) / 5)));
}
/** Qualifying-game gap between two new badges, so they arrive one at a time. */
export const BADGE_SPACING_GAMES = 12;

export function evaluateBadgeRule(id: string, c: BadgeContext): { eligible: boolean; description: string; rule?: BadgeRule } {
  const rule = BADGE_RULES[id];
  if (!rule) return { eligible: false, description: 'Experimental badges are Sandbox-only.' };
  const ability = c.ability(rule.abilities);
  const eligible = ability >= rule.min && c.stats.minutes >= 300 && rule.test(c);
  return { eligible, rule, description: `Ratings ${rule.min}+ (${rule.abilities.map(a => a.split('.')[1]).join(', ')}), 300+ minutes and ${rule.text} ${rule.games} qualifying games.` };
}

/** Context for a player from his season stats, development evidence and ratings. */
export function badgeContext(p: PlayerSeason, attributeValue: (p: PlayerSeason, path: string) => number): BadgeContext {
  const s = p.seasonStats;
  const e = p.training?.evidence;
  return {
    ability: paths => paths.reduce((n, k) => n + attributeValue(p, k), 0) / Math.max(1, paths.length),
    stats: { minutes: s?.minutes ?? 0, gamesPlayed: s?.gamesPlayed ?? 0, points: s?.points ?? 0, fga: s?.fga ?? 0, fgm: s?.fgm ?? 0, tpa: s?.tpa ?? 0, tpm: s?.tpm ?? 0, fta: s?.fta ?? 0,
      ast: s?.ast ?? 0, tov: s?.tov ?? 0, stl: s?.stl ?? 0, blk: s?.blk ?? 0, oreb: s?.oreb ?? 0, dreb: s?.dreb ?? 0, pf: s?.pf ?? 0 },
    evidence: { games: e?.games ?? 0, minutes: e?.minutes ?? 0, handling: e?.handling ?? 0, defensiveReps: e?.defensiveReps ?? 0, shots: e?.shots ?? {} },
    workload: p.training?.workload ?? 100,
    heightInches: p.attributes.physical.heightInches,
  };
}
