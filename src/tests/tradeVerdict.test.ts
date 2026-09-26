import { describe, it, expect } from 'vitest';
import { tradeVerdict } from '../components/gmShared';

describe('tradeVerdict', () => {
  it('flags a heavily favorable trade as a great offer', () => {
    expect(tradeVerdict(50, 80).className).toBe('verdict-great');
  });

  it('flags a mildly favorable trade as a good offer', () => {
    expect(tradeVerdict(50, 58).className).toBe('verdict-good');
  });

  it('flags a roughly even trade as fair', () => {
    expect(tradeVerdict(50, 51).className).toBe('verdict-fair');
  });

  it('flags a mildly unfavorable trade as bad', () => {
    expect(tradeVerdict(50, 40).className).toBe('verdict-bad');
  });

  it('flags a heavily lopsided trade as terrible', () => {
    expect(tradeVerdict(50, 10).className).toBe('verdict-terrible');
  });

  it('handles the "nothing selected" case distinctly', () => {
    expect(tradeVerdict(0, 0).className).toBe('verdict-neutral');
  });

  it('treats a one-sided giveaway (0 given, something received) as a great offer', () => {
    expect(tradeVerdict(0, 20).className).toBe('verdict-great');
  });
});
