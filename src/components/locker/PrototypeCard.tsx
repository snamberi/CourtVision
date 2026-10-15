import { useEffect, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import type { BuildShape, Prototype } from '../../career/prototype';
import { CATEGORY_BY_ID } from '../../career/categories';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';

type Engine = typeof import('../../career/prototype');
const seasonOf = (end: number) => `${end - 1}-${String(end).slice(2)}`;

/**
 * Your prototype: the three real players a build is closest to. With a history at hand it shows right away; without
 * one (the Closet) a button loads the history first, then the list follows the build as it changes.
 */
export function PrototypeCard({ shape, h: given }: { shape: BuildShape; h?: NbaHistory | null }) {
  const [loaded, setH] = useState<NbaHistory | null>(null);
  const h = given ?? loaded;
  const [engine, setEngine] = useState<Engine | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [list, setList] = useState<Prototype[] | null>(null);
  const wanted = !!h || loading;

  useEffect(() => {
    if (!wanted || engine) return;
    let live = true;
    import('../../career/prototype').then(m => { if (live) setEngine(m); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [wanted, engine]);
  // The pool takes a moment the first time: build it after this paint, not during it.
  const key = JSON.stringify(shape);
  useEffect(() => {
    if (!h || !engine) return;
    const t = setTimeout(() => setList(engine.closestPrototypes(shape, engine.prototypePool(h), 3)), 0);
    return () => clearTimeout(t);
  }, [h, engine, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = () => {
    if (h || loading) return;
    setLoading(true); setFailed(false);
    import('../../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(setH, () => setFailed(true)).finally(() => setLoading(false));
  };

  const top = list?.[0];
  const gaps = top && engine ? engine.prototypeGaps(shape, top.shape) : [];
  return <section className="prototype-card" aria-label="Your NBA prototype">
    <h3 className="hunt-subhead">Your prototype <small>(the real players this build plays like)</small></h3>
    {!h && !loading && !failed && <button onClick={load}><PixelIcon name="search" size={14} /> Find your NBA prototype</button>}
    {(loading || (h && !list)) && !failed && <p className="hint-text" role="status">Comparing your build with 600 of the best seasons ever…</p>}
    {failed && <p className="hint-text">The player history didn't load. <button className="link-button" onClick={load}>Try again</button></p>}
    {list && <ol className="prototype-list">{list.map((p, i) => <li key={p.card.id} className={i === 0 ? 'top' : ''}>
      <PlayerAvatar playerId={p.card.playerId} mode="portrait" size={i === 0 ? 56 : 40} heightInches={p.shape.height} />
      <span><b>{p.card.name}</b><small>{seasonOf(p.card.end)} · {p.card.team} · {p.card.pos}</small></span>
      <output>{p.match}%<small>match</small></output>
    </li>)}</ol>}
    {top && gaps.length > 0 && <p className="hint-text">Next to {top.card.name}: {gaps.map(g => `${g.by > 0 ? '+' : ''}${g.by} ${CATEGORY_BY_ID.get(g.id)?.name ?? g.id}`).join(', ')}.</p>}
  </section>;
}
