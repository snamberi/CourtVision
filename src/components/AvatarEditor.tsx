import { useState, type CSSProperties } from 'react';
import { AVATAR_CATEGORIES, saveAvatar, randomAvatar, avatarHow, avatarItem, outfitDef, type AvatarCategory, type AvatarItem, type AvatarLook } from '../profile/avatar';
import { unlockContext, isOpen } from '../profile/cosmetics';
import { totalXp, levelFor } from '../profile/profile';
import { readAvatarPresets, writeAvatarPresets } from '../profile/avatarPresets';
import { UserAvatar, useAvatar } from './UserAvatar';
import { PixelIcon } from './PixelIcon';
import { REAL_FRANCHISES } from '../profile/favorites';
import { outfitKit } from '../visuals/avatarSprite';
import './customization.css';

const HEAD: AvatarCategory[] = ['hair', 'hairColor', 'beard', 'hat', 'eyes'];
const ICONS: Record<AvatarCategory, string> = { skin: 'team', hair: 'team', hairColor: 'star', beard: 'team', outfit: 'jersey', hat: 'crown', eyes: 'search', neck: 'star', shoes: 'shoe', aura: 'flame' };
const DESCRIPTIONS: Record<AvatarCategory, string> = {
  skin: 'Natural tones and colors from another world.', hair: 'Find your cut. Every texture has its own character.',
  hairColor: 'The finishing touch for your hair and beard.', beard: 'From a clean shave to a signature beard.',
  outfit: 'From the hardwood to the front office. Dress your part.', hat: 'Caps, headbands, and a little extra personality.',
  eyes: 'Glasses, goggles, and statement shades.', neck: 'The details that make the look yours.',
  shoes: 'Finish your fit from the ground up.', aura: 'Make an entrance. Earn effects as you play.',
};

