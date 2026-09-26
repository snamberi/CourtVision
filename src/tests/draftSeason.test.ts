import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason, type League } from '../simulation/league';
import { generateConferencePlayoffBracket, simulateFullPlayoffs } from '../simulation/playoffs';
import { beginNewSeasonRoster, finalizeNewSeasonSchedule } from '../simulation/seasonTransition';
import { computeFinalsMVP } from '../simulation/awards';
import { simEntireDraft } from '../simulation/aiGM';
import type { GMLeagueExtras } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { classHonors, collegeSeason, collegeSeasonToDate } from '../simulation/collegeSeason';
import { canPlaySummerLeague, ensureUpcomingDraftClass, mockDraft, rookieScale, seasonProgress, simulateSummerLeague, summerStandings } from '../simulation/draftSeason';

function finishSeason(league: League, extras: GMLeagueExtras, seed: number) {
  const played = simulateRemainingSeason(league, seed);
  const finished = simulateFullPlayoffs(generateConferencePlayoffBracket(played), played, seed + 1);
  const finals = finished.bracket.rounds.at(-1)![0];
  const champion = finished.league.teams.find(t => t.teamId === finished.bracket.championTeamId)!;
  return beginNewSeasonRoster(finished.league, extras, seed + 2, { minGames: 5 }, { teamId: champion.teamId, teamName: champion.name, fmvp: computeFinalsMVP(finals, finished.league) });
}

describe('draft season', () => {
  const { league, extras } = generateFullLeague(91, 30, 13, 10, '2026');

  it('gives every prospect a deterministic, plausible pre-draft season that tracks talent', () => {
    for (const p of extras.draftClass) {
      const s = collegeSeason(p.trueSeason);
      expect(collegeSeason(p.trueSeason)).toEqual(s);
      expect(s.gp).toBeGreaterThan(0); expect(s.gp).toBeLessThanOrEqual(s.totalGames);
      for (const v of [s.ppg, s.rpg, s.apg, s.spg, s.bpg, s.mpg]) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); }
      for (const v of [s.fgPct, s.tpPct, s.ftPct]) { expect(v).toBeGreaterThan(0.1); expect(v).toBeLessThan(1); }
      expect(s.team).toBeTruthy();
      expect(s.level === 'college' ? !!p.trueSeason.college : !p.trueSeason.college).toBe(true);
    }
    // Better prospects score more on average.
    const college = extras.draftClass.filter(p => p.trueSeason.college);
    const sorted = [...college].sort((a, b) => calculateOverall(b.trueSeason) - calculateOverall(a.trueSeason));
    const avg = (list: typeof college) => list.reduce((n, p) => n + collegeSeason(p.trueSeason).ppg, 0) / list.length;
    expect(avg(sorted.slice(0, 10))).toBeGreaterThan(avg(sorted.slice(-10)));
    expect(collegeSeasonToDate(collegeSeason(college[0].trueSeason), 0).gp).toBe(0);
    const honors = classHonors(extras.draftClass);
    expect([...honors.values()].flat()).toContain('National Player of the Year');
  });

  it('keeps the scouted class for the draft and puts next year\'s class on the board when the season starts', () => {
    const scouted = extras.draftClass.map(p => p.playerId);
    const withWorkout = { ...extras, draftWorkouts: { [league.teams[0].teamId]: [scouted[0]] } };
    const next = finishSeason(league, withWorkout, 5);
    expect(next.extras.draftClass.map(p => p.playerId)).toEqual(scouted);
    expect(next.extras.draftWorkouts?.[league.teams[0].teamId]).toEqual([scouted[0]]);
    // No class is invented outside the regular season.
    expect(ensureUpcomingDraftClass(next.league, { ...next.extras, draftClass: [], draftDayOpen: false })).toMatchObject({ draftClass: [] });

    const drafted = simEntireDraft(next.league, next.extras);
    const started = finalizeNewSeasonSchedule({ ...drafted.league, seasonPhase: 'preseason' });
    const upcoming = ensureUpcomingDraftClass(started, drafted.extras);
    expect(upcoming.draftClass.length).toBeGreaterThan(50);
    expect(upcoming.draftClass.every(p => p.trueSeason.season === '2028')).toBe(true);
    expect(ensureUpcomingDraftClass(started, drafted.extras).draftClass.map(p => p.playerId)).toEqual(upcoming.draftClass.map(p => p.playerId)); // deterministic
    expect(ensureUpcomingDraftClass(started, upcoming)).toBe(upcoming); // never replaced once on the board
    expect(seasonProgress(started)).toBe(0);
  });

  it('builds a full two-round mock with every prospect at most once, and a descending rookie scale', () => {
    const mock = mockDraft(league, extras);
    expect(mock).toHaveLength(60);
    expect(new Set(mock.map(m => m.prospectId)).size).toBe(60);
    const scale = rookieScale(league, extras.capSettings);
    expect(scale).toHaveLength(60);
    for (let i = 1; i < 30; i++) expect(scale[i].salary).toBeLessThanOrEqual(scale[i - 1].salary);
    expect(scale[0].years).toBe(4);
    expect(scale[30].years).toBe(2);
    expect(rookieScale({ ...league, rulesSettings: { ...league.rulesSettings!, rookieContractLengthYears: 3 } }, extras.capSettings)[0].years).toBe(3);
  });

  it('plays Summer League after the draft without touching rosters, ratings or season stats', () => {
    const next = finishSeason(league, extras, 7);
    expect(canPlaySummerLeague(next.league, next.extras)).toBe(false); // draft still open
    const drafted = simEntireDraft(next.league, next.extras);
    expect(canPlaySummerLeague(drafted.league, drafted.extras)).toBe(true);
    const mine = drafted.league.teams[3].teamId;
    const sl = simulateSummerLeague(drafted.league, drafted.extras, mine, 99);
    expect(sl.championTeamId).toBeTruthy();
    expect(sl.mvpId).toBeTruthy();
    expect(sl.allSummer).toHaveLength(5);
    const final = sl.games.filter(g => g.final);
    expect(final).toHaveLength(1);
    const table = summerStandings(sl);
    expect(table.every(r => r.w + r.l === 4)).toBe(true);
    // Your games keep box scores; others don't.
    expect(sl.games.filter(g => g.homeTeamId === mine || g.awayTeamId === mine).every(g => g.homeBox && g.awayBox)).toBe(true);
    expect(sl.games.some(g => !g.final && g.homeTeamId !== mine && g.awayTeamId !== mine && g.homeBox)).toBe(false);
    // Rookies drafted this year played.
    const rookies = (drafted.extras.draftPicksMade ?? []).map(p => p.playerId);
    expect(rookies.some(id => sl.lines[id]?.gp > 0)).toBe(true);
    expect(simulateSummerLeague(drafted.league, drafted.extras, mine, 99)).toEqual(sl); // deterministic
    const after = { ...drafted.league, summerLeague: sl };
    expect(canPlaySummerLeague(after, drafted.extras)).toBe(false); // once per offseason
  });
});
