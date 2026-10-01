import { memo, useMemo } from 'react';
import type { CoachLook } from '../visuals/coachLook';
import { buildFigureSprite } from '../visuals/avatarSprite';
import type { HairStyle } from '../visuals/playerSprite';

export type CoachPose = 'down' | 'cross' | 'point' | 'up';

const CUTS: HairStyle[] = ['short', 'crop', 'lowFade', 'medium', 'shortWide'];
const hashOf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** The outfit on the detailed figure: suits with a tie in the team colour, a team quarter-zip or tracksuit… */
function dress(look: CoachLook, primary: string, secondary: string) {
  switch (look.outfit) {
    case 'quarterzip': return { kind: 'hoodie' as const, main: primary, trim: '#2a3546' };
    case 'tracksuit': return { kind: 'track' as const, main: primary, trim: secondary };
    case 'turtleneck': return { kind: 'suit' as const, main: look.suit, trim: '#15181f' };
    case 'vest': return { kind: 'tux' as const, main: look.suit, trim: '#f4f0e6' };
    default: return { kind: 'suit' as const, main: look.suit, trim: primary };
  }
}

/**
 * A head coach on the sideline, standing at (0,0) = their feet, drawn on the same detailed body as the players. The
 * outfit comes from `coachLook`; the tie, zip or stripes are the team colour. Poses: arms down, arms crossed, pointing
 * at the play, arms up to celebrate.
 */
export const CoachFigure = memo(function CoachFigure({ look, primary, secondary, pose = 'down', scale = 1 }: { look: CoachLook; primary: string; secondary: string; pose?: CoachPose; scale?: number }) {
  const paths = useMemo(() => {
    const h = hashOf(look.name);
    return buildFigureSprite({ id: `coach-${look.name}`, skin: look.skin, hair: look.hair, hairStyle: look.bald ? 'bald' : CUTS[h % CUTS.length], beard: look.beard ? 'shortBoxed' : 'none', glasses: look.glasses, pose, ...dress(look, primary, secondary) });
  }, [look, primary, secondary, pose]);
  const s = .95 * scale;
  return <g transform={`scale(${s.toFixed(3)}) translate(-20,-50)`} shapeRendering="crispEdges" data-outfit={look.outfit} data-pose={pose}>
    <ellipse cx="20" cy="50" rx="11" ry="3" fill="#1a120c" opacity=".3" />
    {paths.map(p => <path key={p.fill} fill={p.fill} d={p.d} />)}
  </g>;
});

const REF_SKIN = ['#f1c49a', '#d6aa7b', '#a8734f', '#7a5038', '#c8906a'];
const REF_HAIR = ['#1b1410', '#3b2a1c', '#6b4a2b', '#8a8a8a'];
/** A referee: stripes, black slacks, the crew number on the chest; `whistle` raises an arm for the call. */
export const RefereeFigure = memo(function RefereeFigure({ number, whistle = false }: { number?: number; whistle?: boolean }) {
  const paths = useMemo(() => {
    const h = hashOf(`ref-${number ?? 0}`);
    return buildFigureSprite({ id: `ref-${number ?? 0}`, skin: REF_SKIN[h % REF_SKIN.length], hair: REF_HAIR[(h >>> 4) % REF_HAIR.length], hairStyle: (['lowFade', 'buzzCut', 'short', 'bald'] as HairStyle[])[(h >>> 8) % 4], kind: 'referee', main: '#f4f6fa', trim: '#12151c', pose: whistle ? 'whistle' : 'down' });
  }, [number, whistle]);
  return <g transform="scale(.9) translate(-20,-50)" shapeRendering="crispEdges">
    <ellipse cx="20" cy="50" rx="11" ry="3" fill="#1a120c" opacity=".3" />
    {paths.map(p => <path key={p.fill} fill={p.fill} d={p.d} />)}
  </g>;
});
