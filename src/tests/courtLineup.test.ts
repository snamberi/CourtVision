import { describe, expect, it } from 'vitest';
import { assignToSpots, FIVE_SPOTS, THREE_SPOTS } from '../components/lineupSpots';
import { eraShort, ROLL_ERAS } from '../perfect/run';

const p = (id: string, pos: string) => ({ id, pos });

describe('starting five on the court', () => {
  it('puts each starter at the spot that fits him', () => {
    const placed = assignToSpots([p('a', 'C'), p('b', 'PG'), p('c', 'SF'), p('d', 'SG'), p('e', 'PF')], FIVE_SPOTS);
    expect(placed.map(x => x?.id)).toEqual(['b', 'd', 'c', 'e', 'a']);
  });
  it('slides a second player at a position to the nearest open spot, and fills every spot', () => {
    const placed = assignToSpots([p('a', 'PG'), p('b', 'PG'), p('c', 'C'), p('d', 'C'), p('e', 'C')], FIVE_SPOTS);
    expect(placed.map(x => x?.id)).toEqual(['a', 'b', 'e', 'd', 'c']);
    expect(placed.every(Boolean)).toBe(true);
  });
  it('reads guard, wing and big on a 3v3 court', () => {
    expect(assignToSpots([p('big', 'C'), p('g', 'SG'), p('w', 'SF')], THREE_SPOTS).map(x => x?.id)).toEqual(['g', 'w', 'big']);
  });
  it('leaves open spots empty while the draft is on', () => {
    expect(assignToSpots([p('a', 'SF')], FIVE_SPOTS).map(x => x?.id)).toEqual([undefined, undefined, 'a', undefined, undefined]);
  });
});

describe('reel labels', () => {
  it('gives every roll era a short name', () => {
    expect(ROLL_ERAS.map(e => eraShort(e.id))).toEqual(['EARLY', "'60s", "'70s", "'80s", "'90s", "'00s", "'10s", 'TODAY']);
  });
});
