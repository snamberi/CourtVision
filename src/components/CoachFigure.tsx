import { memo } from 'react';
import type { CoachLook } from '../visuals/coachLook';

export type CoachPose = 'down' | 'cross' | 'point' | 'up';

/**
 * A head coach, front-on in pixels, standing at (0,0) = their feet. The outfit comes from `coachLook`; the accent
 * (tie, zip, stripes) is the team colour. Poses: arms down, arms crossed, pointing at the play, arms up to celebrate.
 */
export const CoachFigure = memo(function CoachFigure({ look, primary, secondary, pose = 'down', scale = 1 }: { look: CoachLook; primary: string; secondary: string; pose?: CoachPose; scale?: number }) {
  const { outfit, skin, hair, bald, glasses, beard, suit } = look;
  const top = outfit === 'quarterzip' || outfit === 'tracksuit' ? primary : outfit === 'turtleneck' ? '#15181f' : outfit === 'vest' ? '#f4f0e6' : suit;
  const jacket = outfit === 'turtleneck' ? suit : outfit === 'vest' ? suit : top;
  const legs = outfit === 'tracksuit' ? primary : outfit === 'quarterzip' ? '#2a3546' : suit;
  const sleeve = outfit === 'vest' ? '#f4f0e6' : jacket;
  const arm = (x: number, y: number, w: number, h: number, key: string) => <rect key={key} x={x} y={y} width={w} height={h} fill={sleeve} stroke="#0b1018" strokeWidth=".6" />;
  const hand = (x: number, y: number, key: string) => <rect key={key} x={x} y={y} width="3" height="3" fill={skin} />;
  const arms = pose === 'up' ? [arm(-12, -44, 3, 16, 'l'), arm(9, -44, 3, 16, 'r'), hand(-12, -47, 'hl'), hand(9, -47, 'hr')]
    : pose === 'point' ? [arm(-11, -30, 3, 13, 'l'), hand(-11, -17, 'hl'), arm(8, -29, 11, 3, 'r'), hand(19, -29, 'hr')]
    : pose === 'cross' ? [arm(-11, -30, 3, 8, 'l'), arm(8, -30, 3, 8, 'r'), <rect key="x" x="-9" y="-24" width="18" height="4" fill={sleeve} stroke="#0b1018" strokeWidth=".6" />, hand(-10, -24, 'hl'), hand(7, -24, 'hr')]
    : [arm(-11, -30, 3, 13, 'l'), arm(8, -30, 3, 13, 'r'), hand(-11, -17, 'hl'), hand(8, -17, 'hr')];
  return <g transform={scale !== 1 ? `scale(${scale})` : undefined} shapeRendering="crispEdges" data-outfit={outfit} data-pose={pose}>
    <ellipse cx="0" cy="0" rx="10" ry="3" fill="#1a120c" opacity=".3" />
    {/* shoes and legs */}
    <rect x="-6" y="-3" width="5" height="3" fill="#0b1018" /><rect x="1" y="-3" width="5" height="3" fill="#0b1018" />
    <rect x="-6" y="-16" width="5" height="13" fill={legs} /><rect x="1" y="-16" width="5" height="13" fill={legs} />
    {outfit === 'tracksuit' && <><rect x="-6" y="-16" width="1" height="13" fill={secondary} /><rect x="5" y="-16" width="1" height="13" fill={secondary} /></>}
    {/* torso */}
    <rect x="-8" y="-31" width="16" height="16" fill={jacket} stroke="#0b1018" strokeWidth=".6" />
    {(outfit === 'suit' || outfit === 'vest') && <><path d="M-3 -31H3L0 -23Z" fill="#f4f0e6" /><rect x="-1" y="-29" width="2" height="9" fill={primary} /></>}
    {outfit === 'vest' && <><rect x="-8" y="-31" width="3" height="16" fill="#f4f0e6" /><rect x="5" y="-31" width="3" height="16" fill="#f4f0e6" /></>}
    {outfit === 'turtleneck' && <rect x="-4" y="-31" width="8" height="16" fill="#15181f" />}
    {outfit === 'quarterzip' && <><rect x="-4" y="-32" width="8" height="2" fill={secondary} /><rect x="0" y="-30" width="1" height="6" fill="#f4f0e6" /><rect x="3" y="-27" width="3" height="2" fill={secondary} /></>}
    {outfit === 'tracksuit' && <><rect x="-8" y="-31" width="16" height="2" fill={secondary} /><rect x="0" y="-29" width="1" height="13" fill="#f4f0e6" /></>}
    {arms}
    {/* head */}
    <rect x="-2" y="-33" width="4" height="2" fill={outfit === 'turtleneck' ? '#15181f' : skin} />
    <rect x="-5" y="-42" width="10" height="10" fill={skin} stroke="#0b1018" strokeWidth=".6" />
    {bald ? <><rect x="-5" y="-39" width="1" height="4" fill={hair} /><rect x="4" y="-39" width="1" height="4" fill={hair} /></>
      : <rect x="-5" y="-43" width="10" height="3" fill={hair} />}
    {glasses ? <rect x="-4" y="-38" width="8" height="2" fill="#0b1018" /> : <><rect x="-3" y="-38" width="2" height="2" fill="#1a1410" /><rect x="1" y="-38" width="2" height="2" fill="#1a1410" /></>}
    {beard ? <rect x="-5" y="-35" width="10" height="3" fill={hair} /> : <rect x="-2" y="-34" width="4" height="1" fill="#8a4a3a" />}
  </g>;
});
