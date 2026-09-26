import { describe, it, expect } from 'vitest';
import { courtFrame, replayDuration } from '../simulation/courtMotion';
import { simulateGame } from '../simulation/engine/game';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';

const game = simulateGame({ home: buildDemoTeam('H', 'Home'), away: buildDemoTeam('A', 'Away'), settings: { ...DEFAULT_GAME_SETTINGS, seed: 44, injuriesEnabled: false } });
const log = game.possessionLog;
const frames = (i: number, steps = 60) => Array.from({ length: steps + 1 }, (_, k) => courtFrame(log[i], k / steps, 'H', 'A', 4, log[i - 1]));

describe('court choreography', () => {
  it('after a basket the other team inbounds from under its own basket', () => {
    const i = log.findIndex((e, k) => k > 0 && e.quarter === log[k - 1].quarter && e.offenseTeamId !== log[k - 1].offenseTeamId && log[k - 1].result === 'MAKE' && !e.secondChance);
    expect(i).toBeGreaterThan(0);
    const f = courtFrame(log[i], .03, 'H', 'A', 4, log[i - 1]);
    expect(f.phase).toBe('Inbound');
    // The inbounder is the offensive player standing on his own baseline, with the ball in his hands.
    const ownBasketX = f.attackRight ? 100 : 900;
    const inbounder = f.players.filter(p => p.teamId === log[i].offenseTeamId).sort((a, b) => Math.abs(a.x - ownBasketX) - Math.abs(b.x - ownBasketX))[0];
    expect(Math.abs(inbounder.x - ownBasketX)).toBeLessThan(90);
    expect(Math.hypot(f.ball.x - inbounder.x, f.ball.y - inbounder.y)).toBeLessThan(60);
  });

  it('works the ball: swing passes before the shot in a half-court possession', () => {
    const i = log.findIndex(e => e.action !== 'transition' && !e.secondChance && (e.result === 'MAKE' || e.result === 'MISS'));
    const phases = frames(i, 200).map(f => f.phase);
    expect(phases.filter((ph, k) => ph === 'Swing pass' && phases[k - 1] !== 'Swing pass').length).toBeGreaterThanOrEqual(1);
  });

  it('nobody stands still: off-ball players relocate during the half-court phase', () => {
    const i = log.findIndex(e => e.action !== 'transition' && !e.secondChance && (e.result === 'MAKE' || e.result === 'MISS'));
    const a = courtFrame(log[i], .27, 'H', 'A', 4, log[i - 1]), b = courtFrame(log[i], .45, 'H', 'A', 4, log[i - 1]);
    const offense = a.players.filter(p => p.teamId === log[i].offenseTeamId);
    const moved = offense.filter(p => { const q = b.players.find(x => x.id === p.id)!; return Math.hypot(q.x - p.x, q.y - p.y) > 40; });
    expect(moved.length).toBeGreaterThanOrEqual(3);
  });

  it('a miss sends players crashing the glass', () => {
    const i = log.findIndex(e => e.result === 'MISS' && !!e.playback?.rebounderId && !e.playback?.blockerId);
    const f = courtFrame(log[i], .96, 'H', 'A', 4, log[i - 1]);
    const near = f.players.filter(p => Math.hypot(p.x - f.hoop.x, p.y - f.hoop.y) < 110);
    expect(near.length).toBeGreaterThanOrEqual(3);
  });

  it('moves continuously: nobody outruns a sprint between neighbouring frames (no teleporting)', () => {
    for (let i = 1; i < 40; i++) {
      const fs = frames(i, 240), seconds = replayDuration(log[i]) / 1000 / 240;
      for (let k = 1; k < fs.length; k++) for (const p of fs[k].players) {
        const before = fs[k - 1].players.find(x => x.id === p.id)!;
        expect(Math.hypot(p.x - before.x, p.y - before.y) / seconds).toBeLessThan(620);
      }
    }
  });
});
