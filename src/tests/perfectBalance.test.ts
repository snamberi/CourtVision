import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { newPerfectRun, pickPlayer, rollPool, quickSpinCard, starCount, MAX_STARS, streakPressure, oppEdge, coachMatchup, coachMatchupText, OPP_EDGE, type PerfectRun, type PerfectGame } from '../perfect/run';
import { cardPool } from '../hunt/cards';

const g = (won: boolean): PerfectGame => ({ opp: 'x', us: won ? 100 : 90, them: won ? 90 : 100, won, top: '' });

describe('82-0 balance', () => {
  it('stops offering Stars once a team has three', async () => {
    const h = await loadHistoryForTests();
    const stars = cardPool(h).byRarity.legendary.slice(0, MAX_STARS).map(c => c.id);
    const quick: PerfectRun = { ...newPerfectRun(h, 'quick', 9), squad: stars };
    expect(starCount(h, quick)).toBe(MAX_STARS);
    for (let s = 0; s < 30; s++) expect(quickSpinCard(h, { ...quick, seed: s }).rarity).not.toBe('legendary');
    let fr = newPerfectRun(h, 'franchise', 4);
    fr = { ...fr, squad: stars };
    expect(rollPool(h, fr, fr.roll!).every(c => c.rarity !== 'legendary')).toBe(true);
    expect(rollPool(h, { ...fr, prime: true }, fr.roll!).every(c => c.rarity !== 'legendary')).toBe(true);
    // Below the cap a pick still goes through.
    expect(pickPlayer(h, newPerfectRun(h, 'quick', 9)).squad).toHaveLength(1);
  });
  it('turns up the pressure every ten straight wins, up to +4, and a loss resets it', () => {
    const run = { mode: 'quick' as const, games: Array.from({ length: 25 }, () => g(true)), playoffs: [] };
    expect(streakPressure(run)).toBe(2);
    expect(streakPressure({ ...run, games: [...run.games, g(false), g(true)] })).toBe(0);
    expect(streakPressure({ ...run, games: Array.from({ length: 82 }, () => g(true)), playoffs: [{ round: 0, opp: 'x', games: [g(true)] }] })).toBe(4);
    expect(oppEdge({ ...run, mode: 'franchise' }, true, 1)).toBe(OPP_EDGE.franchise + OPP_EDGE.boss + OPP_EDGE.perRound + 2);
  });
  it('gives each coach style a best and a worst era', () => {
    expect(coachMatchup('pace', '90s')).toBe(2);
    expect(coachMatchup('threes', '60s')).toBe(-2);
    expect(coachMatchup('balanced', '90s')).toBe(0);
    expect(coachMatchup(undefined, '90s')).toBe(0);
    expect(coachMatchupText('triangle')).toBe('Best vs 1990s, 2000s · worst vs 2010s, Today');
  });
});
