import type { League } from './league';
import { calculateOverall } from './engine/overall';
import { computeStandings } from './league';

/* Season preview and report card. When a regular season starts, the league office publishes predicted standings (from
 * each roster's strength), a title favourite and an MVP favourite. When the season ends the predictions are graded. */

export interface PreviewPick { teamId: string; teamName: string; rank: number; predictedWins: number; strength: number }
export interface SeasonPreview { season: string; games: number; picks: PreviewPick[]; champion: string; mvp: string | null }

/** Roster strength: the top eight players' Overall, the best ones counting most. */
export function rosterStrength(seasons: Parameters<typeof calculateOverall>[0][]): number {
  const ovr = seasons.map(s => calculateOverall(s)).sort((a, b) => b - a).slice(0, 8);
  const w = [1.6, 1.4, 1.25, 1.1, 1, 0.8, 0.6, 0.45];
  let sum = 0, wsum = 0;
  ovr.forEach((o, i) => { sum += o * w[i]; wsum += w[i]; });
  return wsum ? sum / wsum : 0;
}

export function buildSeasonPreview(league: League): SeasonPreview {
  const games = league.settings.gamesPerSeason ?? 82;
  const rows = league.teams.map(t => ({ teamId: t.teamId, teamName: t.name, strength: rosterStrength(t.seasons) }));
  const mean = rows.reduce((s, r) => s + r.strength, 0) / Math.max(1, rows.length);
  const sd = Math.sqrt(rows.reduce((s, r) => s + (r.strength - mean) ** 2, 0) / Math.max(1, rows.length)) || 1;
  const picks = rows.map(r => ({ ...r, predictedWins: Math.round(Math.max(games * 0.15, Math.min(games * 0.85, games / 2 + ((r.strength - mean) / sd) * games * 0.15))) }))
    .sort((a, b) => b.strength - a.strength).map((r, i) => ({ ...r, rank: i + 1 }));
  const players = league.teams.flatMap(t => t.seasons).filter(p => !p.twoWay);
  const mvp = [...players].sort((a, b) => calculateOverall(b) - calculateOverall(a))[0]?.playerId ?? null;
  return { season: league.season ?? '', games, picks, champion: picks[0]?.teamId ?? '', mvp };
}

/** Stores this season's preview once (the first time a season starts). */
export function withSeasonPreview(league: League): League {
  const season = league.season ?? '';
  if (league.seasonPreviews?.[season]) return league;
  const all = { ...(league.seasonPreviews ?? {}), [season]: buildSeasonPreview(league) };
  // Keep the last ten seasons' previews.
  const keep = Object.keys(all).sort((a, b) => Number(b) - Number(a)).slice(0, 10);
  return { ...league, seasonPreviews: Object.fromEntries(keep.map(k => [k, all[k]])) };
}

export interface ReportRow extends PreviewPick { actualWins: number; actualGames: number; diff: number }
export interface ReportCard { rows: ReportRow[]; meanMiss: number; grade: 'A' | 'B' | 'C' | 'D' | 'F'; surprise: ReportRow | null; flop: ReportRow | null; championHit: boolean | null; mvpHit: boolean | null; final: boolean }

/**
 * Grades a preview against a season's results: the archived season when it is over, the live standings (scaled to a
 * full season) while it is still being played.
 */
export function gradePreview(league: League, preview: SeasonPreview): ReportCard {
  const rec = league.franchiseHistory?.find(r => r.season === preview.season && !r.imported);
  const live = !rec && league.season === preview.season;
  const actual = new Map<string, { w: number; g: number }>();
  if (rec?.teamSeasons) for (const t of rec.teamSeasons) actual.set(t.teamId, { w: t.wins, g: t.wins + t.losses });
  else if (live) for (const s of computeStandings(league)) actual.set(s.teamId, { w: s.wins, g: s.wins + s.losses });
  const rows: ReportRow[] = preview.picks.map(p => {
    const a = actual.get(p.teamId) ?? { w: 0, g: 0 };
    const pace = a.g ? (a.w / a.g) * preview.games : p.predictedWins;
    return { ...p, actualWins: a.w, actualGames: a.g, diff: Math.round(pace - p.predictedWins) };
  });
  const played = rows.filter(r => r.actualGames > 0);
  const meanMiss = played.length ? played.reduce((s, r) => s + Math.abs(r.diff), 0) / played.length : 0;
  const scaled = meanMiss * (82 / Math.max(1, preview.games));
  const grade = scaled <= 5 ? 'A' : scaled <= 7 ? 'B' : scaled <= 9 ? 'C' : scaled <= 12 ? 'D' : 'F';
  const byDiff = [...played].sort((a, b) => b.diff - a.diff);
  return {
    rows, meanMiss, grade, final: !!rec,
    surprise: byDiff[0] && byDiff[0].diff > 0 ? byDiff[0] : null,
    flop: byDiff.at(-1) && byDiff.at(-1)!.diff < 0 ? byDiff.at(-1)! : null,
    championHit: rec ? rec.championTeamId === preview.champion : null,
    mvpHit: rec ? rec.mvpPlayerId === preview.mvp : null,
  };
}
