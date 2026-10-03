import { describe, expect, it } from 'vitest';
import { ordinal, plural, shortMoney } from '../lib/humanize';

describe('humanize helpers', () => {
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
  });
  it('plurals', () => {
    expect(plural(1, 'season')).toBe('1 season');
    expect(plural(3, 'season')).toBe('3 seasons');
    expect(plural(0, 'game')).toBe('0 games');
  });
  it('short money', () => {
    expect(shortMoney(20_839_187)).toBe('$20.84M');
    expect(shortMoney(950_000)).toBe('$950k');
  });
});
