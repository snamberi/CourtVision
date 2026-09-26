import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { previousSeasonLabel, priorSeasonCount, MAX_PRIOR_SEASONS } from '../simulation/seasonZero';
import { careerYearRows, careerSummary } from '../simulation/careerStats';
import { simulateRemainingSeason } from '../simulation/league';
import { advanceToNextSeason } from '../simulation/seasonTransition';

describe('season zero (pre-generated history for a new league)', () => {
  it('labels prior seasons in both "2026" and "2026-27" styles', () => {
    expect(previousSeasonLabel('2026')).toBe('2025');
    expect(previousSeasonLabel('2026', 3)).toBe('2023');
    expect(previousSeasonLabel('2026-27')).toBe('2025-26');
    expect(previousSeasonLabel('2000-01', 1)).toBe('1999-00');
  });

  it('gives veterans a history and true rookies none', () => {
    const { league } = generateFullLeague(11);
    const players = league.teams.flatMap((t) => t.seasons);
    const nineteen = players.filter((p) => p.age === 19);
    const vets = players.filter((p) => p.age >= 25);
    expect(vets.length).toBeGreaterThan(0);
    for (const p of nineteen) expect(p.careerHistory ?? []).toHaveLength(0);
    for (const p of vets) {
      expect(p.careerHistory!.length).toBe(Math.min(MAX_PRIOR_SEASONS, priorSeasonCount(p, '2026')));
      expect(p.careerHistory!.length).toBeGreaterThan(0);
    }
  });

  it('orders history oldest-first, ending the season before the current one, with ages that line up', () => {
    const { league } = generateFullLeague(12);
    const vet = league.teams.flatMap((t) => t.seasons).find((p) => (p.careerHistory?.length ?? 0) === MAX_PRIOR_SEASONS)!;
    expect(vet.careerHistory!.map((h) => h.season)).toEqual(['2023', '2024', '2025']);
    expect(vet.careerHistory!.map((h) => h.age)).toEqual([vet.age - 3, vet.age - 2, vet.age - 1]);
  });

  it('produces internally consistent stat lines', () => {
    const { league } = generateFullLeague(13);
    for (const p of league.teams.flatMap((t) => t.seasons)) {
      for (const h of p.careerHistory ?? []) {
        const s = h.stats;
        expect(s.gamesPlayed).toBeGreaterThan(0);
        expect(s.gamesPlayed).toBeLessThanOrEqual(82);
        expect(s.fgm).toBeLessThanOrEqual(s.fga);
        expect(s.tpm).toBeLessThanOrEqual(s.tpa);
        expect(s.tpm).toBeLessThanOrEqual(s.fgm);
        expect(s.tpa).toBeLessThanOrEqual(s.fga);
        expect(s.ftm).toBeLessThanOrEqual(s.fta);
        expect(s.points).toBe(2 * (s.fgm - s.tpm) + 3 * s.tpm + s.ftm);
        expect(s.minutes / s.gamesPlayed).toBeLessThanOrEqual(45);
        expect(h.milestones.tripleDoubles).toBeLessThanOrEqual(h.milestones.doubleDoubles);
      }
    }
  });

  it('yields realistic league-wide scoring for rotation players', () => {
    const { league } = generateFullLeague(14);
    const rows = league.teams.flatMap((t) => t.seasons).flatMap((p) => careerYearRows(p))
      .filter((r) => r.perGame.mpg >= 25);
    const avgPpg = rows.reduce((a, r) => a + r.perGame.ppg, 0) / rows.length;
    expect(avgPpg).toBeGreaterThan(8);
    expect(avgPpg).toBeLessThan(20);
    const top = Math.max(...rows.map((r) => r.perGame.ppg));
    expect(top).toBeLessThan(45);
  });

  it('feeds the existing career views (rows and totals) with no special handling', () => {
    const { league } = generateFullLeague(15);
    const vet = league.teams.flatMap((t) => t.seasons).find((p) => (p.careerHistory?.length ?? 0) >= 2)!;
    expect(careerYearRows(vet).length).toBe(vet.careerHistory!.length);
    expect(careerSummary(vet).seasonsPlayed).toBe(vet.careerHistory!.length);
  });

  it('is reproducible per seed and can be switched off', () => {
    const a = generateFullLeague(21).league.teams[3].seasons[2].careerHistory;
    const b = generateFullLeague(21).league.teams[3].seasons[2].careerHistory;
    expect(a).toEqual(b);
    const off = generateFullLeague(21, 30, 18, 82, '2026', { priorSeasons: false });
    for (const p of off.league.teams.flatMap((t) => t.seasons)) expect(p.careerHistory).toBeUndefined();
  });

  it("doesn't change the players themselves (only adds history)", () => {
    const on = generateFullLeague(31).league.teams[0].seasons[0];
    const off = generateFullLeague(31, 30, 18, 82, '2026', { priorSeasons: false }).league.teams[0].seasons[0];
    expect({ ...on, careerHistory: undefined }).toEqual({ ...off, careerHistory: undefined });
  });

  it('season rollover appends to the season-zero history instead of overwriting it', () => {
    const { league, extras } = generateFullLeague(41, 4, 8, 12, '2026-27');
    const before = league.teams[0].seasons.find((p) => (p.careerHistory?.length ?? 0) > 0)!;
    const priorCount = before.careerHistory!.length;
    const played = simulateRemainingSeason(league, 41);
    const { league: next } = advanceToNextSeason(played, extras, 41);
    const after = next.teams.flatMap((t) => t.seasons).find((p) => p.playerId === before.playerId);
    if (after) {
      expect(after.careerHistory!.length).toBe(priorCount + 1);
      expect(after.careerHistory!.slice(0, priorCount)).toEqual(before.careerHistory);
      expect(after.careerHistory![priorCount].season).toBe('2026-27');
    }
  });
});
