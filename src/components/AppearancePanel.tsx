import { useMemo, useState } from 'react';
import type { PlayerSeason } from '../simulation/types';
import { HAIR_STYLES, BEARD_STYLES, HAT_STYLES, SKIN_TONES, HAIR_COLORS, HAT_COLORS, EYE_COLORS, EYE_STYLES, EXPRESSIONS, playerTraits, type Appearance } from '../visuals/playerSprite';
import { actionSprite, POSES, SPRITE_W, SPRITE_H } from '../visuals/actionSprites';
import { teamColors } from '../simulation/teamColors';
import { useTeamIdentity } from '../visuals/TeamIdentityContext';
import { PlayerAvatar } from './PlayerAvatar';
import { PixelIcon } from './PixelIcon';
import { likenessCode, readLikenessCode, setLikeness, likenessOf, hasBuiltInLikeness } from '../visuals/likeness';
import './customization.css';

const label = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).replace(/ ([A-Z])/g, (_, c: string) => ` ${c.toLowerCase()}`);
const TABS = [{ id: 'face', name: 'Face', icon: 'team' }, { id: 'hair', name: 'Hair', icon: 'team' }, { id: 'beard', name: 'Facial hair', icon: 'team' }, { id: 'hat', name: 'Headwear', icon: 'crown' }, { id: 'colors', name: 'Colors', icon: 'star' }] as const;
type Tab = typeof TABS[number]['id'];
const choose = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

function Swatches({ colors, value, onPick, name }: { colors: readonly string[]; value: string; onPick: (i: number) => void; name: string }) {
  return <div className="studio-swatches" role="group" aria-label={name}>
    {colors.map((c, i) => <button key={c} type="button" aria-pressed={c === value} aria-label={`${name} ${i + 1}`} title={c} style={{ background: c }} onClick={() => onPick(i)}>{c === value && <span>✓</span>}</button>)}
  </div>;
}

