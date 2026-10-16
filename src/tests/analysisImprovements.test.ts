import { describe, it, expect, beforeAll } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateFullRound, type League } from '../simulation/league';
import { teamLineups, bestFive, shotChart, ZONES } from '../simulation/lineupLab';
import { careerComps, overallCurve } from '../simulation/careerComps';
import { voteShare, hallOfFameClasses, INDUCTION_SHARE } from '../simulation/hofVoting';
import { HOF_THRESHOLD, type HallOfFameCase } from '../simulation/hallOfFame';
import { buildSeasonPreview, gradePreview, withSeasonPreview } from '../simulation/seasonPreview';
import type { PlayerSeason } from '../simulation/types';

let league: League;
beforeAll(() => {
  league = generateFullLeague(11, 30, 18, 82, '2025').league;
  for (let i = 0; i < 6; i++) league = simulateFullRound(league, 100 + i);
}, 120_000);

describe('Lineup Lab', () => {
  it('lineups are five players and their points add up to the team\'s', () => {
    const team = league.teams[0].teamId;
    const rows = teamLineups(league, team);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.players).toHaveLength(5);
    const games = league.schedule.filter(g => g.played && (g.homeTeamId === team || g.awayTeamId === team));
    const scored = games.reduce((s, g) => s + (g.result!.homeTeamId === team ? g.result!.homeScore : g.result!.awayScore), 0);
    const fromLineups = rows.reduce((s, r) => s + r.ptsFor, 0);
    expect(fromLineups).toBeLessThanOrEqual(scored);
    expect(fromLineups).toBeGreaterThan(scored * 0.9);
    expect(bestFive(rows, 1)).not.toBeNull();
  });
  it('shot chart attempts match the box scores', () => {
    const team = league.teams[1].teamId;
    const chart = shotChart(league, { teamId: team });
    const fga = ZONES.reduce((s, z) => s + chart[z.id].fga, 0);
    const box = league.schedule.filter(g => g.played && g.result && (g.homeTeamId === team || g.awayTeamId === team))
      .reduce((s, g) => s + Object.values((g.result!.homeTeamId === team ? g.result!.homeBox : g.result!.awayBox).players).reduce((n, p) => n + p.fga, 0), 0);
    expect(fga).toBeGreaterThan(box * 0.9);
    expect(fga).toBeLessThanOrEqual(box);
    const threes = chart.corner3.fga + chart.arc3.fga;
    expect(threes).toBeGreaterThan(0);
  });
});

describe('career comps', () => {
  const player = (id: string, curve: [number, number][], now: [number, number]): PlayerSeason => {
    const base = league.teams[0].seasons[0];
    return { ...base, playerId: id, age: now[0], careerHistory: curve.map(([age, overall]) => ({ season: String(2000 + age), teamId: null, age, overall, stats: base.seasonStats ?? ({} as never), milestones: {} as never })) } as PlayerSeason;
  };
  it('finds players whose curve matched at the same age and reports where they went', () => {
    const target = player('Target', [[20, 60], [21, 64]], [22, 0]);
    const curveNow = overallCurve(target).get(22)!;
    const twin = player('Twin', [[20, 60], [21, 64], [22, curveNow], [23, 75], [24, 80]], [25, 0]);
    const other = player('Other', [[20, 40], [21, 42], [22, 45], [23, 46], [24, 47]], [25, 0]);
    const comps = careerComps(target, [target, twin, other]);
    expect(comps[0]?.playerId).toBe('Twin');
    expect(comps.some(c => c.playerId === 'Other')).toBe(false);
    expect(comps[0].peakOverall).toBeGreaterThanOrEqual(80);
  });
});

describe('Hall of Fame voting', () => {
  it('a case right at the bar polls about 75%, stronger cases more, and support grows on the ballot', () => {
    expect(Math.abs(voteShare(HOF_THRESHOLD, 1, 'x') - INDUCTION_SHARE)).toBeLessThanOrEqual(0.04);
    expect(voteShare(HOF_THRESHOLD * 1.3, 1, 'x')).toBeGreaterThan(INDUCTION_SHARE);
    expect(voteShare(80, 5, 'y')).toBeGreaterThan(voteShare(80, 1, 'y') + 0.08);
  });
  it('classes induct each player once, a season after he retires', () => {
    const l: League = { ...league, franchiseHistory: ['2026', '2027', '2028'].map(season => ({ season, championTeamId: null, championTeamName: null, mvpPlayerId: null, mvpTeamName: null, dpoyPlayerId: null, royPlayerId: null, fmvpPlayerId: null })) };
    const c = (playerId: string, score: number, finalSeason: string): HallOfFameCase => ({ playerId, score, inducted: false, finalSeason, finalTeamName: 'X', careerPoints: 0, careerRebounds: 0, careerAssists: 0, seasonsPlayed: 10, ppg: 0, rpg: 0, apg: 0, awardCount: 0, awardScore: 0, resume: [] });
    const classes = hallOfFameClasses(l, [c('Legend', 160, '2025'), c('Borderline', 90, '2025'), c('Role player', 30, '2025'), c('Too soon', 160, '2028')]);
    const all = classes.flatMap(k => k.inducted.map(i => i.playerId));
    expect(classes[0].inducted.map(i => i.playerId)).toContain('Legend');
    expect(all.filter(p => p === 'Legend')).toHaveLength(1);
    expect(all).not.toContain('Role player');
    expect(all).not.toContain('Too soon');
  });
});

describe('season preview', () => {
  it('predicts every team, keeps one preview per season and grades it', () => {
    const fresh = generateFullLeague(12, 30, 18, 82, '2025').league;
    const preview = buildSeasonPreview(fresh);
    expect(preview.picks).toHaveLength(30);
    const total = preview.picks.reduce((s, p) => s + p.predictedWins, 0);
    expect(Math.abs(total - 30 * 41)).toBeLessThan(60);
    const stored = withSeasonPreview(fresh);
    expect(withSeasonPreview(stored)).toBe(stored);
    let played = stored;
    for (let i = 0; i < 4; i++) played = simulateFullRound(played, 9 + i);
    const card = gradePreview(played, stored.seasonPreviews![fresh.season!]);
    expect(card.rows.some(r => r.actualGames > 0)).toBe(true);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(card.grade);
    expect(card.final).toBe(false);
  });
});
