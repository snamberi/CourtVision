import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { generateConferencePlayoffBracket, simulateFullPlayoffs } from '../simulation/playoffs';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { buildYearInReview } from '../simulation/yearInReview';
import { computeSeasonAwards } from '../simulation/awards';

describe('Year in Review', () => {
  const { league: g, extras } = generateFullLeague(44, 30, 13, 30, '2026');
  const played = simulateRemainingSeason({ ...g, rulesSettings: { ...DEFAULT_LEAGUE_RULES, allStarEnabled: false } }, 3);
  const done = simulateFullPlayoffs(generateConferencePlayoffBracket(played), played, 4);
  const league = { ...done.league, playoffBracket: done.bracket, seasonPhase: 'awards_recap' as const };
  const champ = done.bracket.championTeamId!;

  it('tells the champion\'s story, with moments, a grade and a draft board', () => {
    const r = buildYearInReview(league, extras, champ, computeSeasonAwards(league))!;
    expect(r.finish).toBe('Champion');
    expect(r.wins + r.losses).toBe(30);
    expect(r.seasonYear).toBe('2027');
    expect(r.story.at(-1)!.text).toMatch(/champions/);
    expect(r.story.some(b => b.title === 'Finals' && b.tone === 'up')).toBe(true);
    expect(r.moments.length).toBeGreaterThanOrEqual(3);
    expect(r.grade.parts).toHaveLength(4);
    expect(r.grade.letter).toMatch(/^[A-DF][+-]?$/);
    expect(r.league.find(l => l.label === 'Champion')?.text).toBe(league.teams.find(t => t.teamId === champ)!.name);
    for (const d of r.draft) expect(d.classRank).toBeGreaterThan(0);
  });

  it('grades a champion above a team that missed the playoffs', () => {
    const missed = league.teams.find(t => !done.bracket.rounds[0].some(s => s.teamAId === t.teamId || s.teamBId === t.teamId))!;
    const a = buildYearInReview(league, extras, champ)!;
    const b = buildYearInReview(league, extras, missed.teamId)!;
    expect(b.finish).toBe('Missed Playoffs');
    expect(a.grade.parts[1].score).toBeGreaterThan(b.grade.parts[1].score);
  });
});
