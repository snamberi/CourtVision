import type { TrophyKey } from './trophies';
import type { League, RetiredPlayerRecord } from './league';
import { calculateFullAttributeOverall } from './engine/overall';
import { perGameAverages } from './careerStats';
import { placementsForPlayer, type AwardPlacement } from './awards';
export interface PlayerRankEntry {
  playerId: string;
  teamId: string;
  teamName: string;
  overall: number; // full-attribute composite (see calculateFullAttributeOverall)
  delta?: number; // change since last season rollover, when available
}

export interface TeamRankEntry {
  teamId: string;
  teamName: string;
  overallAverage: number; // average full-attribute Overall across the roster
  delta?: number;
}

export interface RookieEntry extends PlayerRankEntry {
  ppg: number;
  apg: number;
  rpg: number;
}

export interface LeagueAnalytics {
  bestPlayers: PlayerRankEntry[];
  mostImprovedPlayers: PlayerRankEntry[];
  mostDeclinedPlayers: PlayerRankEntry[];
  bestTeams: TeamRankEntry[];
  worstTeams: TeamRankEntry[];
  improvedTeams: TeamRankEntry[];
  declinedTeams: TeamRankEntry[];
  retiredPlayers: RetiredPlayerRecord[];
  bestRookies: RookieEntry[];
}

/** The team-wide average of the full-attribute composite — distinct from teamStatus's headline-based average. */
export function computeTeamFullOverallAverage(team: League['teams'][number]): number {
  if (team.seasons.length === 0) return 0;
  return team.seasons.reduce((sum, s) => sum + calculateFullAttributeOverall(s), 0) / team.seasons.length;
}

/**
 * Computes every ranking shown on the league analytics page. "Overall" here
 * always means the full-attribute composite (every rated attribute, not
 * shot tendencies) rather than the headline Overall used for roster/trade
 * display — see calculateFullAttributeOverall for why they're kept distinct.
 * Improvement/decline rankings rely on `previousFullOverall` (players) and
 * `previousOverallAverage` (teams), both of which are only populated once at
 * least one season rollover (or manual development pass) has happened; until
 * then those lists come back empty rather than misleadingly showing zeros.
 */
export function computeLeagueAnalytics(league: League, opts: { topN?: number } = {}): LeagueAnalytics {
  const topN = opts.topN ?? 10;

  const allPlayers: PlayerRankEntry[] = [];
  const withDelta: PlayerRankEntry[] = [];
  const rookies: RookieEntry[] = [];

  for (const t of league.teams) {
    for (const s of t.seasons) {
      const overall = calculateFullAttributeOverall(s);
      const entry: PlayerRankEntry = { playerId: s.playerId, teamId: t.teamId, teamName: t.name, overall };
      allPlayers.push(entry);

      if (s.previousFullOverall != null) {
        withDelta.push({ ...entry, delta: overall - s.previousFullOverall });
      }

      if (s.age <= 21) {
        const avg = perGameAverages(s.seasonStats);
        rookies.push({ ...entry, ppg: avg.ppg, apg: avg.apg, rpg: avg.rpg });
      }
    }
  }

  const bestPlayers = [...allPlayers].sort((a, b) => b.overall - a.overall).slice(0, topN);
  const mostImprovedPlayers = [...withDelta].filter((p) => (p.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)).slice(0, topN);
  const mostDeclinedPlayers = [...withDelta].filter((p) => (p.delta ?? 0) < 0).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0)).slice(0, topN);
  const bestRookies = [...rookies].sort((a, b) => b.overall - a.overall).slice(0, topN);

  const teamEntries: TeamRankEntry[] = league.teams.map((t) => ({
    teamId: t.teamId, teamName: t.name, overallAverage: computeTeamFullOverallAverage(t),
  }));
  const teamEntriesWithDelta: TeamRankEntry[] = league.teams
    .filter((t) => t.previousOverallAverage != null)
    .map((t) => ({
      teamId: t.teamId, teamName: t.name, overallAverage: computeTeamFullOverallAverage(t),
      delta: computeTeamFullOverallAverage(t) - (t.previousOverallAverage as number),
    }));

  const bestTeams = [...teamEntries].sort((a, b) => b.overallAverage - a.overallAverage).slice(0, 5);
  const worstTeams = [...teamEntries].sort((a, b) => a.overallAverage - b.overallAverage).slice(0, 5);
  const improvedTeams = [...teamEntriesWithDelta].filter((t) => (t.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)).slice(0, 5);
  const declinedTeams = [...teamEntriesWithDelta].filter((t) => (t.delta ?? 0) < 0).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0)).slice(0, 5);

  const retiredPlayers = [...(league.retiredPlayers ?? [])].reverse(); // most recent retirements first

  return { bestPlayers, mostImprovedPlayers, mostDeclinedPlayers, bestTeams, worstTeams, improvedTeams, declinedTeams, retiredPlayers, bestRookies };
}

