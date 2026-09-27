import { describe, expect, it } from 'vitest';
import { encodeLeagueCode, decodeLeagueCode, describeOrigin, type LeagueOrigin } from '../retention/leagueCode';
import { generateFullLeague } from '../simulation/leagueGenerator';

describe('league codes', () => {
  const origins: LeagueOrigin[] = [
    { kind: 'random', year: 2025, seed: 987_654, difficulty: 'hard' },
    { kind: 'history', year: 1996, seed: 0, difficulty: 'easy', realDevelopment: true, forceRosters: false, allPlayers: true },
    { kind: 'history', year: 2016, seed: 999_999_999, difficulty: 'normal', realDevelopment: false, forceRosters: true, allPlayers: false },
    { kind: 'rebuild', scenario: 'bulls99', seed: 123_456_789, difficulty: 'normal', twist: 'hardTrades' },
    { kind: 'rebuild', scenario: 'lakers17', seed: 42, difficulty: 'normal' },
  ];
  it('round-trips every kind of league, with and without a team', () => {
    for (const o of origins) for (const team of ['LAL', 'CHI', null]) {
      const code = encodeLeagueCode(o, team);
      expect(code).toMatch(/^[A-Z0-9-]+$/);
      expect(code.length).toBeLessThanOrEqual(26);
      expect(decodeLeagueCode(code)).toEqual({ origin: o, teamId: team });
      expect(decodeLeagueCode(` ${code.toLowerCase()} `).teamId).toBe(team); // any case, stray spaces
    }
  });
  it('forgives O/I/L for 0/1 in the number parts, and catches real typos', () => {
    const code = encodeLeagueCode({ kind: 'random', year: 2025, seed: 1_000_001, difficulty: 'normal' }, 'BOS');
    const parts = code.split('-');
    const swapped = [parts[0], parts[1].replace(/0/g, 'O'), parts[2].replace(/1/g, 'I').replace(/0/g, 'O'), parts[3], parts[4]].join('-');
    expect(decodeLeagueCode(swapped).origin.seed).toBe(1_000_001);
    const typo = [parts[0], parts[1], parts[2].slice(0, -1) + (parts[2].endsWith('2') ? '3' : '2'), parts[3], parts[4]].join('-');
    expect(() => decodeLeagueCode(typo)).toThrow(/typo/);
    expect(() => decodeLeagueCode('hello')).toThrow(/not a Court Vision/);
    expect(() => decodeLeagueCode(encodeLeagueCode({ kind: 'rebuild', scenario: 'nope', seed: 1, difficulty: 'normal' }))).toThrow(/scenario/);
  });
  it('the same code builds the same league', () => {
    const { origin } = decodeLeagueCode(encodeLeagueCode({ kind: 'random', year: 2025, seed: 31337, difficulty: 'normal' }));
    const a = generateFullLeague(origin.seed, 30, 18, 82, String(origin.year)), b = generateFullLeague(31337, 30, 18, 82, '2025');
    expect(JSON.stringify(a.league.teams)).toBe(JSON.stringify(b.league.teams));
    expect(describeOrigin(origin, 'Boston')).toBe('Random league, 2025-26 as Boston');
  });
});
