import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { computeAskingSalary } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { collectPlayerIds, uniquePlayerId } from '../simulation/playerIds';
import { appendHistoryEvent } from '../simulation/playerHistory';
import type { PlayerSeason } from '../simulation/types';
import { CATEGORIES } from './categories';
import { buildPlayer, START_AGE, type Progress } from './create';
import type { CareerMeta } from './career';

/*
 * Bring a Career Mode player into any GM league: as a rookie, at his prime or as he was when his career ended (or is
 * now). He keeps his ratings (past 99 where he earned it) and from then on lives in the league like anyone else: he
 * develops, ages, signs, gets traded and retires on the league's own rules.
 */

export type CareerImportStage = 'rookie' | 'prime' | 'last';
export const STAGE_LABEL: Record<CareerImportStage, string> = { rookie: 'As a 19-year-old rookie', prime: 'At his prime (age 27)', last: 'As he was in his last season' };

const allAt = (v: number) => Object.fromEntries(CATEGORIES.map(c => [c.id, v])) as Progress;

/** The player at a stage of his career, ready for a league. */
export function careerPlayerAt(meta: CareerMeta, stage: CareerImportStage, season: string): PlayerSeason {
  const lastAge = meta.retired?.age ?? meta.years.at(-1)?.age ?? START_AGE;
  const progress = stage === 'rookie' ? allAt(0) : stage === 'prime' ? allAt(1) : meta.progress;
  const age = stage === 'rookie' ? START_AGE : stage === 'prime' ? 27 : lastAge;
  const p = buildPlayer({ ...meta.identity, name: meta.playerId }, meta.prime, progress, meta.readiness, season, age, meta.seed);
  return { ...p, highRatings: true };
}

/** Adds him to `teamId` (Sandbox) or to free agency. */
export function importCareerPlayer(meta: CareerMeta, stage: CareerImportStage, league: League, extras: GMLeagueExtras, teamId: string | null): { league: League; extras: GMLeagueExtras; playerId: string } {
  const base = careerPlayerAt(meta, stage, league.season ?? meta.startSeason);
  const playerId = uniquePlayerId(meta.playerId, collectPlayerIds(league, extras));
  const team = teamId ? league.teams.find(t => t.teamId === teamId) : undefined;
  const taken = new Set(team?.seasons.map(p => p.jerseyNumber) ?? []);
  let jersey = meta.identity.jersey;
  for (let bump = 0; taken.has(jersey) && bump < 100; bump++) jersey = (jersey + 1) % 100;
  const player: PlayerSeason = appendHistoryEvent({ ...base, playerId, teamId: team?.teamId ?? null, jerseyNumber: jersey },
    'created', `Brought in from Career Mode (${STAGE_LABEL[stage].toLowerCase()})`, team?.teamId);
  if (!team) return { league, extras: { ...extras, freeAgents: [...extras.freeAgents, player] }, playerId };
  const contracts = { ...extras.contracts, [playerId]: { playerId, teamId: team.teamId, annualSalary: computeAskingSalary(calculateOverall(player), extras.capSettings), yearsRemaining: 3, playerOption: false, teamOption: false } };
  return { league: { ...league, teams: league.teams.map(t => (t.teamId === team.teamId ? { ...t, seasons: [...t.seasons, player] } : t)) }, extras: { ...extras, contracts }, playerId };
}
