import { describe, expect, it, vi, afterEach } from 'vitest';
import { loadRelics, premiumSpinMany, luckySpin, ultraLuckySpin, type RelicState } from '../relics/relics';
afterEach(() => vi.useRealTimers());
describe('premium batches', () => {
 it('requires the full cost up front and leaves insufficient funds untouched', () => {
   const s = { ...loadRelics(), coins: 9999, gems: 199 };
   expect(premiumSpinMany(s,'lucky')).toBeNull(); expect(premiumSpinMany(s,'ultra')).toBeNull();
   expect(s.coins).toBe(9999); expect(s.gems).toBe(199);
 });
 it('spends exactly ten free tickets and honors the discounted batch threshold', () => {
   const s = { ...loadRelics(), coins: 9000, luckySpins: 12 };
   expect(premiumSpinMany(s, 'free')!.state.luckySpins).toBe(2);
   expect(premiumSpinMany(s, 'lucky', .2)).not.toBeNull();
   expect(premiumSpinMany({ ...s, coins: 8999 }, 'lucky', .2)).toBeNull();
 });
 it('matches ten individual rolls, including costs, pity and duplicate rewards', () => {
   vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
   for (const kind of ['lucky','ultra'] as const) {
     const initial = { ...loadRelics(), coins: 20000, gems: 300 };
     const batch = premiumSpinMany(initial,kind,0,()=>.4)!;
     let s: RelicState=initial;
     for(let i=0;i<10;i++) s=(kind==='lucky'?luckySpin(s,()=>.4):ultraLuckySpin(s,()=>.4))!.state;
     expect({ ...batch.state, gemLedger: undefined }).toEqual({ ...s, gemLedger: undefined });
     expect(Object.values(batch.state.gemLedger ?? {}).sort()).toEqual(Object.values(s.gemLedger ?? {}).sort()); expect(batch.results).toHaveLength(10);
   }
 });
});
