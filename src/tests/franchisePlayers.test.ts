import { describe, it, expect } from 'vitest';
import { generatePlayer } from '../simulation/leagueGenerator';
import { developOffseasonPlayer, GUARANTEE_RATE } from '../simulation/engine/development';
import { calculateOverall } from '../simulation/engine/overall';
import { primeWindow } from '../simulation/engine/potential';
import { RNG } from '../simulation/engine/rng';
import { followsRealDevelopment, ratingsHeld, LOCKED_KEEPS_PLAYING } from '../simulation/realDevelopmentGate';
import { shouldRetire } from '../simulation/seasonTransition';
import type { PlayerSeason } from '../simulation/types';

const player = (seed: number, age: number): PlayerSeason => generatePlayer(`P${seed}`, '2026-27', 'A', age, seed, new RNG(seed));
const played = (p: PlayerSeason, minutes = 2300, games = 75): PlayerSeason => ({ ...p, seasonStats: { ...p.seasonStats!, minutes, gamesPlayed: games } });

describe('Edit Player: lock ratings and own development', () => {
  it('locked ratings: a year older, not a point different, even past his prime', () => {
    for (const age of [20, 27, 35]) {
      const p = { ...played(player(age, age)), lockRatings: true };
      const next = developOffseasonPlayer(p, new RNG(age));
      expect(next.age).toBe(age + 1);
      expect(next.attributes).toEqual(p.attributes);
      expect(calculateOverall(next)).toBe(calculateOverall(p));
    }
  });
  it('locked players who are still good never retire on age; real development steps aside for both options', () => {
    const old = player(5, 44);
    expect(shouldRetire({ ...old, lockRatings: true, overall: { mode: 'MANUAL', manualOverall: LOCKED_KEEPS_PLAYING + 10 } } as PlayerSeason, new RNG(1))).toBe(false);
    expect(shouldRetire(old, new RNG(1))).toBe(true); // 44 without the lock: forced out
    const league = { historical: { realDevelopment: true } } as never;
    const real = { ...player(6, 25), real: { id: 'x' } } as unknown as PlayerSeason;
    expect(followsRealDevelopment(real, league)).toBe(true);
    expect(followsRealDevelopment({ ...real, ownDevelopment: true }, league)).toBe(false);
    expect(followsRealDevelopment({ ...real, lockRatings: true }, league)).toBe(false);
    expect(ratingsHeld({ ...real, lockRatings: true }, league)).toBe(true);
    expect(ratingsHeld({ ...real, ownDevelopment: true }, league)).toBe(false);
  });
});

describe('growing into potential', () => {
  it(`development rate ${GUARANTEE_RATE}+ reaches potential by the first year of his prime, however big the gap`, () => {
    let reached = 0;
    for (let i = 0; i < 20; i++) {
      const base = player(100 + i, 22);
      const w = primeWindow(base);
      const p = played({ ...base, age: w.start - 1, development: { ...base.development, developmentRate: GUARANTEE_RATE, potential: Math.min(99, calculateOverall(base) + 40) } });
      const next = developOffseasonPlayer(p, new RNG(i));
      if (calculateOverall(next) >= p.development.potential - 1) reached++;
    }
    expect(reached).toBe(20);
  });
  it('a season lost to injury still gets in the way of the guarantee', () => {
    const base = player(300, 22), w = primeWindow(base);
    const p = { ...base, age: w.start - 1, development: { ...base.development, developmentRate: 120, potential: Math.min(99, calculateOverall(base) + 30) } };
    const healthy = developOffseasonPlayer(played(p), new RNG(3)), hurt = developOffseasonPlayer(played(p, 200, 6), new RNG(3));
    expect(calculateOverall(hurt)).toBeLessThan(calculateOverall(healthy));
  });
  it('a player who reaches his prime short of his potential keeps growing toward it, and the window fades', () => {
    let gained = 0, n = 0;
    for (let i = 0; i < 40; i++) {
      const base = player(500 + i, 22), w = primeWindow(base);
      const p = played({ ...base, age: w.start, development: { ...base.development, potential: Math.min(99, calculateOverall(base) + 8) } });
      const next = developOffseasonPlayer(p, new RNG(i));
      gained += calculateOverall(next) - calculateOverall(p); n++;
      expect(next.development.potential).toBeLessThanOrEqual(p.development.potential);
      expect(calculateOverall(next)).toBeLessThanOrEqual(p.development.potential);
    }
    expect(gained / n).toBeGreaterThan(0.8);
  });
});

