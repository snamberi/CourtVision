import type { Form } from '../simulation/form';
import { PixelIcon } from './PixelIcon';

/** The last five games as a tiny bar sparkline (a gap for a game he missed), with a flame or ice badge on a streak. */
export function FormCell({ form }: { form?: Form }) {
  if (!form || form.pts.every(p => p == null)) return <span className="hint-text">—</span>;
  const max = Math.max(20, ...form.pts.map(p => p ?? 0));
  const label = `Last ${form.pts.length} games: ${form.pts.map(p => (p == null ? 'DNP' : p)).join(', ')} points${form.heat ? ` · ${form.heat === 'hot' ? 'heating up' : 'cold streak'}` : ''}`;
  return <span className="form-cell" title={label} aria-label={label} role="img">
    <svg viewBox={`0 0 ${form.pts.length * 5} 16`} width={form.pts.length * 7} height="16" shapeRendering="crispEdges" aria-hidden="true">
      {form.pts.map((p, i) => p == null ? <rect key={i} x={i * 5} y="15" width="4" height="1" className="fc-dnp" /> : <rect key={i} x={i * 5} y={16 - Math.max(1, Math.round((p / max) * 16))} width="4" height={Math.max(1, Math.round((p / max) * 16))} className={i === form.pts.length - 1 ? 'fc-last' : 'fc-bar'} />)}
    </svg>
    {form.heat === 'hot' && <b className="fc-heat hot" aria-hidden="true"><PixelIcon name="flame" size={14} /></b>}
    {form.heat === 'cold' && <b className="fc-heat cold" aria-hidden="true"><PixelIcon name="ice" size={14} /></b>}
  </span>;
}
