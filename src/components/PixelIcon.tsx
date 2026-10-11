import { ART, pixelIconPath } from './pixelIconData';

/** Crisp shared UI artwork. Color continues to come from the active theme. */
export function PixelIcon({ name = 'court', size = 20 }: { name?: string; size?: number }) {
  const art = ART[name];
  const { d } = pixelIconPath(name);
  return <svg className="pixel-icon" width={size} height={size} viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true"><path d={d} fillRule="evenodd" />{art && <path d={art.shine} fill="#fff3df" opacity=".28" />}</svg>;
}

export function PixelBall({ size = 36 }: { size?: number }) {
  return <svg className="pixel-ball" width={size} height={size} viewBox="0 0 28 28" shapeRendering="crispEdges" aria-hidden="true">
    <path fill="#17151e" d="M9 0H19V1H22V3H25V6H27V9H28V19H27V22H25V25H22V27H19V28H9V27H6V25H3V22H1V19H0V9H1V6H3V3H6V1H9Z" />
    <path fill="#a64520" d="M9 2H19V3H22V5H24V8H26V19H25V22H22V25H19V26H9V25H6V23H4V20H2V9H3V6H6V4H9Z" />
    <path fill="#e98030" d="M8 3H19V4H22V6H24V11H25V17H22V20H18V22H8V21H5V18H3V9H5V6H8Z" />
    <path fill="#ffa847" d="M9 4H17V5H20V8H21V14H19V17H15V18H8V16H5V10H6V7H9Z" />
    <path fill="#ffd077" d="M9 5H14V6H10V7H8V10H6V8H7V6H9ZM7 11H8V13H7Z" />
    <path fill="#592d24" d="M13 2H15V10H16V13H26V15H16V18H15V26H13V18H12V15H2V13H12V10H13ZM5 5H7V7H9V10H10V18H9V21H7V23H5V21H7V18H8V10H7V8H5ZM22 5H23V8H21V11H20V17H21V20H23V23H21V21H19V18H18V10H19V7H21V5Z" />
    <path fill="#ffc067" d="M11 3H12V9H11ZM3 11H6V12H3ZM16 16H17V20H16ZM22 16H24V17H22Z" />
    <path fill="#d66627" d="M5 16H6V17H5ZM10 20H11V21H10ZM17 6H18V7H17ZM23 9H24V10H23ZM18 22H19V23H18ZM8 9H9V10H8Z" />
  </svg>;
}

/** A pixel medal in gold, silver or bronze (World Games), with its name for screen readers. */
export function MedalIcon({ medal, size = 14 }: { medal: 'gold' | 'silver' | 'bronze'; size?: number }) {
  return <span className={`medal-icon medal-${medal}`} role="img" aria-label={`${medal[0].toUpperCase()}${medal.slice(1)}`}><PixelIcon name="medal" size={size} /></span>;
}
