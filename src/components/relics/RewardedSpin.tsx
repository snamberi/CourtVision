import { useEffect, useRef, useState } from 'react';
import { useConsent } from '../../consent/consent';
import { advertisingPermitted } from '../../ads/adPolicy';
import { loadRelics, saveRelics, grantLuckySpins } from '../../relics/relics';
interface RewardPlacement { type: 'reward'; name: string; beforeReward: (show: () => void) => void; adViewed: () => void; adBreakDone: () => void }
declare global { interface Window { adBreak?: (placement: RewardPlacement) => void } }
/** Enabled only after a rewarded-ad provider is configured; ordinary banners never grant rewards. */
export function RewardedSpin() {
  const consent = useConsent();
  const [show, setShow] = useState<(() => void) | null>(null), [busy,setBusy] = useState(false), [note,setNote] = useState('');
  const pending = useRef(false), mounted = useRef(true), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); }; }, []);
  if (import.meta.env.VITE_REWARDED_ADS_ENABLED !== 'true') return null;
  const request = () => {
    if (pending.current) return;
    if (!advertisingPermitted(consent) || !window.adBreak) { setNote('Rewarded video is unavailable right now.'); return; }
    const now=Date.now(), recent=(loadRelics().adRewards ?? []).filter(t=>t>now-3600000);
    if(recent.length>=3){setNote('Three rewards collected. Try again after your oldest reward is one hour old.');return;}
    pending.current = true; setBusy(true); setNote('Checking for a video…');
    let granted=false, expired=false;
    const finish = (message?: string) => {
      clearTimeout(timer.current); pending.current=false;
      if (mounted.current) { setBusy(false); setShow(null); if(message)setNote(message); }
    };
    timer.current=setTimeout(()=>{expired=true;finish('No video became available. Please try again later.');},30000);
    try {
      window.adBreak({type:'reward',name:'courtvision-lucky-spin',beforeReward:fn=>{
        if(expired || !mounted.current)return;
        clearTimeout(timer.current);
        setNote('A video is available. Complete it to earn one Lucky Spin.');
        setShow(()=>()=>{if(!advertisingPermitted(consent)){expired=true;finish('Advertising consent is required.');return;}fn();});
      },adViewed:()=>{
        if(granted || expired)return;
        granted=true;
        const state=loadRelics(),at=Date.now(),times=(state.adRewards??[]).filter(t=>t>at-3600000);
        if(times.length<3){saveRelics({...grantLuckySpins(state,1),adRewards:[...times,at]});if(mounted.current)setNote('One Lucky Spin added to your vault.');}
      },adBreakDone:()=>{expired=true;finish(granted?undefined:'No completed video; no reward used.');}});
    } catch { expired=true;finish('The video provider is unavailable. Please try again later.'); }
  };
  return <section className="relic-offer"><span><b>Video reward</b><small>Watch a complete video for one Lucky Spin. Up to three per rolling hour.</small></span>{show?<button onClick={()=>{const fn=show;setShow(null);fn();}}>Watch video for 1 Lucky Spin</button>:<button disabled={busy} onClick={request}>Check video availability</button>}<p role="status">{note}</p></section>;
}
