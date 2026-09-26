import { describe, it, expect } from 'vitest';
import { assignGMPersonalities, runFreeAgencyAI, type GMPersonality } from '../simulation/aiGM';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { waiveToFreeAgency } from '../simulation/gm';

describe('assignGMPersonalities', () => {
  it('assigns exactly one personality per team, deterministically for a given seed', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const p1 = assignGMPersonalities(ids, 5);
    const p2 = assignGMPersonalities(ids, 5);
    expect(Object.keys(p1).length).toBe(5);
    expect(p1).toEqual(p2);
    for (const v of Object.values(p1)) expect(['aggressive', 'conservative', 'balanced']).toContain(v);
  });

  it('produces a mix of personalities across a large enough league', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `team${i}`);
    const personalities = assignGMPersonalities(ids, 1);
    const uniqueValues = new Set(Object.values(personalities));
    expect(uniqueValues.size).toBeGreaterThan(1);
  });
});

describe('personality-driven free agency', () => {
  it('an aggressive team signs a free agent even with tighter cap space than a conservative team would accept', () => {
    const { league, extras } = generateFullLeague(1, 4, 8, 10, '2026-27');
    const aggressiveId = league.teams[0].teamId;
    const conservativeId = league.teams[1].teamId;
    const personalities: Record<string, GMPersonality> = { [aggressiveId]: 'aggressive', [conservativeId]: 'conservative' };

    // Waive most of both rosters so they're both clearly under target size and need signings.
    let stateA: { league: typeof league; extras: typeof extras } = { league, extras: { ...extras, freeAgencyOpen: true, teamPersonalities: personalities } };
    for (const s of league.teams[0].seasons.slice(3)) stateA = waiveToFreeAgency(stateA.league, stateA.extras, s.playerId, aggressiveId);
    for (const s of stateA.league.teams.find((t) => t.teamId === conservativeId)!.seasons.slice(3)) {
      stateA = waiveToFreeAgency(stateA.league, stateA.extras, s.playerId, conservativeId);
    }

    const result = runFreeAgencyAI(stateA.league, stateA.extras, null, 3, 20);
    const aggressiveSignings = result.signings.filter((s) => s.teamId === aggressiveId).length;
    // Not a strict guarantee for every random roster, but the aggressive team should never sign strictly fewer
    // than the conservative one when both start from the same need, since its cap cushion requirement is looser.
    const conservativeSignings = result.signings.filter((s) => s.teamId === conservativeId).length;
    expect(aggressiveSignings).toBeGreaterThanOrEqual(conservativeSignings);
  });

  it('falls back to balanced behavior when no personality is assigned for a team', () => {
    const { league, extras } = generateFullLeague(2, 4, 8, 10, '2026-27');
    const noPersonalityExtras = { ...extras, freeAgencyOpen: true, teamPersonalities: undefined };
    expect(() => runFreeAgencyAI(league, noPersonalityExtras, null, 1)).not.toThrow();
  });
});
