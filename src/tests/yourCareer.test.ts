import { describe, expect, it } from 'vitest';
import { archetypeOf, choose, draftProjection, newCareer, overall, playSeason, startingRatings, START_AGE, type Identity, type YcState } from '../yourCareer/yourCareer';
import { MODE_CATALOG } from '../menu/modeCatalog';

const id = (over: Partial<Identity> = {}): Identity => ({ name: 'Test Player', number: 30, nation: 'GEO', pos: 'SG', heightCm: 195, background: 'city', answers: { score: 'a', offense: 'b', clutch: 'a' }, ...over });

/** Plays a whole career, always taking option `pick` (or the last one there is), declaring for the draft at 20. */
function run(seed: number, pick = 0, over: Partial<Identity> = {}) {
  let s: YcState = newCareer(id(over), seed);
  const seen: number[] = [];
  for (let guard = 0; !s.done && guard < 300; guard++) {
    if (s.pending.length) {
      const d = s.pending[0];
      seen.push(d.options.length);
      const o = d.id === 'college-end' && s.age >= 20 ? d.options[0] : d.options[Math.min(pick, d.options.length - 1)];
      s = choose(s, o.id).state;
    } else s = playSeason(s);
  }
  return { s, seen };
}

describe('Your Career', () => {
  it('starts at 13 around 50-60 overall, with an archetype from how you play', () => {
    const { ratings, deltas } = startingRatings({ pos: 'SG', background: 'city', answers: { score: 'a', summer: 'a' } });
    expect(deltas.shooting).toBeGreaterThan(0);
    expect(archetypeOf(ratings).name).toBeTruthy();
    const s = newCareer(id(), 1);
    expect(s.age).toBe(START_AGE);
    expect(overall(s.ratings, s.pos)).toBeGreaterThanOrEqual(45);
    expect(overall(s.ratings, s.pos)).toBeLessThanOrEqual(62);
    expect(s.pending[0].id).toBe('youth-club');
  });

  it('plays a whole career: one row a season, every decision offers 2 to 5 options, and it ends', () => {
    for (const seed of [1, 7, 42, 99]) {
      const { s, seen } = run(seed);
      expect(s.done).toBe(true);
      expect(s.seasons.map(r => r.age)).toEqual(s.seasons.map((_, i) => START_AGE + i));
      expect(seen.every(n => n >= 2 && n <= 5)).toBe(true);
      expect(s.legacy).toBeGreaterThanOrEqual(0);
    }
  });

  it('goes youth club, high school, then college or a pro path, then the draft', () => {
    const { s } = run(42);
    const levels = s.seasons.map(r => r.club.level);
    expect(levels[0]).toBe('youth');
    expect(levels.slice(1, 5).every(l => l === 'highschool')).toBe(true);
    expect(['college', 'academy', 'europe']).toContain(levels[5]);
    expect(s.draft).not.toBeNull();
  });

  it('the same seed and the same choices replay the same career', () => {
    expect(JSON.stringify(run(5, 1).s.seasons)).toBe(JSON.stringify(run(5, 1).s.seasons));
  });

  it('pro numbers stay basketball-sized', () => {
    for (const seed of [3, 11, 23]) for (const r of run(seed, 1, { pos: 'C', heightCm: 213 }).s.seasons.filter(x => x.club.level === 'nba')) {
      expect(r.ppg).toBeLessThanOrEqual(36);
      expect(r.apg).toBeLessThanOrEqual(13);
      expect(r.rpg).toBeLessThanOrEqual(15.5);
      expect(r.gp).toBeLessThanOrEqual(82);
    }
  });

  it('a better prospect projects higher in the draft', () => {
    const s = newCareer(id(), 9);
    const weak = { ...s, age: 20, rep: 20, ratings: { shooting: 60, dribbling: 60, vision: 60, defense: 60, physical: 60 } };
    const strong = { ...weak, rep: 70, ratings: { shooting: 80, dribbling: 78, vision: 75, defense: 70, physical: 70 } };
    expect(draftProjection(strong).pick).toBeLessThan(draftProjection(weak).pick);
  });

  it('is on the menu as a main mode', () => {
    expect(MODE_CATALOG.find(m => m.id === 'yourCareer')).toMatchObject({ group: 'main', action: { kind: 'start', mode: 'yourCareer' } });
  });
});
