import { useState, useEffect } from 'react';
const KEY='cv-page-pins', EVENT='cv-page-pins-changed';
type Pin={route:string;name:string};
const read=():Pin[]=>{try{const data=JSON.parse(localStorage.getItem(KEY)??'[]');return Array.isArray(data)?data.filter(x=>typeof x?.name==='string'&&typeof x?.route==='string'&&x.route.startsWith('#/')).slice(0,8):[];}catch{return [];}};
export function PagePins({name,canPin=true}:{name?:string;canPin?:boolean}) {
 const [pins,setPins]=useState(read),[note,setNote]=useState('');
 useEffect(()=>{const update=()=>setPins(read());window.addEventListener(EVENT,update);window.addEventListener('storage',update);return()=>{window.removeEventListener(EVENT,update);window.removeEventListener('storage',update);};},[]);
 const save=(next:Pin[])=>{try{localStorage.setItem(KEY,JSON.stringify(next));setPins(next);window.dispatchEvent(new Event(EVENT));setNote('');}catch{setNote('Could not save page pins.');}};
 const pin=()=>{const route=location.hash;if(!route.startsWith('#/'))return;const current=read();if(current.some(p=>p.route===route)){setNote('This page is already pinned.');return;}if(current.length>=8){setNote('Unpin a page first (maximum eight).');return;}save([...current,{route,name:(name??document.querySelector('h1')?.textContent??'Saved page').slice(0,60)}]);};
 return <details className="page-pin-menu"><summary>Pinned pages · {pins.length}</summary>{canPin&&<button onClick={pin}>Pin this page</button>}<ul>{pins.map(p=><li key={p.route}><a href={p.route}>{p.name}</a><button aria-label={`Unpin ${p.name}`} onClick={()=>save(pins.filter(x=>x.route!==p.route))}>×</button></li>)}</ul>{!pins.length&&<small>Pin pages to return to them directly.</small>}{note&&<small role="status">{note}</small>}</details>;
}
