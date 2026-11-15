import { bearer,getUser,json,rest,type SupaEnv,type Fetch } from './supabase';
export interface PushEnv { publicKey: string; privateKey: string; subject: string; cronSecret?: string }
export function pushEnv(vars:Record<string,unknown>):PushEnv|null {
 const publicKey=vars.PUSH_VAPID_PUBLIC_KEY,privateKey=vars.PUSH_VAPID_PRIVATE_KEY,subject=vars.PUSH_VAPID_SUBJECT;
 return typeof publicKey==='string'&&typeof privateKey==='string'&&typeof subject==='string' ? {publicKey,privateKey,subject,cronSecret:typeof vars.PUSH_CRON_SECRET==='string'?vars.PUSH_CRON_SECRET:undefined}:null;
}
const decode=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const encode=(value:Uint8Array)=>btoa(String.fromCharCode(...value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
/** Explicit push-service allowlist, HTTPS only; never fetch arbitrary client-supplied URLs. */
export function validPushEndpoint(value:unknown):value is string {
 if(typeof value!=='string'||value.length>2048)return false;
 try {const u=new URL(value); return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&(
  u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||
  /^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname));}catch{return false;}
}
export async function vapidAuthorization(endpoint:string,config:PushEnv,now=Date.now()):Promise<string> {
 const pub=decode(config.publicKey); if(pub.length!==65||pub[0]!==4)throw new Error('Invalid VAPID public key');
 if(!/^(mailto:|https:\/\/)/.test(config.subject))throw new Error('Invalid VAPID subject');
 const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:encode(pub.slice(1,33)),y:encode(pub.slice(33)),d:config.privateKey}, {name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const text=(x:unknown)=>encode(new TextEncoder().encode(JSON.stringify(x)));
 const unsigned=`${text({typ:'JWT',alg:'ES256'})}.${text({aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+3600,sub:config.subject})}`;
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(unsigned));
 return `vapid t=${unsigned}.${encode(new Uint8Array(signature))}, k=${config.publicKey}`;
}
export async function handlePush(req:Request,env:SupaEnv|null,config:PushEnv|null,f:Fetch=fetch):Promise<Response> {
 if(!env)return json({error:'Accounts are unavailable.'},503);
 if(req.method==='GET')return json({enabled:!!config,publicKey:config?.publicKey??null});
 const token=bearer(req),user=token?await getUser(env,token,f).catch(()=>null):null;
 if(!user)return json({error:'Sign in first.'},401);
 if(req.method!=='POST')return json({error:'Method not allowed.'},405);
 let b:{action?:string;endpoint?:unknown};try{const text=await req.text();if(text.length>4096)return json({error:'Request too large.'},413);b=JSON.parse(text);if(!b||typeof b!=='object')return json({error:'Invalid request.'},400);}catch{return json({error:'Invalid request.'},400);}
 if(!validPushEndpoint(b.endpoint))return json({error:'Unsupported push service.'},400);
 try {
  if(b.action==='unsubscribe') {
   await rest(env,'DELETE',`push_subscriptions?user_id=eq.${user.id}&endpoint=eq.${encodeURIComponent(b.endpoint)}`,undefined,'return=minimal',f);return json({ok:true});
  }
  if(b.action!=='subscribe')return json({error:'Unknown action.'},400);
  if(!config)return json({error:'Push delivery is not configured yet.'},503);
  // Endpoint ownership can move only with its secret URL, on explicit browser opt-in.
  await rest(env,'POST','rpc/register_push_subscription',{p_user:user.id,p_endpoint:b.endpoint},undefined,f);
  return json({ok:true});
 }catch{return json({error:'Could not update notification settings.'},502);}
}
/** No private payload leaves the app: a standards-compliant empty Web Push wakes the service worker. */
export async function dispatchPush(env:SupaEnv|null,config:PushEnv|null,f:Fetch=fetch):Promise<{sent:number;failed:number}> {
 if(!env||!config)return {sent:0,failed:0};
 const jobs=await rest(env,'POST','rpc/lease_push_jobs',{},undefined,f) as {id:string;user_id:string;lease:string}[];
 let sent=0,failed=0;
 for(const job of jobs){
  let retry=false;
  try{
   const subs=await rest(env,'GET',`push_subscriptions?user_id=eq.${job.user_id}&select=endpoint`,undefined,undefined,f) as {endpoint:string}[];
   for(const sub of subs){
    if(!validPushEndpoint(sub.endpoint))continue;
    try{
     const res=await f(sub.endpoint,{method:'POST',redirect:'error',headers:{Authorization:await vapidAuthorization(sub.endpoint,config),TTL:'86400',Urgency:'normal','Content-Length':'0'},signal:AbortSignal.timeout(10000)});
     if(res.status===404||res.status===410)await rest(env,'DELETE',`push_subscriptions?user_id=eq.${job.user_id}&endpoint=eq.${encodeURIComponent(sub.endpoint)}`,undefined,'return=minimal',f);
     else if(!res.ok)retry=true;else sent++;
    }catch{retry=true;}
   }
  }catch{retry=true;}
  if(retry)failed++;
  await rest(env,'POST','rpc/finish_push_job',{p_id:job.id,p_lease:job.lease,p_retry:retry},undefined,f);
 }
 return {sent,failed};
}
