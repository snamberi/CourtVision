import { describe, expect, it } from 'vitest';
import { simulateGame, type LiveCoachingCommand } from '../simulation/engine/game';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { liveBoxScore } from '../simulation/liveBox';
import { detectHighlights, reelFor, topPlaysFor } from '../simulation/highlights';
import { compactLeagueLogs, gameLog, packResult, withGameLog } from '../simulation/logPacking';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateFullRound, simulateRounds } from '../simulation/league';
import { replayDuration } from '../simulation/courtMotion';

const gen = generateFullLeague(12, 2, 13, 4).league;
const deep = (i: number, id: string) => ({ teamId: id, seasons: gen.teams[i].seasons, coach: gen.teams[i].coach });
const teams = () => ({ home: deep(0, 'H'), away: deep(1, 'A') });
void buildDemoTeam;
const sim = (seed: number, liveCoaching?: LiveCoachingCommand[]) => { const t = teams(); return simulateGame({ ...t, settings: { ...DEFAULT_GAME_SETTINGS, injuriesEnabled: false, seed }, liveCoaching }); };

describe('live box score', () => {
  it('matches the official box score exactly once every possession has been shown', () => {
    for (const seed of [3, 41, 977]) {
      const g = sim(seed);
      const live = liveBoxScore(g.possessionLog, g.possessionLog.length, 'H', 'A', { home: Object.keys(g.homeBox.players), away: Object.keys(g.awayBox.players) });
      for (const [side, box] of [['home', g.homeBox], ['away', g.awayBox]] as const) {
        expect(live[side].points).toBe(box.points);
        for (const official of Object.values(box.players)) {
          const l = live[side].lines.find(x => x.playerId === official.playerId)!;
          expect({ pts: l.pts, fgm: l.fgm, fga: l.fga, tpm: l.tpm, tpa: l.tpa, ftm: l.ftm, fta: l.fta, oreb: l.oreb, dreb: l.dreb, ast: l.ast, stl: l.stl, blk: l.blk, tov: l.tov, pf: l.pf })
            .toEqual({ pts: official.points, fgm: official.fgm, fga: official.fga, tpm: official.tpm, tpa: official.tpa, ftm: official.ftm, fta: official.fta, oreb: official.oreb, dreb: official.dreb, ast: official.ast, stl: official.stl, blk: official.blk, tov: official.tov, pf: official.pf });
          expect(l.seconds / 60).toBeCloseTo(official.minutes, 5);
        }
      }
    }
  });
  it('never counts possessions that have not been shown yet', () => {
    const g = sim(8), half = Math.floor(g.possessionLog.length / 2);
    const live = liveBoxScore(g.possessionLog, half, 'H', 'A', { home: [], away: [] });
    expect(live.home.points).toBe(g.possessionLog[half - 1].homeScoreAfter);
    expect(live.away.points).toBe(g.possessionLog[half - 1].awayScoreAfter);
  });
});

