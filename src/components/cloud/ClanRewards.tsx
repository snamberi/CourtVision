import { useState } from 'react';
import { claimRewardRpc } from '../../cloud/deliveries';
export function ClanRewards() {
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <section className="locker-bay"><h2>Clan rewards</h2>
 <p>Every 5 clan-pass tiers: 500 coins, 1 spin and 5 gems. Each milestone pays once per account, even if you change clans.</p>
 <table className="db-table"><thead><tr><th>Last week’s place</th><th>Coins</th><th>Spins</th><th>Gems</th></tr></thead><tbody>{[[1,3000,5,50],['2–3',2000,4,30],['4–10',1000,3,20],['11+',500,2,10]].map(r=><tr key={r[0]}>{r.map((v,i)=><td key={i}>{v}</td>)}</tr>)}</tbody></table>
 <p className="hint-text">Weekly rewards are settled when first claimed after Monday 00:00 UTC. You must still be in the clan, have joined before that week began and have scored on a weekly board. Settled rewards remain yours if you leave.</p>
 <button disabled={busy} onClick={async()=>{setBusy(true);try{const got=await claimRewardRpc('claim_clan_rewards');setMessage(got.length?`Collected ${got.reduce((n,r)=>n+r.coins,0)} coins, ${got.reduce((n,r)=>n+r.spins,0)} spins and ${got.reduce((n,r)=>n+r.gems,0)} gems.`:'All available rewards are already collected.');}catch(e){setMessage(e instanceof Error?e.message:'Could not collect rewards. Try again.');}finally{setBusy(false);}}}>{busy?'Collecting…':'Collect clan rewards'}</button><p role="status">{message}</p>
 </section>;
}