export interface PlayerAwardEntry {
  season: string;
  label: string; // e.g. "MVP", "All-NBA 1st Team", "NBA Champion", "Finals MVP"
  /** Which trophy it is (drives the pixel art and Hall of Fame weight). */
  key: TrophyKey;
}
/**
 * Scans the full franchise history for every award a given player has ever
 * won, across every category that was archived (not just the headline
 * MVP/DPOY/ROY fields) - this is what makes awards actually persist and be
 * viewable on a player's profile instead of only existing for the season
 * they were computed in.
 */
export function getPlayerAwardsHistory(league: League, playerId: string): PlayerAwardEntry[] {
  const entries: PlayerAwardEntry[] = [];
  const add = (season: string, label: string, key: TrophyKey) => entries.push({ season, label, key });
  for (const record of league.franchiseHistory ?? []) {
    const { season } = record;
    if (record.championPlayerIds?.includes(playerId)) add(season, 'NBA Champion', 'champion');
    if (record.fmvpPlayerId === playerId) add(season, 'Finals MVP', 'fmvp');
    if (record.allStarGameMVPPlayerId === playerId) add(season, 'All-Star Game MVP', 'allStarMvp');
    if (record.risingStarsMVPPlayerId === playerId) add(season, 'Rising Stars MVP', 'risingStarsMvp');
    if (record.threePointChampionId === playerId) add(season, '3-Point Contest Champion', 'threePoint');
    if (record.dunkChampionId === playerId) add(season, 'Slam Dunk Contest Champion', 'dunk');
    const a = record.fullAwards;
    if (!a) continue;
    const headline = [['mvp', 'MVP'], ['dpoy', 'Defensive Player of the Year'], ['roy', 'Rookie of the Year'], ['mip', 'Most Improved Player'], ['smoy', 'Sixth Man of the Year']] as const;
    for (const [key, label] of headline) {
      // The winner, plus anyone who shared it (an exact tie in the vote, or a real shared award in imported history).
      if (a[key]?.playerId === playerId || a.coWinners?.[key]?.some(w => w.playerId === playerId)) add(season, label, key);
    }
    const extraAwards = [
      ['cpoy', 'Clutch Player of the Year'], ['hustle', 'Hustle Award'], ['teammate', 'Teammate of the Year'],
      ['scoringChamp', 'Scoring Champion'], ['reboundingChamp', 'Rebounding Champion'], ['assistsChamp', 'Assists Champion'], ['stealsChamp', 'Steals Champion'], ['blocksChamp', 'Blocks Champion'],
      ['sharpshooter', 'Sharpshooter of the Year'], ['floorGeneral', 'Floor General Award'], ['paintScorer', 'Interior Scorer of the Year'], ['ironMan', 'Iron Man Award'], ['rookieDefender', 'Rookie Defender of the Year'],
    ] as const;
    for (const [key, label] of extraAwards) if (a[key]?.playerId === playerId || a.coWinners?.[key]?.some(w => w.playerId === playerId)) add(season, label, key);
    a.allNBA.forEach((team, i) => { if (i < 3 && team.some((w) => w.playerId === playerId)) add(season, `All-NBA ${i + 1}${['st', 'nd', 'rd'][i] ?? 'th'} Team`, (['allLeague1', 'allLeague2', 'allLeague3'] as const)[i]); });
    a.allDefense.forEach((team, i) => { if (i < 2 && team.some((w) => w.playerId === playerId)) add(season, `All-Defensive ${i + 1}${i === 0 ? 'st' : 'nd'} Team`, i === 0 ? 'allDefense1' : 'allDefense2'); });
    a.allRookie.forEach((team, i) => { if (i < 2 && team.some((w) => w.playerId === playerId)) add(season, `All-Rookie ${i + 1}${i === 0 ? 'st' : 'nd'} Team`, i === 0 ? 'allRookie1' : 'allRookie2'); });
    if (a.allStars.some((w) => w.playerId === playerId)) add(season, 'All-Star', 'allStar');
    for (const h of a.honors ?? []) {
      if (h.playerId !== playerId) continue;
      add(season, h.kind === 'month' ? `Player of the Month (${h.label})` : `Player of the Week (${h.label})`, h.kind === 'month' ? 'pom' : 'pow');
    }
  }

  // Credit championships by matching the player's own known (season, team) history against each
  // franchise record's champion - not the team's CURRENT roster, which would be wrong for anyone
  // since traded/waived/re-signed elsewhere.
  const playerSeason = league.teams.flatMap((t) => t.seasons).find((s) => s.playerId === playerId) ?? league.retiredPlayers?.find(p => p.playerId === playerId)?.finalSeasonData;
  if (playerSeason) {
    const affiliations = new Map<string, string>(); // season -> teamId
    affiliations.set(playerSeason.season, playerSeason.teamId ?? '');
    for (const h of playerSeason.careerHistory ?? []) affiliations.set(h.season, h.teamId ?? '');
    for (const record of league.franchiseHistory ?? []) {
      if (!record.championPlayerIds && record.championTeamId && affiliations.get(record.season) === record.championTeamId) {
        add(record.season, 'NBA Champion', 'champion');
      }
    }
  }

  return entries;
}

