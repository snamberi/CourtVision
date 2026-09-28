import type { TradeSideView } from '../../simulation/gm';
import { tradeMood, type Mood } from '../../simulation/tradeMood';

/*
 * The trade scale: the two packages on a pixel balance, weighed the way the other GM sees them, with his face telling
 * you how the offer lands before you send it. It uses the same numbers as the real decision (evaluateTradeSides and
 * the difficulty's tolerance), so a smiling GM says yes.
 */

const MOOD_TEXT: Record<Mood, string> = {
  furious: 'Not even close. He hangs up.',
  unhappy: 'He wants more. Add a player or a pick.',
  thinking: 'Close to even. He would take this.',
  happy: 'He likes it. You may be giving a little extra.',
  thrilled: 'He loves it. You are overpaying.',
};
/** 8×8 pixel faces: eyes and mouth rows per mood. */
const MOUTH: Record<Mood, string[]> = {
  furious: ['........', '..####..', '.#....#.'],
  unhappy: ['........', '..####..', '.#....#.'],
  thinking: ['........', '.######.', '........'],
  happy: ['.#....#.', '..####..', '........'],
  thrilled: ['.#....#.', '.######.', '..####..'],
};
const BROWS: Record<Mood, string> = { furious: '.##..##.', unhappy: '........', thinking: '........', happy: '........', thrilled: '........' };

function Face({ mood }: { mood: Mood }) {
  const rows = ['.######.', BROWS[mood], '.##..##.', '.##..##.', '........', ...MOUTH[mood]];
  const skin = mood === 'furious' ? '#e85d5d' : mood === 'unhappy' ? '#e0a36a' : '#e8b98a';
  return <svg className={`ts-face mood-${mood}`} viewBox="0 0 8 10" width="56" height="70" aria-hidden="true" shapeRendering="crispEdges">
    <rect x="0" y="0" width="8" height="10" fill={skin} />
    {rows.map((r, y) => [...r].map((c, x) => c === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={y === 0 ? '#3a2a1a' : '#0b1018'} /> : null))}
  </svg>;
}

export function TradeScale({ aName, bName, view, aiSide, tolerance, empty }: { aName: string; bName: string; view: TradeSideView; aiSide: 'a' | 'b'; tolerance: number; empty: boolean }) {
  const { mood, ratio } = tradeMood(view, tolerance);
  // Weights from the other GM's view: his incoming package against his outgoing one.
  const aWeight = aiSide === 'b' ? view.receive : view.give, bWeight = aiSide === 'b' ? view.give : view.receive;
  const total = aWeight + bWeight;
  const tilt = empty || total <= 0 ? 0 : Math.max(-14, Math.min(14, ((aWeight - bWeight) / total) * 40));
  const aiName = aiSide === 'a' ? aName : bName;
  const meter = Math.max(0, Math.min(100, (ratio / 1.5) * 100)), floorAt = ((1 - tolerance) / 1.5) * 100;
  return <div className={`trade-scale mood-${mood}`} role="group" aria-label={`Trade scale: ${aiName}'s GM is ${mood}`}>
    <svg className="ts-balance" viewBox="0 0 240 110" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="116" y="30" width="8" height="70" className="ts-post" /><rect x="96" y="98" width="48" height="8" className="ts-post" />
      <g className="ts-beam" style={{ transform: `rotate(${-tilt}deg)` }}>
        <rect x="20" y="26" width="200" height="6" className="ts-bar" /><rect x="114" y="22" width="12" height="12" className="ts-pivot" />
        <g transform="translate(40 32)"><line x1="0" y1="0" x2="-14" y2="30" /><line x1="0" y1="0" x2="14" y2="30" /><rect x="-24" y="30" width="48" height="6" className="ts-pan" /></g>
        <g transform="translate(200 32)"><line x1="0" y1="0" x2="-14" y2="30" /><line x1="0" y1="0" x2="14" y2="30" /><rect x="-24" y="30" width="48" height="6" className="ts-pan" /></g>
      </g>
    </svg>
    <div className="ts-labels"><span>{aName} sends</span><span>{bName} sends</span></div>
    <div className="ts-gm">
      <Face mood={mood} />
      <div>
        <small>{aiName.toUpperCase()} GM</small>
        <b>{empty ? 'Put something on the table.' : MOOD_TEXT[mood]}</b>
        {!empty && <div className="ts-meter" aria-hidden="true"><i style={{ width: `${meter}%` }} /><em style={{ left: `${floorAt}%` }} title="What he needs" /></div>}
      </div>
    </div>
  </div>;
}