/** The same player identity rendered in portrait, uniform and court poses. */
export function AppearancePanel({ season, onChange }: { season: PlayerSeason; onChange: (next: PlayerSeason) => void }) {
  const look = season.appearance ?? {};
  const t = playerTraits(season.playerId, look);
  const identity = useTeamIdentity(season.teamId);
  const kit = identity ?? teamColors(season.teamId);
  const [tab, setTab] = useState<Tab>('hair');
  const [view, setView] = useState<'full' | 'portrait' | 'court'>('full');
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<(Appearance | undefined)[]>([]);
  const [status, setStatus] = useState('Select a piece to update the player.');
  const replace = (next: Appearance | undefined, message: string) => {
    setHistory(h => [...h.slice(-19), season.appearance]);
    onChange({ ...season, appearance: next }); setStatus(message);
  };
  const set = (patch: Appearance, message = 'Player appearance updated.') => replace({ ...look, ...patch }, message);
  const lookKey = JSON.stringify(look);
  const frame = useMemo(() => actionSprite('LOOK', POSES.JUMPER[3], { playerId: season.playerId, primary: kit.primary, secondary: kit.secondary, jerseyStyle: identity?.jerseyStyle, jerseyNumber: season.jerseyNumber, age: season.age, appearance: JSON.parse(lookKey) }), [season.playerId, season.jerseyNumber, season.age, kit.primary, kit.secondary, identity?.jerseyStyle, lookKey]);
  const randomize = () => replace({ skin: Math.floor(Math.random() * SKIN_TONES.length), hairColor: Math.floor(Math.random() * 9), hairStyle: choose(HAIR_STYLES), beardStyle: choose(BEARD_STYLES), hatStyle: Math.random() < .65 ? 'none' : choose(HAT_STYLES), hatColor: Math.floor(Math.random() * HAT_COLORS.length), eyeColor: Math.floor(Math.random() * EYE_COLORS.length), eyeStyle: choose(EYE_STYLES), expression: choose(EXPRESSIONS) }, 'New player look applied.');
  const avatar = (appearance: Appearance, size = 58) => <PlayerAvatar playerId={season.playerId} teamId={season.teamId} jerseyNumber={season.jerseyNumber} age={season.age} appearance={appearance} mode="portrait" size={size} />;
  const tiles = (items: readonly string[], key: 'hairStyle' | 'beardStyle' | 'hatStyle' | 'eyeStyle' | 'expression', selected: string) => items.filter(i => label(i).toLowerCase().includes(query.trim().toLowerCase())).map(i => {
    const patch = { [key]: i } as Appearance;
    return <button type="button" key={i} className={`studio-tile${selected === i ? ' selected' : ''}`} aria-pressed={selected === i} onClick={() => set(patch, `${label(i)} selected.`)} aria-label={i === 'none' ? 'None' : label(i)}>
      <span className="studio-tile-state">{selected === i && <PixelIcon name="check" size={13} />}</span><span className="studio-tile-art">{avatar({ ...look, ...(key === 'hairStyle' ? { hatStyle: 'none' as const } : {}), ...patch })}</span><b>{i === 'none' ? 'None' : label(i)}</b>
    </button>;
  });
  const colorField = (name: string, colors: readonly string[], value: string, field: 'skin' | 'hairColor' | 'hatColor', hex: 'skinHex' | 'hairHex' | 'hatHex') => <div className="studio-color-field"><h4>{name}</h4><Swatches colors={colors} value={value} name={name} onPick={i => set({ [field]: i, [hex]: undefined })} /><label className="studio-custom-color"><input type="color" aria-label={`Custom ${name.toLowerCase()}`} value={value} onChange={e => set({ [hex]: e.target.value })} /><span>Custom color</span><code>{value.toUpperCase()}</code></label></div>;

  return <section className="player-look-studio" aria-label="Player appearance studio">
    <header className="studio-heading"><div><span className="pixel-eyebrow">PLAYER APPEARANCE</span><h3>Signature look</h3><p>Bring {season.firstName || season.playerId} to life.</p></div><span className="studio-tag">PIXEL STUDIO</span></header>
    <div className="studio-layout">
      <aside className="studio-preview-column">
        <div className="studio-stage"><div className="studio-stage-label"><span><i /> LIVE PREVIEW</span><span>#{season.jerseyNumber ?? '—'}</span></div>
          <div className="studio-view" role="group" aria-label="Player preview view">{(['full', 'portrait', 'court'] as const).map(v => <button type="button" key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'full' ? 'Full body' : v === 'portrait' ? 'Portrait' : 'On court'}</button>)}</div>
          <div className={`studio-character studio-character--${view}`}><div className="studio-locker-lines" aria-hidden="true" />{view === 'court' ? <svg width={210} height={290} viewBox={`0 0 ${SPRITE_W} ${SPRITE_H}`} shapeRendering="crispEdges" role="img" aria-label="On the court">{frame.map(p => <path key={p.fill} fill={p.fill} d={p.d} />)}</svg> : <PlayerAvatar playerId={season.playerId} teamId={season.teamId} jerseyNumber={season.jerseyNumber} age={season.age} appearance={look} mode={view} size={view === 'full' ? 190 : 170} title={season.playerId} />}<div className="studio-platform" aria-hidden="true" /></div>
          <div className="studio-stage-caption"><small>YOUR PLAYER</small><strong>{season.playerId}</strong></div>
        </div>
        <div className="studio-actions"><button type="button" onClick={randomize}><PixelIcon name="shuffle" size={16} /> Randomize</button><button type="button" disabled={!history.length} onClick={() => { if (history.length) { onChange({ ...season, appearance: history.at(-1) }); setHistory(h => h.slice(0, -1)); setStatus('Last change undone.'); } }}>Undo</button></div>
        <button type="button" className="studio-reset" disabled={!season.appearance} onClick={() => replace(undefined, 'Original look restored.')}>Restore original look</button>
        <LikenessCode playerId={season.playerId} look={look} onPaste={l => replace(l, 'Look code applied.')} onStatus={setStatus} />
        <div className="studio-status" role="status">{status}</div>
      </aside>
      <div className="studio-browser">
        <div className="studio-categories" role="group" aria-label="Player appearance categories">{TABS.map(c => <button type="button" key={c.id} aria-pressed={tab === c.id} onClick={() => { setTab(c.id); setQuery(''); }}><PixelIcon name={c.icon} size={16} /><span>{c.name}</span></button>)}</div>
        {tab !== 'colors' && tab !== 'face' && <div className="studio-toolbar"><label className="studio-search"><PixelIcon name="search" size={16} /><input type="search" aria-label="Search player styles" placeholder={`Search ${TABS.find(c => c.id === tab)?.name.toLowerCase()}…`} value={query} onChange={e => setQuery(e.target.value)} /></label></div>}
        {tab === 'hair' && <><div className="studio-section-title"><h4>Choose your cut</h4><small>{HAIR_STYLES.length} styles</small></div><p className="studio-hint">Hair previews show the cut without headwear.</p><div className="studio-grid">{tiles(HAIR_STYLES, 'hairStyle', t.hairStyle)}</div></>}
        {tab === 'beard' && <><div className="studio-section-title"><h4>Facial hair</h4><small>{BEARD_STYLES.length} styles</small></div><div className="studio-grid">{tiles(BEARD_STYLES, 'beardStyle', t.beardStyle)}</div></>}
        {tab === 'hat' && <><div className="studio-section-title"><h4>Headwear</h4><small>{HAT_STYLES.length + 1} choices</small></div><div className="studio-grid">{tiles(['none', ...HAT_STYLES], 'hatStyle', t.hatStyle ?? 'none')}</div>{colorField('Headwear color', HAT_COLORS, t.hatColor, 'hatColor', 'hatHex')}</>}
        {query && ![...(tab === 'hair' ? HAIR_STYLES : tab === 'beard' ? BEARD_STYLES : ['none', ...HAT_STYLES])].some(i => label(i).toLowerCase().includes(query.trim().toLowerCase())) && <div className="studio-empty"><p>No matching styles.</p><button type="button" onClick={() => setQuery('')}>Clear search</button></div>}
        {tab === 'face' && <><div className="studio-section-title"><h4>Eyes & brows</h4></div><div className="studio-grid">{tiles(EYE_STYLES, 'eyeStyle', t.eyeStyle)}</div><h4>Eye color</h4><Swatches name="Eye color" colors={EYE_COLORS} value={t.eyeColor} onPick={i => set({ eyeColor: i })} /><div className="studio-section-title"><h4>Expression</h4></div><div className="studio-grid">{tiles(EXPRESSIONS, 'expression', t.expression)}</div></>}
        {tab === 'colors' && <div className="studio-color-fields">{colorField('Skin tone', SKIN_TONES, t.skin, 'skin', 'skinHex')}{colorField('Hair color', HAIR_COLORS, t.hair, 'hairColor', 'hairHex')}{colorField('Headwear color', HAT_COLORS, t.hatColor, 'hatColor', 'hatHex')}</div>}
      </div>
    </div>
  </section>;
}

