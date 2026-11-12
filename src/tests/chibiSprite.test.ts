import { describe, it, expect } from 'vitest';
import { chibiSprite, rasterizeChibi, courtView, chibiHandReach, chibiHeadTop, COURT_VIEWS, CHIBI_ORIGIN_Y } from '../visuals/chibiSprite';
import { ANIMATIONS, POSES } from '../visuals/actionSprites';
import { HAIR_STYLES, BEARD_STYLES, HAT_STYLES } from '../visuals/playerSprite';

const look = { playerId: 'Test Player', primary: '#1d428a', secondary: '#f58426', jerseyNumber: 30 };
type Paths = ReturnType<typeof rasterizeChibi>;
const cells = (paths: Paths, fill?: string) => paths.filter(p => !fill || p.fill === fill).flatMap(p => [...p.d.matchAll(/M(\d+) (\d+)h(\d+)/g)].map(m => [+m[1], +m[2], +m[3]] as const));
const rows = (paths: Paths) => cells(paths).map(c => c[1]);
const height = (paths: Paths) => Math.max(...rows(paths)) - Math.min(...rows(paths)) + 1;
const digitCells = (paths: Paths) => cells(paths, '#fff3df').filter(([, y]) => y >= 16 + 24 && y <= 16 + 30);

describe('v2 characters', () => {
  it('stands about 44 px tall with a big head, feet on the origin row', () => {
    const s = rasterizeChibi(POSES.STAND, look, 'front');
    expect(height(s)).toBeGreaterThanOrEqual(42);
    expect(height(s)).toBeLessThanOrEqual(48);
    expect(Math.max(...rows(s))).toBe(CHIBI_ORIGIN_Y - 1 + 1); // the outline sits one row under the sole
    expect(s.map(p => p.fill)).toContain('#1d428a');
    expect(s.map(p => p.fill)).toContain('#080d19');
  });
  it('draws four distinct directions; the number shows on the front, angle and back but not in profile', () => {
    const views = COURT_VIEWS.map(v => rasterizeChibi(POSES.STAND, look, v));
    expect(new Set(views.map(v => JSON.stringify(v))).size).toBe(4);
    const [front, angled, side, back] = views;
    expect(digitCells(front).length).toBeGreaterThan(5);
    expect(digitCells(angled).length).toBeGreaterThan(5);
    expect(digitCells(back).length).toBeGreaterThan(5);
    expect(digitCells(side).length).toBeLessThan(digitCells(front).length);
  });
  it('turns to face left without mirroring the jersey number', () => {
    const r = rasterizeChibi(POSES.DRIBBLE[0], look, 'angled', 1), l = rasterizeChibi(POSES.DRIBBLE[0], look, 'angled', -1);
    expect(l).not.toEqual(r);
    const shape = (p: Paths) => { const c = digitCells(p); const x0 = Math.min(...c.map(v => v[0])); return c.map(([x, y, w]) => `${x - x0},${y},${w}`).sort().join(' '); };
    expect(shape(l)).toBe(shape(r));
  });
  it('draws every frame of the animation sheet in every direction, and caches them', () => {
    for (const [name, frames] of Object.entries(ANIMATIONS)) for (const f of frames) for (const v of COURT_VIEWS) {
      const p = rasterizeChibi(f, look, v);
      expect(p.length, `${name} ${v}`).toBeGreaterThan(4);
      expect(p.map(q => q.fill), `${name} ${v}`).toContain('#1d428a');
    }
    expect(chibiSprite('S', POSES.STAND, look, 'back')).toBe(chibiSprite('S', POSES.STAND, look, 'back'));
  });
  it('raises the hands above the head to shoot and dunk, and lies flat on a dive', () => {
    expect(chibiHandReach(POSES.REACH)).toBeGreaterThan(chibiHeadTop(POSES.REACH));
    expect(chibiHandReach(POSES.STAND)).toBeLessThan(chibiHeadTop(POSES.STAND));
    expect(height(rasterizeChibi(ANIMATIONS.dive[2], look, 'side'))).toBeLessThan(height(rasterizeChibi(POSES.STAND, look, 'side')) * .75);
  });
  it('renders every hairstyle, beard and hat', () => {
    const base = rasterizeChibi(POSES.STAND, { ...look, appearance: { hairStyle: 'bald', beardStyle: 'none', hatStyle: 'none' } }, 'front');
    for (const hairStyle of HAIR_STYLES.filter(h => h !== 'bald')) expect(rasterizeChibi(POSES.STAND, { ...look, appearance: { hairStyle, beardStyle: 'none', hatStyle: 'none' } }, 'front'), hairStyle).not.toEqual(base);
    for (const beardStyle of BEARD_STYLES.filter(b => b !== 'none')) expect(rasterizeChibi(POSES.STAND, { ...look, appearance: { hairStyle: 'bald', beardStyle, hatStyle: 'none' } }, 'front'), beardStyle).not.toEqual(base);
    for (const hatStyle of HAT_STYLES) expect(rasterizeChibi(POSES.STAND, { ...look, appearance: { hairStyle: 'bald', beardStyle: 'none', hatStyle } }, 'front'), hatStyle).not.toEqual(base);
  });
  it('picks the view from movement: front coming down the screen, back going up, profile along the court', () => {
    expect(courtView({ vx: 0, vy: 200, pose: 'run' })).toBe('front');
    expect(courtView({ vx: 0, vy: -200, pose: 'run' })).toBe('back');
    expect(courtView({ vx: 200, vy: 0, pose: 'run' })).toBe('side');
    expect(courtView({ vx: 150, vy: 150, pose: 'run' })).toBe('angled');
    expect(courtView({ vx: 0, vy: 0, pose: 'guard' })).toBe('angled');
    expect(courtView({ vx: 0, vy: 200, pose: 'shoot', anim: { kind: 'jumper', t: .5 } })).toBe('side');
    // Hysteresis: just past a boundary he keeps the view he had.
    const nearEdge = { vx: 100, vy: 100 * Math.tan(63 * Math.PI / 180), pose: 'run' };
    expect(courtView(nearEdge)).toBe('front');
    expect(courtView(nearEdge, 'angled')).toBe('angled');
  });
});
