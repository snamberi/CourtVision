import { describe, expect, it } from 'vitest';
import { simulateGame, type LiveCoachingCommand, RUN_TIMEOUT } from '../simulation/engine/game';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { currentRun, lastShotMoment } from '../simulation/coachMoments';

const gen = generateFullLeague(12, 2, 13, 4).league;
const side = (i: number, id: string) => ({ teamId: id, seasons: gen.teams[i].seasons, coach: gen.teams[i].coach });
const sim = (seed: number, liveCoaching?: LiveCoachingCommand[]) => simulateGame({ home: side(0, 'H'), away: side(1, 'A'), settings: { ...DEFAULT_GAME_SETTINGS, injuriesEnabled: false, seed }, liveCoaching });
const fga = (g: ReturnType<typeof sim>, id: string) => g.homeBox.players[id].fga;

describe('sideline coaching', () => {
  it('an isolation call runs the offense through the chosen player', () => {
    let base = 0, iso = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const b = sim(seed);
      const star = Object.values(b.homeBox.players).sort((x, y) => y.minutes - x.minutes)[2].playerId;
      base += fga(b, star);
      iso += fga(sim(seed, [{ kind: 'play', atPossession: 0, teamId: 'H', play: 'iso', focusId: star }]), star);
    }
    expect(iso).toBeGreaterThan(base * 1.5);
  });

  it('hunting threes raises the three-point rate', () => {
    let base = 0, hunt = 0, fgaB = 0, fgaH = 0;
    for (const seed of [7, 8, 9, 10]) {
      const b = sim(seed), h = sim(seed, [{ kind: 'play', atPossession: 0, teamId: 'H', play: 'threes' }]);
      for (const l of Object.values(b.homeBox.players)) { base += l.tpa; fgaB += l.fga; }
      for (const l of Object.values(h.homeBox.players)) { hunt += l.tpa; fgaH += l.fga; }
    }
    expect(hunt / fgaH).toBeGreaterThan(base / fgaB + 0.08);
  });

  it('a drawn-up last shot goes to the chosen shooter with the chosen shot', () => {
    const base = sim(21);
    const at = base.possessionLog.findIndex((e, i) => i > 150 && e.offenseTeamId === 'H');
    const shooter = base.possessionLog[at].onCourtHome[4];
    const g = sim(21, [{ kind: 'lastShot', atPossession: at, teamId: 'H', shooterId: shooter, shot: 'three' }]);
    const trip = g.possessionLog[at];
    expect(trip.ballHandlerId).toBe(shooter);
    if (trip.playback?.shotType) expect(['aboveBreak3', 'pullUp3', 'stepback', 'corner3', 'catchAndShoot3']).toContain(trip.playback.shotType);
    expect(g.possessionLog.slice(0, at)).toEqual(base.possessionLog.slice(0, at));
  });

  it('doubling a player sends two at him every time he has the ball', () => {
    const g = sim(31, [{ kind: 'double', atPossession: 0, teamId: 'A', target: 'hot' }]);
    const doubled = g.possessionLog.filter(e => e.offenseTeamId === 'H' && e.events.includes('Double team')).length;
    const b = sim(31);
    expect(doubled).toBeGreaterThan(b.possessionLog.filter(e => e.offenseTeamId === 'H' && e.events.includes('Double team')).length * 2);
  });

  it('an AI bench calls timeout to stop a big run, and the run resets', () => {
    let found = false;
    for (const seed of [41, 42, 43, 44, 45, 46, 47, 48]) {
      const g = sim(seed);
      const i = g.possessionLog.findIndex(e => e.events.some(ev => ev.endsWith(' timeout')));
      if (i < 0) continue;
      found = true;
      expect(currentRun(g.possessionLog, i).points).toBeGreaterThanOrEqual(RUN_TIMEOUT);
      expect(currentRun(g.possessionLog, i + 1).points).toBeLessThan(RUN_TIMEOUT);
      break;
    }
    expect(found).toBe(true);
  });

  it('recognises a last-shot moment: your ball, final 24 seconds, tied or down 3 or less', () => {
    const log = [
      { quarter: 4, clockSeconds: 60, offenseTeamId: 'A', homeScoreAfter: 100, awayScoreAfter: 101, events: [] },
      { quarter: 4, clockSeconds: 18, offenseTeamId: 'H', homeScoreAfter: 100, awayScoreAfter: 101, events: [] },
    ] as never[];
    expect(lastShotMoment(log, 1, 'H', 'H', 4)).toBe(true);
    expect(lastShotMoment(log, 1, 'A', 'H', 4)).toBe(false);
    expect(lastShotMoment(log, 0, 'A', 'H', 4)).toBe(false);
  });
});
