import type { League, RetiredPlayerRecord } from './league';
import type { PlayerSeason } from './types';
import { careerSummary } from './careerStats';
import { getPlayerAwardsHistory } from './leagueAnalytics';
import { TROPHIES, TROPHY_ORDER, type TrophyKey } from './trophies';

export interface HallOfFameCase {
  playerId: string;
  score: number;
  inducted: boolean;
  finalSeason: string;
  finalTeamName: string;
  careerPoints: number;
  careerRebounds: number;
  careerAssists: number;
  seasonsPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
  awardCount: number;
  /** Hall of Fame points from hardware, weighted by prestige (an MVP is worth far more than a Player of the Week). */
  awardScore: number;
  resume: string[]; // human-readable bullet points explaining the case
}

/** The score a career needs to clear to be enshrined. Tuned so a long, productive, decorated career gets
 * in and a merely-solid starter does not. */
export const HOF_THRESHOLD = 100;

/**
 * Builds the Hall of Fame case for one retired player, blending career counting stats, per-game
 * production, longevity, and hardware. A player is enshrined the moment their score clears the
 * threshold — there's no separate voting committee to model.
 */
export function buildHallOfFameCase(
  season: PlayerSeason,
  record: RetiredPlayerRecord,
  league: League,
): HallOfFameCase {
  const summary = careerSummary(season);
  const awards = getPlayerAwardsHistory(league, season.playerId, season);
  const t = summary.totals;
  const pg = summary.perGame;

  // Counting stats carry the most weight, then peak per-game production, then hardware and longevity.
  const countingScore = t.points / 700 + (t.oreb + t.dreb) / 400 + t.ast / 350;
  // Imported early-era seasons may not have recorded rebounds or assists (NaN): they add nothing rather than breaking the score.
  const f = (v: number) => (Number.isFinite(v) ? v : 0);
  const rateScore = f(pg.ppg) * 1.6 + f(pg.rpg) * 0.9 + f(pg.apg) * 1.1;
  const awardScore = Math.round(awards.reduce((n, a) => n + TROPHIES[a.key].prestige, 0));
  const counts = new Map<TrophyKey, number>();
  for (const a of awards) counts.set(a.key, (counts.get(a.key) ?? 0) + 1);
  const headline = TROPHY_ORDER.filter(k => counts.has(k) && TROPHIES[k].prestige >= 2).slice(0, 5)
    .map(k => `${counts.get(k)! > 1 ? `${counts.get(k)}× ` : ''}${TROPHIES[k].short}`);
  const awardCount = awards.filter(a => a.key !== 'pow').length;
  const longevityScore = summary.seasonsPlayed * 1.5;
  const score = Math.round(countingScore + rateScore + awardScore + longevityScore);

  const resume: string[] = [];
  if (summary.seasonsPlayed > 0) resume.push(`${summary.seasonsPlayed} seasons, ${t.gamesPlayed} games`);
  const one = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '—');
  resume.push(`${one(pg.ppg)} / ${one(pg.rpg)} / ${one(pg.apg)} career averages`);
  resume.push(`${t.points.toLocaleString()} career points`);
  if (headline.length) resume.push(headline.join(' · '));
  else if (awardCount > 0) resume.push(`${awardCount} career award${awardCount === 1 ? '' : 's'}`);
  if (summary.milestones.tripleDoubles > 0) resume.push(`${summary.milestones.tripleDoubles} career triple-doubles`);
  if (summary.milestones.gameHighPoints > 0) resume.push(`Career high ${summary.milestones.gameHighPoints} points`);

  return {
    playerId: season.playerId,
    score,
    inducted: score >= HOF_THRESHOLD,
    finalSeason: record.finalSeason,
    finalTeamName: record.finalTeamName,
    careerPoints: t.points,
    careerRebounds: t.oreb + t.dreb,
    careerAssists: t.ast,
    seasonsPlayed: summary.seasonsPlayed,
    ppg: pg.ppg,
    rpg: pg.rpg,
    apg: pg.apg,
    awardCount,
    awardScore,
    resume,
  };
}

/**
 * Every retired player's Hall of Fame case, inductees first and then the near-misses, each sorted by
 * score. Retired players keep their full archived season data, so their case is recomputed from the
 * real career rather than a stored snapshot.
 */
export function computeHallOfFame(league: League): HallOfFameCase[] {
  const cases: HallOfFameCase[] = [];
  for (const record of league.retiredPlayers ?? []) {
    const season = record.finalSeasonData;
    if (!season) continue;
    cases.push(buildHallOfFameCase(season, record, league));
  }
  return cases.sort((a, b) => Number(b.inducted) - Number(a.inducted) || b.score - a.score);
}
