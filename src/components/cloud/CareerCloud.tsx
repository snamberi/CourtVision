import { useEffect,useState } from 'react';
import { useAccount } from '../../cloud/account';
import { listCareers } from '../../career/storage';
import type { CareerMeta } from '../../career/career';
import { listCloudCareers,uploadCareer,downloadCareer,removeCloudCareer,type CloudCareer } from '../../cloud/careerCloud';
export function CareerCloud() {
 const account=useAccount();
 return <CareerCloudAccount key={account.userId??'none'} userId={account.status==='signedIn'?account.userId:null} />;
}
function CareerCloudAccount({userId}:{userId:string|null}) {
 const [local,setLocal]=useState<CareerMeta[]>([]),[cloud,setCloud]=useState<CloudCareer[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[tick,setTick]=useState(0);
 useEffect(()=>{if(!userId)return;let live=true;void Promise.all([listCareers(),listCloudCareers()]).then(([a,b])=>{if(live){setLocal(a.filter(c=>c.status==='active'&&(!c.cloudOwner||c.cloudOwner===userId)));setCloud(b);}},e=>{if(live)setMessage(e instanceof Error?e.message:'Could not load cloud careers.');});return()=>{live=false;};},[userId,tick]);
 const act=async(task:()=>Promise<void>,text:string)=>{setBusy(true);try{await task();setMessage(text);setTick(t=>t+1);}catch(e){setMessage(e instanceof Error?e.message:'Could not save. Your local career is unchanged.');}finally{setBusy(false);}};
 return <section className="locker-bay"><h2>Active Career cloud saves</h2><p>Save your complete Career world, then load it on another device. Up to 10 cloud saves, 20 MB each. Saving is manual; save after leaving your Career. Other devices’ changes are never overwritten automatically.</p>
 {!userId?<p>Sign in to use cloud saves.</p>:<><button disabled={busy} onClick={()=>setTick(t=>t+1)}>Refresh careers</button><h3>On this device</h3>{!local.length&&<p>No active careers saved here.</p>}<ul className="cv-saved">{local.map(c=><li key={c.id}><span>{c.identity.name}</span><button disabled={busy} onClick={()=>void act(()=>uploadCareer(c.id),'Complete Career saved to your account.')}>Save to cloud</button></li>)}</ul><h3>Your cloud copies</h3>{!cloud.length&&<p>No cloud copies yet.</p>}<ul className="cv-saved">{cloud.map(c=><li key={c.career_id}><span>{c.meta.identity.name}<small>Saved {new Date(c.updated_at).toLocaleString()} · revision {c.revision}</small></span><button disabled={busy} onClick={()=>{if(window.confirm('Load this cloud Career? Its matching local Career will be replaced. Leave any running Career first.'))void act(()=>downloadCareer(c.career_id),'Career restored. Open Career Mode to continue.');}}>Load on this device</button><button disabled={busy} onClick={()=>{if(window.confirm('Delete this cloud copy? Your local Career stays on this device.'))void act(()=>removeCloudCareer(c.career_id),'Cloud copy deleted.');}}>Delete cloud copy</button></li>)}</ul></>}
 <p role="status">{message}</p></section>;
}
