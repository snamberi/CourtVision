import { describe, it, expect } from 'vitest';
import { pickFrame, rasterizePose, actionSprite, POSES, ANIMATIONS } from '../visuals/actionSprites';

const look = { playerId: 'Test Player', primary: '#1d428a', secondary: '#f58426', jerseyNumber: 23 };
const base = { pose: 'run', carrier: false, moving: true, ballZ: 20 };

describe('court animations', () => {
  it('steps through the jump shot, layup and dunk frames by shot progress', () => {
    const ids = (kind: 'jumper' | 'layup' | 'dunk') => [0, .1, .2, .4, .5, .7, .95].map(t => pickFrame({ ...base, pose: 'shoot', anim: { kind, t } }).id);
    expect(ids('jumper')[0]).toBe('JS0');
    expect(pickFrame({...base,anim:{kind:'jumper',t:.231}}).pose).toBe(ANIMATIONS.jumper[8]);
    expect(pickFrame({...base,anim:{kind:'jumper',t:.57}}).pose.air).toBe(false);
    expect(new Set(ids('layup')).size).toBeGreaterThanOrEqual(4);
    expect(ids('dunk').at(-1)).toBe('DK14');
  });
  it('selects all 16 run drawings and a protected moving dribble', () => {
    const run = Array.from({length:16},(_,i)=>pickFrame({...base,cycle:i/16}).id);
    expect(new Set(run).size).toBe(16);
    expect(pickFrame({ ...base, carrier: true, ballZ: 25, cycle: 0 }).id).toBe('RD0');
    expect(pickFrame({ ...base, carrier: true, ballZ: 5, cycle: 0 }).id).toBe('RD0');
    expect(pickFrame({ ...base, pose: 'dribble', moving: false, ballZ: 15 }).id).toBe('DB0');
    expect(new Set([0, .6].map(c => pickFrame({ ...base, pose: 'guard', moving: false, cycle: c }).id))).toEqual(new Set(['SL0']));
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
    expect(top(rasterizePose(POSES.REACH, look))).toBeLessThanOrEqual(top(sprite) - 3);
    expect(actionSprite('S', POSES.STAND, look)).toBe(actionSprite('S', POSES.STAND, look)); // cached
    // Facing left mirrors the arms and legs, not the face or the jersey number (the white digit pixels stay put).
    const digits = (paths: ReturnType<typeof rasterizePose>) => paths.find(p => p.fill === '#fff3df')?.d.match(/M(1[5-9]|2[0-5]) 3[1-5]h/g)?.length ?? 0;
    expect(digits(rasterizePose(POSES.DRIBBLE[0], look, -1))).toBe(digits(rasterizePose(POSES.DRIBBLE[0], look, 1)));
  });
  it('has the whole animation sheet: 16 exposure slots for every action, from idle to celebrate', () => {
    expect(Object.keys(ANIMATIONS).length).toBeGreaterThanOrEqual(35);
    for (const [name, frames] of Object.entries(ANIMATIONS)) {
      expect(frames, name).toHaveLength(16);
      for (const f of frames) { const paths = rasterizePose(f, look); expect(paths.length, name).toBeGreaterThan(3); expect(paths.map(p => p.fill)).toContain('#1d428a'); }
    }
  });
  it('picks gaits, dribble moves and the new actions by kind and progress', () => {
    expect(pickFrame({ ...base, gait: 'sprint', cycle: 0 }).id).toBe('SP0');
    expect(pickFrame({ ...base, gait: 'walk', cycle: .5 }).id).toBe('WK8');
    expect(pickFrame({ ...base, gait: 'backpedal', cycle: 0 }).id).toBe('BP0');
    expect([0, .5, .99].map(t => pickFrame({ ...base, anim: { kind: 'crossover', t } }).id)).toEqual(['CX0', 'CX8', 'CX15']);
    // The spin turns him round in the middle frames.
    expect(pickFrame({ ...base, anim: { kind: 'spin', t: .45 } }).flip).toBe(true);
    expect(pickFrame({ ...base, anim: { kind: 'spin', t: .05 } }).flip).toBeFalsy();
    for (const kind of ['floater', 'alleyOop', 'stepback', 'fadeaway', 'block', 'steal', 'contest', 'dive', 'charge', 'fall', 'land', 'catch', 'overheadPass', 'bouncePass'] as const)
      expect(pickFrame({ ...base, anim: { kind, t: .5 } }).pose, kind).toBeTruthy();
  });
  it('lies flat on the floor for a dive or a charge, and uses separate sprint drawings', () => {
    const rows = (paths: ReturnType<typeof rasterizePose>) => paths.flatMap(p => [...p.d.matchAll(/M\d+(?:\.\d+)? (\d+(?:\.\d+)?)/g)].map(m => +m[1]));
    const tall = (paths: ReturnType<typeof rasterizePose>) => Math.max(...rows(paths)) - Math.min(...rows(paths));
    expect(tall(rasterizePose(ANIMATIONS.dive[7], look))).toBeLessThan(tall(rasterizePose(POSES.STAND, look)) * .6);
    expect(tall(rasterizePose(ANIMATIONS.charge[9], look, -1))).toBeLessThan(tall(rasterizePose(POSES.STAND, look)) * .6);
    expect(rasterizePose(ANIMATIONS.sprint[0], look)).not.toEqual(rasterizePose(ANIMATIONS.run[0], look));
  });
});