/** The look as a short code to share, a box to paste one, and "use this look everywhere" (every league and mode on this device). */
function LikenessCode({ playerId, look, onPaste, onStatus }: { playerId: string; look: Appearance; onPaste: (l: Appearance) => void; onStatus: (m: string) => void }) {
  const [paste, setPaste] = useState('');
  const full = { ...likenessOf(playerId), ...look };
  const code = likenessCode(full);
  return <div className="studio-likeness">
    <h4>Look code</h4>
    <div className="studio-likeness-row"><code title="Share this code: anyone can paste it to get this look">{code}</code>
      <button type="button" onClick={() => { void navigator.clipboard?.writeText(code).then(() => onStatus('Look code copied.'), () => onStatus('Copy the code by hand.')); }}>Copy</button></div>
    <div className="studio-likeness-row"><input value={paste} onChange={e => setPaste(e.target.value)} placeholder="Paste a look code (CVL1.…)" aria-label="Paste a look code" />
      <button type="button" disabled={!paste.trim()} onClick={() => { const l = readLikenessCode(paste); if (l) { onPaste(l); setPaste(''); } else onStatus('That is not a look code.'); }}>Apply</button></div>
    <button type="button" onClick={() => { setLikeness(playerId, full); onStatus(`${playerId} now looks like this everywhere: every league and mode on this device.`); }}>Use this look everywhere</button>
    {hasBuiltInLikeness(playerId) && <small>{playerId} has a real-life look built in. Fix it here if it is off.</small>}
  </div>;
}
