import { memo } from 'react';
import { TROPHIES, type TrophyKey } from '../simulation/trophies';
import { trophyRects } from '../visuals/trophyArt';

/** Every award's original pixel trophy. `dim` draws an unearned silhouette. */
export const PixelTrophy = memo(function PixelTrophy({ award, size = 32, title, dim, className }: {
  award: TrophyKey; size?: number; title?: string; dim?: boolean; className?: string;
}) {
  const label = title ?? TROPHIES[award].label;
  return (
    <svg className={`pixel-trophy${dim ? ' pixel-trophy--dim' : ''}${className ? ` ${className}` : ''}`} width={size} height={Math.round(size * 1.25)}
      viewBox="0 0 16 20" shapeRendering="crispEdges" role="img" aria-label={label}>
      <title>{label}</title>
      {trophyRects(award).map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />)}
    </svg>
  );
});
