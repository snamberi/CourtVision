// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('../cloud/account',()=>({getAccount:()=>({userId:'me'}),supa:vi.fn()}));
import {applyDeliveries,type Delivery} from '../relics/deliveries';
import {loadRelics,mergeRelics,RELICS_KEY} from '../relics/relics';
import {persistDeliveries} from '../cloud/deliveries';
const receipt:Delivery={id:'gift:test',coins:150,spins:2,lucky:1,gems:10,items:['ring'],cosmetics:['shop-test'],label:'Friend gift'};
beforeEach(()=>localStorage.clear());
it('retries every part of a gift exactly once',()=>{const s=applyDeliveries(loadRelics(()=>null),[receipt]);expect(s.coins).toBe(150);expect(s.owned.ring).toBe(1);const retry=applyDeliveries(s,[receipt]);expect(retry).toBe(s);expect(retry.gems).toBe(10);expect(retry.spins).toBe(2);});
it('preserves receipts and reward value when a stale device has more unrelated progress',()=>{const old=loadRelics(()=>null),gift=applyDeliveries(old,[receipt]);const stale={...old,opens:100,coins:50};for(const merged of [mergeRelics(stale,gift),mergeRelics(gift,stale)]){expect(merged.coins).toBe(200);expect(merged.owned.ring).toBe(1);expect(merged.gems).toBe(10);expect(applyDeliveries(merged,[receipt])).toBe(merged);}});
it('does not acknowledge a reward when local storage is full; retry recovers it',()=>{const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('disk full');});expect(()=>persistDeliveries([receipt],'me')).toThrow('disk full');spy.mockRestore();expect(persistDeliveries([receipt],'me')).toHaveLength(1);expect(persistDeliveries([receipt],'me')).toHaveLength(0);expect(JSON.parse(localStorage.getItem(RELICS_KEY)!).coins).toBe(150);});
it('never writes a receipt into another signed-in account',()=>{expect(()=>persistDeliveries([receipt],'other')).toThrow(/Account changed/);expect(localStorage.getItem(RELICS_KEY)).toBeNull();});