/** Auto-saving wardrobe with local undo, previews that respect unlocks, and three saved looks. */
export function AvatarEditor() {
  const { look, team } = useAvatar();
  const [cat, setCat] = useState<AvatarCategory>('outfit');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'full' | 'portrait'>('full');
  const [preview, setPreview] = useState<{ cat: AvatarCategory; item: AvatarItem } | null>(null);
  const [history, setHistory] = useState<AvatarLook[]>([]);
  const [slots, setSlots] = useState(readAvatarPresets);
  const [slotName, setSlotName] = useState('');
  const [status, setStatus] = useState('Changes save automatically.');
  /** Just picked a jersey: ask for its team and number. */
  const [jerseyAsk, setJerseyAsk] = useState(false);
  const ctx = unlockContext(levelFor(totalXp()).level);
  const open = (i: AvatarItem) => isOpen(i.rule, ctx);
  const category = AVATAR_CATEGORIES.find(c => c.id === cat)!;
  const openCount = (items: AvatarItem[]) => items.filter(open).length;
  const allOpen = AVATAR_CATEGORIES.reduce((n, c) => n + openCount(c.items), 0);
  const all = AVATAR_CATEGORIES.reduce((n, c) => n + c.items.length, 0);
  const shown = category.items.filter(i => (!query.trim() || i.name.toLowerCase().includes(query.trim().toLowerCase())) && (filter === 'all' || (filter === 'open' ? open(i) : !open(i))));
  const display = preview ? { ...look, [preview.cat]: preview.item.id } : look;
  const commit = (next: AvatarLook, message: string) => {
    setPreview(null);
    if (JSON.stringify(next) !== JSON.stringify(look)) { setHistory(h => [...h.slice(-19), look]); saveAvatar(next); }
    setStatus(message);
  };
  const changeCategory = (next: AvatarCategory) => { setCat(next); setQuery(''); setPreview(null); };
  const shuffleCategory = () => {
    const choices = category.items.filter(i => open(i) && i.id !== look[cat]);
    if (choices.length) { const i = choices[Math.floor(Math.random() * choices.length)]; commit({ ...look, [cat]: i.id }, `${i.name} equipped.`); }
  };
  const storeSlot = (index: number) => {
    const next = slots.map((s, i) => i === index ? { name: slotName.trim().slice(0, 28) || `Look ${index + 1}`, look: { ...look } } : s);
    if (writeAvatarPresets(next)) { setSlots(next); setSlotName(''); setStatus(`Saved ${next[index]!.name}.`); }
    else setStatus('This browser could not save the look. Please check storage access.');
  };
  const loadSlot = (index: number) => {
    const slot = slots[index]; if (!slot) return;
    const next = { ...look }; let skipped = false;
    for (const c of AVATAR_CATEGORIES) {
      const item = avatarItem(c.id, slot.look[c.id]);
      if (item && open(item)) next[c.id] = item.id; else skipped = true;
    }
    commit(next, skipped ? 'Look loaded. Locked pieces kept their current choices.' : `${slot.name} equipped.`);
  };

  return <section className="character-studio" aria-label="Your character">
    <header className="studio-heading"><div><span className="pixel-eyebrow">MAKE IT YOURS</span><h2>Character studio</h2><p>Your style, down to the last pixel.</p></div>
      <div className="studio-collection"><strong>{allOpen}<span> / {all}</span></strong><small>PIECES UNLOCKED</small><meter min={0} max={all} value={allOpen} aria-label="Pieces unlocked" /></div>
    </header>
    <div className="studio-layout">
      <aside className="studio-preview-column">
        <div className="studio-stage" style={{ '--studio-kit': team?.primary ?? '#f47b20' } as CSSProperties}>
          <div className="studio-stage-label"><span><i /> LIVE PREVIEW</span><span>CV / 01</span></div>
          <div className="studio-view" role="group" aria-label="Preview view">
            {(['full', 'portrait'] as const).map(v => <button type="button" key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'full' ? 'Full body' : 'Portrait'}</button>)}
          </div>
          <div className={`studio-character studio-character--${view}`}><div className="studio-locker-lines" aria-hidden="true" /><UserAvatar look={display} team={team} size={view === 'full' ? 210 : 194} mode={view} title={preview ? `Trying ${preview.item.name}` : 'Your character'} /><div className="studio-platform" aria-hidden="true" /></div>
          <div className="studio-stage-caption"><small>{preview ? 'TRYING ON · NOT EQUIPPED' : 'CURRENT LOOK'}</small><strong>{preview?.item.name ?? avatarItem('outfit', look.outfit)?.name}</strong></div>
        </div>
        {preview && <div className="studio-tryon" role="status"><PixelIcon name="lock" size={16} /><span>Unlock at {avatarHow(preview.item).toLowerCase()}.</span><button type="button" onClick={() => setPreview(null)}>Close preview</button></div>}
        <div className="studio-actions"><button type="button" className="primary" onClick={() => commit(randomAvatar(Math.random, (_c, i) => open(i)), 'New look equipped.')}><PixelIcon name="shuffle" size={16} /> Shuffle look</button>
          <button type="button" disabled={!history.length} onClick={() => { const last = history.at(-1); if (last) { saveAvatar(last); setHistory(h => h.slice(0, -1)); setPreview(null); setStatus('Last change undone.'); } }}>Undo</button></div>
        <div className="studio-equipped"><span className="studio-label">ON YOUR CHARACTER</span><div>{(['outfit', 'hair', 'hat', 'shoes', 'aura'] as AvatarCategory[]).map(c => <button type="button" key={c} onClick={() => changeCategory(c)}><PixelIcon name={ICONS[c]} size={14} /><span>{avatarItem(c, look[c])?.name}</span></button>)}</div></div>
        <div className="studio-save-looks"><div className="studio-section-title"><h3>Saved looks</h3><small>3 slots</small></div>
          <label className="studio-preset-name">Name this look<input value={slotName} maxLength={28} placeholder="e.g. Courtside" onChange={e => setSlotName(e.target.value)} /></label>
          <div className="studio-slots">{slots.map((slot, i) => <div className="studio-slot" key={i}><button className="studio-slot-load" type="button" disabled={!slot} onClick={() => loadSlot(i)} aria-label={slot ? `Wear ${slot.name}` : `Empty look slot ${i + 1}`}>
            {slot ? <UserAvatar look={slot.look} team={team} size={35} animate={false} /> : <span className="studio-slot-plus">+</span>}<span>{slot?.name ?? `Slot ${i + 1}`}</span></button>
            <button type="button" className="studio-slot-save" onClick={() => storeSlot(i)} aria-label={slot ? `Replace saved look ${i + 1}` : `Save look to slot ${i + 1}`}>{slot ? 'Replace' : 'Save'}</button></div>)}</div>
        </div>
      </aside>
      <div className="studio-browser">
        <div className="studio-categories" role="group" aria-label="Character categories">{AVATAR_CATEGORIES.map(c => <button type="button" key={c.id} aria-pressed={cat === c.id} onClick={() => changeCategory(c.id)}><PixelIcon name={ICONS[c.id]} size={17} /><span>{c.label}</span><small>{openCount(c.items)}/{c.items.length}</small></button>)}</div>
        <div className="studio-section-title studio-category-heading"><div><h3>{category.label}</h3><p>{DESCRIPTIONS[cat]}</p></div><button type="button" onClick={shuffleCategory} aria-label={`Shuffle ${category.label}`} title={`Shuffle unlocked ${category.label.toLowerCase()}`}><PixelIcon name="shuffle" size={18} /></button></div>
        <div className="studio-toolbar"><label className="studio-search"><PixelIcon name="search" size={16} /><input type="search" value={query} placeholder={`Search ${category.label.toLowerCase()}…`} aria-label={`Search ${category.label.toLowerCase()}`} onChange={e => setQuery(e.target.value)} /></label>
          <select aria-label="Filter pieces" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All pieces</option><option value="open">Unlocked</option><option value="locked">Locked</option></select></div>
        {cat === 'hair' && <p className="studio-hint">Hair previews show the cut without headwear.</p>}
        {cat === 'outfit' && outfitDef(look.outfit).kind === 'jersey' && <JerseyPanel key={look.outfit} look={look} ask={jerseyAsk} onChange={(next, msg) => commit(next, msg)} onDone={() => setJerseyAsk(false)} />}
        <div className="studio-results"><span>{shown.length} {shown.length === 1 ? 'piece' : 'pieces'}</span><span>Click a locked piece to try it on</span></div>
        <div className="studio-grid" role="group" aria-label={`${category.label} choices`}>{shown.map(i => {
          const unlocked = open(i), equipped = look[cat] === i.id, trying = preview?.cat === cat && preview.item.id === i.id;
          return <button type="button" key={i.id} aria-pressed={equipped} className={`studio-tile${equipped ? ' selected' : ''}${!unlocked ? ' locked' : ''}${trying ? ' trying' : ''}`} onClick={() => { if (!unlocked) { setPreview({ cat, item: i }); return; } commit({ ...look, [cat]: i.id }, `${i.name} equipped.`); if (cat === 'outfit' && outfitDef(i.id).kind === 'jersey') setJerseyAsk(true); }} aria-label={`${i.name}${unlocked ? equipped ? ', equipped' : '' : `, locked: ${avatarHow(i)}, preview`}`}>
            <span className="studio-tile-state">{equipped ? <PixelIcon name="check" size={13} /> : !unlocked ? <PixelIcon name="lock" size={13} /> : null}</span>
            <span className="studio-tile-art">{i.hex && <span className={`studio-color-chip${i.hex === 'rainbow' ? ' rainbow' : ''}`} style={i.hex !== 'rainbow' ? { background: i.hex } : undefined} />}<UserAvatar look={{ ...look, ...(cat === 'hair' ? { hat: 'none' } : {}), [cat]: i.id }} team={team} size={63} mode={HEAD.includes(cat) ? 'portrait' : 'full'} animate={false} title={i.name} /></span>
            <b>{i.name}</b><small>{equipped ? 'Equipped' : unlocked ? 'Available' : avatarHow(i)}</small>
          </button>;
        })}</div>
        {!shown.length && <div className="studio-empty"><PixelIcon name="search" size={28} /><strong>No matching pieces</strong><p>Try another name or show all pieces.</p><button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</button></div>}
        <div className="studio-status" role="status"><PixelIcon name="check" size={14} />{status}</div>
      </div>
    </div>
  </section>;
}

