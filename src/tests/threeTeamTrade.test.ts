import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { calculateOverall } from '../simulation/engine/overall';
import { validateThreeTeam, threeTeamSides, threeTeamCounter, executeThreeTeam, type ThreeTeamTrade } from '../simulation/threeTeamTrade';

const { league, extras: base } = generateFullLeague(47, 10, 14, 30, '2026', { priorSeasons: false });
const extras = { ...base, capSettings: { ...base.capSettings, enforceCapOnTrades: false } };
const [A, B, C] = league.teams;
const byOvr = (t: typeof A) => [...t.seasons].sort((x, y) => calculateOverall(y) - calculateOverall(x));

describe('three-team trades', () => {
  it('each front office judges its own side; a fair rotation of players goes through', () => {
    // A's 5th best to B, B's 5th best to C, C's 5th best to A: roughly even for everyone.
    const trade: ThreeTeamTrade = { teams: [A.teamId, B.teamId, C.teamId], moves: [
      { kind: 'player', id: byOvr(A)[4].playerId, from: A.teamId, to: B.teamId },
      { kind: 'player', id: byOvr(B)[4].playerId, from: B.teamId, to: C.teamId },
      { kind: 'player', id: byOvr(C)[4].playerId, from: C.teamId, to: A.teamId },
    ] };
    const sides = threeTeamSides(league, extras, trade);
    expect(sides).toHaveLength(3);
    const easy = { ...extras, tradeSettings: { ...extras.tradeSettings, difficulty: 'easy' as const } };
    const done = validateThreeTeam(league, easy, trade, A.teamId).length ? threeTeamCounter(league, easy, trade, A.teamId)!.trade : trade;
    expect(validateThreeTeam(league, easy, done, A.teamId)).toEqual([]);
    const r = executeThreeTeam(league, easy, done);
    expect(r.league.teams.find(t => t.teamId === B.teamId)!.seasons.some(p => p.playerId === byOvr(A)[4].playerId)).toBe(true);
    expect(r.extras.contracts[byOvr(C)[4].playerId].teamId).toBe(A.teamId);
    for (const t of r.league.teams) for (const p of t.seasons) if (r.extras.contracts[p.playerId]) expect(r.extras.contracts[p.playerId].teamId).toBe(t.teamId);
  });

  it('a lopsided deal gets a counter from your side that every AI team accepts', () => {
    const trade: ThreeTeamTrade = { teams: [A.teamId, B.teamId, C.teamId], moves: [
      { kind: 'player', id: byOvr(A).at(-1)!.playerId, from: A.teamId, to: B.teamId },
      { kind: 'player', id: byOvr(B)[1].playerId, from: B.teamId, to: A.teamId },
      { kind: 'player', id: byOvr(C).at(-2)!.playerId, from: C.teamId, to: B.teamId },
    ] };
    expect(validateThreeTeam(league, extras, trade, A.teamId).some(r => r.includes(B.name))).toBe(true);
    const counter = threeTeamCounter(league, extras, trade, A.teamId);
    expect(counter).not.toBeNull();
    expect(validateThreeTeam(league, extras, counter!.trade, A.teamId)).toEqual([]);
    expect(counter!.trade.moves.length).toBeGreaterThan(3);
    expect(counter!.trade.moves.slice(3).every(m => m.from === A.teamId)).toBe(true);
  });

  it('rejects bad deals: an asset twice, a team left out, a pick it does not own', () => {
    const p = byOvr(A)[3].playerId;
    expect(validateThreeTeam(league, extras, { teams: [A.teamId, B.teamId, C.teamId], moves: [{ kind: 'player', id: p, from: A.teamId, to: B.teamId }, { kind: 'player', id: p, from: A.teamId, to: C.teamId }] }, A.teamId)).toContain('An asset cannot move twice.');
    expect(validateThreeTeam(league, extras, { teams: [A.teamId, B.teamId, C.teamId], moves: [{ kind: 'player', id: p, from: A.teamId, to: B.teamId }] }, A.teamId).some(r => r.includes(`${C.name} isn't part`))).toBe(true);
  });
});
