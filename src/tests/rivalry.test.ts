import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason, type FranchiseHistoryRecord } from '../simulation/league';
import { generateConferencePlayoffBracket, simulateFullPlayoffs } from '../simulation/playoffs';
import { archiveRivalries, dynasties, rivalryTable, recordRivalryTrade, rivalryKey } from '../simulation/rivalry';
import { generateNewsFeed } from '../simulation/news';

const rec = (season: string, champ: string | null): FranchiseHistoryRecord => ({ season, championTeamId: champ, championTeamName: champ, mvpPlayerId: null, mvpTeamName: null, dpoyPlayerId: null, royPlayerId: null, fmvpPlayerId: null });

describe('rivalries and dynasties', () => {
  it('playoff meetings create the hottest rivalries, and archived heat cools each season', () => {
    const { league } = generateFullLeague(61, 30, 13, 20, '2026');
    const played = simulateRemainingSeason(league, 2);
    const finished = simulateFullPlayoffs(generateConferencePlayoffBracket(played), played, 3).league;
    const table = rivalryTable(finished);
    expect(table.length).toBeGreaterThan(0);
    const finals = finished.playoffBracket!.rounds.at(-1)![0];
    const finalsPair = table.find(r => r.a === [finals.teamAId!, finals.teamBId!].sort()[0] && r.b === [finals.teamAId!, finals.teamBId!].sort()[1])!;
    expect(finalsPair.series).toBe(1);
    expect(table.indexOf(finalsPair)).toBeLessThan(15);
    // Series results are consistent: every series has exactly one winner.
    for (const r of table) expect(r.seriesWinsA + r.seriesWinsB).toBe(r.series);

    const archived = archiveRivalries(finished);
    const k = rivalryKey(finals.teamAId!, finals.teamBId!);
    expect(archived[k].series).toBe(1);
    // A second rollover with no new games only decays heat.
    const cooled = archiveRivalries({ ...finished, schedule: [], playoffBracket: undefined, rivalries: archived });
    expect(cooled[k].heat).toBeLessThan(archived[k].heat);
    expect(cooled[k].series).toBe(1);
  }, 60_000);

  it('notable trades add heat', () => {
    const { league } = generateFullLeague(62, 30, 13, 10, '2026');
    const [a, b] = league.teams;
    const after = recordRivalryTrade(league, a.teamId, b.teamId, true);
    expect(after.rivalries?.[rivalryKey(a.teamId, b.teamId)]?.trades).toBe(1);
    expect(recordRivalryTrade(league, a.teamId, b.teamId, false)).toBe(league);
  });

  it('three titles within five seasons is a dynasty, and it makes the news', () => {
    const history = [rec('2026', 'A'), rec('2027', 'B'), rec('2028', 'A'), rec('2029', 'C'), rec('2030', 'A'), rec('2031', 'A'), rec('2032', 'B'), rec('2033', 'B')];
    const d = dynasties(history);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ teamId: 'A', from: '2026', to: '2031', titles: ['2026', '2028', '2030', '2031'] });
    expect(dynasties([rec('2026', 'A'), rec('2027', 'B'), rec('2028', 'C'), rec('2029', 'D'), rec('2030', 'A'), rec('2031', 'A')])).toHaveLength(0);

    const { league, extras } = generateFullLeague(63, 4, 8, 4, '2034');
    const news = generateNewsFeed({ ...league, franchiseHistory: history }, extras, 500);
    expect(news.some(n => n.id.includes('dynasty:A:2030') && n.headline.includes('dynasty'))).toBe(true);
  });
});
