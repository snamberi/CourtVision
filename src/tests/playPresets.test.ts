import { describe, expect, it } from 'vitest';
import { generateSeasonSchedule, gamesRemainingForTeam, roundTargetForDays, roundTargetForTeamGames, simulateToRound, sortUnplayedByRound, type League } from '../simulation/league';
import { withRingNight } from '../simulation/ringNight';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';

function leagueOf(ids: string[], games: number): League {
  const teams = ids.map((id) => ({ teamId: id, name: id, seasons: buildDemoTeam(id, id).seasons }));
  return { teams, schedule: generateSeasonSchedule(ids, games), settings: { ...DEFAULT_GAME_SETTINGS }, season: '2026' };
}
const played = (before: League, after: League, team: string) => gamesRemainingForTeam(before, team) - gamesRemainingForTeam(after, team);

describe('Play menu presets play the amount they say', () => {
  it('Next Game plays exactly one of your games, even when your team sits out the next game day', () => {
    const league = leagueOf(['T1', 'T2', 'T3', 'T4', 'T5'], 12); // odd count: someone rests every day
    let l = league;
    for (let i = 0; i < 6; i++) {
      const next = simulateToRound(l, roundTargetForTeamGames(l, 'T1', 1)!, 3);
      expect(played(l, next, 'T1')).toBe(1);
      l = next;
    }
  });

  it('a custom game count plays that many of your games', () => {
    const league = leagueOf(['T1', 'T2', 'T3', 'T4', 'T5', 'T6'], 20);
    const after = simulateToRound(league, roundTargetForTeamGames(league, 'T2', 10)!, 3);
    expect(played(league, after, 'T2')).toBe(10);
  });

  it('1 Week plays ~3 games per team and 1 Month ~15, not 7 and 30', () => {
    const league = leagueOf(['T1', 'T2', 'T3', 'T4'], 40);
    const week = simulateToRound(league, roundTargetForDays(league, 7)!, 3);
    expect(played(league, week, 'T1')).toBe(3);
    const month = simulateToRound(week, roundTargetForDays(week, 30)!, 3);
    expect(played(week, month, 'T1')).toBe(15);
  });
});

describe('Ring Night keeps the schedule in round order', () => {
  it('1 Week in a league with a Ring Night opener plays ~3 games, not 50+', () => {
    const ids = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
    const base = leagueOf(ids, 40);
    const history = [{ championTeamId: 'T3', teamSeasons: [{ teamId: 'T5', playoffFinish: 'Finals' }] }] as unknown as Parameters<typeof withRingNight>[1];
    const league = { ...base, schedule: withRingNight(base.schedule, history) };
    expect(league.schedule.find(g => g.ringNight)?.round).toBe(0);
    expect(league.schedule[0].round).toBe(0);
    const week = simulateToRound(league, roundTargetForDays(league, 7)!, 3);
    expect(played(league, week, 'T1')).toBe(3);
  });

  it('repairs saves whose unplayed games are out of round order', () => {
    const base = leagueOf(['T1', 'T2', 'T3', 'T4'], 12);
    const scrambled = [...base.schedule.slice(6), ...base.schedule.slice(0, 6)];
    const fixed = sortUnplayedByRound(scrambled);
    expect(fixed.map(g => g.round)).toEqual([...scrambled.map(g => g.round)].sort((a, b) => a - b));
    expect(sortUnplayedByRound(fixed)).toBe(fixed);
  });
});
