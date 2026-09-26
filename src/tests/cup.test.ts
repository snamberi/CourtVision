import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { computeStandings, simulateRemainingSeason, simulateRounds } from '../simulation/league';
import { generateConferencePlayoffBracket, simulateFullPlayoffs } from '../simulation/playoffs';
import { beginNewSeasonRoster, finalizeNewSeasonSchedule } from '../simulation/seasonTransition';
import { computeFinalsMVP } from '../simulation/awards';
import { getPlayerAwardsHistory, teamTrophyEntries } from '../simulation/leagueAnalytics';
import { generateNewsFeed } from '../simulation/news';
import { cupGroupStageComplete, cupGroupTable, cupLines, setupCup } from '../simulation/cup';

describe('In-Season Cup', () => {
  const { league: base, extras } = generateFullLeague(61, 30, 13, 82, '2026');
  const league = setupCup(base);
  const cup = league.cup!;

  it('draws six groups of five within the conferences and tags one early meeting per pair', () => {
    expect(cup.groups).toHaveLength(6);
    expect(cup.groups.every(g => g.teamIds.length === 5)).toBe(true);
    expect(new Set(cup.groups.flatMap(g => g.teamIds)).size).toBe(30);
    for (const g of cup.groups) for (const id of g.teamIds) expect(league.teams.find(t => t.teamId === id)!.conferenceId).toBe(g.conference);
    const tagged = league.schedule.filter(g => g.cupGroupId);
    expect(tagged).toHaveLength(60); // every pairing once: four group games per team
    // Same schedule, same number of games: the Cup only labels existing games.
    expect(league.schedule).toHaveLength(base.schedule.length);
    expect(setupCup(league)).toBe(league); // once per season
    expect(setupCup(base).cup).toEqual(cup); // deterministic
  });

  it('plays the knockouts the night the group stage ends, without touching standings', () => {
    let l = league;
    for (let i = 0; i < 200 && !l.cup!.knockout; i++) l = simulateRounds(l, 1, 7);
    expect(cupGroupStageComplete(l)).toBe(true);
    const c = l.cup!;
    expect(c.qualifiers).toHaveLength(8);
    for (const g of c.groups) expect(c.qualifiers).toContain(cupGroupTable(l, g)[0].teamId); // every group winner
    expect(c.knockout!.filter(g => g.stage === 'qf')).toHaveLength(4);
    expect(c.knockout!.filter(g => g.stage === 'sf')).toHaveLength(2);
    const final = c.knockout!.find(g => g.stage === 'final')!;
    expect([final.homeTeamId, final.awayTeamId]).toContain(c.championTeamId);
    expect(c.runnerUpTeamId).not.toBe(c.championTeamId);
    // East vs West final.
    const conf = (id: string) => l.teams.find(t => t.teamId === id)!.conferenceId;
    expect(conf(final.homeTeamId)).not.toBe(conf(final.awayTeamId));
    expect(l.teams.find(t => t.teamId === c.championTeamId)!.seasons.map(s => s.playerId)).toContain(c.mvpId);
    expect(c.allCup).toHaveLength(5);
    // Standings count only scheduled games.
    const played = l.schedule.filter(g => g.played).length;
    expect(computeStandings(l).reduce((n, r) => n + r.wins, 0)).toBe(played);
    expect(cupLines(l).some(x => x.playerId === c.mvpId)).toBe(true);
    expect(generateNewsFeed(l, extras, 500).some(n => n.id.endsWith('cup:champion'))).toBe(true);
  });

  it('shorter seasons still hold a Cup', () => {
    const short = setupCup(generateFullLeague(63, 30, 13, 30, '2026').league);
    expect(short.schedule.filter(g => g.cupGroupId).length).toBeGreaterThan(40);
  });

  it('archives the Cup with the season, credits trophies and draws a new Cup next season', () => {
    const played = simulateRemainingSeason(league, 9);
    const c = played.cup!;
    expect(c.championTeamId).toBeTruthy();
    const finished = simulateFullPlayoffs(generateConferencePlayoffBracket(played), played, 10);
    const finals = finished.bracket.rounds.at(-1)![0];
    const champ = finished.league.teams.find(t => t.teamId === finished.bracket.championTeamId)!;
    const next = beginNewSeasonRoster(finished.league, extras, 11, { minGames: 5 }, { teamId: champ.teamId, teamName: champ.name, fmvp: computeFinalsMVP(finals, finished.league) });
    const record = next.league.franchiseHistory!.at(-1)!;
    expect(record.cup?.championTeamId).toBe(c.championTeamId);
    expect(next.league.cup).toBeUndefined();
    expect(teamTrophyEntries(next.league, c.championTeamId!).some(e => e.key === 'cup')).toBe(true);
    expect(getPlayerAwardsHistory(next.league, c.mvpId!).map(e => e.key)).toContain('cupMvp');
    const started = finalizeNewSeasonSchedule({ ...next.league, seasonPhase: 'preseason' });
    expect(started.cup?.season).toBe(started.season);
    expect(started.schedule.some(g => g.cupGroupId)).toBe(true);
  });

  it('skips leagues too small or seasons too far along', () => {
    const small = generateFullLeague(62, 6, 12, 10, '2026').league;
    expect(setupCup(small).cup).toBeUndefined();
    const late = simulateRounds(base, Math.ceil(Math.max(...base.schedule.map(g => g.round)) * 0.5), 3);
    expect(setupCup(late).cup).toBeUndefined();
  });
});
