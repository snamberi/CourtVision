import { describe, it, expect } from 'vitest';
import { changeGems, gemBalance, loadRelics, claimDailyChest, ultraLuckySpin, upgradeRelic, relicLuck, RELIC_BY_ID, RELICS, fuseDuplicates, relicCoinBoost, mergeRelics, PITY } from '../relics/relics';
import { RELEASE_ACHIEVEMENTS } from '../profile/modeAchievements';
const fresh = () => loadRelics(() => null);
describe('Update 50 economy', () => {
 it('merges gem receipts without restoring spent gems or duplicating the daily grant', () => {
  const grant = changeGems(fresh(), 30, 'chest:2026-11-01');
  const spent = changeGems(grant, -20, 'spin:one');
  expect(changeGems(grant, 30, 'chest:2026-11-01')).toBe(grant);
  expect(gemBalance(mergeRelics(spent, grant))).toBe(10);
  expect(gemBalance(mergeRelics(grant, spent))).toBe(10);
  expect(changeGems(spent, -20, 'spin:two')).toBe(spent);
 });
 it('ignores malformed rewarded-ad history in saved profiles', () => {
  const read = () => JSON.stringify({...fresh(), adRewards: 'invalid'});
  expect(loadRelics(read).adRewards).toEqual([]);
 });
 it('adds ten Mythics and 100 unique achievements', () => { expect(RELICS.filter(r=>r.rarity==='mythic')).toHaveLength(15); expect(RELEASE_ACHIEVEMENTS).toHaveLength(100); expect(new Set(RELEASE_ACHIEVEMENTS.map(a=>a.id)).size).toBe(100); });
 it('grants the chest once per UTC date with bounded gems and relic counts', () => {
  const day=new Date('2026-11-01T23:59:59Z'); const out=claimDailyChest(fresh(),day,()=>0.999)!;
  expect(out.gems).toBe(30); expect(out.results).toHaveLength(5); expect(out.state.spins).toBe(2);
  expect(claimDailyChest(out.state,day)).toBeNull(); expect(claimDailyChest(out.state,new Date('2026-11-02'),()=>0)!.gems).toBe(12);
 });
 it('Ultra spins charge gems and only drop Epic+ or regular Secrets', () => {
  expect(ultraLuckySpin(fresh())).toBeNull();
  const out=ultraLuckySpin({...fresh(),gems:20},()=>0.5)!;expect(out.state.gems).toBe(0);expect(['epic','legendary','mythic','secret']).toContain(out.result.rarity);
  const secret=ultraLuckySpin({...fresh(),gems:20},()=>0)!;expect(secret.result.kind).toBe('secret');
 });
 it('requires 25 Legendary spares for crafting a Mythic',()=>{
  expect(fuseDuplicates({...fresh(),owned:{ring:25}},'legendary')).toBeNull();
  const out=fuseDuplicates({...fresh(),owned:{ring:26}},'legendary',()=>0)!;expect(out.result.rarity).toBe('mythic');expect(out.state.fused?.ring).toBe(25);expect(PITY.mythic).toBe(500);
 });
 it('preserves old upgrades and charges the second Mythic upgrade exactly once',()=>{
  const first={...fresh(),coins:100000,gems:50,owned:{firstBall:1},upgraded:['firstBall'],equipped:['firstBall']};
  const next=upgradeRelic(first,'firstBall')!;expect(next.coins).toBe(0);expect(next.gems).toBe(0);expect(next.mastery).toEqual(['firstBall']);expect(upgradeRelic(next,'firstBall')).toBeNull();
  expect(relicLuck(RELIC_BY_ID.get('firstBall')!,1,2)).toBe(10);expect(relicCoinBoost(next)).toBe(12.5);
  expect(mergeRelics(next,first).mastery).toContain('firstBall');
 });
});
