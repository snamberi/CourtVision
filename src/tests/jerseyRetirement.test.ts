import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { retireLegendJerseys } from '../simulation/jerseyRetirement';
import type { RetiredPlayerRecord } from '../simulation/league';
import type { CareerSeasonRecord, PlayerSeason } from '../simulation/types';
import { emptySeasonStatTotals, emptySeasonMilestones } from '../simulation/types';
import { generateNewsFeed } from '../simulation/news';

const { league, extras } = generateFullLeague(4, 6, 10, 4, '2030');
const player = league.teams[1].seasons[0];
const career = (teamId: string, n: number, overall: number, from = 2019): CareerSeasonRecord[] => Array.from({ length: n }, (_, i) => ({
  season: String(from + i), teamId, age: 24 + i, overall, stats: emptySeasonStatTotals(), milestones: emptySeasonMilestones(),
}));
const retiree = (history: CareerSeasonRecord[], data: Partial<PlayerSeason> = {}): RetiredPlayerRecord => ({
  playerId: player.playerId, finalTeamId: history.at(-1)!.teamId!, finalTeamName: 'x', finalSeason: '2029', finalAge: 34, finalOverall: 70,
  finalSeasonData: { ...player, jerseyNumber: 23, careerHistory: history, ...data },
});

describe('AI jersey retirement', () => {
  it('a long-time star gets his number raised by the team he spent most seasons with', () => {
    const t = league.teams[1].teamId;
    const r = retiree([...career('GEN02', 2, 70, 2017), ...career(t, 10, 80)]);
    const out = retireLegendJerseys(league, [r], league.teams[0].teamId, '2029');
    expect(out.honors).toHaveLength(1);
    const team = out.league.teams.find(x => x.teamId === t)!;
    expect(team.retiredJerseys).toEqual([{ number: 23, playerId: player.playerId, season: '2029' }]);
    expect(generateNewsFeed(out.league, extras, 500).some(n => n.headline === `${team.name} retire #23 for ${player.playerId}.`)).toBe(true);
    // Once only; and never decided for your own team.
    expect(retireLegendJerseys(out.league, [r], null, '2029').honors).toHaveLength(0);
    expect(retireLegendJerseys(league, [r], t, '2029').honors).toHaveLength(0);
  });

  it('a journeyman or a short stay does not', () => {
    expect(retireLegendJerseys(league, [retiree(career(league.teams[1].teamId, 10, 66))], null, '2029').honors).toHaveLength(0);
    expect(retireLegendJerseys(league, [retiree(career(league.teams[1].teamId, 4, 85))], null, '2029').honors).toHaveLength(0);
  });
});
