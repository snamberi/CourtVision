import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { autoGeneratePlayoffBracket, simulateCurrentPlayoffRound } from '../simulation/playoffs';
import { autoFinishSeason } from '../simulation/autoPlay';
import { autoHandleDesk, hasDeskWork } from '../simulation/handsOff';
import { DEFAULT_AWARD_SETTINGS } from '../simulation/awards';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
import { awardOptions } from '../simulation/awards';

const { league: generated, extras } = generateFullLeague(44, 30, 13, 20, '2026');
const me = generated.teams[0].teamId;
const played = simulateRemainingSeason({ ...generated, rulesSettings: { ...DEFAULT_LEAGUE_RULES, allStarEnabled: false } }, 44);

describe('Hands-off Franchise', () => {
  it('finishes a season from the middle of the playoffs and opens the next one', () => {
    const bracket = simulateCurrentPlayoffRound(autoGeneratePlayoffBracket(played), played, 9);
    const mid = { ...bracket.league, seasonPhase: 'playoffs' as const, playoffBracket: bracket.bracket };
    const done = autoFinishSeason(mid, extras, me, DEFAULT_AWARD_SETTINGS, 5, bracket.bracket);
    expect(done.league.seasonPhase).toBe('regular_season');
    expect(done.league.season).not.toBe(played.season);
    expect(done.league.playoffBracket).toBeUndefined();
    expect(done.league.schedule.length).toBeGreaterThan(0);
    expect(done.league.schedule.every(g => !g.played)).toBe(true);
    expect(done.summary.championTeamName).toBeTruthy();
  }, 120_000);

  it('finishes from the draft and from free agency', () => {
    const bracket = autoGeneratePlayoffBracket(played);
    const roll = beginNewSeasonRoster(played, extras, 3, awardOptions(DEFAULT_AWARD_SETTINGS), { teamId: null, teamName: null, fmvp: null });
    const draft = autoFinishSeason({ ...roll.league, seasonPhase: 'draft' }, roll.extras, me, DEFAULT_AWARD_SETTINGS, 6, bracket);
    expect(draft.league.seasonPhase).toBe('regular_season');
    expect(draft.extras.draftDayOpen).toBeFalsy();
    const fa = autoFinishSeason({ ...roll.league, seasonPhase: 'free_agency' }, { ...roll.extras, freeAgencyDaysRemaining: 3 }, me, DEFAULT_AWARD_SETTINGS, 7, bracket);
    expect(fa.league.seasonPhase).toBe('regular_season');
    expect(fa.extras.freeAgencyOpen).toBe(false);
  }, 120_000);

  it('answers the desk: press, injuries and staff calls', () => {
    const team = played.teams[0];
    const p = team.seasons[0];
    const withWork = {
      ...played,
      injuries: { [p.playerId]: { playerId: p.playerId, teamId: me, severity: 'moderate' as const, gamesRemaining: 6, totalGames: 6 } },
      press: { season: played.season ?? '', fans: 55, pending: [{ id: 'x', season: played.season ?? '', kind: 'bigWin' as const, context: 'a 30-point win', question: 'Q', answers: [
        { id: 'a', text: 'meh', tone: 'x', effects: { fans: -2 } }, { id: 'b', text: 'great', tone: 'y', effects: { team: 3, fans: 2 } }] }], log: [], playerMood: {}, gamesSeen: 0, asked: [] },
    };
    expect(hasDeskWork(withWork, me)).toBe(true);
    const done = autoHandleDesk(withWork, me);
    expect(hasDeskWork(done.league, me)).toBe(false);
    expect(done.league.press?.log.at(-1)?.answer).toBe('great');
    expect(done.league.injuries?.[p.playerId].treatment).toBe('standard');
  });
});
