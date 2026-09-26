import { beforeAll, describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { hasConferenceStructure, isAllStarBreakPending, simulateFullRound, type League } from '../simulation/league';
import { autoRunAllStarWeekend } from '../simulation/autoPlay';
import {
  AWARD_GAMES_SHARE, DEFAULT_AWARD_SETTINGS, computeSeasonAwards, gamesNeeded, normalizeAwardSettings, positionGroup, VOTED_BALLOTS,
} from '../simulation/awards';
import { panelVote } from '../simulation/awardVoting';
import { periodHonors } from '../simulation/awardRace';
import { lockAllStarVoting } from '../simulation/allStarVoting';
import { risingStarsRosters, simulateRisingStars } from '../simulation/allStarGame';
import { previousSeasonsPlayed } from '../simulation/rookieEligibility';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
import { getPlayerAwardsHistory, teamTrophyEntries } from '../simulation/leagueAnalytics';
import { buildHallOfFameCase } from '../simulation/hallOfFame';
import { generateNewsFeed } from '../simulation/news';
import { TROPHIES, TROPHY_ORDER } from '../simulation/trophies';
import { trophyGridProblems, trophyRects } from '../visuals/trophyArt';
import type { GMLeagueExtras } from '../simulation/gm';

/** Plays every regular-season game day, running the All-Star break when it comes. */
function playSeason(league: League, seed: number): League {
  let current = league;
  for (let guard = 0; guard < 400 && current.schedule.some(g => !g.played); guard++) {
    if (isAllStarBreakPending(current)) { current = autoRunAllStarWeekend(current, DEFAULT_AWARD_SETTINGS, seed).league; continue; }
    const next = simulateFullRound(current, seed);
    if (next === current) break;
    current = next;
  }
  return current;
}

let season: League;
let extras: GMLeagueExtras;
beforeAll(() => {
  const gen = generateFullLeague(404, 30, 13, 30, '2026');
  season = playSeason(gen.league, 11);
  extras = gen.extras;
}, 120_000);

describe('the voting panel', () => {
  it('is deterministic, hands out every ballot point, and names co-winners on an exact tie', () => {
    const awards = computeSeasonAwards(season);
    for (const key of ['mvp', 'dpoy', 'roy', 'smoy', 'cpoy'] as const) {
      const vote = awards.votes![key]!;
      const places = vote.pointsByPlace;
      // Lines are trimmed to the leaders, so the totals are an upper bound — and first-place votes all land in the top lines.
      expect(vote.lines.reduce((n, l) => n + l.firstVotes, 0)).toBe(100);
      expect(vote.lines.reduce((n, l) => n + l.points, 0)).toBeLessThanOrEqual(100 * places.reduce((a, b) => a + b, 0));
      expect(awards[key]!.playerId).toBe(vote.lines[0].id);
      for (let i = 1; i < vote.lines.length; i++) expect(vote.lines[i - 1].points).toBeGreaterThanOrEqual(vote.lines[i].points);
      expect(vote.notes!.length).toBeGreaterThan(1);
    }
    expect(computeSeasonAwards(season).votes).toEqual(awards.votes);
    // Voted ballots carry their share and first-place votes.
    for (const key of VOTED_BALLOTS) for (const w of awards.ballots[key]) expect(w.voteShare).toBeGreaterThanOrEqual(0);

    // Two voters who may each only vote for one candidate: 1 point apiece, a dead heat.
    const tie = panelVote('t', [{ id: 'A', teamId: null, teamName: '', score: 10 }, { id: 'B', teamId: null, teamName: '', score: 10 }],
      { voters: 2, points: [1], canVote: (v, c) => (v === 0 ? c.id === 'A' : c.id === 'B') });
    expect(tie.winners.sort()).toEqual(['A', 'B']);
  });

  it('shares a stat title on an exact tie and credits both players', () => {
    const top = computeSeasonAwards(season).scoringChamp!;
    const tied = structuredClone(season);
    const players = tied.teams.flatMap(t => t.seasons).filter(s => (s.seasonStats?.gamesPlayed ?? 0) > 0);
    const leader = players.find(p => p.playerId === top.playerId)!;
    const other = players.find(p => p.playerId !== top.playerId && p.seasonStats!.gamesPlayed === leader.seasonStats!.gamesPlayed)!;
    other.seasonStats = { ...other.seasonStats!, points: leader.seasonStats!.points };
    const awards = computeSeasonAwards(tied);
    const champs = [awards.scoringChamp!.playerId, ...(awards.coWinners?.scoringChamp ?? []).map(w => w.playerId)].sort();
    expect(champs).toEqual([leader.playerId, other.playerId].sort());
  });

  it('builds All-League and All-Defense teams of two guards, two forwards and a center', () => {
    const awards = computeSeasonAwards(season);
    expect(awards.allNBA).toHaveLength(3);
    for (const team of [...awards.allNBA, ...awards.allDefense]) {
      expect(team).toHaveLength(5);
      const count = (p: string) => team.filter(w => w.position === p).length;
      expect(count('G')).toBeLessThanOrEqual(2); expect(count('C')).toBeLessThanOrEqual(1);
      expect(count('G') + count('F') + count('C')).toBe(5);
    }
    const ids = awards.allNBA.flat().map(w => w.playerId);
    expect(new Set(ids).size).toBe(15);
    const byId = new Map(season.teams.flatMap(t => t.seasons.map(s => [s.playerId, s])));
    // Positions come from the player's best position.
    for (const w of awards.allNBA[0]) expect(['G', 'F', 'C']).toContain(positionGroup(byId.get(w.playerId)!));
  });

  it('lets front offices vote for Executive of the Year, never for themselves, and flags a win by your team', () => {
    const awards = computeSeasonAwards(season);
    const vote = awards.votes!.eoy!;
    expect(vote.voters).toBe(30);
    expect(vote.lines.reduce((n, l) => n + l.firstVotes, 0)).toBe(30);
    expect(awards.eoy!.userTeam).toBe(false);
    const mine = computeSeasonAwards({ ...season, coachingUserTeamId: awards.eoy!.teamId });
    expect(mine.eoy!.userTeam).toBe(true);
    expect(awards.coy!.detail!.expectedWins).toBeGreaterThan(0);
  });
});

describe('eligibility', () => {
  it('scales the games minimum with the season and pro-rates it mid-season', () => {
    const full = computeSeasonAwards(season);
    expect(full.minGamesRequired).toBe(gamesNeeded(30, AWARD_GAMES_SHARE));
    expect(full.minGamesRequired).toBe(24);
    expect(full.statMinGames).toBe(22);
    expect(full.rookieMinGames).toBe(15);
    expect(gamesNeeded(82, AWARD_GAMES_SHARE)).toBe(65);
    const byId = new Map(season.teams.flatMap(t => t.seasons.map(s => [s.playerId, s])));
    expect(byId.get(full.mvp!.playerId)!.seasonStats!.gamesPlayed).toBeGreaterThanOrEqual(24);
    const early = generateFullLeague(405, 30, 13, 30, '2026').league;
    let mid = early;
    for (let r = 0; r < 10; r++) mid = simulateFullRound(mid, 3);
    expect(computeSeasonAwards(mid).minGamesRequired).toBe(gamesNeeded(10, AWARD_GAMES_SHARE));
  });

  it('keeps award settings with the league and repairs malformed ones', () => {
    expect(normalizeAwardSettings(undefined)).toEqual(DEFAULT_AWARD_SETTINGS);
    const fixed = normalizeAwardSettings({ minGamesShare: 7, allStarCount: -3, mvpWeights: { ppg: Number.NaN } as never });
    expect(fixed.minGamesShare).toBe(1);
    expect(fixed.allStarCount).toBe(4);
    expect(fixed.mvpWeights.ppg).toBe(DEFAULT_AWARD_SETTINGS.mvpWeights.ppg);
    const saved: League = JSON.parse(JSON.stringify({ ...season, awardSettings: { ...DEFAULT_AWARD_SETTINGS, minGamesShare: 0.5 } }));
    expect(normalizeAwardSettings(saved.awardSettings).minGamesShare).toBe(0.5);
  });
});

describe('in-season races', () => {
  it('saves a weekly ladder and Players of the Week and Month for each conference', () => {
    const race = season.awardRace!;
    expect(race.season).toBe(season.season);
    expect(race.ladder.length).toBeGreaterThan(3);
    expect(race.ladder.at(-1)!.races.mvp!.length).toBe(10);
    const weeks = race.honors.filter(h => h.kind === 'week');
    const months = race.honors.filter(h => h.kind === 'month');
    expect(weeks.length).toBe(race.ladder.length * 2);
    expect(months.length).toBeGreaterThan(0);
    const confOf = new Map(season.teams.map(t => [t.teamId, t.conferenceId]));
    for (const h of race.honors) expect(confOf.get(h.teamId)).toBe(h.conference);
    // Player of the Month now comes from the monthly honors.
    const awards = computeSeasonAwards(season);
    expect(months.some(h => h.playerId === awards.playerOfTheMonth!.playerId)).toBe(true);
    // News reports them.
    expect(generateNewsFeed(season, extras, 2000).some(n => /Player of the Week/.test(n.headline))).toBe(true);
  });

  it('names one honoree league-wide when there are no conferences', () => {
    const flat: League = { ...season, teams: season.teams.map(t => ({ ...t, conferenceId: undefined })) };
    const honors = periodHonors(flat, 'week', 'Week 1', '2026-10-21', '2026-10-27', 0, 3);
    expect(honors).toHaveLength(1);
    expect(honors[0].conference).toBeNull();
  });
});

describe('All-Star Weekend', () => {
  it('picks All-Stars by conference: two backcourt and three frontcourt starters each', () => {
    const fresh = generateFullLeague(406, 30, 13, 30, '2026').league;
    let mid = fresh;
    for (let r = 0; r < 12; r++) mid = simulateFullRound(mid, 5);
    expect(hasConferenceStructure(mid)).toBe(true);
    const selected = lockAllStarVoting(mid, 24).allStarWeekend!.voting!.selected!;
    for (const conf of ['east', 'west'] as const) {
      const mine = selected.filter(w => w.conference === conf);
      expect(mine).toHaveLength(12);
      expect(mine.filter(w => w.starter)).toHaveLength(5);
    }
    expect(selected.slice(0, 10).every(w => w.starter)).toBe(true);
  });

  it('plays a Rising Stars game of rookies against second-year players', () => {
    const game = simulateRisingStars(season, 9)!;
    expect(game).toBeTruthy();
    const byId = new Map(season.teams.flatMap(t => t.seasons.map(s => [s.playerId, s])));
    expect(game.squadA.playerIds.every(id => previousSeasonsPlayed(byId.get(id)!) === 0)).toBe(true);
    expect(game.squadB.playerIds.every(id => previousSeasonsPlayed(byId.get(id)!) === 1)).toBe(true);
    expect(risingStarsRosters(season).rookies.length).toBeGreaterThanOrEqual(5);
    expect(season.allStarWeekend?.risingStars ?? null).not.toBeUndefined();
  });
});

describe('archiving and honors', () => {
  it('saves the votes and honors with the season, clears the race, and fills trophy shelves', () => {
    const { league: next } = beginNewSeasonRoster(season, extras, 7, {}, { teamId: season.teams[0].teamId, teamName: season.teams[0].name, fmvp: null });
    const record = next.franchiseHistory!.at(-1)!;
    expect(record.fullAwards!.votes!.mvp!.lines.length).toBeGreaterThan(0);
    expect(record.fullAwards!.honors!.length).toBeGreaterThan(0);
    expect(next.awardRace).toBeUndefined();
    const mvp = record.fullAwards!.mvp!.playerId;
    expect(getPlayerAwardsHistory(next, mvp).some(e => e.key === 'mvp')).toBe(true);
    const pomWinner = record.fullAwards!.honors!.find(h => h.kind === 'month')!.playerId;
    expect(getPlayerAwardsHistory(next, pomWinner).some(e => e.key === 'pom')).toBe(true);
    expect(teamTrophyEntries(next, season.teams[0].teamId).some(e => e.key === 'champion')).toBe(true);
    if (season.allStarWeekend?.risingStarsMvp) expect(record.risingStarsMVPPlayerId).toBe(season.allStarWeekend.risingStarsMvp.playerId);
  });

  it('weights Hall of Fame hardware by prestige: one MVP outweighs a pile of Player of the Week honors', () => {
    const base = season.teams[0].seasons[0];
    const record = { playerId: base.playerId, finalTeamId: 'A', finalTeamName: 'Alpha', finalSeason: '2030-31', finalAge: 36, finalOverall: 70 };
    const history = (awards: object) => ({ ...season, franchiseHistory: [{ season: '2026', championTeamId: null, championTeamName: null, mvpPlayerId: null, mvpTeamName: null, dpoyPlayerId: null, royPlayerId: null, fmvpPlayerId: null,
      fullAwards: { mvp: null, dpoy: null, roy: null, mip: null, smoy: null, coy: null, allNBA: [], allDefense: [], allRookie: [], allStars: [], cpoy: null, hustle: null, teammate: null,
        scoringChamp: null, reboundingChamp: null, assistsChamp: null, stealsChamp: null, blocksChamp: null, playerOfTheMonth: null, ballots: {}, minGamesRequired: 1, ...awards } }] }) as League;
    const w = { playerId: base.playerId, teamId: 'A', teamName: 'A', score: 1 };
    const mvp = buildHallOfFameCase(base, record, history({ mvp: w }));
    const weeks = buildHallOfFameCase(base, record, history({ honors: Array.from({ length: 8 }, (_, i) => ({ kind: 'week', label: `Week ${i + 1}`, playerId: base.playerId })) }));
    expect(mvp.awardScore).toBe(TROPHIES.mvp.prestige);
    expect(weeks.awardScore).toBe(Math.round(8 * TROPHIES.pow.prestige));
    expect(mvp.score).toBeGreaterThan(weeks.score);
    expect(mvp.resume.some(r => r.includes('MVP'))).toBe(true);
  });
});

describe('pixel trophies', () => {
  it('draws every award on the 16×20 grid', () => {
    expect(trophyGridProblems()).toEqual([]);
    for (const key of TROPHY_ORDER) {
      const rects = trophyRects(key);
      expect(rects.length).toBeGreaterThan(20);
      for (const r of rects) { expect(r.x + r.w).toBeLessThanOrEqual(16); expect(r.y).toBeLessThan(20); }
    }
    expect(new Set(TROPHY_ORDER).size).toBe(Object.keys(TROPHIES).length);
  });
});
