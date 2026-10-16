import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { rollOverProtectedPicks, loosenedProtection, PICK_PROTECTION_OPTIONS, type FutureDraftPick } from '../simulation/gm';
import { simulateNextGame, type League } from '../simulation/league';
import { calculateOverall } from '../simulation/engine/overall';
import { setTwoWay, setCalledUp, twoWayBlocker, gLeagueGrowth, standardRosterCount } from '../simulation/twoWay';
import { assignHoldouts, isHoldingOut, endHoldout } from '../simulation/holdouts';
import { resolveExpiringContract } from '../simulation/seasonTransition';

const fresh = () => generateFullLeague(7, 30, 18, 82, '2025');

describe('protected picks roll over', () => {
  it('loosens protection each year until the pick conveys', () => {
    const top10 = PICK_PROTECTION_OPTIONS.find(o => o.topN === 10)!;
    expect(loosenedProtection(top10)?.topN).toBe(8);
    expect(loosenedProtection(PICK_PROTECTION_OPTIONS.find(o => o.topN === 4)!)).toBeNull();
  });
  it('moves the obligation onto next year\'s pick, still owed to the same team', () => {
    const top10 = PICK_PROTECTION_OPTIONS.find(o => o.topN === 10)!;
    const picks: FutureDraftPick[] = [
      { id: '2026-R1-AAA', year: 2026, round: 1, originalTeamId: 'AAA', currentOwnerTeamId: 'BBB', protection: top10 },
      { id: '2027-R1-AAA', year: 2027, round: 1, originalTeamId: 'AAA', currentOwnerTeamId: 'AAA', protection: null },
    ];
    const out = rollOverProtectedPicks(picks, 2026, [{ originalTeamId: 'AAA', round: 1 }]);
    const next = out.find(p => p.id === '2027-R1-AAA')!;
    expect(next.currentOwnerTeamId).toBe('BBB');
    expect(next.protection?.topN).toBe(8);
    expect(next.rolledFrom).toContain('2026');
  });
  it('lapses when next year\'s pick is already gone', () => {
    const picks: FutureDraftPick[] = [
      { id: '2026-R1-AAA', year: 2026, round: 1, originalTeamId: 'AAA', currentOwnerTeamId: 'BBB', protection: PICK_PROTECTION_OPTIONS[0] },
      { id: '2027-R1-AAA', year: 2027, round: 1, originalTeamId: 'AAA', currentOwnerTeamId: 'CCC', protection: null },
    ];
    expect(rollOverProtectedPicks(picks, 2026, [{ originalTeamId: 'AAA', round: 1 }])).toEqual(picks);
  });
});

describe('two-way contracts', () => {
  it('only young, raw players qualify, two per team, and they sit unless called up', () => {
    const { league } = fresh();
    const team = league.teams[0];
    const young = [...team.seasons].filter(p => !twoWayBlocker(team, p)).slice(0, 3);
    expect(young.length).toBeGreaterThanOrEqual(1);
    let l: League = league;
    for (const p of young) l = setTwoWay(l, team.teamId, p.playerId, true);
    const t = l.teams[0];
    expect(t.seasons.filter(p => p.twoWay).length).toBe(Math.min(2, young.length));
    expect(standardRosterCount(t)).toBe(t.seasons.length - t.seasons.filter(p => p.twoWay).length);
    const star = [...t.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
    expect(twoWayBlocker(t, star)).toBeTruthy();

    const tw = t.seasons.find(p => p.twoWay)!;
    const g = l.schedule.findIndex(s => s.homeTeamId === t.teamId || s.awayTeamId === t.teamId);
    const firstGame = { ...l, schedule: [l.schedule[g], ...l.schedule.filter((_, i) => i !== g)] };
    const played = simulateNextGame(firstGame, 3);
    const box = played.schedule[0].result!;
    const side = box.homeTeamId === t.teamId ? box.homeBox : box.awayBox;
    expect(side.players[tw.playerId]).toBeUndefined();
    const up = setCalledUp(firstGame, t.teamId, tw.playerId, true);
    expect(up.teams[0].seasons.find(p => p.playerId === tw.playerId)!.calledUp).toBe(true);
  });
  it('G League minutes add growth for young players', () => {
    const { league } = fresh();
    const p = { ...league.teams[0].seasons.find(s => s.age <= 21) ?? league.teams[0].seasons[0], age: 20 };
    expect(calculateOverall(gLeagueGrowth(p, p))).toBeGreaterThan(calculateOverall(p));
  });
});

describe('holdouts', () => {
  it('an underpaid star holds out for a few games until extended or traded', () => {
    const { league, extras } = fresh();
    const team = league.teams[0];
    const star = [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
    const underpaid = { ...extras, contracts: { ...extras.contracts, [star.playerId]: { ...extras.contracts[star.playerId], annualSalary: 1_000_000, yearsRemaining: 2 } } };
    const withStar = { ...league, teams: league.teams.map((t, i) => (i === 0 ? { ...t, seasons: t.seasons.map(p => (p.playerId === star.playerId ? { ...p, age: 26, morale: { score: 20, season: league.season ?? '', teamId: t.teamId, games: 0 } } : p)) } : t)) };
    let held: League | null = null;
    for (let seed = 0; seed < 40 && !held; seed++) { const l = assignHoldouts(withStar, underpaid, seed); if (l.holdouts?.[star.playerId]) held = l; }
    expect(held).not.toBeNull();
    const h = held!.holdouts![star.playerId];
    expect(h.games).toBeGreaterThanOrEqual(3);
    expect(isHoldingOut(held!, star.playerId, team.teamId, 1)).toBe(true);
    expect(isHoldingOut(held!, star.playerId, team.teamId, h.games + 1)).toBe(false);
    expect(isHoldingOut(held!, star.playerId, 'OTHER', 1)).toBe(false);
    expect(isHoldingOut(endHoldout(held!, star.playerId), star.playerId, team.teamId, 1)).toBe(false);
    expect(Object.keys(held!.holdouts!).length).toBeLessThanOrEqual(3);
  });
});

describe('player options', () => {
  const contract = { playerId: 'x', teamId: 'T', annualSalary: 5_000_000, yearsRemaining: 0, playerOption: true, teamOption: false };
  it('opts out when the market pays clearly more', () => {
    expect(resolveExpiringContract(contract, 65, 27, 9_000_000).retained).toBe(false);
  });
  it('opts in when he would not do better', () => {
    expect(resolveExpiringContract(contract, 60, 30, 4_000_000).retained).toBe(true);
  });
});
