import { useEffect, useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardPool } from '../../hunt/cards';
import { huntTeams } from '../../hunt/teams';
import { ERAS } from '../../hunt/eras';
import { opponentRating, maxLives, SERIES_COUNT, type HuntRun, type HuntSeries } from '../../hunt/run';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';

/*
 * The hunt as a world map: the ten series laid along a winding trail through basketball's eras, like the map screen of
 * an old platform game. Beaten series are ticked, the semi-boss and the boss stand out, shops sit on the trail where
 * they open, and your point guard stands on the series you are about to play.
 */

const narrowQuery = '(max-width: 700px)';
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(narrowQuery).matches);
  useEffect(() => {
    const m = window.matchMedia?.(narrowQuery);
    if (!m) return;
    const on = () => setNarrow(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return narrow;
}

/** Where each stop sits: rows left to right, then right to left (a snake), in % across and rows down. */
function mapLayout(count: number, cols: number): { x: number; row: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols), inRow = i % cols;
    const col = row % 2 === 0 ? inRow : cols - 1 - inRow;
    return { x: ((col + 0.5) / cols) * 100, row };
  });
}

const kindName = (s: HuntSeries, i: number) => (s.kind === 'boss' ? 'Boss' : s.kind === 'semi' ? 'Semi-boss' : `Series ${i + 1}`);

export function HuntMap({ h, run }: { h: NbaHistory; run: HuntRun }) {
  const narrow = useNarrow();
  const cols = narrow ? 2 : 5;
  const teams = useMemo(() => new Map(huntTeams(h).map(t => [t.id, t])), [h]);
  const pool = cardPool(h);
  const lead = pool.byId.get(run.squad[0] ?? '');
  const spots = mapLayout(run.series.length, cols);
  const rows = Math.ceil(run.series.length / cols);
  const rowH = 100; // viewBox units per row
  const at = (i: number) => ({ x: spots[i].x, y: spots[i].row * rowH + rowH / 2 });
  const won = run.results.filter(r => r.won).length;
  return <div className="hunt-map" role="group" aria-label={`The hunt map: series ${run.seriesIndex + 1} of ${SERIES_COUNT}`}>
    <div className="hm-head">
      <span className="pixel-eyebrow">THE ROAD · {won} OF {SERIES_COUNT} WON</span>
      <span className="hm-status"><span className="hm-lives" aria-label={`${run.lives} of ${maxLives(run)} lives`}>{Array.from({ length: maxLives(run) }, (_, i) => <i key={i} className={i < run.lives ? 'on' : ''}>♥</i>)}</span>
        <span className="hm-coins"><b>{run.coins}</b> coins</span></span>
    </div>
    <div className="hm-board" style={{ height: `${rows * (narrow ? 138 : 128)}px` }}>
      <svg className="hm-path" viewBox={`0 0 100 ${rows * rowH}`} preserveAspectRatio="none" aria-hidden="true">
        {run.series.slice(1).map((_, k) => { const a = at(k), b = at(k + 1);
          return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={k + 1 <= run.seriesIndex ? 'walked' : ''} vectorEffect="non-scaling-stroke" />; })}
      </svg>
      {run.series.map((s, i) => {
        const t = teams.get(s.teamId);
        const res = run.results.filter(r => r.index === i).at(-1);
        const done = i < run.seriesIndex, here = i === run.seriesIndex && run.stage !== 'won' && run.stage !== 'lost';
        const seen = i <= run.seriesIndex || s.kind !== 'normal' || run.items.includes('scout');
        const era = ERAS.find(e => e.id === s.eraId);
        const w = res ? res.games.filter(g => g.won).length : 0;
        return <div key={s.teamId + i} className={`hm-stop ${s.kind} ${done ? 'done' : ''} ${here ? 'here' : ''} ${res && !res.won ? 'lost' : ''} hm-era-${s.eraId}`}
          style={{ left: `${spots[i].x}%`, top: `${((spots[i].row + 0.5) / rows) * 100}%` }}>
          {here && lead && <span className="hm-pin" aria-label="You are here"><PlayerAvatar playerId={lead.name} mode="portrait" size={30} primaryColor="#f47b20" secondaryColor="#f4f0e6" /></span>}
          <span className="hm-node" aria-hidden="true">{done && res?.won ? '✓' : <PixelIcon name={s.kind === 'boss' ? 'trophy' : s.kind === 'semi' ? 'star' : 'court'} size={s.kind === 'normal' ? 18 : 22} />}</span>
          <span className="hm-label">
            <small>{kindName(s, i)}{i % 2 === 0 ? ' · shop first' : ''}</small>
            <b>{seen && t ? `'${String(t.end).slice(2)} ${t.name}` : '???'}</b>
            <em>{res ? `${res.won ? 'Won' : 'Lost'} ${w}-${res.games.length - w}` : seen ? `${era?.label ?? ''} · ${opponentRating(h, run, s)}` : era?.label ?? ''}</em>
          </span>
        </div>;
      })}
    </div>
  </div>;
}