/** A jersey's team and number: any franchise's colours, any number from 0 to 99. */
function JerseyPanel({ look, ask, onChange, onDone }: { look: AvatarLook; ask: boolean; onChange: (next: AvatarLook, message: string) => void; onDone: () => void }) {
  const kit = outfitKit(look);
  const [number, setNumber] = useState(String(kit.number ?? ''));
  const setTeam = (team: string) => { const { kitTeam: _old, ...rest } = look; onChange(team ? { ...rest, kitTeam: team } : rest, team ? `${REAL_FRANCHISES.find(t => t.id === team)?.city} jersey on.` : 'Jersey colours reset.'); };
  const setNum = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setNumber(digits);
    const { kitNumber: _old, ...rest } = look;
    onChange(digits === '' ? rest : { ...rest, kitNumber: Number(digits) }, digits === '' ? 'Number reset.' : `Number ${Number(digits)} on.`);
  };
  return <div className={`studio-jersey${ask ? ' asking' : ''}`} role="group" aria-label="Your jersey">
    <span className="pixel-eyebrow">{ask ? 'MAKE IT YOURS' : 'YOUR JERSEY'}</span>
    <label>Team<select value={look.kitTeam ?? ''} autoFocus={ask} onChange={e => setTeam(e.target.value)}>
      <option value="">{look.outfit === 'jersey-fav' ? 'Your favourite team' : 'The jersey\'s own colours'}</option>
      {REAL_FRANCHISES.map(t => <option key={t.id} value={t.id}>{t.city} ({t.id})</option>)}
    </select></label>
    <label>Number<input inputMode="numeric" value={number} maxLength={2} placeholder="0-99" onChange={e => setNum(e.target.value)} aria-label="Jersey number" /></label>
    {ask && <button type="button" className="primary" onClick={onDone}>Done</button>}
  </div>;
}
