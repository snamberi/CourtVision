import { autoPlayOneSeason } from '../simulation/autoPlay';
import { DEFAULT_AWARD_SETTINGS } from '../components/LeagueSettingsPage';
import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateGame } from '../simulation/engine/game';
import { allStarBreakRound, isAllStarBreakPending, simulateFullRound, simulateRemainingSeason, defaultCoachTendencies } from '../simulation/league';
import { allStarVoteStandings, castAllStarBallot, lockAllStarVoting } from '../simulation/allStarVoting';
import { computeSeasonAwards } from '../simulation/awards';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { formatPlayingTime } from '../simulation/boxscore';
import { createSave, getSave, deleteSave } from '../storage/saves';
import { developOffseasonLeague } from '../simulation/engine/development';

function fixture() {
  const generated = generateFullLeague(433, 4, 12, 20, '2026', { priorSeasons: false });
  generated.league.settings = { ...generated.league.settings, injuriesEnabled: false, foulFrequency: 0 };
  return generated;
}

describe('seconds-based rotations', () => {
  it('reconciles every player second with the logged lineups and period clock', () => {
    const { league } = fixture();
    const result = simulateGame({ home: league.teams[0], away: league.teams[1], settings: { ...league.settings, seed: 52 } });
    const clockByQuarter = new Map<number, number>();
    const seconds: Record<string, number> = {};
    for (const p of result.possessionLog) {
      expect(p.durationSeconds).toBeGreaterThan(0);
      expect(Number.isInteger(p.durationSeconds)).toBe(true);
      expect(new Set(p.onCourtHome).size).toBe(5);
      expect(new Set(p.onCourtAway).size).toBe(5);
      expect(p.clockSeconds).toBe((p.quarter <= 4 ? 720 : 300) - (clockByQuarter.get(p.quarter) ?? 0));
      clockByQuarter.set(p.quarter, (clockByQuarter.get(p.quarter) ?? 0) + p.durationSeconds!);
      for (const id of [...p.onCourtHome, ...p.onCourtAway]) seconds[id] = (seconds[id] ?? 0) + p.durationSeconds!;
    }
    for (const [q, value] of clockByQuarter) expect(value).toBe(q <= 4 ? 720 : 300);
    for (const box of [result.homeBox, result.awayBox]) {
      for (const row of Object.values(box.players)) expect(Math.round(row.minutes * 60)).toBe(seconds[row.playerId] ?? 0);
      expect(Object.values(box.players).reduce((n, s) => n + s.minutes, 0)).toBeCloseTo([...clockByQuarter.values()].reduce((a, b) => a + b, 0) / 60 * 5);
      expect(Object.values(box.players).filter(s => s.minutes > 0 && Math.round(s.minutes * 60) % 60 !== 0).length).toBeGreaterThan(5);
    }
    expect(result.possessionLog.some(p => p.events.some(e => e.includes('substitution:')))).toBe(true);
    expect(result).toEqual(simulateGame({ home: league.teams[0], away: league.teams[1], settings: { ...league.settings, seed: 52 } }));
  });
  it('uses the full requested EXACT quarter budget when feasible', () => {
    const { league } = fixture();
    const player = league.teams[0].seasons[0];
    player.minutes = { mode: 'EXACT', target: 36, perQuarter: [9, 9, 9, 9] };
    const result = simulateGame({ home: league.teams[0], away: league.teams[1], settings: { ...league.settings, seed: 13 } });
    for (let q = 1; q <= 4; q++) expect(result.possessionLog.filter(p => p.quarter === q && p.onCourtHome.includes(player.playerId)).reduce((n, p) => n + p.durationSeconds!, 0)).toBe(540);
  });
  it('limits an AI rotation to its depth when fouls, injuries and blowouts do not intervene', () => {
    const { league } = fixture();
    const home = { ...league.teams[0], coach: { ...defaultCoachTendencies(), rotationDepth: 8 } };
    const result = simulateGame({ home, away: league.teams[1], settings: { ...league.settings, seed: 22 }, rules: { ...DEFAULT_LEAGUE_RULES, blowoutBenchThreshold: 999 } });
    expect(Object.values(result.homeBox.players).filter(s => s.minutes > 0).length).toBe(8);
  });
  it('formats minute rollovers without a 60-second or rounded-up minute component', () => {
    expect(formatPlayingTime(12.55)).toBe('12:33');
    expect(formatPlayingTime(12 + 59.8 / 60)).toBe('13:00');
    expect(formatPlayingTime(0)).toBe('0:00');
  });
});

