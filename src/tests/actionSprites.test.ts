import { describe, it, expect } from 'vitest';
import { pickFrame, rasterizePose, actionSprite, POSES } from '../visuals/actionSprites';

const look = { playerId: 'Test Player', primary: '#1d428a', secondary: '#f58426', jerseyNumber: 23 };
const base = { pose: 'run', carrier: false, moving: true, ballZ: 20 };

describe('court animations', () => {
  it('steps through the jump shot, layup and dunk frames by shot progress', () => {
    const ids = (kind: 'jumper' | 'layup' | 'dunk') => [0, .1, .2, .4, .5, .7, .95].map(t => pickFrame({ ...base, pose: 'shoot', anim: { kind, t } }).id);
    expect(ids('jumper')).toEqual(['J0', 'J0', 'J1', 'J2', 'J3', 'J4', 'J5']);
    expect(new Set(ids('layup')).size).toBeGreaterThanOrEqual(4);
    expect(ids('dunk').at(-1)).toBe('K4');
  });
  it('runs a four-frame cycle, dribbles with the hand at the ball, and guards in a shuffle', () => {
    const run = [0, .25, .5, .75].map(c => pickFrame({ ...base, cycle: c }).id);
    expect(new Set(run).size).toBe(4);
    expect(pickFrame({ ...base, carrier: true, ballZ: 25, cycle: 0 }).id).toBe('RD00');
    expect(pickFrame({ ...base, carrier: true, ballZ: 5, cycle: 0 }).id).toBe('RD20');
    expect(pickFrame({ ...base, pose: 'dribble', moving: false, ballZ: 15 }).id).toBe('D1');
    expect(new Set([0, .6].map(c => pickFrame({ ...base, pose: 'guard', cycle: c }).id))).toEqual(new Set(['G0', 'G1']));
    expect(pickFrame({ ...base, pose: 'idle', carrier: true }).id).toBe('RDY');
  });
  it('draws the player from his avatar: his kit colour, an outline, raised arms above the head, and a mirrored pose that keeps his number', () => {
    const sprite = rasterizePose(POSES.STAND, look);
    const fills = sprite.map(p => p.fill);
    expect(fills).toContain('#1d428a');
    expect(fills).toContain('#080d19');
    const top = (paths: ReturnType<typeof rasterizePose>) => Math.min(...paths.flatMap(p => [...p.d.matchAll(/M\d+ (\d+)/g)].map(m => +m[1])));
    expect(top(rasterizePose(POSES.REACH, look))).toBeLessThanOrEqual(top(sprite) - 5);
    expect(actionSprite('S', POSES.STAND, look)).toBe(actionSprite('S', POSES.STAND, look)); // cached
    // Facing left mirrors the arms and legs, not the face or the jersey number (the white digit pixels stay put).
    const digits = (paths: ReturnType<typeof rasterizePose>) => paths.find(p => p.fill === '#fff3df')?.d.match(/M(1[5-9]|2[0-5]) 3[1-5]h/g)?.length ?? 0;
    expect(digits(rasterizePose(POSES.DRIBBLE[0], look, -1))).toBe(digits(rasterizePose(POSES.DRIBBLE[0], look, 1)));
  });
});
