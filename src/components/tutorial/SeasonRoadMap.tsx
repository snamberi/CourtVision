import type { RoadMap, StopStatus } from '../../tutorial/roadmap';

const STATUS_TEXT: Record<StopStatus, string> = { done: 'done', current: 'you are here', next: 'next', later: 'later' };

interface Props {
  map: RoadMap;
  /** e.g. "2016–17 · Regular Season" */
  eyebrow: string;
  onGo: (tab: string) => void;
}

/** Where the league is in the season loop, what matters right now, and what comes next. */
export function SeasonRoadMap({ map, eyebrow, onGo }: Props) {
  return (
    <section className="road-map" aria-labelledby="road-map-title" data-tour="roadmap">
      <div className="road-map-head">
        <span className="pixel-eyebrow">{eyebrow}</span>
        <h2 id="road-map-title">Season road map</h2>
      </div>
      <div className="road-map-scroll">
        <ol className="road-map-stops" style={{ gridTemplateColumns: `repeat(${map.stops.length}, minmax(0, 1fr))` }}>
          {map.stops.map((stop) => (
            <li key={stop.id} className={`road-stop is-${stop.status}`} aria-current={stop.status === 'current' ? 'step' : undefined}>
              <span className="road-stop-marker" aria-hidden="true">{stop.status === 'done' ? '✓' : ''}</span>
              <span className="road-stop-label">{stop.label}</span>
              {stop.status === 'current' && <span className="road-stop-here" aria-hidden="true">YOU ARE HERE</span>}
              {stop.note && <span className="road-stop-note">{stop.note}</span>}
              <span className="sr-only">, {STATUS_TEXT[stop.status]}</span>
            </li>
          ))}
        </ol>
        <div className="road-map-track" aria-hidden="true"><div style={{ width: `${Math.round(map.fill * 100)}%` }} /></div>
      </div>
      <div className="road-map-panels">
        <div className="road-now">
          <h3><span>What matters now</span> {map.now.title}</h3>
          <ul>{map.now.points.map((p) => <li key={p}>{p}</li>)}</ul>
          {map.now.actions.length > 0 && (
            <div className="road-now-actions">
              {map.now.actions.map((a, i) => <button key={a.tab} type="button" className={i === 0 ? 'primary' : undefined} onClick={() => onGo(a.tab)}>{a.label}</button>)}
            </div>
          )}
        </div>
        {map.next && (
          <div className="road-next">
            <h3>Coming up</h3>
            <b>{map.next.title}</b>
            <p>{map.next.text}</p>
          </div>
        )}
      </div>
    </section>
  );
}
