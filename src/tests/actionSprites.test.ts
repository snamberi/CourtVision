import { describe, it, expect } from 'vitest';
import { pickFrame, rasterizePose, actionSprite, POSES, ANIMATIONS } from '../visuals/actionSprites';

const look = { playerId: 'Test Player', primary: '#1d428a', secondary: '#f58426', jerseyNumber: 23 };
const base = { pose: 'run', carrier: false, moving: true, ballZ: 20 };

describe('court animations', () => {
  it('steps through the jump shot, layup and dunk frames by shot progress', () => {
    const ids = (kind: 'jumper' | 'layup' | 'dunk') => [0, .1, .2, .4, .5, .7, .95].map(t => pickFrame({ ...base, pose: 'shoot', anim: { kind, t } }).id);
    expect(ids('jumper')).toEqual(['J0', 'J0', 'J1', 'J2', 'J3', 'J4', 'J5']);
    expect(new Set(ids('layup')).size).toBeGreaterThanOrEqual(4);
    expect(ids('dunk').at(-1)).toBe('K5');
  });
  it('runs a four-frame cycle, dribbles with the hand at the ball, and guards in a shuffle', () => {
    const run = [0, .25, .5, .75].map(c => pickFrame({ ...base, cycle: c }).id);
    expect(new Set(run).size).toBe(4);
    expect(pickFrame({ ...base, carrier: true, ballZ: 25, cycle: 0 }).id).toBe('RD00');
    expect(pickFrame({ ...base, carrier: true, ballZ: 5, cycle: 0 }).id).toBe('RD20');
    expect(pickFrame({ ...base, pose: 'dribble', moving: false, ballZ: 15 }).id).toBe('D1');
    expect(new Set([0, .6].map(c => pickFrame({ ...base, pose: 'guard', moving: false, cycle: c }).id))).toEqual(new Set(['G0', 'G1']));
    // On the move, a defender slides.
    expect(pickFrame({ ...base, pose: 'guard', cycle: 0 }).id).toBe('SL0');
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
  it('has the whole animation sheet: six drawable frames for every action, from idle to celebrate', () => {
    expect(Object.keys(ANIMATIONS).length).toBeGreaterThanOrEqual(35);
    for (const [name, frames] of Object.entries(ANIMATIONS)) {
      expect(frames, name).toHaveLength(6);
      for (const f of frames) { const paths = rasterizePose(f, look); expect(paths.length, name).toBeGreaterThan(3); expect(paths.map(p => p.fill)).toContain('#1d428a'); }
    }
  });
  it('picks gaits, dribble moves and the new actions by kind and progress', () => {
    expect(pickFrame({ ...base, gait: 'sprint', cycle: 0 }).id).toBe('SP0');
    expect(pickFrame({ ...base, gait: 'walk', cycle: .5 }).id).toBe('WK3');
    expect(pickFrame({ ...base, gait: 'backpedal', cycle: 0 }).id).toBe('BP0');
    expect([0, .5, .99].map(t => pickFrame({ ...base, anim: { kind: 'crossover', t } }).id)).toEqual(['CX0', 'CX3', 'CX5']);
    // The spin turns him round in the middle frames.
    expect(pickFrame({ ...base, anim: { kind: 'spin', t: .45 } }).flip).toBe(true);
    expect(pickFrame({ ...base, anim: { kind: 'spin', t: .05 } }).flip).toBeFalsy();
    for (const kind of ['floater', 'alleyOop', 'stepback', 'fadeaway', 'block', 'steal', 'contest', 'dive', 'charge', 'fall', 'land', 'catch', 'overheadPass', 'bouncePass'] as const)
      expect(pickFrame({ ...base, anim: { kind, t: .5 } }).pose, kind).toBeTruthy();
  });
  it('lies flat on the floor for a dive or a charge, and leans into a sprint', () => {
    const rows = (paths: ReturnType<typeof rasterizePose>) => paths.flatMap(p => [...p.d.matchAll(/M\d+(?:\.\d+)? (\d+(?:\.\d+)?)/g)].map(m => +m[1]));
    const tall = (paths: ReturnType<typeof rasterizePose>) => Math.max(...rows(paths)) - Math.min(...rows(paths));
    expect(tall(rasterizePose(ANIMATIONS.dive[2], look))).toBeLessThan(tall(rasterizePose(POSES.STAND, look)) * .6);
    expect(tall(rasterizePose(ANIMATIONS.charge[3], look, -1))).toBeLessThan(tall(rasterizePose(POSES.STAND, look)) * .6);
    expect(rasterizePose(ANIMATIONS.sprint[0], look)).not.toEqual(rasterizePose(ANIMATIONS.run[0], look));
  });
});