describe('voting and season lifecycle', () => {
  it('auto play completes voting and events, archives the selections and opens the next season', () => {
    const { league, extras } = fixture();
    const result = autoPlayOneSeason(league, extras, league.teams[0].teamId, DEFAULT_AWARD_SETTINGS, 217);
    const archive = result.league.franchiseHistory?.find(s => s.season === league.season);
    expect(archive?.fullAwards?.allStars.length).toBe(24);
    expect(archive?.allStarGameMVPPlayerId).toBeTruthy();
    expect(archive?.threePointChampionId).toBeTruthy();
    expect(archive?.dunkChampionId).toBeTruthy();
    expect(result.league.season).not.toBe(league.season);
    expect(result.league.seasonPhase).toBe('regular_season');
    expect(isAllStarBreakPending(result.league)).toBe(false);
  });
  it('opens before the actual break, saves one editable ballot and locks selected players', async () => {
    const { league: fresh, extras } = fixture();
    expect(isAllStarBreakPending(fresh)).toBe(false);
    let league = simulateFullRound(fresh, 77);
    expect(isAllStarBreakPending(league)).toBe(false);
    const leader = allStarVoteStandings(league, 1)[0];
    const duplicate = castAllStarBallot(league, [leader.playerId, leader.playerId]);
    expect(duplicate.allStarWeekend?.voting?.ballot).toEqual([leader.playerId]);
    expect(allStarVoteStandings(duplicate, 1).find(s => s.playerId === leader.playerId)!.fanVotes).toBe(leader.fanVotes + 1);
    expect(castAllStarBallot(duplicate, [leader.playerId])).toEqual(duplicate);
    league = simulateRemainingSeason(duplicate, 77);
    expect(isAllStarBreakPending(league)).toBe(true);
    expect(league.schedule.find(g => !g.played)?.round).toBe(allStarBreakRound(league));
    expect(castAllStarBallot(league, [])).toBe(league);
    league = lockAllStarVoting(league, 24, 1);
    const selected = league.allStarWeekend!.voting!.selected!;
    expect(selected.length).toBe(24);
    expect(new Set(selected.map(p => p.playerId)).size).toBe(24);
    league = { ...league, allStarWeekend: { ...league.allStarWeekend!, completed: true } };
    league = simulateRemainingSeason(league, 77);
    expect(computeSeasonAwards(league, { minGames: 1 }).allStars).toEqual(selected);
    const id = await createSave('Voting persistence QA', league, extras, league.teams[0].teamId);
    expect((await getSave(id))!.league.allStarWeekend).toEqual(league.allStarWeekend);
    await deleteSave(id);
  });
  it('supports disabling and moving the break and safe zero-weight voting', () => {
    const { league } = fixture();
    expect(isAllStarBreakPending({ ...league, season: undefined, allStarWeekend: { season: '', completed: true } })).toBe(false);
    expect(allStarBreakRound({ ...league, rulesSettings: { ...DEFAULT_LEAGUE_RULES, allStarEnabled: false } })).toBeNull();
    expect(allStarBreakRound({ ...league, rulesSettings: { ...DEFAULT_LEAGUE_RULES, allStarBreakPercent: 75 } })).toBeGreaterThan(allStarBreakRound(league)!);
    const played = simulateFullRound(league, 88);
    const result = allStarVoteStandings({ ...played, rulesSettings: { ...DEFAULT_LEAGUE_RULES, allStarFanWeight: 0, allStarPlayerWeight: 0, allStarCoachWeight: 0 } }, 1);
    expect(result.every(s => Number.isFinite(s.score))).toBe(true);
  });
});

describe('coaching choices', () => {
  it('changes shot selection for a three-point system over the same seeded games', () => {
    const { league } = fixture();
    let space = 0, post = 0;
    for (let seed = 0; seed < 8; seed++) {
      for (const system of ['pace-space', 'post'] as const) {
        const home = { ...league.teams[0], coach: { ...defaultCoachTendencies(), offensiveSystem: system, threePointFrequency: system === 'pace-space' ? 90 : 20 } };
        const game = simulateGame({ home, away: league.teams[1], settings: { ...league.settings, seed } });
        const attempts = Object.values(game.homeBox.players).reduce((n, s) => n + s.tpa, 0);
        if (system === 'pace-space') space += attempts; else post += attempts;
      }
    }
    expect(space).toBeGreaterThan(post * 1.25);
  });
  it('specialized training increases growth in the selected skill group', () => {
    const { league } = fixture();
    const team = league.teams[0];
    team.seasons.forEach(s => { s.age = 20; s.development.peakAge = 28; s.development.potential = 99; });
    const balanced = developOffseasonLeague([{ ...team, coach: { ...defaultCoachTendencies(), trainingFocus: 'balanced' as const } }], 10)[0];
    const shooting = developOffseasonLeague([{ ...team, coach: { ...defaultCoachTendencies(), trainingFocus: 'shooting' as const } }], 10)[0];
    const total = (t: typeof team) => t.seasons.reduce((n, p) => n + p.attributes.offense.threePoint, 0);
    expect(total(shooting)).toBeGreaterThan(total(balanced));
  });
});
