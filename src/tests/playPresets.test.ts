import { describe, expect, it } from 'vitest';
import { generateSeasonSchedule, gamesRemainingForTeam, roundTargetForDays, roundTargetForTeamGames, simulateToRound, type League } from '../simulation/league';
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