describe('contracts: max, supermax and pay cuts', async () => {
  const { generateFullLeague } = await import('../simulation/leagueGenerator');
  const { supermaxEligible, supermaxSalary, maxSalary, contractTier, maxFor } = await import('../simulation/maxContracts');
  const { payCut, personalityOf } = await import('../simulation/personality');
  const { resignVerdict, signingDecision } = await import('../simulation/freeAgentDecision');
  const { isProtectedCornerstone, wouldBeCornerstone, tradeAssetValue } = await import('../simulation/tradeValue');
  const g = generateFullLeague(7);
  const cap = g.extras.capSettings;
  const team = g.league.teams[0];
  const best = [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
  const star = (p: PlayerSeason): PlayerSeason => ({ ...p, age: 28, overall: { mode: 'MANUAL', manualOverall: 88 }, careerHistory: Array.from({ length: 6 }, () => ({}) as never) });

  it('the supermax: 35% of the cap, for his own team\'s 82+ best player with 5 seasons, 33 or younger', () => {
    expect(supermaxSalary(cap)).toBeGreaterThan(maxSalary(cap));
    const s = star(best);
    expect(supermaxEligible(s, team, true)).toBe(true);
    expect(supermaxEligible(s, team, false)).toBe(false);
    expect(supermaxEligible({ ...s, age: 34 }, team, true)).toBe(false);
    expect(supermaxEligible({ ...s, careerHistory: [] }, team, true)).toBe(false);
    expect(maxFor(s, team, true, cap)).toBe(supermaxSalary(cap));
    expect(maxFor(s, team, false, cap)).toBe(maxSalary(cap));
    expect(contractTier(supermaxSalary(cap), cap)).toBe('supermax');
    expect(contractTier(maxSalary(cap), cap)).toBe('max');
    expect(contractTier(cap.minSalary, cap)).toBeNull();
  });
  it('a franchise player asks his own team for the supermax; nobody can be paid past his ceiling', () => {
    const s = star(best);
    const league = { ...g.league, teams: g.league.teams.map((t, i) => (i === 0 ? { ...t, seasons: t.seasons.filter(p => p.playerId !== best.playerId) } : t)) };
    const v = resignVerdict(g.extras, s, team.teamId, league);
    expect(v.required).toBeGreaterThan(maxSalary(cap) * 0.85);
    expect(v.reason).toMatch(/supermax/);
    const other = g.league.teams[1].seasons[0];
    const fa = { ...other, history: [] } as PlayerSeason;
    // A team with all the cap room in the world still cannot pay a free agent past the max.
    const roomy = { ...g.extras, freeAgents: [fa], contracts: Object.fromEntries(Object.entries(g.extras.contracts).filter(([, c]) => c.teamId !== team.teamId)) };
    const d = signingDecision(g.league, roomy, fa, team.teamId, { annualSalary: supermaxSalary(cap), yearsRemaining: 2 });
    expect(d.accepted).toBe(false);
    expect(d.reason).toMatch(/more than the max/);
  });
  it('a win-first player who does not care about money takes a pay cut for a contender, never for anyone else', () => {
    let found: PlayerSeason | null = null;
    for (let i = 0; i < 400 && !found; i++) { const p = { ...best, playerId: `Win ${i}` }; const per = personalityOf(p); if (per.winning >= 85 && per.greed <= 40) found = p; }
    expect(found).not.toBeNull();
    const cut = payCut(found!, true)!;
    expect(cut.discount).toBeGreaterThanOrEqual(0.15);
    expect(cut.discount).toBeLessThanOrEqual(0.35);
    expect(payCut(found!, false)).toBeNull();
    let greedy: PlayerSeason | null = null;
    for (let i = 0; i < 400 && !greedy; i++) { const p = { ...best, playerId: `Money ${i}` }; if (personalityOf(p).greed >= 70) greedy = p; }
    expect(payCut(greedy!, true)).toBeNull();
  });
  it('a team holds on to its leader unless it is tanking and he is past 27, or he asked out', () => {
    expect(isProtectedCornerstone(best, g.league, team.teamId)).toBe(true);
    const second = [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[1];
    expect(isProtectedCornerstone(second, g.league, team.teamId)).toBe(false);
    expect(isProtectedCornerstone({ ...best, morale: { ...(best.morale ?? {}), tradeRequest: 'wants out' } } as unknown as PlayerSeason, g.league, team.teamId)).toBe(false);
    // Worth more to his own team than to a team that already has a better leader...
    const rival = g.league.teams[1];
    const ledRival = { ...g.league, teams: g.league.teams.map(t => (t.teamId === rival.teamId ? { ...t, seasons: [star(t.seasons[0]), ...t.seasons.slice(1)] } : t)) };
    const own = tradeAssetValue(best, g.league, g.extras, team.teamId), theirs = tradeAssetValue(best, ledRival, g.extras, rival.teamId);
    expect(own).toBeGreaterThan(theirs);
    // ...but a team he would lead prizes him as its own does, so a swap of equal stars still balances.
    const weakRival = { ...g.league, teams: g.league.teams.map(t => (t.teamId === rival.teamId ? { ...t, seasons: t.seasons.filter(p => calculateOverall(p) < calculateOverall(best)) } : t)) };
    expect(wouldBeCornerstone(best, weakRival, rival.teamId)).toBe(true);
    expect(tradeAssetValue(best, weakRival, g.extras, rival.teamId)).toBeGreaterThan(theirs);
  });
});
