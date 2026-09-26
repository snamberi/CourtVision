import type { League, InjuryRecord } from './league';
import type { PlayerSeason } from './types';

/*
 * The medical room. When one of your players is hurt, the doctors lay out the options: rush him back (fewer games
 * out, a real re-injury risk after), the standard recovery, extra rest (more games, no added risk) or, for severe
 * injuries, surgery (the longest, but it lowers his injury risk for good). Load management rests players on a
 * schedule you set, so their workload (and with it fatigue and injury risk) stays down for the playoffs.
 */

export type Treatment = 'rush' | 'standard' | 'rest' | 'surgery';
export interface TreatmentOption { id: Treatment; label: string; games: number; risk: string; detail: string }
export type RestPlan = 'none' | 'every10' | 'every6' | 'untilPlayoffs';
export interface MedicalState {
  /** Returning players with a raised injury risk for their next games. */
  fragile: Record<string, { gamesLeft: number; mult: number }>;
  /** Load management by player (your team). */
  rest: Record<string, RestPlan>;
}

const TREATMENT_EFFECT: Record<Treatment, { games: number; fragile: { games: number; mult: number } | null }> = {
  rush: { games: 0.55, fragile: { games: 15, mult: 2 } },
  standard: { games: 1, fragile: { games: 8, mult: 1.25 } },
  rest: { games: 1.4, fragile: null },
  surgery: { games: 1.8, fragile: null },
};
export const REST_LABEL: Record<RestPlan, string> = { none: 'Plays every game', every10: 'Rest 1 game in 10', every6: 'Rest 1 game in 6', untilPlayoffs: 'Sit until the playoffs' };

export const medicalState = (league: League): MedicalState => league.medical ?? { fragile: {}, rest: {} };

/** The doctors' options for an injury, with games out and what it means afterwards. */
export function treatmentOptions(injury: InjuryRecord): TreatmentOption[] {
  const base = injury.totalGames;
  const g = (t: Treatment) => Math.max(1, Math.ceil(base * TREATMENT_EFFECT[t].games));
  const opts: TreatmentOption[] = [
    { id: 'rush', label: 'Rush him back', games: g('rush'), risk: 'High re-injury risk', detail: 'Back about twice as fast; his injury risk doubles for 15 games after.' },
    { id: 'standard', label: 'Standard recovery', games: g('standard'), risk: 'Slight re-injury risk', detail: 'The usual timeline; a little extra risk for 8 games.' },
    { id: 'rest', label: 'Extra rest', games: g('rest'), risk: 'No added risk', detail: 'Longer out, but he comes back fully healed.' },
  ];
  if (injury.severity === 'severe') opts.push({ id: 'surgery', label: 'Surgery', games: g('surgery'), risk: 'Lower risk for good', detail: 'The longest road back, but it fixes the problem: his injury risk drops permanently.' });
  return opts;
}

/** Applies the chosen treatment to an injury that hasn't been decided yet. */
export function chooseTreatment(league: League, playerId: string, treatment: Treatment): League {
  const rec = league.injuries?.[playerId];
  if (!rec || rec.treatment) return league;
  if (treatment === 'surgery' && rec.severity !== 'severe') return league;
  const played = rec.totalGames - rec.gamesRemaining;
  const total = Math.max(1, Math.ceil(rec.totalGames * TREATMENT_EFFECT[treatment].games));
  const injuries = { ...league.injuries, [playerId]: { ...rec, treatment, totalGames: total, gamesRemaining: Math.max(1, total - played) } };
  let teams = league.teams;
  if (treatment === 'surgery') teams = teams.map(t => ({ ...t, seasons: t.seasons.map(p => p.playerId === playerId ? { ...p, development: { ...p.development, injuryRisk: Math.max(0, p.development.injuryRisk - 8) } } : p) }));
  return { ...league, teams, injuries };
}

/** Injuries on your team waiting for a decision. */
export const pendingDecisions = (league: League, teamId: string | null): InjuryRecord[] =>
  teamId ? Object.values(league.injuries ?? {}).filter(r => r.teamId === teamId && !r.treatment) : [];

/** When an injury heals, the treatment decides how fragile he is for his next games. */
export function afterHealing(state: MedicalState, healed: InjuryRecord[]): MedicalState {
  if (!healed.length) return state;
  const fragile = { ...state.fragile };
  for (const h of healed) { const f = TREATMENT_EFFECT[h.treatment ?? 'standard'].fragile; if (f) fragile[h.playerId] = { gamesLeft: f.games, mult: f.mult }; else delete fragile[h.playerId]; }
  return { ...state, fragile };
}

/** One more game played for these players: fragility wears off. */
export function afterGame(state: MedicalState, played: string[]): MedicalState {
  let changed = false;
  const fragile = { ...state.fragile };
  for (const id of played) { const f = fragile[id]; if (!f) continue; changed = true; if (f.gamesLeft <= 1) delete fragile[id]; else fragile[id] = { ...f, gamesLeft: f.gamesLeft - 1 }; }
  return changed ? { ...state, fragile } : state;
}

/** The player as he takes the floor: a fragile player's injury risk is raised so the engine's roll reflects it. */
export function withMedicalRisk(state: MedicalState | undefined, p: PlayerSeason): PlayerSeason {
  const f = state?.fragile[p.playerId];
  if (!f) return p;
  const risk = p.development.injuryRisk;
  return { ...p, development: { ...p.development, injuryRisk: ((1 + risk / 100) * f.mult - 1) * 100 } };
}

/** Does load management sit this player tonight? `gameNumber` is the team's game about to be played (1-based). */
export function restsTonight(state: MedicalState | undefined, playerId: string, gameNumber: number, phase: League['seasonPhase']): boolean {
  const plan = state?.rest[playerId];
  if (!plan || plan === 'none' || (phase ?? 'regular_season') !== 'regular_season') return false;
  if (plan === 'untilPlayoffs') return true;
  const every = plan === 'every10' ? 10 : 6;
  return gameNumber % every === 0;
}

export function setRestPlan(league: League, playerId: string, plan: RestPlan): League {
  const s = medicalState(league);
  const rest = { ...s.rest };
  if (plan === 'none') delete rest[playerId]; else rest[playerId] = plan;
  return { ...league, medical: { ...s, rest } };
}
