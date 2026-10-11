import type { League, PlayoffFinish } from './league';

/*
 * "Build a Dynasty in 10 Seasons": a franchise with a clock. Every season scores your wins and how far you went in the
 * playoffs; titles are worth the most. After the tenth season the run ends with a final score and up to three stars
 * (the league carries on if you want to keep playing, but the score is locked).
 */

export interface DecadeChallenge { start: string; seasons: number }
export const DECADE_SEASONS = 10;
export const DECADE_FINISH_POINTS: Record<PlayoffFinish, number> = {
  Champion: 1000, Finals: 500, 'Conference Finals': 300, 'Second Round': 180, 'First Round': 90, Playoffs: 90, 'Play-In': 30, 'Missed Playoffs': 0,
};
export const DECADE_STARS = [3000, 6000, 9000] as const;

export interface DecadeSeason { season: string; wins: number; losses: number; finish: PlayoffFinish; points: number }
/** Your team's completed seasons inside the challenge, with points (wins x 10 + the playoff finish). */
export function decadeSeasons(league: League, teamId: string | null): DecadeSeason[] {
  const c = league.decade;
  if (!c || !teamId) return [];
  return (league.franchiseHistory ?? []).filter(h => h.season >= c.start).slice(0, c.seasons).flatMap(h => {
    const t = h.teamSeasons?.find(x => x.teamId === teamId);
    return t ? [{ season: h.season, wins: t.wins, losses: t.losses, finish: t.playoffFinish, points: t.wins * 10 + DECADE_FINISH_POINTS[t.playoffFinish] }] : [];
  });
}
export interface DecadeView { played: number; seasons: number; score: number; titles: number; stars: number; done: boolean; rows: DecadeSeason[] }
export function decadeView(league: League, teamId: string | null): DecadeView | null {
  const c = league.decade;
  if (!c) return null;
  const rows = decadeSeasons(league, teamId);
  const score = rows.reduce((n, r) => n + r.points, 0);
  return { played: rows.length, seasons: c.seasons, score, titles: rows.filter(r => r.finish === 'Champion').length, stars: DECADE_STARS.filter(s => score >= s).length, done: rows.length >= c.seasons, rows };
}
export const startDecade = (league: League): League => ({ ...league, decade: { start: league.season ?? '', seasons: DECADE_SEASONS } });

export const DECADE_BEST_KEY = 'cv-decade-best';
/** Your best finished 10-season run on this device. */
export function readDecadeBest(): { score: number; stars: number; titles: number } | null {
  try { return JSON.parse(localStorage.getItem(DECADE_BEST_KEY) ?? 'null'); } catch { return null; }
}
export function noteDecadeBest(v: DecadeView): boolean {
  if (!v.done) return false;
  const best = readDecadeBest();
  if (best && best.score >= v.score) return false;
  try { localStorage.setItem(DECADE_BEST_KEY, JSON.stringify({ score: v.score, stars: v.stars, titles: v.titles })); } catch { return false; }
  return true;
}
