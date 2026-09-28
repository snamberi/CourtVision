import { useState } from 'react';
import type { CareerYear } from '../../career/career';
import { formatSeasonYear } from '../../simulation/calendar';

const W = 640, H = 220, PAD = { l: 36, r: 24, t: 24, b: 28 };

/** His Overall season by season, by age: the rise, the peak (labelled) and the decline. Hover a season for its line. */
export function OverallChart({ years }: { years: CareerYear[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (years.length < 2) return null;
  const ovr = years.map(y => y.overall);
  const lo = Math.floor((Math.min(...ovr) - 3) / 5) * 5, hi = Math.ceil((Math.max(...ovr) + 3) / 5) * 5;
  const x = (i: number) => PAD.l + (i / (years.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const peak = ovr.indexOf(Math.max(...ovr));
  const ticks = Array.from({ length: Math.floor((hi - lo) / 5) + 1 }, (_, i) => lo + i * 5).filter((_, i, a) => a.length <= 6 || i % 2 === 0);
  const path = years.map((yr, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(yr.overall).toFixed(1)}`).join(' ');
  const h = hover != null ? years[hover] : null;
  return <figure className="cv-chart">
    <figcaption><b>Overall by age</b><small>peak {ovr[peak]} at age {years[peak].age}</small></figcaption>
    <div className="cv-chart-box">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Overall by season, from ${ovr[0]} at age ${years[0].age} to a peak of ${ovr[peak]} at age ${years[peak].age}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W; setHover(Math.max(0, Math.min(years.length - 1, Math.round((px - PAD.l) / (W - PAD.l - PAD.r) * (years.length - 1))))); }}>
        {ticks.map(t => <g key={t}><line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="cv-grid" /><text x={PAD.l - 6} y={y(t) + 4} className="cv-axis" textAnchor="end">{t}</text></g>)}
        {years.map((yr, i) => (i % Math.ceil(years.length / 10) === 0 || i === years.length - 1) && <text key={yr.season} x={x(i)} y={H - 8} className="cv-axis" textAnchor="middle">{yr.age}</text>)}
        <path d={path} className="cv-line" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="cv-cross" />}
        {years.map((yr, i) => <circle key={yr.season} cx={x(i)} cy={y(yr.overall)} r={i === peak ? 6 : hover === i ? 5 : 4} className={i === peak ? 'cv-dot peak' : 'cv-dot'} />)}
        <text x={x(peak)} y={y(ovr[peak]) - 11} className="cv-peak-label" textAnchor={peak >= years.length - 2 ? 'end' : peak <= 1 ? 'start' : 'middle'}>Peak {ovr[peak]}</text>
      </svg>
      {h && <div className="cv-tip" style={{ left: `${Math.min(84, Math.max(16, (x(hover!) / W) * 100))}%` }}><b>{formatSeasonYear(h.season)} · age {h.age}</b><span>{h.overall} OVR · {h.teamName}</span>
        <span>{(h.stats.points / Math.max(1, h.stats.gamesPlayed)).toFixed(1)} PTS · {((h.stats.oreb + h.stats.dreb) / Math.max(1, h.stats.gamesPlayed)).toFixed(1)} REB · {(h.stats.ast / Math.max(1, h.stats.gamesPlayed)).toFixed(1)} AST</span></div>}
    </div>
  </figure>;
}
