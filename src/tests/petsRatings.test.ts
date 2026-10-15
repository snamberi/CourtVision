import { describe, it, expect } from 'vitest';
import { PETS, PET_ART, PET_ANCHORS, cleanPets, equipPet, setLook, lookOf, petOpen, activePet, PETS_KEY } from '../profile/pets';
import { baseRatings, pointsEarned, pointsLeft, stepSkill, stepHeight, raiseBlock, eliteCount, cleanRatings, myOverall, MY_SKILLS, BASE_RATING, BASE_HEIGHT, ELITE_SLOTS, INCH_COST, MAX_RATING } from '../profile/myRatings';

describe('pets', () => {
  it('every pet has 14 x 14 art, anchors inside it, and an ability', () => {
    expect(PETS).toHaveLength(10);
    for (const p of PETS) {
      expect(PET_ART[p.id]).toHaveLength(14);
      for (const row of PET_ART[p.id]) expect(row).toHaveLength(14);
      const a = PET_ANCHORS[p.id];
      for (const v of [...a.head, ...a.eyes, ...a.neck]) expect(v).toBeGreaterThanOrEqual(0);
      expect(p.ability.length).toBeGreaterThan(10);
    }
    expect(new Set(PETS.map(p => p.ability.split(':')[0])).size).toBe(PETS.length); // each ability is its own
  });
  it('one pet at a time, locked pets stay home, looks are cleaned', () => {
    let s = cleanPets(null);
    s = equipPet(s, 'cat', 1);
    expect(s.equipped).toBe('cat');
    expect(equipPet(s, 'dragon', 5)).toBe(s); // level 120 pet at level 5
    expect(petOpen('dragon', 120)).toBe(true);
    s = setLook(s, 'cat', { name: 'Air Jordan the Cat with a very long name', color: '#123456', accessory: 'crown' });
    const clean = cleanPets(JSON.parse(JSON.stringify(s)));
    expect(lookOf(clean, 'cat')).toMatchObject({ name: 'Air Jordan the Cat with a very long name'.slice(0, 16), color: '#123456', accessory: 'crown' });
    expect(cleanPets({ equipped: 'unicorn', looks: { cat: { color: 'red', accessory: 'jetpack' } } })).toMatchObject({ equipped: null, looks: { cat: { color: PETS[0].color, accessory: 'none' } } });
    const read = (k: string) => (k === PETS_KEY ? JSON.stringify({ v: 1, equipped: 'owl', looks: {} }) : null);
    expect(activePet(40, read)).toBe('owl');
    expect(activePet(39, read)).toBeNull();
  });
});

describe('your player ratings', () => {
  it('starts at 5\'3" with every skill 45 and earns 7 points every 5 levels', () => {
    const r = baseRatings();
    expect(r.height).toBe(BASE_HEIGHT);
    expect(MY_SKILLS.every(s => r.skills[s.id] === BASE_RATING)).toBe(true);
    expect(pointsEarned(4)).toBe(0);
    expect(pointsEarned(5)).toBe(7);
    expect(pointsEarned(52)).toBe(70);
    expect(myOverall(r)).toBe(45);
  });
  it('spends points: +1 a skill, 5 an inch, max 120, only three skills at 99+', () => {
    let r = baseRatings();
    expect(stepSkill(r, 'threePoint', 1, 0)).toBe(r); // no points yet
    r = stepHeight(r, 1, 5);
    expect(r.height).toBe(BASE_HEIGHT + 1);
    expect(pointsLeft(r, 5)).toBe(7 - INCH_COST);
    // Plenty of points: push four skills to 99; the fourth stops at 98.
    const lv = 2000;
    for (const id of ['threePoint', 'finishing', 'playmaking', 'iq'] as const) for (let i = 0; i < 60; i++) r = stepSkill(r, id, 1, lv);
    expect(eliteCount(r)).toBe(ELITE_SLOTS);
    expect(r.skills.iq).toBe(98);
    expect(raiseBlock(r, 'iq', lv)).toMatch(/Only 3 skills/);
    for (let i = 0; i < 40; i++) r = stepSkill(r, 'threePoint', 1, lv);
    expect(r.skills.threePoint).toBe(MAX_RATING);
    // Lowering gives the point back, never below 45.
    const down = stepSkill(r, 'iq', -1, lv);
    expect(pointsLeft(down, lv)).toBe(pointsLeft(r, lv) + 1);
    expect(stepSkill(baseRatings(), 'iq', -1, lv).skills.iq).toBe(BASE_RATING);
  });
  it('cleans a stored build: never over budget, never four 99s', () => {
    const raw = { skills: { threePoint: 120, finishing: 120, playmaking: 120, iq: 120 }, height: 84 };
    const r = cleanRatings(raw, 2000);
    expect(eliteCount(r)).toBe(ELITE_SLOTS);
    const poor = cleanRatings(raw, 10);
    expect(pointsLeft(poor, 10)).toBeGreaterThanOrEqual(0);
  });
});
