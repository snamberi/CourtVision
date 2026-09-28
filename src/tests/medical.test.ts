import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds, type League } from '../simulation/league';
import { chooseTreatment, treatmentOptions, afterHealing, afterGame, withMedicalRisk, restsTonight, setRestPlan, pendingDecisions } from '../simulation/medical';

const { league: base } = generateFullLeague(17, 8, 13, 30, '2026', { priorSeasons: false });
const team = base.teams[0];
const p = team.seasons[0];
const hurt = (sev: 'minor' | 'moderate' | 'severe', games: number): League => ({ ...base, injuries: { [p.playerId]: { playerId: p.playerId, teamId: team.teamId, severity: sev, gamesRemaining: games, totalGames: games } } });

describe('medical room', () => {
  it('offers rush/standard/rest, and surgery only for severe injuries, with the right games out', () => {
    const l = hurt('moderate', 10);
    expect(pendingDecisions(l, team.teamId)).toHaveLength(1);
    const opts = treatmentOptions(l.injuries![p.playerId]);
    expect(opts.map(o => o.id)).toEqual(['rush', 'standard', 'rest']);
    expect(opts.find(o => o.id === 'rush')!.games).toBeLessThan(10);
    expect(opts.find(o => o.id === 'rest')!.games).toBeGreaterThan(10);
    expect(treatmentOptions(hurt('severe', 20).injuries![p.playerId]).map(o => o.id)).toContain('surgery');
    const rushed = chooseTreatment(l, p.playerId, 'rush');
    expect(rushed.injuries![p.playerId].gamesRemaining).toBe(6);
    expect(pendingDecisions(rushed, team.teamId)).toHaveLength(0);
    expect(chooseTreatment(rushed, p.playerId, 'rest')).toBe(rushed); // decided once
  });

  it('surgery lowers his injury risk for good; rushing makes him fragile after he heals', () => {
    const s = chooseTreatment(hurt('severe', 20), p.playerId, 'surgery');
    expect(s.teams[0].seasons[0].development.injuryRisk).toBeLessThan(p.development.injuryRisk + 0.001);
    const state = afterHealing({ fragile: {}, rest: {} }, [{ ...hurt('moderate', 1).injuries![p.playerId], treatment: 'rush' }]);
    expect(state.fragile[p.playerId]).toEqual({ gamesLeft: 15, mult: 2 });
    expect(withMedicalRisk(state, p).development.injuryRisk).toBeGreaterThan(p.development.injuryRisk);
    let s2 = state; for (let i = 0; i < 15; i++) s2 = afterGame(s2, [p.playerId]);
    expect(s2.fragile[p.playerId]).toBeUndefined();
  });

  it('load management sits a player on schedule in the regular season only', () => {
    const l = setRestPlan(base, p.playerId, 'every6');
    expect(restsTonight(l.medical, p.playerId, 6, 'regular_season')).toBe(true);
    expect(restsTonight(l.medical, p.playerId, 5, 'regular_season')).toBe(false);
    expect(restsTonight(l.medical, p.playerId, 6, 'playoffs')).toBe(false);
    const sat = simulateRounds(setRestPlan(base, p.playerId, 'untilPlayoffs'), 6, 3);
    expect(sat.teams[0].seasons.find(s => s.playerId === p.playerId)!.seasonStats?.gamesPlayed ?? 0).toBe(0);
  });
});
