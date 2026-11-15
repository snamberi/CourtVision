import { expect, it } from 'vitest';
import { eventKeysLeft, loadRelics, mergeRelics, spinEventRelic } from '../relics/relics';
it('spends carried keys only in their active event and preserves spent keys across merges', () => {
  const base = { ...loadRelics(() => null), eventKeys: { 'halloween-2026': 3, 'christmas-2026': 8 }, eventKeysUsed: { 'halloween-2026': 1 } };
  expect(eventKeysLeft(base, 'halloween-2027')).toBe(2);
  expect(spinEventRelic(base, 'halloween', new Date('2027-11-02'))).toBeNull();
  const first = spinEventRelic(base, 'halloween', new Date('2027-10-02'), () => 0.5)!.state;
  expect(eventKeysLeft(first, 'halloween-2027')).toBe(1);
  expect(eventKeysLeft(mergeRelics(base, first), 'halloween-2027')).toBe(1);
  const second = spinEventRelic(first, 'halloween', new Date('2027-10-02'), () => 0.5)!.state;
  expect(eventKeysLeft(second, 'halloween-2027')).toBe(0);
  expect(spinEventRelic(second, 'halloween', new Date('2027-10-02'))).toBeNull();
  expect(eventKeysLeft(second, 'christmas-2027')).toBe(8);
});
