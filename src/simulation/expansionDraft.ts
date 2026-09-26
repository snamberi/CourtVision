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

/**
 * Standard expansion-draft shape: each existing team protects its top
 * `protectCount` players by current Overall; everyone else is exposed. The
 * new team drafts one player per existing team per pass (best-available),
 * so no single team loses more than one player per pass, until the new
 * roster reaches `rosterSize`.
 */
export function runExpansionDraft(
  league: League,
  extras: GMLeagueExtras,
  newTeamName: string,
  rosterSize = 14,
  protectCount = 8,
  seed = 1,
): ExpansionDraftResult {
  const rng = new RNG(seed);
  const newTeamId = newTeamName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `EXPANSION-${seed}`;

  const exposedByTeam = new Map<string, PlayerSeason[]>();
  for (const t of league.teams) {
    const sorted = [...t.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a));
    const exposed = sorted.slice(protectCount);
    exposedByTeam.set(t.teamId, exposed);
  }

  const drafted: PlayerSeason[] = [];
  const draftedFromTeam = new Set<string>();
  const draftedPlayerIds: string[] = [];

  let safety = 0;
  while (drafted.length < rosterSize && safety < rosterSize * 3) {
    safety++;
    draftedFromTeam.clear();
    for (const t of league.teams) {
      if (drafted.length >= rosterSize) break;
      if (draftedFromTeam.has(t.teamId)) continue;
      const pool = exposedByTeam.get(t.teamId) ?? [];
      if (pool.length === 0) continue;
      const idx = rng.nextInt(Math.min(3, pool.length));
      const [player] = pool.splice(idx, 1);
      drafted.push({ ...player, teamId: newTeamId });
      draftedPlayerIds.push(player.playerId);
      draftedFromTeam.add(t.teamId);
    }
    if ([...exposedByTeam.values()].every((pool) => pool.length === 0)) break;
  }

  const teams: LeagueTeam[] = league.teams.map((t) => ({
    ...t,
    seasons: t.seasons.filter((s) => !draftedPlayerIds.includes(s.playerId)),
  }));

  const newTeam: LeagueTeam = {
    teamId: newTeamId,
    name: newTeamName,
    seasons: drafted,
    coach: defaultCoachTendencies(),
    chemistry: 50,
  };
  teams.push(newTeam);

  const contracts: Record<string, Contract> = { ...extras.contracts };
  for (const p of drafted) {
    const existing = contracts[p.playerId];
    contracts[p.playerId] = existing
      ? { ...existing, teamId: newTeamId }
      : { playerId: p.playerId, teamId: newTeamId, annualSalary: 3_000_000, yearsRemaining: 2, playerOption: false, teamOption: false };
  }

  const gamesPerTeam = league.schedule.length > 0
    ? Math.round((league.schedule.length * 2) / league.teams.length)
    : 82;
  const schedule = generateSeasonSchedule(teams.map((t) => t.teamId), gamesPerTeam);

  return {
    league: { ...league, teams, schedule },
    extras: { ...extras, contracts },
    draftedPlayerIds,
  };
}
