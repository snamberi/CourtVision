import {it,expect,vi} from 'vitest';
vi.mock('../workers/enginePool',()=>({startEngineWorkers:()=>({ports:[],release:vi.fn(),stop:vi.fn()})}));
vi.mock('../history/retirees',()=>({slimRetirees:(x:unknown)=>x,restoreRetirees:(x:unknown)=>x}));
vi.mock('../profile/curryAchievement',()=>({noteCurryHigh:vi.fn()}));
it('reuses a successful Career coordinator, preserves payloads, and terminates on cancellation',async()=>{
 vi.useFakeTimers();
 const workers:FakeWorker[]=[];
 class FakeWorker {onmessage:((e:{data:unknown})=>void)|null=null;onerror:unknown=null;postMessage=vi.fn();terminate=vi.fn();constructor(){workers.push(this);}}
 vi.stubGlobal('Worker',FakeWorker);
 try{
  const {runCareerStep}=await import('../career/runner');
  const msg={type:'toDraft',league:{schedule:[],archive:['every year']},extras:{},seed:7,awardSettings:{}} as unknown as Parameters<typeof runCareerStep>[0];
  const first=runCareerStep(msg,vi.fn());const output={type:'atDraft',league:msg.league,extras:msg.extras,partial:{}};
  workers[0].onmessage!({data:output});expect(await first.done).toEqual(output);expect(workers[0].terminate).not.toHaveBeenCalled();
  const next=runCareerStep({...msg,seed:8},vi.fn());expect(workers).toHaveLength(1);expect(workers[0].postMessage.mock.calls[1][0].league).toEqual(msg.league);
  const cancelled=expect(next.done).rejects.toThrow('cancelled');next.cancel();await cancelled;expect(workers[0].terminate).toHaveBeenCalledOnce();
 }finally{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();}
});
