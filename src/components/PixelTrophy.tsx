import { memo } from 'react';
import { TROPHIES, type TrophyKey } from '../simulation/trophies';
import { trophyRects } from '../visuals/trophyArt';
import { detailedSpritePaths, type SpriteGrid, type SpritePath } from '../visuals/playerSprite';

const artwork = new Map<TrophyKey, SpritePath[]>();
function trophyPaths(award: TrophyKey) {
  let paths = artwork.get(award);
  if (!paths) {
    const grid: SpriteGrid = Array.from({ length: 20 }, () => Array(16).fill(null));
    for (const r of trophyRects(award)) for (let x = r.x; x < r.x + r.w; x++) grid[r.y][x] = r.fill;
    paths = detailedSpritePaths(grid); artwork.set(award, paths);
  }
  return paths;
}

/** Every award's original pixel trophy. `dim` draws an unearned silhouette. */
export const PixelTrophy = memo(function PixelTrophy({ award, size = 32, title, dim, className }: {
  award: TrophyKey; size?: number; title?: string; dim?: boolean; className?: string;
}) {
  const label = title ?? TROPHIES[award].label;
  return (
    <svg className={`pixel-trophy${dim ? ' pixel-trophy--dim' : ''}${className ? ` ${className}` : ''}`} width={size} height={Math.round(size * 1.25)}
      viewBox="0 0 16 20" shapeRendering="crispEdges" role="img" aria-label={label}>
      <title>{label}</title>
      {trophyPaths(award).map(p => <path key={p.fill} d={p.d} fill={p.fill} />)}
    </svg>
  );
});
