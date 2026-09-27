import type { League, LeagueTeam } from './league';
import type { PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';

/*
 * Summer development camps for the team you run. Before the offseason, give each player a summer focus and, if you
 * have one free, a personal trainer. The camp runs when the new season begins, on top of normal development:
 * young, hard-working players with a trainer gain the most; an overloaded strength program can backfire; rest does
 * nothing for his game but clears his legs. Then the Training Camp Report reveals who broke out and who slipped.
 * Real players on Real Player Development follow their real careers, so camps don't change their ratings.
 */

export type CampFocus = 'shooting' | 'finishing' | 'playmaking' | 'defense' | 'strength' | 'conditioning' | 'rest';
export type TrainerTier = 'none' | 'skills' | 'elite';
export interface SummerPlan { focus: CampFocus; trainer: TrainerTier }
export interface SummerCampState { season: string; teamId: string; plans: Record<string, SummerPlan> }
export type CampLabel = 'Breakout' | 'Leap' | 'Steady' | 'Dip' | 'Regression';
export interface CampReportRow { playerId: string; age: number; before: number; after: number; campGain: number; plan?: SummerPlan; label: CampLabel; note: string; skipped?: string }
export interface CampReport { season: string; teamId: string; rows: CampReportRow[]; seen?: boolean }

export const FOCUS: Record<CampFocus, { label: string; attrs: [string, string][]; detail: string }> = {
  shooting: { label: 'Shooting', detail: 'Jump shot, threes and free throws.', attrs: [['offense', 'threePoint'], ['offense', 'midrange'], ['offense', 'catchAndShoot'], ['offense', 'freeThrow']] },
  finishing: { label: 'Finishing', detail: 'Touch and finishing through contact.', attrs: [['offense', 'finishing'], ['offense', 'closeShot'], ['offense', 'touch']] },
  playmaking: { label: 'Playmaking', detail: 'Handle, passing and reads.', attrs: [['offense', 'ballHandling'], ['offense', 'passing'], ['offense', 'decisionMaking']] },
  defense: { label: 'Defense', detail: 'Footwork, positioning and help reads.', attrs: [['defense', 'perimeterDefense'], ['defense', 'interiorDefense'], ['defense', 'helpDefense']] },
  strength: { label: 'Strength', detail: 'Adds strength; heavy lifting can nick a player up.', attrs: [['physical', 'strength']] },
  conditioning: { label: 'Conditioning', detail: 'Stamina and durability for the long season.', attrs: [['physical', 'stamina'], ['physical', 'durability']] },
  rest: { label: 'Rest', detail: 'No gains; comes back fresh.', attrs: [] },
};
export const TRAINER: Record<TrainerTier, { label: string; mult: number }> = {
  none: { label: 'No trainer', mult: 1 }, skills: { label: 'Skills trainer', mult: 1.4 }, elite: { label: 'Elite trainer', mult: 1.9 },
};

/** Trainers you can hire this summer, by the coaching budget. */
export function trainerSlots(team: LeagueTeam): { skills: number; elite: number } {
  const level = team.expenseLevels?.coaching ?? 50;
  return { skills: 2 + Math.floor(level / 25), elite: level >= 50 ? 1 + Math.floor((level - 50) / 25) : 0 };
}

export function campState(league: League, teamId: string): SummerCampState {
  const s = league.summerCamp;
  return s && s.season === league.season && s.teamId === teamId ? s : { season: league.season ?? '', teamId, plans: {} };
}

/** Sets one player's summer plan; returns an error when no trainer of that tier is free. */
export function setSummerPlan(league: League, teamId: string, playerId: string, plan: SummerPlan | null): { league: League; error?: string } {
  const team = league.teams.find(t => t.teamId === teamId);
  if (!team || !team.seasons.some(p => p.playerId === playerId)) return { league, error: 'He is not on your roster.' };
  const state = campState(league, teamId);
  const plans = { ...state.plans };
  if (plan) {
    if (plan.trainer !== 'none') {
      const used = Object.entries(plans).filter(([id, p]) => id !== playerId && p.trainer === plan.trainer).length;
      const slots = trainerSlots(team)[plan.trainer];
      if (used >= slots) return { league, error: slots ? `All ${slots} ${TRAINER[plan.trainer].label.toLowerCase()}s are booked. Raise the coaching budget for more.` : `No ${TRAINER[plan.trainer].label.toLowerCase()} on this budget. Raise the coaching budget to 50 or more.` };
    }
    plans[playerId] = plan;
  } else delete plans[playerId];
  return { league: { ...league, summerCamp: { ...state, plans } } };
}

function hashUnit(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 0xffffffff;
}

/**
 * The camp's effect on a player who has just developed for the new season. Gains shrink with age and grow with
 * work ethic, the trainer and your development staff (`staffMult`, from the development coach); a heavy strength program has a small chance of a tweak (a durability hit).
 */
export function applySummerCamp(p: PlayerSeason, plan: SummerPlan, key: string, staffMult = 1): { player: PlayerSeason; note: string } {
  if (plan.focus === 'rest') {
    return { player: p.training ? { ...p, training: { ...p.training, workload: 0 } } : p, note: 'Rested all summer.' };
  }
  const youth = p.age <= 22 ? 1.3 : p.age <= 26 ? 1 : p.age <= 30 ? 0.6 : 0.3;
  const ethic = 0.6 + (p.development.workEthic ?? 50) / 125;
  const base = 2.2 * youth * ethic * TRAINER[plan.trainer].mult * staffMult;
  const attributes = { offense: { ...p.attributes.offense }, defense: { ...p.attributes.defense }, mental: { ...p.attributes.mental }, physical: { ...p.attributes.physical } };
  const groups = attributes as unknown as Record<string, Record<string, number>>;
  let total = 0;
  FOCUS[plan.focus].attrs.forEach(([g, k], i) => {
    if (groups[g]?.[k] == null) return;
    const gain = Math.round(base * (0.6 + hashUnit(`${key}|${k}|${i}`) * 0.8) * 10) / 10;
    const room = Math.max(0, Math.min(gain, 99 - groups[g][k]));
    groups[g][k] = Math.round((groups[g][k] + room) * 10) / 10;
    total += room;
  });
  let note = `${FOCUS[plan.focus].label} camp${plan.trainer !== 'none' ? ` with a ${TRAINER[plan.trainer].label.toLowerCase()}` : ''}: +${total.toFixed(1)} across ${FOCUS[plan.focus].label.toLowerCase()} ratings.`;
  if (plan.focus === 'strength' && hashUnit(`${key}|tweak`) < 0.08 + (p.age >= 30 ? 0.07 : 0)) {
    attributes.physical.durability = Math.max(20, attributes.physical.durability - 3);
    note += ' He tweaked something in the weight room (durability −3).';
  }
  return { player: { ...p, attributes }, note };
}

export function campLabel(delta: number): CampLabel {
  return delta >= 4 ? 'Breakout' : delta >= 2 ? 'Leap' : delta > -2 ? 'Steady' : delta > -4 ? 'Dip' : 'Regression';
}

export function reportRow(before: PlayerSeason, after: PlayerSeason, campGain: number, plan: SummerPlan | undefined, note: string, skipped?: string): CampReportRow {
  const b = calculateOverall(before), a = calculateOverall(after);
  return { playerId: after.playerId, age: after.age, before: b, after: a, campGain, ...(plan ? { plan } : {}), label: campLabel(a - b), note, ...(skipped ? { skipped } : {}) };
}
