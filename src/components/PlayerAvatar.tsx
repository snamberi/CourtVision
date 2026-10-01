import { useTeamIdentity, usePlayerLook } from '../visuals/TeamIdentityContext';
import type { Appearance } from '../visuals/playerSprite';
import { memo, useMemo } from 'react';
import { teamColors } from '../simulation/teamColors';
import { buildPlayerSprite, SPRITE_WIDTH, SPRITE_HEIGHT, PORTRAIT_VIEWBOX } from '../visuals/playerSprite';

export type AvatarMode = 'full' | 'portrait';

interface PlayerAvatarProps {
  playerId: string;
  teamId?: string | null;
  jerseyStyle?: 'classic' | 'stripe' | 'split';
  primaryColor?: string;
  secondaryColor?: string;
  jerseyNumber?: number | null;
  heightInches?: number;
  /** Optional appearance-only aging; never changes the player's saved identity. */
  age?: number;
  mode?: AvatarMode;
  size?: number;
  className?: string;
  title?: string;
  /** Celebration pose: both arms raised. */
  pose?: 'stand' | 'raise';
  /** A look to show instead of the saved one (the Edit Player preview). */
  appearance?: Appearance;
}

/** The shared renderer upgrades every player surface without regenerating saved players.
 * Paths are grouped by color and memoized: detailed sprites use a compact set of SVG paths.
 */
export const PlayerAvatar = memo(function PlayerAvatar({
  playerId, teamId, primaryColor, secondaryColor, jerseyNumber, heightInches, age, jerseyStyle,
  mode = 'full', size = 48, className, title, pose, appearance,
}: PlayerAvatarProps) {
  const identity = useTeamIdentity(teamId);
  const saved = usePlayerLook(playerId);
  const look = appearance ?? saved;
  const lookKey = look ? JSON.stringify(look) : '';
  // The look by value, so a new object with the same choices doesn't redraw the sprite.
  const stableLook = useMemo(() => (lookKey ? JSON.parse(lookKey) as Appearance : undefined), [lookKey]);
  const colors = identity ?? teamColors(teamId);
  const style = jerseyStyle ?? identity?.jerseyStyle;
  const primary = primaryColor ?? colors.primary;
  const secondary = secondaryColor ?? colors.secondary;
  const paths = useMemo(() => buildPlayerSprite({ playerId, primary, secondary, jerseyNumber, age, jerseyStyle: style, pose, appearance: stableLook }),
    [playerId, primary, secondary, jerseyNumber, age, style, pose, stableLook]);
  const scale = heightInches && Number.isFinite(heightInches) ? Math.max(0.86, Math.min(1.16, heightInches / 79)) : 1;
  const width = Math.round(size * scale);
  const height = Math.round(width * (mode === 'portrait' ? 30 / 24 : SPRITE_HEIGHT / SPRITE_WIDTH));

  return (
    <svg
      className={`player-avatar player-avatar--${mode}${className ? ` ${className}` : ''}`}
      width={width} height={height}
      viewBox={mode === 'portrait' ? PORTRAIT_VIEWBOX : `0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}`}
      shapeRendering="crispEdges" role="img" aria-label={title ?? `${playerId} avatar`}
    >
      {title && <title>{title}</title>}
      {mode === 'full' && <path d="M10 49h21v1h3v1H7v-1h3z" fill="#070d1a" opacity=".45" />}
      {paths.map(({ fill, d }) => <path key={fill} fill={fill} d={d} />)}
    </svg>
  );
});

interface PlayerNameTagProps {
  playerId: string;
  teamId?: string | null;
  jerseyNumber?: number | null;
  heightInches?: number;
  /** Defaults to playerId — pass a different display name if the list already formats it specially. */
  name?: string;
  size?: number;
  className?: string;
}

/** The common "small portrait avatar + name" pairing used in list rows throughout the app — tables, checkboxes, compare cards, wherever a player's name shows up. Deliberately omits heightInches-based scaling by default (a fixed-size icon reads better in a dense table row) unless explicitly passed. */
export function PlayerNameTag({ playerId, teamId, jerseyNumber, heightInches, name, size = 26, className }: PlayerNameTagProps) {
  return (
    <span className={className ? `player-name-with-avatar ${className}` : 'player-name-with-avatar'}>
      <PlayerAvatar playerId={playerId} teamId={teamId} jerseyNumber={jerseyNumber} heightInches={heightInches} mode="portrait" size={size} />
      <span>{name ?? playerId}</span>
    </span>
  );
}
