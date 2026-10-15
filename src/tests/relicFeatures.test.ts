import { describe, expect, it } from 'vitest';
import { RELICS, RELIC_BY_ID, fuseDuplicates, spareCopies, relicOfWeek, weeklyLuck, totalLuck, luckPercent, mergeRelics, FUSE_COST, WEEKLY_BOOST, type RelicState } from '../relics/relics';
import { derive } from '../../server/derive';

const base = (over: Partial<RelicState> = {}): RelicState => ({ v: 1, spins: 0, coins: 0, owned: {}, secrets: [], granted: [], history: [], upgraded: [], equipped: [], slotsBought: 0, pity: { epic: 0, legendary: 0, mythic: 0, lucky: 0 }, opens: 0, ledger: [], rewards: [], ...over });
const commons = RELICS.filter(r => r.rarity === 'common' && !r.stack);

describe('fusing duplicates', () => {
  it('turns five spare copies into a relic one rarity up, new when possible, and counts spares once', () => {
    const s = base({ owned: { [commons[0].id]: 4, [commons[1].id]: 3 } });
    expect(spareCopies(s, 'common')).toBe(5);
    const out = fuseDuplicates(s, 'common', () => 0)!;
    expect(out.result.rarity).toBe('rare');
    expect(out.result.duplicate).toBe(false);
    expect(RELIC_BY_ID.get(out.result.id)!.rarity).toBe('rare');
    expect(spareCopies(out.state, 'common')).toBe(0);
    expect(out.state.owned[commons[0].id]).toBe(4); // your collection keeps every copy
    expect(fuseDuplicates(out.state, 'common')).toBeNull();
    expect(fuseDuplicates(base({ owned: { [commons[0].id]: FUSE_COST } }), 'common')).toBeNull(); // 4 spares
    expect(fuseDuplicates(base({ owned: { x: 99 } }), 'mythic')).toBeNull();
  });
  it('keeps fused counts when two devices merge', () => {
    const a = base({ owned: { [commons[0].id]: 7 }, fused: { [commons[0].id]: 5 }, opens: 10 });
    const b = base({ owned: { [commons[0].id]: 7 }, opens: 1 });
    expect(mergeRelics(b, a).fused).toEqual({ [commons[0].id]: 5 });
    expect(mergeRelics(a, b).fused).toEqual({ [commons[0].id]: 5 });
  });
});

describe('relic of the week', () => {
  it('is the same all week, changes on Monday and never stacks', () => {
    const mon = new Date('2026-10-12T01:00:00Z'), sun = new Date('2026-10-18T23:00:00Z'), next = new Date('2026-10-19T01:00:00Z');
    expect(relicOfWeek(mon).id).toBe(relicOfWeek(sun).id);
    expect(relicOfWeek(mon).stack).toBeFalsy();
    const weeks = new Set(Array.from({ length: 8 }, (_, i) => relicOfWeek(new Date(next.getTime() + i * 7 * 86_400_000)).id));
    expect(weeks.size).toBeGreaterThan(3);
  });
  it('adds +50% of its luck only while it is in a slot', () => {
    const now = new Date('2026-10-12T12:00:00Z'), r = relicOfWeek(now);
    const off = base({ owned: { [r.id]: 1 }, equipped: [] }), on = base({ owned: { [r.id]: 1 }, equipped: [r.id] });
    expect(weeklyLuck(off, now)).toBe(0);
    expect(weeklyLuck(on, now)).toBeCloseTo(luckPercent(on) * WEEKLY_BOOST, 5);
    expect(totalLuck(on, now)).toBeGreaterThan(luckPercent(on));
    expect(totalLuck({ owned: Object.fromEntries(RELICS.map(x => [x.id, 1])) }, now)).toBeGreaterThanOrEqual(luckPercent({ owned: Object.fromEntries(RELICS.map(x => [x.id, 1])) }));
  });
});

describe('public showcase and relic museum', () => {
  it('publishes your rarest relics and the checkable shelf picks', () => {
    const mythic = RELICS.find(r => r.rarity === 'mythic')!;
    const relics = base({ owned: { [commons[0].id]: 1, [mythic.id]: 1 }, secrets: ['secondWind'] as RelicState['secrets'] });
    const d = derive({ version: 1, updatedAt: Date.now(), careers: [], storage: {
      'cv-relics': JSON.stringify(relics),
      'cv-trophy-case': JSON.stringify(['title:Made Up Title', 'title:Rookie GM', 'run:hunt']),
      'cv-hunt-records': JSON.stringify({ runs: 3, wins: 2, bestStop: 10 }),
    } }, new Date('2026-10-12T12:00:00Z'));
    const stats = d.profile.stats as { relicShelf: { ids: string[]; secrets: number }; showcase: string[] };
    expect(stats.relicShelf).toEqual({ ids: [mythic.id, commons[0].id], secrets: 1 });
    expect(stats.showcase).toEqual(['Rookie GM', '2 League Hunt wins']);
  });
});
