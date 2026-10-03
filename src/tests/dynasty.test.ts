import { describe, it, expect } from 'vitest';
import { startDynasty, dynastySeasonEnd, historyBook } from '../simulation/dynasty';
import type { League, FranchiseHistoryRecord, TeamSeasonSummary } from '../simulation/league';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';

const team = (teamId: string, name: string) => ({ teamId, name, seasons: [] });
const summary = (teamId: string, teamName: string, wins: number): TeamSeasonSummary => ({ teamId, teamName, wins, losses: 82 - wins, ppg: 0, oppPpg: 0, ortg: 0, drtg: 0, pace: 0, tpmPg: 0, apg: 0, rpg: 0, spg: 0, bpg: 0, playoffFinish: 'Missed Playoffs', playoffWins: 0, playoffLosses: 0, roster: [] });
const rec = (season: string, champ: string, mvp: string, wins: Record<string, number>): FranchiseHistoryRecord => ({
  season, championTeamId: champ, championTeamName: champ === 'A' ? 'Alphas' : 'Betas', mvpPlayerId: mvp, mvpTeamName: null, dpoyPlayerId: null, royPlayerId: null, fmvpPlayerId: null,
  teamSeasons: Object.entries(wins).map(([id, w]) => summary(id, id === 'A' ? 'Alphas' : id === 'B' ? 'Betas' : 'Cellar', w)),
});
const base = (): League => ({ teams: [team('A', 'Alphas'), team('B', 'Betas'), team('C', 'Cellar')], schedule: [], settings: { ...DEFAULT_GAME_SETTINGS }, season: '2030' } as League);

describe('Dynasty Mode', () => {
  it('starts with an owner for every team and the league office open', () => {
    const l = startDynasty(base());
    expect(Object.keys(l.dynasty!.owners)).toEqual(['A', 'B', 'C']);
    expect(l.leagueOffice).toBeTruthy();
    expect(l.dynasty!.startSeason).toBe('2030');
  });
  it('a long-losing AI team gets sold sooner or later, never yours', () => {
    let sold = 0, mine = 0;
    for (let y = 2030; y < 2060; y++) {
      const l = { ...startDynasty(base()), season: String(y + 1), franchiseHistory: [0, 1, 2, 3, 4].map(i => rec(String(y - i), 'A', 'Star', { A: 60, B: 50, C: 15 })) };
      const next = dynastySeasonEnd(l, String(y), 'C');
      const ev = next.leagueOffice!.events.filter(e => e.kind === 'sale');
      sold += ev.length; mine += ev.filter(e => e.teamId === 'C').length;
      expect(ev.length).toBeLessThanOrEqual(1);
    }
    expect(mine).toBe(0);
    expect(sold).toBeGreaterThanOrEqual(0);
  });
  it('writes a chapter per decade with dynasties and MVPs', () => {
    const l = { ...base(), franchiseHistory: [rec('2031', 'A', 'Star', { A: 64, B: 40, C: 20 }), rec('2032', 'A', 'Star', { A: 66, B: 41, C: 19 }), rec('2033', 'B', 'Other', { A: 50, B: 55, C: 22 }), rec('2041', 'B', 'Other', { A: 30, B: 60, C: 40 })] } as League;
    const book = historyBook(l);
    expect(book.map(c => c.title)).toEqual(['The 2030s', 'The 2040s']);
    expect(book[0].dynasties).toEqual([{ team: 'Alphas', titles: 2 }]);
    expect(book[0].mvps[0]).toEqual({ player: 'Star', times: 2 });
    expect(book[0].bestTeam).toMatchObject({ team: 'Alphas', wins: 66 });
    expect(book[0].story[0]).toContain('Alphas');
  });
});
