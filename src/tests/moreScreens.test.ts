import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { generateConferencePlayoffBracket, simulateFullPlayoffs } from '../simulation/playoffs';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { buildYearInReview } from '../simulation/yearInReview';
import { computeSeasonAwards } from '../simulation/awards';
import { buildReel, drawReel, reelLength, SCENE_MS } from '../recap/reel';
import { recentForm, heatOf, FORM_GAMES } from '../simulation/form';
import { perGameAverages } from '../simulation/careerStats';
import { tradeMood } from '../simulation/tradeMood';

const { league: g, extras } = generateFullLeague(44, 30, 13, 30, '2026');
const played = simulateRemainingSeason({ ...g, rulesSettings: { ...DEFAULT_LEAGUE_RULES, allStarEnabled: false } }, 3);
const done = simulateFullPlayoffs(generateConferencePlayoffBracket(played), played, 4);
const league = { ...done.league, playoffBracket: done.bracket, seasonPhase: 'awards_recap' as const };
const champ = done.bracket.championTeamId!;

describe('season reel', () => {
  it('builds the scenes of the champion\'s season, about 20 seconds long', () => {
    const awards = computeSeasonAwards(league);
    const reel = buildReel(league, buildYearInReview(league, extras, champ, awards)!, awards);
    const kinds = reel.scenes.map(s => s.kind);
    expect(kinds[0]).toBe('title');
    expect(kinds).toContain('record');
    expect(kinds).toContain('leader');
    expect(kinds.at(-1)).toBe('grade');
    expect(reel.champion).toBe(true);
    expect(reel.scenes.find(s => s.kind === 'finish')!.big).toBe('CHAMPIONS!');
    expect(reel.scenes.find(s => s.kind === 'record')!.count).toEqual([expect.any(Number), expect.any(Number)]);
    expect(reelLength(reel)).toBe(reel.scenes.length * SCENE_MS);
    expect(reelLength(reel)).toBeLessThanOrEqual(25_000);
  });
});

describe('heat check', () => {
  it('labels hot and cold streaks only with a real sample', () => {
    expect(heatOf(28, 18, 5)).toBe('hot');
    expect(heatOf(9, 18, 5)).toBe('cold');
    expect(heatOf(19, 18, 5)).toBeNull();
    expect(heatOf(28, 18, 2)).toBeNull();
    expect(heatOf(3, 5, 5)).toBeNull(); // too small a scorer to go cold
  });
  it('reads each player\'s points from the team\'s last five box scores', () => {
    const team = league.teams[0];
    const form = recentForm(league.schedule, team.teamId, id => perGameAverages(team.seasons.find(p => p.playerId === id)?.seasonStats).ppg);
    const games = league.schedule.filter(x => x.played && (x.homeTeamId === team.teamId || x.awayTeamId === team.teamId)).slice(-FORM_GAMES);
    const box = (x: typeof games[number]) => (x.homeTeamId === team.teamId ? x.result!.homeBox : x.result!.awayBox);
    const someone = Object.keys(box(games.at(-1)!).players).find(id => box(games.at(-1)!).players[id].minutes > 0)!;
    expect(form.get(someone)!.pts).toHaveLength(FORM_GAMES);
    expect(form.get(someone)!.pts.at(-1)).toBe(box(games.at(-1)!).players[someone].points);
  });
});

describe('trade mood', () => {
  it('matches the acceptance line: at or above give × (1 - tolerance) he takes it', () => {
    const view = (give: number, receive: number) => ({ teamId: 'X', direction: 'middle' as const, give, receive });
    expect(tradeMood(view(100, 60), 0.12).mood).toBe('furious');
    expect(tradeMood(view(100, 85), 0.12).mood).toBe('unhappy');
    expect(tradeMood(view(100, 88), 0.12).mood).toBe('thinking');
    expect(tradeMood(view(100, 120), 0.12).mood).toBe('happy');
    expect(tradeMood(view(100, 160), 0.12).mood).toBe('thrilled');
    expect(tradeMood(view(0, 0), 0.12).mood).toBe('thinking');
  });
});

describe('season reel drawing', () => {
  it('draws at any time, even a frame before the start or after the end', () => {
    const awards = computeSeasonAwards(league);
    const reel = buildReel(league, buildYearInReview(league, extras, champ, awards)!, awards);
    const calls: string[] = [];
    const g = new Proxy({}, { get: (_, k) => (typeof k === 'string' && ['fillRect', 'fillText', 'beginPath', 'moveTo', 'lineTo', 'fill', 'save', 'restore'].includes(k) ? () => calls.push(k) : undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const t of [-16, 0, 5000, reelLength(reel), reelLength(reel) + 500]) expect(() => drawReel(g, reel, t)).not.toThrow();
    expect(calls).toContain('fillText');
  });
});
