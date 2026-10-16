// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import type { NbaHistory } from '../history/nbaHistoryData';
import type { League, FranchiseHistoryRecord, TeamSeasonSummary, PlayoffFinish } from '../simulation/league';
import type { PlayoffBracket, PlayoffSeries } from '../simulation/playoffs';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { aiUserTeam } from '../simulation/gmCareer';
import { COACH_ONLY_HIDDEN } from '../simulation/coachOnly';
import { dailyDraft, runDraft, scoreDraft, draftStreak, dailyDraftXp, saveDailyDraft, readDailyDraft, PICKS } from '../arcade/dailyDraft';
import { openSeries, scorePicks, claimPickemWins, pickemXp, PICKEM_XP } from '../profile/pickem';
import { realDynasties, leagueDynasties, rankDynasties, tierOf } from '../history/dynastyRankings';
import { mergeValue, SYNC_KEYS } from '../cloud/merge';

let h: NbaHistory;
beforeAll(async () => { h = await loadHistoryForTests(); }, 120_000);
beforeEach(() => localStorage.clear());

describe('coach-only leagues', () => {
  const league = (coachOnly: boolean) => ({ teams: [], schedule: [], settings: { ...DEFAULT_GAME_SETTINGS, coachOnly } } as unknown as League);
  it('hands your roster moves to the AI and hides the front-office pages', () => {
    expect(aiUserTeam(league(true), 'BOS')).toBeNull();
    expect(aiUserTeam(league(false), 'BOS')).toBe('BOS');
    expect(COACH_ONLY_HIDDEN).toEqual(expect.arrayContaining(['trade', 'freeAgency', 'resignWaive', 'extensions']));
    expect(COACH_ONLY_HIDDEN).not.toContain('roster');
  });
});

describe('Daily Draft', () => {
  it('gives everyone the same class and five rising pick slots each day', () => {
    const a = dailyDraft(h, '2026-10-16'), b = dailyDraft(h, '2026-10-16');
    expect(a).toEqual(b);
    expect(a.slots).toHaveLength(PICKS);
    for (let i = 1; i < a.slots.length; i++) expect(a.slots[i]).toBeGreaterThan(a.slots[i - 1]);
    expect(a.prospects.length).toBeGreaterThanOrEqual(30);
    const years = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map(d => dailyDraft(h, d).year));
    expect(years.size).toBeGreaterThan(1);
  });
  it('the rest of the league drafts in real order before each of your picks', () => {
    const d = dailyDraft(h, '2026-10-16');
    const first = runDraft(d, []);
    expect(first.onClock).toBe(d.slots[0]);
    expect(first.available[0].pick).toBe(d.slots[0]);
    // Take the best career left instead; the real pick at your slot then goes next.
    const steal = [...first.available].sort((x, y) => y.ws - x.ws)[0];
    const after = runDraft(d, [steal.pick]);
    expect(after.taken.get(steal.pick)).toBe(d.slots[0]);
    expect(after.onClock).toBe(d.slots[1]);
  });
  it('scores real careers, matches the real draft when you copy it, and saves the day', () => {
    const d = dailyDraft(h, '2026-10-16');
    const copy = scoreDraft(d, d.slots);
    expect(copy.score).toBe(copy.realScore);
    let mine: number[] = [];
    while (mine.length < d.slots.length) { const s = runDraft(d, mine); mine = [...mine, [...s.available].sort((x, y) => y.ws - x.ws)[0].pick]; }
    const greedy = scoreDraft(d, mine);
    expect(greedy.score).toBeGreaterThanOrEqual(copy.score);
    expect(greedy.score).toBeLessThanOrEqual(greedy.best);
    saveDailyDraft('2026-10-16', { picks: mine, score: greedy.score, realScore: greedy.realScore, grade: greedy.grade });
    expect(readDailyDraft()['2026-10-16'].grade).toBe(greedy.grade);
    expect(draftStreak(readDailyDraft(), '2026-10-17')).toBe(1);
    expect(draftStreak(readDailyDraft(), '2026-10-19')).toBe(0);
    expect(dailyDraftXp('A+')).toBe(70);
    expect(dailyDraftXp('F')).toBe(30);
  });
});

