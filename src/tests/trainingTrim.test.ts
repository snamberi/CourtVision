import { describe, it, expect } from 'vitest';
import { trimTraining, retiredData, TRAINING_HISTORY_MAX, TRAINING_DETAIL_KEEP } from '../simulation/playerDevelopment';
import type { PlayerTraining } from '../simulation/coachingModel';

describe('long saves stay small', () => {
  it('keeps the latest training entries, with details only on the newest few', () => {
    const tr = { history: Array.from({ length: 40 }, (_, i) => ({ date: `d${i}`, season: '2030', kind: 'training' as const, text: `t${i}`, changes: { 'offense.midrange': 0.5 } })) } as unknown as PlayerTraining;
    trimTraining(tr);
    expect(tr.history).toHaveLength(TRAINING_HISTORY_MAX);
    expect(tr.history.at(-1)!.text).toBe('t39');
    expect(tr.history.filter(e => e.changes)).toHaveLength(TRAINING_DETAIL_KEEP);
  });
  it('a retired player keeps his career, not his training log', () => {
    const p = { playerId: 'X', training: { history: [] } } as unknown as { playerId: string; training?: PlayerTraining };
    expect(retiredData(p)).toEqual({ playerId: 'X' });
  });
});
