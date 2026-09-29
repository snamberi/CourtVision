import { useEffect, useMemo, useState } from 'react';
import { loadAlbum, loadSets, packsWaiting, openPack, albumStats, ALBUM_EVENT, VARIANT_LABEL, type TradingCard, type Rarity } from '../cards/cards';
import { PlayerAvatar } from './PlayerAvatar';
import { ShareCardButton } from './ShareCardButton';
import { formatSeasonYear } from '../simulation/calendar';

/** One trading card: pixel portrait, name, team colours, the season line, and a frame that shows the variant. */
export function TradingCardView({ card, onOpen, flip = false }: { card: TradingCard; onOpen?: () => void; flip?: boolean }) {
  const Tag = onOpen ? 'button' : 'div';
  return <Tag className={`tcard tcard-${card.variant} rarity-${card.rarity}${flip ? ' tcard-flip' : ''}`} onClick={onOpen} style={{ ['--tc1' as string]: card.primary, ['--tc2' as string]: card.secondary }}
    aria-label={`${card.playerId}, ${formatSeasonYear(card.season)} ${card.teamName}, ${VARIANT_LABEL[card.variant]}`}>
    <span className="tcard-top"><b>{card.abbr}</b><i>{card.ovr}</i></span>
    <span className="tcard-art"><PlayerAvatar playerId={card.playerId} teamId={card.teamId} size={72} jerseyNumber={card.jersey} age={card.age} primaryColor={card.primary} secondaryColor={card.secondary} />
      {card.variant === 'rookie' && <em className="tcard-rc">RC</em>}{card.variant === 'champion' && <em className="tcard-ring">◆</em>}</span>
    <span className="tcard-name">{card.playerId.replace(/ '\d+$/, '')}</span>
    <span className="tcard-meta">{card.pos} · {formatSeasonYear(card.season)}</span>
    <span className="tcard-stats"><span><b>{card.pts.toFixed(1)}</b>PTS</span><span><b>{card.reb.toFixed(1)}</b>REB</span><span><b>{card.ast.toFixed(1)}</b>AST</span></span>
    <span className="tcard-variant">{VARIANT_LABEL[card.variant]}</span>
  </Tag>;
}

const RARITIES: Rarity[] = ['legendary', 'epic', 'rare', 'common'];

/** The card album: every card you own, team sets, and packs to open. Cards come at the end of each season. */
export function CardAlbumPage() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const bump = () => setTick(t => t + 1); window.addEventListener(ALBUM_EVENT, bump); return () => window.removeEventListener(ALBUM_EVENT, bump); }, []);
  const album = useMemo(() => loadAlbum(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const sets = useMemo(() => Object.values(loadSets()), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const stats = albumStats(), packs = packsWaiting();
  const [view, setView] = useState<'album' | 'sets'>('album');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [open, setOpen] = useState<TradingCard | null>(null);
  const [pulled, setPulled] = useState<TradingCard[] | null>(null);
  const cards = Object.values(album).filter(c => rarity === 'all' || c.rarity === rarity)
    .sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) || b.season.localeCompare(a.season) || b.ovr - a.ovr);
  const setRows = sets.map(s => ({ s, have: s.ids.filter(id => album[id]).length })).sort((a, b) => b.have / b.s.ids.length - a.have / a.s.ids.length || b.s.season.localeCompare(a.s.season));
  return <div className="card-album">
    <div className="season-feature-header"><div><span className="pixel-eyebrow">COLLECTION</span><h2>Card Album</h2>
      <p>{stats.cards} cards · {stats.legendary} legendary · {stats.completeSets} of {stats.sets} team sets complete</p></div>
      <div className="card-packs"><b>{packs}</b><small>pack{packs === 1 ? '' : 's'} to open</small><button className="primary" disabled={packs <= 0} onClick={() => { const got = openPack(); if (got.length) setPulled(got); }}>Open a pack</button></div></div>
    <p className="hint-text">Every season, your roster's cards come to you, plus a pack for every 10 wins and every playoff series won (at least one). Packs pull five cards from around the league, the last one at least rare. Variants: rookie card, All-Star foil, champion ring, MVP gold, and the legendary holo. Complete team sets and legendary cards unlock profile cosmetics.</p>
    {pulled && <div className="pack-open" role="dialog" aria-modal="true" aria-label="Pack opened">
      <div className="pack-row">{pulled.map((c, i) => <div key={`${c.id}-${i}`} style={{ animationDelay: `${i * 160}ms` }} className="pack-slot"><TradingCardView card={c} flip /></div>)}</div>
      <div className="contest-actions"><button className="primary" disabled={packsWaiting() <= 0} onClick={() => { const got = openPack(); setPulled(got.length ? got : null); }}>Open another ({packsWaiting()})</button><button onClick={() => setPulled(null)}>Done</button></div>
    </div>}
    <div className="stats-view-toggle" role="tablist" aria-label="Album views">
      <button role="tab" aria-selected={view === 'album'} className={view === 'album' ? 'active' : ''} onClick={() => setView('album')}>Cards</button>
      <button role="tab" aria-selected={view === 'sets'} className={view === 'sets' ? 'active' : ''} onClick={() => setView('sets')}>Team sets</button>
    </div>
    {view === 'album' ? <>
      <div className="card-filter" role="radiogroup" aria-label="Rarity">{(['all', ...RARITIES] as const).map(r => <button key={r} role="radio" aria-checked={rarity === r} className={rarity === r ? 'active' : ''} onClick={() => setRarity(r)}>{r === 'all' ? 'All' : r[0].toUpperCase() + r.slice(1)}</button>)}</div>
      {cards.length ? <div className="card-grid">{cards.slice(0, 240).map(c => <TradingCardView key={c.id} card={c} onOpen={() => setOpen(c)} />)}</div>
        : <p className="empty-state">No cards yet. Finish a season in any league and your roster's cards arrive, with packs to open.</p>}
    </> : <div className="card-sets">{setRows.length ? setRows.slice(0, 120).map(({ s, have }) => <div key={s.key} className={have === s.ids.length ? 'done' : ''}>
      <b>{s.teamName}</b><small>{formatSeasonYear(s.season)}</small><span className="card-set-bar"><i style={{ width: `${have / s.ids.length * 100}%` }} /></span><em>{have}/{s.ids.length}</em></div>)
      : <p className="empty-state">Team sets appear after your first finished season.</p>}</div>}
    {open && <div className="card-zoom" role="dialog" aria-modal="true" aria-label={open.playerId} onClick={e => { if (e.target === e.currentTarget) setOpen(null); }}>
      <div className="card-zoom-box"><TradingCardView card={open} />
        <div className="contest-actions"><ShareCardButton label="Share card" fileName={`card-${open.playerId.replace(/\W+/g, '-')}-${open.season}.png`} text={`${open.playerId} · ${VARIANT_LABEL[open.variant]} · Court Vision`}
          spec={{ kicker: `${formatSeasonYear(open.season)} · ${VARIANT_LABEL[open.variant].toUpperCase()}`, title: open.playerId.replace(/ '\d+$/, ''), subtitle: `${open.teamName} · ${open.pos}`,
            stats: [{ label: 'OVR', value: String(open.ovr) }, { label: 'PTS', value: open.pts.toFixed(1) }, { label: 'REB', value: open.reb.toFixed(1) }, { label: 'AST', value: open.ast.toFixed(1) }],
            badge: open.rarity.toUpperCase(), avatar: { playerId: open.playerId, jersey: open.jersey ?? undefined, primary: open.primary, secondary: open.secondary },
            accent: open.rarity === 'legendary' ? 'gold' : open.rarity === 'epic' ? 'red' : open.rarity === 'rare' ? 'green' : 'orange' }} />
          <button onClick={() => setOpen(null)}>Close</button></div></div>
    </div>}
  </div>;
}