describe('coaching while watching', () => {
  it('replays every earlier possession identically and only changes the game from the decision onward', () => {
    const base = sim(123), at = 90;
    const lineup = base.possessionLog[at].onCourtHome.slice().reverse();
    const bench = Object.keys(base.homeBox.players).filter(id => !lineup.includes(id));
    const newFive = [...lineup.slice(0, 3), ...bench.slice(0, 2)];
    const coached = sim(123, [
      { kind: 'timeout', atPossession: at, teamId: 'H' },
      { kind: 'lineup', atPossession: at, teamId: 'H', lineup: newFive },
      { kind: 'pace', atPossession: at, teamId: 'H', pace: 'fast' },
      { kind: 'defense', atPossession: at, teamId: 'H', defense: 'zone' },
    ]);
    expect(coached.possessionLog.slice(0, at)).toEqual(base.possessionLog.slice(0, at));
    expect(coached.possessionLog[at].events).toContain('H timeout');
    expect([...coached.possessionLog[at].onCourtHome].sort()).toEqual([...newFive].sort());
    expect(JSON.stringify(coached.possessionLog.slice(at))).not.toBe(JSON.stringify(base.possessionLog.slice(at)));
    // Box score still reconciles with the recorded possessions after coaching.
    const live = liveBoxScore(coached.possessionLog, coached.possessionLog.length, 'H', 'A', { home: [], away: [] });
    expect(live.home.points).toBe(coached.homeScore); expect(live.away.points).toBe(coached.awayScore);
    // Yours, plus any the AI bench called to stop a run before you took over.
    expect(live.home.timeoutsUsed).toBe(1 + base.possessionLog.slice(0, at).filter(e => e.events.includes('H timeout')).length);
  });
  it('keeps the pinned five for the rest of that quarter only', () => {
    const base = sim(5), at = 12, q = base.possessionLog[at].quarter;
    const five = Object.keys(base.homeBox.players).slice(-5);
    const coached = sim(5, [{ kind: 'lineup', atPossession: at, teamId: 'H', lineup: five }]);
    const sameQuarter = coached.possessionLog.slice(at).filter(e => e.quarter === q);
    for (const e of sameQuarter) expect([...e.onCourtHome].sort()).toEqual([...five].sort());
    expect(coached.possessionLog.some(e => e.quarter > q && [...e.onCourtHome].sort().join() !== [...five].sort().join())).toBe(true);
  });
  it('re-simulates a league round with the coached game while every other game is unchanged', () => {
    const { league } = generateFullLeague(4, 6, 12, 10);
    const round = league.schedule.find(g => !g.played)!.round;
    const mine = league.schedule.find(g => g.round === round)!;
    const plain = simulateFullRound(league, 9);
    const coached = simulateFullRound(league, 9, { [mine.id]: [{ kind: 'pace', atPossession: 40, teamId: mine.homeTeamId, pace: 'slow' }] });
    const pick = (l: typeof plain, id: string) => l.schedule.find(g => g.id === id)!.result!;
    expect(pick(coached, mine.id).possessionLog.slice(0, 40)).toEqual(pick(plain, mine.id).possessionLog.slice(0, 40));
    for (const g of plain.schedule.filter(g => g.round === round && g.id !== mine.id)) expect(pick(coached, g.id).homeScore).toBe(g.result!.homeScore);
  });
});

describe('highlights', () => {
  it('finds scored moments in order, fits a 60-second reel and stores top plays on the result', () => {
    const g = sim(64), hs = detectHighlights(g.possessionLog, 4);
    expect(hs.length).toBeGreaterThan(5);
    expect(hs.map(h => h.index)).toEqual([...hs.map(h => h.index)].sort((a, b) => a - b));
    const reel = reelFor(hs, i => replayDuration(g.possessionLog[i]));
    expect(reel.reduce((n, h) => n + replayDuration(g.possessionLog[h.index]), 0)).toBeLessThanOrEqual(60_000);
    expect(reel.length).toBeGreaterThan(2);
    expect(g.topPlays!.length).toBeGreaterThan(0);
    expect(g.topPlays).toEqual(topPlaysFor(g));
    for (const t of g.topPlays!) expect(g.possessionLog[t.possession].homeScoreAfter).toBe(t.homeScoreAfter);
  });
});

describe('replay log packing', () => {
  it('round-trips losslessly and shrinks a season', () => {
    const g = sim(17), packed = packResult(g);
    expect(packed.possessionLog).toEqual([]);
    expect(packed.packedLog!.length).toBeLessThan(JSON.stringify(g.possessionLog).length / 5);
    expect(JSON.parse(JSON.stringify(gameLog(JSON.parse(JSON.stringify(packed)))))).toEqual(JSON.parse(JSON.stringify(g.possessionLog)));
    expect(withGameLog(packed).possessionLog.length).toBe(g.possessionLog.length);
    const { league } = generateFullLeague(2, 6, 12, 10);
    const played = simulateRounds(league, 4, 3);
    const compact = compactLeagueLogs(played, 1);
    const last = Math.max(...played.schedule.filter(g => g.played).map(g => g.round));
    for (const g of compact.schedule.filter(g => g.played)) expect(!!g.result!.packedLog).toBe(g.round < last);
    expect(compactLeagueLogs(compact, 1)).toBe(compact);
    expect(JSON.stringify(compactLeagueLogs(played, 0).schedule).length).toBeLessThan(JSON.stringify(played.schedule).length / 5);
  });
});
