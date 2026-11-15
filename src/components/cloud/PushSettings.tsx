import {useEffect,useState} from 'react';
import {useAccount} from '../../cloud/account';
import {enablePush,disablePush,pushEnabledForAccount,supportsPush} from '../../cloud/push';
export function PushSettings(){const account=useAccount();const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let live=true;void pushEnabledForAccount().then(v=>{if(live)setEnabled(v);},()=>{});return()=>{live=false;};},[account.userId]);
 return <section className="push-settings"><h3>Push notifications</h3><p>Get a notification for gifts and new friend scores, even when CourtVision is closed. Friend alerts are limited to one per friend per hour. No private message text is shown.</p>{!supportsPush()?<p>This browser cannot receive push here. On iPhone/iPad, add CourtVision to your Home Screen.</p>:<button disabled={busy||account.status!=='signedIn'} onClick={async()=>{setBusy(true);try{if(enabled)await disablePush();else await enablePush();setEnabled(await pushEnabledForAccount());setMessage(enabled?'Notifications disabled.':'Notifications enabled on this device.');}catch(e){setMessage(e instanceof Error?e.message:'Could not change notifications.');}finally{setBusy(false);}}}>{busy?'Updating…':enabled?'Disable push':'Enable push on this device'}</button>}<p role="status">{message}</p></section>;
}
