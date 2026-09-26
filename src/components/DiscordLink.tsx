import { CLYDE_PATH } from '../visuals/discordGlyph';
export const DISCORD_URL = 'https://discord.gg/5uGK5HDS8e';


/** Pixel-art Discord badge: blurple tile, stepped corners, white mascot. */
export function PixelDiscordIcon({ size = 20 }: { size?: number }) {
  return <svg className="pixel-discord" width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
    <path fill="#3c45a5" d="M1 0h14v1h1v14h-1v1H1v-1H0V1h1z" />
    <path fill="#5865f2" d="M1 1h14v13H1z" />
    <path fill="#7984f5" d="M1 1h14v1H1z" />
    <path fill="#fff" d={CLYDE_PATH} />
  </svg>;
}

/** Opens the community server in a new tab. `compact` shows the icon only (collapsed sidebar). */
export function DiscordLink({ className = '', compact = false, label = 'Join our Discord' }: { className?: string; compact?: boolean; label?: string }) {
  return <a className={`discord-link ${className}`} href={DISCORD_URL} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`} title={label}>
    <PixelDiscordIcon size={compact ? 18 : 20} />{!compact && <span>{label}</span>}
  </a>;
}
