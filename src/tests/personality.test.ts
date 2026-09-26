import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds, type League } from '../simulation/league';
import { personalityOf, refreshLeagueMorale, moraleContractAdjustment, withGrudge, lockerRoom } from '../simulation/personality';
import { freeAgentVerdict } from '../simulation/freeAgentDecision';
import { calculateOverall } from '../simulation/engine/overall';
import { appendHistoryEvent } from '../simulation/playerHistory';

describe('personalities and morale', () => {
  it('personality is stable for a player and varied across the league', () => {
    const { league } = generateFullLeague(31, 30, 13, 10, '2026');
    const all = league.teams.flatMap(t => t.seasons);
    expect(personalityOf(all[0])).toEqual(personalityOf(all[0]));
    const types = new Set(all.map(p => personalityOf(p).type));
    expect(types.size).toBeGreaterThanOrEqual(5);
  });

  it('a buried, established player on a losing team asks for a trade once, and it makes news in his history', () => {
    const { league: base, extras } = generateFullLeague(32, 30, 13, 30, '2026');
    let league: League = { ...simulateRounds(base, 20, 5), seasonPhase: 'regular_season' };
    const team = league.teams[0];
    const star = [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
    // Bury the best player: he barely plays on a team that keeps losing, and he's paid far below his worth.
    league = { ...league, teams: league.teams.map(t => t.teamId !== team.teamId ? t : { ...t, seasons: t.seasons.map(p => p.playerId !== star.playerId ? p : {
      ...p, minutes: { ...p.minutes, target: 4 }, seasonStats: { ...(p.seasonStats ?? { gamesPlayed: 0, minutes: 0 } as never), gamesPlayed: 20, minutes: 60 },
    }) }) };
    const cheap = { ...extras, contracts: { ...extras.contracts, [star.playerId]: { ...extras.contracts[star.playerId], annualSalary: extras.capSettings.minSalary } } };
    const first = refreshLeagueMorale(league, cheap);
    const after = first.league.teams[0].seasons.find(p => p.playerId === star.playerId)!;
    expect(after.morale!.score).toBeLessThan(40);
    expect(after.morale!.tradeRequest).toBeTruthy();
    {
      expect(first.events.some(e => e.playerId === star.playerId && e.kind === 'trade_request')).toBe(true);
      expect(after.history?.at(-1)?.type).toBe('trade_request');
      expect(first.extras.tradeBlock).toContain(star.playerId);
      // Repeated passes don't file it again.
      const again = refreshLeagueMorale(first.league, first.extras);
      expect(again.events.some(e => e.playerId === star.playerId && e.kind === 'trade_request')).toBe(false);
      // And he won't re-sign with that team.
      const adj = moraleContractAdjustment(after, team.teamId, true);
      expect(adj.refuses).toBeTruthy();
    }
  }, 60_000);

  it('players remember teams that moved them when they did not ask to leave', () => {
    const { league, extras } = generateFullLeague(33, 30, 13, 10, '2026');
    const p = league.teams[0].seasons.find(s => personalityOf(s).loyalty >= 60 && personalityOf(s).temper < 70)!;
    const moved = withGrudge({ ...p, morale: { score: 70, season: '2026', teamId: league.teams[0].teamId, games: 10 } }, league.teams[0].teamId, '2026');
    expect(moved.morale!.grudges).toContain(league.teams[0].teamId);
    const fa = appendHistoryEvent({ ...moved, teamId: null }, 'signed', 'test', league.teams[5].teamId);
    const withTeam = { ...extras, freeAgents: [fa] };
    const grudgeTeam = freeAgentVerdict(league, withTeam, fa, league.teams[0].teamId);
    const clean = freeAgentVerdict(league, withTeam, { ...fa, morale: { ...fa.morale!, grudges: [] } }, league.teams[0].teamId);
    if (!grudgeTeam.refuses && !clean.refuses) expect(grudgeTeam.required).toBeGreaterThan(clean.required);
  });

  it('locker-room links only involve teammates and chemistry delta stays bounded', () => {
    const { league } = generateFullLeague(34, 30, 13, 10, '2026');
    for (const t of league.teams) {
      const { links, chemistryDelta } = lockerRoom(t);
      const ids = new Set(t.seasons.map(p => p.playerId));
      expect(links.every(l => ids.has(l.a) && ids.has(l.b))).toBe(true);
      expect(Math.abs(chemistryDelta)).toBeLessThanOrEqual(6);
    }
  });
});
