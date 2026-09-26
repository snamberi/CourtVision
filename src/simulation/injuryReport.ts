import type { PlayerSeason } from './types';
import type { InjuryRecord, League, LeagueTeam } from './league';

export interface InjuryReportEntry {
  record: InjuryRecord;
  player: PlayerSeason;
  teamName: string;
}

/** Every currently-active injury league-wide, sorted worst-team-impact first (most games remaining), then by team. */
export function listLeagueInjuries(league: League): InjuryReportEntry[] {
  const injuries = league.injuries ?? {};
  const entries: InjuryReportEntry[] = [];
  for (const rec of Object.values(injuries)) {
    const team = league.teams.find((t) => t.teamId === rec.teamId);
    const player = team?.seasons.find((s) => s.playerId === rec.playerId);
    if (!team || !player) continue;
    entries.push({ record: rec, player, teamName: team.name });
  }
  return entries.sort((a, b) => b.record.gamesRemaining - a.record.gamesRemaining || a.teamName.localeCompare(b.teamName));
}

/** Just one team's currently-active injuries. */
export function listTeamInjuries(league: League, teamId: string): InjuryReportEntry[] {
  return listLeagueInjuries(league).filter((e) => e.record.teamId === teamId);
}

const FULL_GAME_PLAYER_MINUTES = 240; // 5 players x 48 minutes, the total minute-pool a team needs to fill each game
const DEFAULT_MAX_PER_PLAYER = 40;

/**
 * When injuries have hollowed out a roster, the healthy players' MinutesConfig
 * targets often no longer add up to a full game (240 player-minutes). This
 * spreads the shortfall across healthy players proportional to their existing
 * (pre-injury) target share, capped per player, so the rotation doesn't quietly
 * play short-handed. Players currently out are left untouched.
 *
 * Every affected player's original target is remembered in `baselineTarget` the
 * first time they're touched, and every recalculation starts back from that
 * baseline (not from whatever the target drifted to last time this ran) - so
 * calling this repeatedly while the same players are hurt is idempotent rather
 * than compounding, and `restoreMinutesIfHealthy` can cleanly put it back once
 * the team is fully healthy again.
 */
export function redistributeMinutesForInjuries(
  team: LeagueTeam,
  injuries: Record<string, InjuryRecord> | undefined,
  opts: { totalTeamMinutes?: number; maxPerPlayer?: number } = {},
): LeagueTeam {
  const totalTeamMinutes = opts.totalTeamMinutes ?? FULL_GAME_PLAYER_MINUTES;
  const maxPerPlayer = opts.maxPerPlayer ?? DEFAULT_MAX_PER_PLAYER;
  const isOut = (playerId: string) => (injuries?.[playerId]?.gamesRemaining ?? 0) > 0;

  const healthy = team.seasons.filter((s) => !isOut(s.playerId));
  if (healthy.length === 0) return team;

  const baselineOf = (s: PlayerSeason) => s.minutes.baselineTarget ?? s.minutes.target;
  const currentSum = healthy.reduce((sum, s) => sum + baselineOf(s), 0);
  const deficit = totalTeamMinutes - currentSum;
  if (deficit <= 0) return team; // healthy rotation's baseline already covers a full game

  const weights = healthy.map((s) => Math.max(baselineOf(s), 5)); // small floor so bench players still get a share
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const seasons = team.seasons.map((s) => {
    if (isOut(s.playerId)) return s;
    const idx = healthy.findIndex((h) => h.playerId === s.playerId);
    const baseline = baselineOf(s);
    const share = weights[idx] / totalWeight;
    const proposedTarget = baseline + deficit * share;
    const newTarget = Math.round(Math.min(maxPerPlayer, proposedTarget));
    if (newTarget === s.minutes.target && s.minutes.baselineTarget != null) return s;
    return { ...s, minutes: { ...s.minutes, baselineTarget: baseline, target: newTarget } };
  });

  return { ...team, seasons };
}

/**
 * Reverts every player's minute target back to their pre-injury baseline and
 * clears the baseline marker. Intended to be called automatically once a team
 * has zero active injuries left, so redistributed minutes don't linger
 * permanently inflated after everyone heals.
 */
export function restoreMinutesIfHealthy(team: LeagueTeam): LeagueTeam {
  let changed = false;
  const seasons = team.seasons.map((s) => {
    if (s.minutes.baselineTarget == null) return s;
    changed = true;
    const { baselineTarget, ...restMinutes } = s.minutes;
    return { ...s, minutes: { ...restMinutes, target: baselineTarget } };
  });
  return changed ? { ...team, seasons } : team;
}

/** How many total minutes a team's currently-healthy rotation is configured for, out of a full 240-minute game. */
export function healthyRotationMinutes(team: LeagueTeam, injuries: Record<string, InjuryRecord> | undefined): number {
  const isOut = (playerId: string) => (injuries?.[playerId]?.gamesRemaining ?? 0) > 0;
  return team.seasons.filter((s) => !isOut(s.playerId)).reduce((sum, s) => sum + s.minutes.target, 0);
}
