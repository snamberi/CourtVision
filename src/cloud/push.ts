import { accessToken,getAccount } from './account';
export const supportsPush=()=>typeof window!=='undefined'&&window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const OWNER='courtvision-push-owner';
async function post(action:string,endpoint:string){const token=accessToken();if(!token)throw new Error('Sign in first.');const res=await fetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,endpoint})});if(!res.ok)throw new Error('Could not update push settings. Try again.');}
export async function enablePush():Promise<void>{
 const owner=getAccount().userId;if(!owner)throw new Error('Sign in first.');if(!supportsPush())throw new Error('This browser does not support push. On iPhone/iPad, add CourtVision to your Home Screen first.');
 // Request from the explicit button gesture; never prompt on page load.
 const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Notifications are blocked. You can change this in your browser settings.');
 const res=await fetch('/api/push');const config=await res.json() as {enabled:boolean;publicKey:string};if(!res.ok||!config.enabled||!config.publicKey)throw new Error('Push delivery is not configured on this site yet.');
 const registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
 let sub=await registration.pushManager.getSubscription();
 if(sub && localStorage.getItem(OWNER)!==owner){await sub.unsubscribe();sub=null;}
 const key=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 sub??=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 if(getAccount().userId!==owner){await sub.unsubscribe();throw new Error('Account changed. Enable notifications again.');}
 try{await post('subscribe',sub.endpoint);localStorage.setItem(OWNER,owner);}catch(e){await sub.unsubscribe();throw e;}
}
export async function disablePush():Promise<void>{
 if(!supportsPush())return;
 const registration=await navigator.serviceWorker.getRegistration('/sw.js');const sub=await registration?.pushManager.getSubscription();
 if(sub){try{await post('unsubscribe',sub.endpoint);}finally{await sub.unsubscribe();localStorage.removeItem(OWNER);}}else localStorage.removeItem(OWNER);
}
export async function pushEnabledForAccount():Promise<boolean>{
 if(!supportsPush()||localStorage.getItem(OWNER)!==getAccount().userId)return false;
 return !!(await navigator.serviceWorker.getRegistration('/sw.js'))?.pushManager && !!(await (await navigator.serviceWorker.getRegistration('/sw.js'))?.pushManager.getSubscription());
}
/** Revoke the browser endpoint on sign-out/account switches even if the API is unreachable. */
export async function clearForeignPush(userId:string|null):Promise<void>{
 if(!supportsPush())return;const owner=localStorage.getItem(OWNER);if(!owner||owner===userId)return;
 const sub=await (await navigator.serviceWorker.getRegistration('/sw.js'))?.pushManager.getSubscription();await sub?.unsubscribe();localStorage.removeItem(OWNER);
}
