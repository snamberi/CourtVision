import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { generateConferencePlayoffBracket, simulateFullPlayoffs } from '../simulation/playoffs';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
import { computeFinalsMVP, computeSeasonAwards } from '../simulation/awards';
import { almanacSeason, almanacSeasons, awardVote, compactBracket, voteRows } from '../simulation/almanac';

describe('league almanac and awards night', () => {
  it('awards votes are deterministic, total 100 first-place votes, and shares fall in [0, 1]', () => {
    const { league } = generateFullLeague(51, 30, 13, 20, '2026');
    const played = simulateRemainingSeason(league, 3);
    const awards = computeSeasonAwards(played, { minGames: 5 });
    // The panel's saved vote decides the award.
    const saved = awards.votes!.mvp!;
    expect(computeSeasonAwards(played, { minGames: 5 }).votes!.mvp).toEqual(saved);
    expect(saved.lines.reduce((n, l) => n + l.firstVotes, 0)).toBe(100);
    expect(saved.lines.reduce((n, l) => n + l.points, 0)).toBe(100 * (10 + 7 + 5 + 3 + 1));
    expect(saved.lines.every(l => l.share >= 0 && l.share <= 1)).toBe(true);
    expect(awards.mvp!.playerId).toBe(saved.lines[0].id);
    expect(voteRows(awards, 'mvp', '2026')[0]).toMatchObject({ playerId: saved.lines[0].id, first: saved.lines[0].firstVotes });
    // Older saves without a saved vote still get a (labeled) estimate from the final ballot.
    const ballot = awards.ballots.mvp.map(({ voteShare: _s, firstVotes: _f, points: _p, ...w }) => w);
    const votes = awardVote(ballot, '2026|mvp');
    expect(awardVote(ballot, '2026|mvp')).toEqual(votes);
    expect(votes.reduce((n, v) => n + v.first, 0)).toBe(100);
    expect(votes[0].points).toBeGreaterThanOrEqual(votes[1].points);
    expect(voteRows({ ...awards, votes: undefined, ballots: { ...awards.ballots, mvp: ballot } }, 'mvp', '2026').every(r => r.estimated)).toBe(true);
  }, 60_000);

  it('archives a compact bracket and seeds, and builds a full page for a finished season', () => {
    const { league, extras } = generateFullLeague(52, 30, 13, 20, '2026');
    const played = simulateRemainingSeason(league, 4);
    const finished = simulateFullPlayoffs(generateConferencePlayoffBracket(played), played, 5);
    const finals = finished.bracket.rounds.at(-1)![0];
    const champion = finished.league.teams.find(t => t.teamId === finished.bracket.championTeamId)!;
    const { league: next, extras: nextExtras } = beginNewSeasonRoster(finished.league, extras, 6, { minGames: 5 },
      { teamId: champion.teamId, teamName: champion.name, fmvp: computeFinalsMVP(finals, finished.league) });

    const record = next.franchiseHistory!.at(-1)!;
    expect(record.bracket?.championTeamId).toBe(champion.teamId);
    expect(record.bracket!.rounds.flat().every(s => s.games.length === 0)).toBe(true);
    expect(record.bracket!.playIn?.every(g => g.result === undefined)).toBe(true);
    expect(Object.keys(record.seeds ?? {}).length).toBe(30);

    expect(almanacSeasons(next)).toContain(record.season);
    const page = almanacSeason(next, nextExtras, record.season, () => null)!;
    expect(page.inProgress).toBe(false);
    expect(page.championTeamId).toBe(champion.teamId);
    expect(page.standings).toHaveLength(30);
    expect(page.awards?.mvp).toBeTruthy();
    const ppg = page.leaders.find(l => l.key === 'ppg')!;
    expect(ppg.rows.length).toBe(5);
    expect(ppg.rows[0].value).toBeGreaterThanOrEqual(ppg.rows[4].value);
  }, 60_000);

  it('compactBracket strips box scores but keeps results', () => {
    const { league } = generateFullLeague(53, 30, 13, 10, '2026');
    const played = simulateRemainingSeason(league, 7);
    const finished = simulateFullPlayoffs(generateConferencePlayoffBracket(played), played, 8);
    const small = compactBracket(finished.bracket);
    expect(JSON.stringify(small).length).toBeLessThan(JSON.stringify(finished.bracket).length / 20);
    expect(small.rounds.flat().map(s => s.winnerTeamId)).toEqual(finished.bracket.rounds.flat().map(s => s.winnerTeamId));
  }, 60_000);
});
