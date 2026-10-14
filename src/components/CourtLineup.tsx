import { useEffect, useRef, useState } from 'react';
import { PlayerAvatar } from './PlayerAvatar';
import { burst } from '../fx/effects';
import './courtLineup.css';
import { FIVE_SPOTS } from './lineupSpots';

/*
 * The lineup board: a pixel half court with a spot for each starter (five, or three for 3v3). Empty spots show a
 * ghost jersey and the position; a filled spot shows the player standing there, dropping in with a burst of sparks.
 * The next spot to fill pulses. Players go to the spot that fits their position best (assignToSpots).
 */
export interface LineupPlayer { id: string; name: string; pos?: string; teamId?: string; colors?: [string, string]; sub?: string; hot?: boolean }

const PLACES: Record<number, [number, number][]> = {
  5: [[50, 80], [83, 62], [17, 62], [66, 40], [34, 40]], // PG, SG, SF, PF, C
  3: [[50, 76], [22, 50], [78, 50]],
};

function Court() {
  return <svg className="court-lineup-floor" viewBox="0 0 160 120" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
    {Array.from({ length: 12 }, (_, i) => <rect key={i} x="0" y={i * 10} width="160" height="10" fill={i % 2 ? '#a8743f' : '#b5804a'} />)}
    {Array.from({ length: 12 }, (_, i) => <rect key={`j${i}`} x={(i * 37) % 160} y={i * 10} width="1" height="10" fill="#000" opacity=".15" />)}
    <rect x="58" y="0" width="44" height="46" fill="var(--court-paint, #f47b20)" opacity=".55" />
    <rect x="58" y="0" width="44" height="46" fill="none" stroke="#f4f0e6" strokeWidth="1.5" />
    <path d="M58 46 A22 22 0 0 0 102 46" fill="none" stroke="#f4f0e6" strokeWidth="1.5" />
    <path d="M12 0 V30 A68 68 0 0 0 148 30 V0" fill="none" stroke="#f4f0e6" strokeWidth="1.5" />
    <rect x="0" y="118" width="160" height="2" fill="#f4f0e6" />
    <path d="M60 120 A20 20 0 0 1 100 120" fill="none" stroke="#f4f0e6" strokeWidth="1.5" />
    <rect x="66" y="4" width="28" height="2" fill="#f4f0e6" /><rect x="76" y="6" width="8" height="5" fill="none" stroke="#e85d5d" strokeWidth="1.5" />
  </svg>;
}

function Ghost() {
  return <svg className="court-lineup-ghost" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
    <path d="M4 1H6V3H10V1H12L15 4V7H12V15H4V7H1V4Z" fill="currentColor" />
  </svg>;
}

export function CourtLineup({ players, spots = FIVE_SPOTS, active, paint, label = 'Starting lineup', bonds = [], highlighted, selected, onSelect }: { players: (LineupPlayer | undefined)[]; spots?: readonly string[]; active?: number; paint?: string; label?: string; bonds?: { label: string; cards: string[]; bonus?: number }[]; highlighted?: Set<string>; selected?: string; onSelect?: (id: string) => void }) {
  const places = PLACES[spots.length] ?? PLACES[5];
  const seen = useRef<Set<string>>(new Set(players.filter(Boolean).map(p => p!.id)));
  const [fresh, setFresh] = useState<string | null>(null);
  const spotRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const i = players.findIndex(p => p && !seen.current.has(p.id));
    players.forEach(p => p && seen.current.add(p.id));
    if (i < 0) return;
    setFresh(players[i]!.id);
    const p = players[i]!;
    const sparks = window.setTimeout(() => burst(spotRefs.current[i], { colors: [p.colors?.[0] ?? '#f47b20', p.colors?.[1] ?? '#ffd166', '#f4f0e6'], count: p.hot ? 40 : 22, power: p.hot ? 6 : 4 }), 260);
    const t = window.setTimeout(() => setFresh(null), 700);
    return () => { window.clearTimeout(t); window.clearTimeout(sparks); };
  }, [players.map(p => p?.id ?? '').join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="court-lineup" role="list" aria-label={label} style={paint ? { ['--court-paint' as string]: paint } : undefined}>
    <Court />
    <svg className="lineup-link-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{bonds.flatMap((b, n) => {
      const indices = b.cards.map(id => players.findIndex(p => p?.id === id)).filter(i => i >= 0);
      return indices.slice(1).map((index, k) => { const a = places[indices[k]], z = places[index]; return <g key={`${n}-${k}`} className={(b.bonus ?? 0) < 0 ? 'negative' : ''}><line x1={a[0]} y1={a[1]} x2={z[0]} y2={z[1]} className="link-shadow" /><line x1={a[0]} y1={a[1]} x2={z[0]} y2={z[1]} /><circle cx={(a[0] + z[0]) / 2} cy={(a[1] + z[1]) / 2} r="1.1" /></g>; });
    })}</svg>
    {spots.map((s, i) => {
      const p = players[i], [x, y] = places[i] ?? [50, 50];
      return <div key={s + i} role="listitem" ref={el => { spotRefs.current[i] = el; }} className={`court-spot ${p ? 'filled' : 'empty'} ${active === i && !p ? 'next' : ''} ${p && fresh === p.id ? 'drop-in' : ''} ${p?.hot ? 'hot' : ''} ${p && highlighted?.has(p.id) ? 'chem-linked' : ''}`}
        style={{ left: `${x}%`, top: `${y}%` }} aria-label={p ? `${s}: ${p.name}` : `${s}: open`}>
        {p ? <PlayerAvatar playerId={p.name} teamId={p.teamId} primaryColor={p.colors?.[0]} secondaryColor={p.colors?.[1]} size={58} mode="full" title={p.name} />
          : <span className="court-spot-ghost"><Ghost /></span>}
        <b className="court-spot-pos">{s}</b>
        {p && <small className="court-spot-name">{p.name}{p.sub ? <em>{p.sub}</em> : null}</small>}
        {p && onSelect && <button className="court-player-hit" onClick={() => onSelect(p.id)} aria-pressed={selected === p.id} aria-label={`Inspect ${p.name}'s chemistry`} />}
      </div>;
    })}
  </div>;
}
