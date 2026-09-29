import type { PlayerSeason } from '../simulation/types';
import type { CoachTendencies } from '../simulation/league';
import { defaultCoachTendencies } from '../simulation/league';
import { DEFAULT_LEAGUE_RULES, type LeagueRulesSettings } from '../simulation/leagueRules';

/*
 * Era rules for League Hunt games. Both teams play under the rules of the stop's era, so the same squad plays
 * differently from stop to stop: no three-point line before 1979-80, hand-checking until 2004-05, the pace of the
 * time. The game engine is the main game's; these rules adjust the players and coaches going in.
 */

export interface HuntEra { id: string; label: string; from: number; to: number; pace: number; threes: 'none' | 'rare' | 'normal' | 'heavy'; handCheck: boolean; blurb: string }

export const ERAS: HuntEra[] = [
  { id: '60s', label: 'The 1960s', from: 1955, to: 1969, pace: 85, threes: 'none', handCheck: true, blurb: 'No three-point line. Run, rebound, run again. Big men rule.' },
  { id: '70s', label: 'The 1970s', from: 1970, to: 1979, pace: 70, threes: 'none', handCheck: true, blurb: 'Still no three. Physical, fast, and all about the paint.' },
  { id: '80s', label: 'The 1980s', from: 1980, to: 1989, pace: 68, threes: 'rare', handCheck: true, blurb: 'The three arrives but nobody trusts it. Showtime and Celtic pride.' },
  { id: '90s', label: 'The 1990s', from: 1990, to: 1999, pace: 42, threes: 'rare', handCheck: true, blurb: 'Hand-checking, elbows, grind-it-out half-court. Defense wins.' },
  { id: '00s', label: 'The 2000s', from: 2000, to: 2009, pace: 45, threes: 'normal', handCheck: false, blurb: 'Hand-checking gone in 2004-05; the drive-and-kick era begins.' },
  { id: '10s', label: 'The 2010s', from: 2010, to: 2019, pace: 60, threes: 'heavy', handCheck: false, blurb: 'Pace and space. Threes rain down; shooters are gold.' },
  { id: '20s', label: 'Today', from: 2020, to: 2030, pace: 66, threes: 'heavy', handCheck: false, blurb: 'Everyone shoots. Fast, spaced and relentless.' },
];

export const eraOf = (end: number): HuntEra => ERAS.find(e => end >= e.from && end <= e.to) ?? (end < 1955 ? ERAS[0] : ERAS[ERAS.length - 1]);

const THREE_KINDS = ['corner3', 'aboveBreak3', 'pullUp3', 'catchAndShoot3', 'stepback'] as const;
const clamp = (v: number) => Math.max(1, Math.min(99, Math.round(v)));

/** A player under an era's rules. */
export function underEra(p: PlayerSeason, era: HuntEra): PlayerSeason {
  const shotMult = era.threes === 'none' ? 0.02 : era.threes === 'rare' ? 0.55 : era.threes === 'heavy' ? 1.3 : 1;
  const shot = { ...p.tendencies.shot };
  for (const k of THREE_KINDS) shot[k] = clamp(shot[k] * shotMult);
  if (era.threes === 'none') { shot.midrange = clamp(shot.midrange * 1.25); shot.close = clamp(shot.close * 1.15); }
  const o = p.attributes.offense, d = p.attributes.defense;
  const offense = era.handCheck ? { ...o, ballHandling: clamp(o.ballHandling - 3), speedWithBall: clamp(o.speedWithBall - 2) } : o;
  const defense = era.handCheck ? { ...d, perimeterDefense: clamp(d.perimeterDefense + 4) } : d;
  return { ...p, tendencies: { ...p.tendencies, shot }, attributes: { ...p.attributes, offense, defense } };
}

/*
 * Real team-seasons are rosters of stars and starters, so under the main game's scoring they shoot far better than a
 * whole league does and games ran to ~250 points. Each era's shot-making is scaled so games land near the real
 * points per team of the time (60s ~115, 70s ~106, 80s ~108, 90s ~100, 00s ~98, 10s ~103, today ~113).
 */
const ERA_SCORING: Record<string, number> = { '60s': 0.9, '70s': 0.88, '80s': 0.86, '90s': 0.91, '00s': 0.86, '10s': 0.85, '20s': 0.91 };

/** League rules for a game under an era's rules (League Hunt, Dream Matchup, PvP, Legend Challenges). */
export function eraRules(era: HuntEra): LeagueRulesSettings {
  return { ...DEFAULT_LEAGUE_RULES, offensiveEfficiency: DEFAULT_LEAGUE_RULES.offensiveEfficiency * (ERA_SCORING[era.id] ?? 0.88) };
}

/** The coaching the era played with. */
export function eraCoach(era: HuntEra): CoachTendencies {
  const threeFreq = era.threes === 'none' ? 2 : era.threes === 'rare' ? 25 : era.threes === 'heavy' ? 75 : 50;
  return { ...defaultCoachTendencies(), paceTendency: era.pace, threePointFrequency: threeFreq };
}
