import { useState } from 'react';
import { sendOwnerGift } from '../../cloud/social';
import { hasOwnerAccess } from '../../profile/ownerAccess';
import { RELICS } from '../../relics/relics';
import { SHOP_COSMETICS, SECRET_COSMETICS } from '../../relics/shopCosmetics';
export function OwnerGift() {
  const [to, setTo] = useState(''), [message, setMessage] = useState(''), [item, setItem] = useState(''), [cosmetic, setCosmetic] = useState('');
  const [amounts, setAmounts] = useState({ coins: 0, spins: 0, lucky: 0, gems: 0 });
  const [busy, setBusy] = useState(false), [note, setNote] = useState('');
  if (!hasOwnerAccess()) return null;
  return <section className="locker-bay"><h2>Owner gifts</h2><p>One gift per recipient per UTC day. The server checks your owner role.</p><form onSubmit={async e => { e.preventDefault(); setBusy(true); try { await sendOwnerGift({ to: to.trim(), message, ...amounts, items: item ? [item] : [], cosmetics: cosmetic ? [cosmetic] : [] }); setNote('Gift sent.'); } catch(e) { setNote(e instanceof Error ? e.message : 'Could not send gift.'); } finally { setBusy(false); } }}>
    <label>Recipient account ID <input required value={to} onChange={e=>setTo(e.target.value)} /></label><label>Message <textarea maxLength={300} value={message} onChange={e=>setMessage(e.target.value)} /></label>
    {(['coins','spins','lucky','gems'] as const).map(k=><label key={k}>{k === 'lucky' ? 'Lucky Spins' : k}<input type="number" min={0} max={k==='coins'?10000000:k==='gems'?100000:10000} step={1} value={amounts[k]} onChange={e=>setAmounts({...amounts,[k]:Number(e.target.value)})} /></label>)}
    <label>Relic <select value={item} onChange={e=>setItem(e.target.value)}><option value="">None</option>{RELICS.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Cosmetic <select value={cosmetic} onChange={e=>setCosmetic(e.target.value)}><option value="">None</option>{[...SHOP_COSMETICS,...SECRET_COSMETICS].map(c=><option key={c.key} value={c.key}>{c.name}</option>)}</select></label><button disabled={busy}>{busy?'Sending…':'Send custom gift'}</button><p role="status">{note}</p></form></section>;
}
