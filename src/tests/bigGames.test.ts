import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { generateConferencePlayoffBracket, simulateFullPlayoffs } from '../simulation/playoffs';
import { playToTeamGame, playoffOccasion, findSeriesGame } from '../simulation/bigGames';
import { setupCup } from '../simulation/cup';
import { simulateRounds } from '../simulation/league';
import { unpackLog } from '../simulation/logPacking';

describe('big games', () => {
  const { league: g } = generateFullLeague(55, 30, 13, 20, '2026');
  const played = simulateRemainingSeason({ ...g, rulesSettings: { ...DEFAULT_LEAGUE_RULES, allStarEnabled: false } }, 2);
  const bracket = generateConferencePlayoffBracket(played);
  const name = (id: string | null) => played.teams.find(t => t.teamId === id)?.name ?? '?';

  it('plays the bracket to your next game and returns it', () => {
    const me = bracket.rounds[0][3].teamAId!;
    let b = bracket, l = played;
    const mine: string[] = [];
    for (let i = 0; i < 4; i++) {
      const step = playToTeamGame(b, l, me);
      expect(step.game).toBeTruthy();
      expect([step.game!.homeTeamId, step.game!.awayTeamId]).toContain(me);
      mine.push(`${step.game!.seed}`);
      b = step.bracket; l = step.league;
    }
    expect(new Set(mine).size).toBe(4); // four different games of your series
    // Once you're out (or done), there is no next game.
    const done = simulateFullPlayoffs(b, l, 1000);
    expect(playToTeamGame(done.bracket, done.league, me).game).toBeNull();
    const missed = played.teams.find(t => !bracket.rounds[0].some(s => s.teamAId === t.teamId || s.teamBId === t.teamId) && !(bracket.playIn ?? []).some(p => p.teamAId === t.teamId || p.teamBId === t.teamId))!;
    expect(playToTeamGame(bracket, played, missed.teamId).game).toBeNull();
  });

  it('labels each playoff game with its stakes, Game 7 included', () => {
    const done = simulateFullPlayoffs(bracket, played, 1000).bracket;
    for (const s of done.rounds.flat()) s.games.forEach((game, i) => {
      const o = playoffOccasion(done, game, name)!;
      expect(o.eyebrow).toMatch(new RegExp(`GAME ${i + 1}$`));
      expect(findSeriesGame(done, game)?.index).toBe(i);
      if (i === 6) { expect(o.stakes).toBe('game7'); expect(o.title).toBe('GAME 7'); }
      if (s.round === done.rounds.length - 1 && i < 6) expect(['final']).toContain(o.stakes);
    });
    expect(playoffOccasion(done, done.rounds[0][0].games[0], name)!.subtitle).toBe('Series opener.');
  });

  it('Cup knockout games keep a watchable replay', () => {
    const { league: base } = generateFullLeague(61, 30, 13, 82, '2026');
    let l = setupCup(base);
    for (let i = 0; i < 200 && !l.cup!.knockout; i++) l = simulateRounds(l, 1, 7);
    const final = l.cup!.knockout!.find(k => k.stage === 'final')!;
    expect(final.replay?.packedLog).toBeTruthy();
    expect(unpackLog(final.replay!.packedLog!).length).toBeGreaterThan(150);
    expect(final.replay!.homeScore).toBe(final.homeScore);
  });
});
