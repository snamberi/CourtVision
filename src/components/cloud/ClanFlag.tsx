import { useMemo, useState } from 'react';
import { FLAG_W, FLAG_H, FLAG_PATTERNS, PATTERN_NAME, EMBLEMS, EMBLEM_IDS, PLACE_NAME, cellOf, emblemBox, patternCells, randomFlag, cleanFlag, type ClanFlag, type EmblemPlace } from '../../cloud/clanFlag';
import { PixelIcon } from '../PixelIcon';

/** A clan flag, drawn pixel by pixel (15 x 10). */
export function FlagArt({ flag, width = 60, title }: { flag: ClanFlag; width?: number; title?: string }) {
  const paths = useMemo(() => {
    const by: string[] = ['', '', '', ''];
    for (let y = 0; y < FLAG_H; y++) for (let x = 0; x < FLAG_W; x++) by[cellOf(flag.pattern, x + 0.5, y + 0.5, flag.paint[y * FLAG_W + x] ?? 0)] += `M${x} ${y}h1v1h-1z`;
    let emblem = '';
    const art = EMBLEMS[flag.emblem]?.art;
    if (art) {
      const b = emblemBox(flag);
      art.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') emblem += `M${(b.x + c * b.px).toFixed(2)} ${(b.y + r * b.px).toFixed(2)}h${b.px.toFixed(2)}v${b.px.toFixed(2)}h-${b.px.toFixed(2)}z`; }));
    }
    return { by, emblem };
  }, [flag]);
  const fills = [...flag.colors, flag.emblemColor];
  return <svg className="clan-flag" width={width} height={width * FLAG_H / FLAG_W} viewBox={`0 0 ${FLAG_W} ${FLAG_H}`} shapeRendering="crispEdges" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
    {paths.by.map((d, i) => d && <path key={i} d={d} fill={fills[i]} />)}
    {paths.emblem && <path d={paths.emblem} fill={flag.emblemColor} />}
  </svg>;
}

/** The flag editor: pattern, colours, emblem, or paint every pixel yourself. */
export function FlagEditor({ value, onChange }: { value: ClanFlag; onChange: (f: ClanFlag) => void }) {
  const [brush, setBrush] = useState(1);
  const [painting, setPainting] = useState(false);
  const set = (p: Partial<ClanFlag>) => onChange(cleanFlag({ ...value, ...p }));
  const setPattern = (pattern: ClanFlag['pattern']) => set(pattern === 'paint' ? { pattern, paint: value.pattern === 'paint' ? value.paint : patternCells(value) } : { pattern, paint: [] });
  const paintAt = (i: number) => { if (value.paint[i] === brush) return; const paint = [...value.paint]; paint[i] = brush; set({ paint }); };
  const colorNames = ['Main colour', 'Second colour', 'Third colour'];
  return <div className="flag-editor">
    <div className="flag-editor-preview"><FlagArt flag={value} width={180} title="Your clan flag" />
      <button type="button" onClick={() => onChange(randomFlag())}><PixelIcon name="shuffle" size={14} /> Random flag</button></div>
    <fieldset><legend>Pattern</legend><div className="flag-picks">{FLAG_PATTERNS.map(p => <button type="button" key={p} aria-pressed={value.pattern === p} className={value.pattern === p ? 'active' : ''} title={PATTERN_NAME[p]} onClick={() => setPattern(p)}>
      <FlagArt flag={{ ...value, pattern: p, emblem: 'none', paint: p === 'paint' ? (value.pattern === 'paint' ? value.paint : patternCells(value)) : [] }} width={36} /><small>{PATTERN_NAME[p]}</small></button>)}</div></fieldset>
    <fieldset><legend>Colours</legend><div className="flag-colors">
      {value.colors.map((c, i) => <label key={i}><input type="color" value={c} onChange={e => { const colors = [...value.colors] as ClanFlag['colors']; colors[i] = e.target.value; set({ colors }); }} /><span>{colorNames[i]}</span></label>)}
      <label><input type="color" value={value.emblemColor} onChange={e => set({ emblemColor: e.target.value })} /><span>Emblem colour</span></label>
    </div></fieldset>
    {value.pattern === 'paint' && <fieldset><legend>Paint (pick a colour, then click or drag over the pixels)</legend>
      <div className="flag-brushes">{[...value.colors, value.emblemColor].map((c, i) => <button type="button" key={i} aria-pressed={brush === i} className={brush === i ? 'active' : ''} aria-label={`Paint with colour ${i + 1}`} onClick={() => setBrush(i)}><i style={{ background: c }} /></button>)}</div>
      <div className="flag-paint" role="grid" aria-label="Flag pixels" onPointerLeave={() => setPainting(false)} onPointerUp={() => setPainting(false)}>
        {Array.from({ length: FLAG_W * FLAG_H }, (_, i) => <button type="button" key={i} aria-label={`Pixel ${i % FLAG_W + 1}, ${Math.floor(i / FLAG_W) + 1}`} style={{ background: [...value.colors, value.emblemColor][value.paint[i] ?? 0] }}
          onPointerDown={e => { e.preventDefault(); setPainting(true); paintAt(i); }} onPointerEnter={() => { if (painting) paintAt(i); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); paintAt(i); } }} />)}
      </div></fieldset>}
    <fieldset><legend>Emblem</legend><div className="flag-picks emblems">{EMBLEM_IDS.map(id => <button type="button" key={id} aria-pressed={value.emblem === id} className={value.emblem === id ? 'active' : ''} title={id === 'none' ? 'No emblem' : EMBLEMS[id].name} onClick={() => set({ emblem: id })}>
      {id === 'none' ? <small>None</small> : <><FlagArt flag={{ ...value, pattern: 'solid', emblem: id, place: 'c', size: 2, paint: [] }} width={36} /><small>{EMBLEMS[id].name}</small></>}</button>)}</div></fieldset>
    {value.emblem !== 'none' && <div className="flag-row">
      <fieldset><legend>Emblem size</legend><div className="hunt-replace">{([1, 2, 3] as const).map(s => <button type="button" key={s} aria-pressed={value.size === s} className={value.size === s ? 'active' : ''} onClick={() => set({ size: s })}>{['Small', 'Medium', 'Large'][s - 1]}</button>)}</div></fieldset>
      <fieldset><legend>Emblem place</legend><div className="hunt-replace">{(Object.keys(PLACE_NAME) as EmblemPlace[]).map(p => <button type="button" key={p} aria-pressed={value.place === p} className={value.place === p ? 'active' : ''} onClick={() => set({ place: p })}>{PLACE_NAME[p]}</button>)}</div></fieldset>
    </div>}
  </div>;
}
