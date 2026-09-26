import { RNG } from './engine/rng';
import { calculateOverall } from './engine/overall';
import type { League, LeagueTeam } from './league';
import { defaultCoachTendencies, generateSeasonSchedule } from './league';
import type { GMLeagueExtras, Contract } from './gm';
import type { PlayerSeason } from './types';

export interface ExpansionDraftResult {
  league: League;
  extras: GMLeagueExtras;
  draftedPlayerIds: string[];
}

/** One exposed player on the expansion draft board. */
export interface ExposedPlayer { player: PlayerSeason; fromTeamId: string; overall: number; value: number }

export interface ExpansionSetup {
  newTeamId: string;
  rosterSize: number;
  protectCount: number;
  /** Most players the new team may take from any one existing team. */
  perTeamLimit: number;
  protectedIds: Record<string, string[]>;
  pool: ExposedPlayer[];
}

export const expansionTeamId = (name: string, seed = 1) => name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `EXPANSION-${seed}`;

/**
 * How much a team wants to keep a player: today's rating, with youth and upside counted (a front office protects
 * its 21-year-old with star potential before a fading veteran of the same rating), and big contracts on older
 * players left exposed so the expansion team can take them off the books.
 */
export function protectionValue(p: PlayerSeason, contract?: Contract): number {
  const ovr = calculateOverall(p);
  const upside = Math.max(0, (p.development?.potential ?? ovr) - ovr) * (p.age <= 24 ? 0.55 : p.age <= 27 ? 0.25 : 0);
  const age = p.age >= 33 ? -(p.age - 32) * 2.2 : p.age <= 23 ? 1.5 : 0;
  const salary = contract && p.age >= 30 ? -Math.max(0, contract.annualSalary - 20_000_000) / 5_000_000 : 0;
  return ovr + upside + age + salary;
}

/**
 * Every existing team files its protection list first (the best `protectCount` players by protection value);
 * everyone else is exposed and becomes the new team's draft board.
 */
export function prepareExpansionDraft(league: League, extras: GMLeagueExtras, newTeamName: string, rosterSize = 14, protectCount = 8, seed = 1): ExpansionSetup {
  const protectedIds: Record<string, string[]> = {};
  const pool: ExposedPlayer[] = [];
  for (const t of league.teams) {
    const ranked = t.seasons.map(p => ({ player: p, fromTeamId: t.teamId, overall: calculateOverall(p), value: protectionValue(p, extras.contracts[p.playerId]) }))
      .sort((a, b) => b.value - a.value);
    protectedIds[t.teamId] = ranked.slice(0, protectCount).map(r => r.player.playerId);
    pool.push(...ranked.slice(protectCount));
  }
  pool.sort((a, b) => b.value - a.value);
  const perTeamLimit = Math.max(1, Math.ceil(rosterSize / Math.max(1, league.teams.length)));
  return { newTeamId: expansionTeamId(newTeamName, seed), rosterSize, protectCount, perTeamLimit, protectedIds, pool };
}

/** Why a pick isn't allowed (already taken, roster full, or that team has already lost its limit), or null. */
export function pickBlocked(setup: ExpansionSetup, picks: string[], playerId: string): string | null {
  const entry = setup.pool.find(e => e.player.playerId === playerId);
  if (!entry) return 'That player is protected.';
  if (picks.includes(playerId)) return 'Already on your roster.';
  if (picks.length >= setup.rosterSize) return 'Your roster is full.';
  const fromSame = picks.filter(id => setup.pool.find(e => e.player.playerId === id)?.fromTeamId === entry.fromTeamId).length;
  if (fromSame >= setup.perTeamLimit) return `You can take at most ${setup.perTeamLimit} from each team.`;
  return null;
}

/** Best available pick that respects the rules, for "auto-pick the rest". A little randomness among near-equals. */
export function autoPick(setup: ExpansionSetup, picks: string[], rng: RNG): string | null {
  const open = setup.pool.filter(e => !pickBlocked(setup, picks, e.player.playerId));
  if (!open.length) return null;
  const top = open.slice(0, Math.min(3, open.length));
  return top[rng.nextInt(top.length)].player.playerId;
}

/** Builds the league with the new team made of the chosen players. */
export function completeExpansionDraft(league: League, extras: GMLeagueExtras, newTeamName: string, setup: ExpansionSetup, picks: string[]): ExpansionDraftResult {
  const newTeamId = setup.newTeamId;
  const chosen = new Set(picks);
  const drafted: PlayerSeason[] = picks.map(id => setup.pool.find(e => e.player.playerId === id)!.player).map(p => ({ ...p, teamId: newTeamId }));

  const teams: LeagueTeam[] = league.teams.map(t => ({ ...t, seasons: t.seasons.filter(s => !chosen.has(s.playerId)) }));
  teams.push({ teamId: newTeamId, name: newTeamName, seasons: drafted, coach: defaultCoachTendencies(), chemistry: 50 });

  const contracts: Record<string, Contract> = { ...extras.contracts };
  for (const p of drafted) {
    const existing = contracts[p.playerId];
    contracts[p.playerId] = existing
      ? { ...existing, teamId: newTeamId }
      : { playerId: p.playerId, teamId: newTeamId, annualSalary: 3_000_000, yearsRemaining: 2, playerOption: false, teamOption: false };
  }

  const gamesPerTeam = league.schedule.length > 0 ? Math.round((league.schedule.length * 2) / league.teams.length) : 82;
  const schedule = generateSeasonSchedule(teams.map(t => t.teamId), gamesPerTeam);
  return { league: { ...league, teams, schedule }, extras: { ...extras, contracts }, draftedPlayerIds: picks };
}

/** The whole draft picked automatically (protection lists, then best available within the per-team limit). */
export function runExpansionDraft(league: League, extras: GMLeagueExtras, newTeamName: string, rosterSize = 14, protectCount = 8, seed = 1): ExpansionDraftResult {
  const rng = new RNG(seed);
  const setup = prepareExpansionDraft(league, extras, newTeamName, rosterSize, protectCount, seed);
  const picks: string[] = [];
  while (picks.length < rosterSize) {
    const next = autoPick(setup, picks, rng);
    if (!next) break;
    picks.push(next);
  }
  return completeExpansionDraft(league, extras, newTeamName, setup, picks);
}