describe('authored player poses', () => {
  it('alternates contacts and recovery knees without folding or shearing a standing sprite',()=>{
    for(const name of ['run','sprint'] as const){
      const frames=ANIMATIONS[name];
      expect(new Set(frames.map(p=>JSON.stringify(p))).size).toBe(16);
      for(const p of frames){expect(p.lean??0).toBe(0);expect(p.lie).toBeUndefined();expect(p.travel).toBe(true);}
      expect(frames[0].lF[1]).toBe(49);expect(frames[8].rF[1]).toBe(49);
      expect(frames[2].rF[1]).toBeLessThan(43);expect(frames[10].lF[1]).toBeLessThan(43);
      expect(frames[0].lH).toEqual(frames[8].rH);
      expect(frames[0].rH).toEqual(frames[8].lH);
      expect(Math.max(...frames.map(p=>p.body[1]))-Math.min(...frames.map(p=>p.body[1]))).toBeLessThanOrEqual(2);
      // No pop at the loop seam, including the shoe pitch.
      for(const key of ['lE','lH','rE','rH','lK','lF','rK','rF'] as const)
        expect(Math.hypot(frames[15][key][0]-frames[0][key][0],frames[15][key][1]-frames[0][key][1])).toBeLessThan(6);
    }
  });
  it('holds the authored drawing between exposures without morphing the body', async () => {
    const { smoothFrame } = await import('../visuals/actionSprites');
    const a = smoothFrame({...base,cycle:.08});
    expect(a.id).toBe('RN1');
    expect(a.pose).toBe(pickFrame({...base,cycle:.08}).pose);
    expect(smoothFrame({...base,cycle:.09}).pose).toBe(a.pose);
    expect(actionSprite(a.id,a.pose,look)).toBe(actionSprite(a.id,a.pose,look));
    for(const frames of Object.keys(ANIMATIONS)) {
      for(const t of [0,.15,.45,.7,1]) {
        const frame=smoothFrame({...base,anim:{kind:frames as 'jumper',t}});
        expect(frame.pose.body.every(Number.isFinite)).toBe(true);
      }
    }
  });
  it('mirrors the contact hand for dunks at either basket', async () => {
    const { upperHand } = await import('../visuals/actionSprites');
    const pose=ANIMATIONS.dunk[3];
    const right=upperHand(pose,1),left=upperHand(pose,-1);
    expect(left[0]).toBe(-right[0]);
    expect(left[1]).toBe(right[1]);
  });
});
