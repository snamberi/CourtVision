import { useState } from 'react';
import { CATEGORIES } from '../../career/categories';
import { OFFENSE_HINTS, DEFENSE_HINTS, ROLE_HINTS } from '../../simulation/hints';
import { RELICS, SECRET_RELICS } from '../../relics/relics';
import { HOLIDAYS } from '../../retention/holiday';
const entries = [
 ...CATEGORIES.map(x => ({name: x.name, type: 'Ratings', text: `${x.blurb} Fields: ${x.fields.map(([,key]) => key.replace(/([A-Z])/g,' $1')).join(', ')}.`})),
 ...Object.entries({...OFFENSE_HINTS, ...DEFENSE_HINTS, ...ROLE_HINTS}).map(([name,text]) => ({name: name.replace(/([A-Z])/g,' $1'), type: 'Ratings', text})),
 ...RELICS.map(x => ({name: x.name, type: 'Relics', text: `${x.rarity}. ${x.blurb} Equip in a slot to add luck.`})),
 ...SECRET_RELICS.map(x => ({name: x.name, type: 'Secrets', text: `${x.mode}: ${x.ability}`})),
 ...HOLIDAYS.map(x => ({name: x.coins, type: 'Currencies', text: `${x.name} currency. Used in its event shop; unused balances carry over to later occurrences of the same event.`})),
 {name:'Coins',type:'Currencies',text:'Earned through runs and rewards; spent on relic spins, upgrades and cosmetics.'},
 {name:'Gems',type:'Currencies',text:'Used for Ultra Lucky Spins, selected cosmetics and the second Mythic upgrade.'},
 {name:'Relic luck',type:'Relics',text:'Changes the weighting of eligible random draws. Daily and weekly shared-seed challenges ignore personal luck.'},
];
export function Glossary() {
 const [query,setQuery] = useState('');
 const found = entries.filter(x => `${x.name} ${x.type} ${x.text}`.toLowerCase().includes(query.trim().toLowerCase()));
 return <section className="qol-panel"><h2>Game glossary</h2><label>Search ratings, relics and currencies <input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label><p>{found.length} entries</p><div className="qol-glossary">{found.map((x,i) => <details key={`${x.type}-${x.name}-${i}`}><summary>{x.name} · {x.type}</summary><p>{x.text}</p></details>)}{!found.length && <p>No matching entries. Try a shorter term.</p>}</div></section>;
}
