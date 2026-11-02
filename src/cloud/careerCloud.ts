import { getAccount, supa } from './account';
import { readCareerSnapshot, restoreCareers, tagCareerOwner, type CareerWorld } from '../career/storage';
import type { CareerMeta } from '../career/career';
export interface CloudCareer { career_id: string; revision: number; meta: CareerMeta; updated_at: string }
const revisionKey = (user: string,id: string) => `courtvision-career-revision:${user}:${id}`;
function owner(): string { const id=getAccount().userId; if(!id) throw new Error('Sign in first.'); return id; }
function stillOwner(id:string) {if(getAccount().userId!==id) throw new Error('Account changed. Try again.');}
export async function listCloudCareers(): Promise<CloudCareer[]> {
 const me=owner(), client=await supa();
 const {data,error}=await client.from('career_snapshots').select('career_id,revision,meta,updated_at').eq('user_id',me).order('updated_at',{ascending:false});
 if(error) throw new Error(error.message); stillOwner(me); return (data??[]) as CloudCareer[];
}
export async function uploadCareer(id:string): Promise<void> {
 const me=owner(), snapshot=await readCareerSnapshot(id);
 if(!snapshot || snapshot.meta.status!=='active') throw new Error('No active career world is saved on this device.');
 if(snapshot.meta.cloudOwner && snapshot.meta.cloudOwner!==me) throw new Error('This career belongs to another account.');
 const localOwner=localStorage.getItem('cv-cloud-owner');
 if(!snapshot.meta.cloudOwner && localOwner && localOwner!==me) throw new Error('This local save belongs to another account.');
 const revision=Number(localStorage.getItem(revisionKey(me,id))??0);
 if(!Number.isSafeInteger(revision)||revision<0) throw new Error('Load the cloud copy before saving this career.');
 const client=await supa(); stillOwner(me);
 const {data,error}=await client.rpc('save_career_snapshot',{p_id:id,p_revision:revision,p_meta:{...snapshot.meta,cloudOwner:me},p_world:snapshot.world});
 if(error) throw new Error(error.message); stillOwner(me);
 await tagCareerOwner(id,me);
 localStorage.setItem(revisionKey(me,id),String(data));
}
export async function downloadCareer(id:string): Promise<void> {
 const me=owner(),client=await supa();
 const {data,error}=await client.from('career_snapshots').select('meta,world,revision').eq('user_id',me).eq('career_id',id).single();
 if(error) throw new Error(error.message); stillOwner(me);
 const row=data as {meta:CareerMeta;world:CareerWorld;revision:number};
 if(row.meta?.id!==id || row.world?.id!==id || row.meta.cloudOwner!==me || !row.world.league || !row.world.extras) throw new Error('The cloud snapshot is invalid. Your local save was not changed.');
 await restoreCareers({metas:[row.meta],worlds:[row.world]});
 localStorage.setItem(revisionKey(me,id),String(row.revision));
 window.dispatchEvent(new Event('courtvision:progress'));
}
export async function removeCloudCareer(id:string): Promise<void> {
 const me=owner(),client=await supa();
 const {error}=await client.from('career_snapshots').delete().eq('user_id',me).eq('career_id',id);
 if(error) throw new Error(error.message); stillOwner(me); localStorage.removeItem(revisionKey(me,id));
}