export interface PlayerAwardRacePlacement extends AwardPlacement {
  season: string;
}

/**
 * Every top-10 award-ballot finish a player has ever had, season by season — not just the
 * ones they won outright. Pulled from each season's full archived ballots in
 * `league.franchiseHistory[].fullAwards`, which is written once at that season's transition and
 * never touched again, so this reflects the actual historical voting rather than a live
 * recomputation against the current (different) roster of candidates.
 */
export function getPlayerAwardRaceHistory(league: League, playerId: string): PlayerAwardRacePlacement[] {
  const out: PlayerAwardRacePlacement[] = [];
  for (const record of league.franchiseHistory ?? []) {
    if (!record.fullAwards) continue;
    for (const placement of placementsForPlayer(record.fullAwards, playerId)) {
      out.push({ ...placement, season: record.season });
    }
  }
  return out;
}

export interface TeamTrophyEntry { key: TrophyKey; season: string; who?: string }

/** A franchise's trophy case: its titles, its coach's and front office's awards, and what its players won in its uniform. */
export function teamTrophyEntries(league: League, teamId: string): TeamTrophyEntry[] {
  const out: TeamTrophyEntry[] = [];
  for (const r of league.franchiseHistory ?? []) {
    if (r.championTeamId === teamId) out.push({ key: 'champion', season: r.season });
    if (r.championTeamId === teamId && r.fmvpPlayerId) out.push({ key: 'fmvp', season: r.season, who: r.fmvpPlayerId });
    const a = r.fullAwards;
    if (!a) continue;
    if (a.coy?.teamId === teamId) out.push({ key: 'coy', season: r.season, who: a.coy.coachName ?? undefined });
    if (a.eoy?.teamId === teamId) out.push({ key: 'eoy', season: r.season, who: a.eoy.userTeam ? 'Your front office' : 'Front office' });
    const single = ['mvp', 'dpoy', 'roy', 'mip', 'smoy', 'cpoy', 'scoringChamp', 'reboundingChamp', 'assistsChamp', 'stealsChamp', 'blocksChamp'] as const;
    for (const k of single) for (const w of [a[k], ...(a.coWinners?.[k] ?? [])]) if (w && w.teamId === teamId) out.push({ key: k, season: r.season, who: w.playerId });
    a.allNBA.forEach((team, i) => { if (i < 3) for (const w of team) if (w.teamId === teamId) out.push({ key: (['allLeague1', 'allLeague2', 'allLeague3'] as const)[i], season: r.season, who: w.playerId }); });
    a.allDefense.forEach((team, i) => { if (i < 2) for (const w of team) if (w.teamId === teamId) out.push({ key: i === 0 ? 'allDefense1' : 'allDefense2', season: r.season, who: w.playerId }); });
    for (const w of a.allStars) if (w.teamId === teamId) out.push({ key: 'allStar', season: r.season, who: w.playerId });
  }
  return out;
}
