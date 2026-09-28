import type { LeagueTeam } from './league';
import type { PlayerId } from './types';
import type { Contract } from './gm';
import { teamPayroll } from './gm';
import { calculateOverall } from './engine/overall';

/** Where a rebuilding team stands: its record, payroll and best three players. Taken when a challenge starts and again now. */
export interface RebuildSnapshot {
  /** The record behind it: the season before the challenge at the start, this season (or the last one) now. */
  record?: { wins: number; losses: number; season: string };
  payroll: number;
  stars: { id: PlayerId; ovr: number }[];
}

export function rebuildSnapshot(team: LeagueTeam, contracts: Record<PlayerId, Contract>, record?: RebuildSnapshot['record']): RebuildSnapshot {
  const stars = [...team.seasons].map(s => ({ id: s.playerId, ovr: calculateOverall(s) }))
    .sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  return { ...(record ? { record } : {}), payroll: teamPayroll(contracts, team), stars };
}
