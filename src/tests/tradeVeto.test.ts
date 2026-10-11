import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { tradeVeto } from '../simulation/personality';
import type { League } from '../simulation/league';

const { league: base } = generateFullLeague(12, 30, 13, 4, '2026');
// The first team has lost twelve straight; the second has won twelve straight.
const bad = base.teams[0].teamId, good = base.teams[1].teamId;
const games = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, round: i, homeTeamId: good, awayTeamId: bad, played: true, result: { homeScore: 110, awayScore: 100 } }));
const league = { ...base, schedule: [...games, ...base.schedule.filter(g => g.homeTeamId !== bad && g.awayTeamId !== bad && g.homeTeamId !== good && g.awayTeamId !== good)] } as League;
const vets = league.teams.slice(2).flatMap(t => t.seasons).map(p => ({ ...p, age: 32 }));

describe('trade personalities', () => {
  it('some veteran stars refuse a trade to a losing team, not to a decent one', () => {
    const refusers = vets.filter(p => tradeVeto(p, bad, league));
    expect(refusers.length).toBeGreaterThan(0);
    expect(refusers.length).toBeLessThan(vets.length / 2);
    expect(tradeVeto(refusers[0], good, league) ?? '').not.toMatch(/refuses/);
    expect(tradeVeto(refusers[0], bad, league)).toMatch(/refuses a trade/);
  });
  it('a player who asked out, or a young one, takes any exit', () => {
    const star = vets.find(p => tradeVeto(p, bad, league))!;
    expect(tradeVeto({ ...star, morale: { ...(star.morale ?? { score: 30 }), tradeRequest: '2026' } as typeof star.morale }, bad, league)).toBeNull();
    expect(tradeVeto({ ...star, age: 24 }, bad, league)).toBeNull();
  });
});