describe("Pick'em", () => {
  const series = (id: string, a: string, b: string, winner: string | null, played = winner ? 4 : 0): PlayoffSeries =>
    ({ id, round: 0, slot: 0, teamAId: a, teamBId: b, teamAWins: winner === a ? 4 : 0, teamBWins: winner === b ? 4 : played ? 2 : 0, gamesToWin: 4, games: [], winnerTeamId: winner });
  it('opens untouched series, scores calls, and pays XP once per right call', () => {
    const bracket: PlayoffBracket = { rounds: [[series('s1', 'A', 'B', 'A'), series('s2', 'C', 'D', 'D'), series('s3', 'E', 'F', null)]], championTeamId: null };
    expect(openSeries(bracket).map(s => s.id)).toEqual(['s3']);
    const score = scorePicks(bracket, { season: '2025', picks: { s1: 'A', s2: 'C', s3: 'E' } });
    expect(score).toEqual({ right: ['s1'], wrong: ['s2'], pending: ['s3'] });
    expect(claimPickemWins(['save:2025:s1'])).toEqual(['save:2025:s1']);
    expect(claimPickemWins(['save:2025:s1'])).toEqual([]);
    expect(pickemXp()).toBe(PICKEM_XP);
  });
});

describe('Dynasty rankings', () => {
  it('finds the famous real dynasties', () => {
    const real = realDynasties(h);
    const find = (team: string, from: number) => real.find(d => d.teamId === team && d.titles.includes(from));
    expect(find('BOS', 1960)!.titles.length).toBeGreaterThanOrEqual(10);
    expect(find('CHI', 1991)!.titles).toEqual([1991, 1992, 1993, 1996, 1997, 1998]);
    expect(find('GSW', 2017)!.titles).toEqual([2015, 2017, 2018, 2022]);
    expect(find('GSW', 2017)!.finalsLosses).toBe(2);
    expect(tierOf(find('CHI', 1991)!)).toBe('Legendary');
    const ranked = rankDynasties(real, []);
    expect(ranked.rows[0].teamId).toBe('BOS');
    expect(ranked.best).toBeNull();
  });
  it('ranks this league’s runs among the real ones and marks yours', () => {
    const summary = (teamId: string, wins: number, finish: PlayoffFinish): TeamSeasonSummary => ({ teamId, teamName: teamId === 'X' ? 'Your Team' : 'Rivals', wins, losses: 82 - wins, ppg: 0, oppPpg: 0, ortg: 0, drtg: 0, pace: 0, tpmPg: 0, apg: 0, rpg: 0, spg: 0, bpg: 0, playoffFinish: finish, playoffWins: 0, playoffLosses: 0, roster: [] });
    const rec = (season: string, champ: string, imported = false): FranchiseHistoryRecord => ({ season, championTeamId: champ, championTeamName: champ, mvpPlayerId: null, mvpTeamName: null, dpoyPlayerId: null, royPlayerId: null, fmvpPlayerId: null, imported,
      teamSeasons: [summary('X', champ === 'X' ? 66 : 55, champ === 'X' ? 'Champion' : 'Finals'), summary('Y', champ === 'Y' ? 60 : 40, champ === 'Y' ? 'Champion' : 'Missed Playoffs')] });
    const history = [rec('2020', 'Y', true), rec('2021', 'Y', true), rec('2025', 'X'), rec('2026', 'X'), rec('2027', 'Y'), rec('2028', 'X'), rec('2029', 'X'), rec('2030', 'X')];
    const mine = leagueDynasties(history, 'X');
    expect(mine).toHaveLength(1); // imported seasons stay with the real list
    expect(mine[0]).toMatchObject({ teamId: 'X', from: 2026, to: 2031, finalsLosses: 1, yours: true, teamName: 'X' });
    expect(mine[0].titles).toHaveLength(5);
    const ranked = rankDynasties(realDynasties(h), mine);
    expect(ranked.yourBest!.key).toBe(mine[0].key);
    expect(ranked.above ?? ranked.below).toBeTruthy();
    if (ranked.above) expect(ranked.above.score).toBeGreaterThanOrEqual(ranked.yourBest!.score);
  });
});

describe('cloud sync', () => {
  it("keeps every Pick'em call and each day's better Daily Draft", () => {
    expect(SYNC_KEYS).toEqual(expect.arrayContaining(['cv-pickem', 'cv-daily-draft']));
    expect(JSON.parse(mergeValue('cv-pickem', '["a","b"]', '["b","c"]')!).sort()).toEqual(['a', 'b', 'c']);
    const local = JSON.stringify({ d1: { score: 10 }, d2: { score: 5 } }), cloud = JSON.stringify({ d1: { score: 20 }, d3: { score: 1 } });
    expect(JSON.parse(mergeValue('cv-daily-draft', local, cloud)!)).toEqual({ d1: { score: 20 }, d2: { score: 5 }, d3: { score: 1 } });
  });
});
