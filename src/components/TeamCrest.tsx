import { memo } from 'react';
import type { LeagueTeam } from '../simulation/league';
import { resolveTeamIdentity, type TeamIdentity } from '../simulation/teamIdentity';
import { MARKS } from '../visuals/logoMarks';
import { pixelTextPath, pixelTextWidth, splitTeamName } from '../visuals/pixelFont';

export type CrestLayout = 'roundel' | 'wordmark' | 'shield';
const LAYOUTS: CrestLayout[] = ['roundel', 'wordmark', 'shield'];
const CREAM = '#f6ecd2', INK = '#0b1018';

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
/** Each team keeps one crest layout, picked from its id, so the league shows a mix of roundels, wordmarks and shields. */
const crestLayout = (teamId: string): CrestLayout => LAYOUTS[hash(teamId) % LAYOUTS.length];

/** Pixel text centred on (cx, y), sized to fit maxWidth (at most maxPx per font pixel). */
function Word({ text, cx, y, maxWidth, maxPx, fill, outline = INK, outer = false }: { text: string; cx: number; y: number; maxWidth: number; maxPx: number; fill: string; outline?: string; outer?: boolean }) {
  if (!text) return null;
  const w = pixelTextWidth(text);
  const px = Math.max(1, Math.min(maxPx, maxWidth / w));
  const d = pixelTextPath(text, px);
  return <g transform={`translate(${(cx - (w * px) / 2).toFixed(2)},${(y - 3.5 * px).toFixed(2)})`}>
    {outer && <Outlined d={d} o={Math.max(2, px * 1.1)} fill={INK} outline={INK} />}
    <Outlined d={d} o={Math.max(1, px * .55)} fill={fill} outline={outline} />
  </g>;
}

/** Pixel letters with a solid outline built from offset copies (a stroke would show seams between pixel runs). */
function Outlined({ d, o, fill, outline = INK }: { d: string; o: number; fill: string; outline?: string }) {
  const offsets = [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]];
  return <>{offsets.map(([x, y], i) => <path key={i} d={d} fill={outline} transform={`translate(${x.toFixed(2)},${y.toFixed(2)})`} />)}<path d={d} fill={fill} /></>;
}

/** Text around a circle, one character at a time (top arc reads left→right clockwise, bottom arc counter-clockwise). */
function ArcText({ text, r, top, px, fill }: { text: string; r: number; top: boolean; px: number; fill: string }) {
  const chars = [...text.toUpperCase()];
  const step = (6 * px) / r; // radians per character
  const span = step * (chars.length - 1);
  return <g>{chars.map((c, i) => {
    const a = top ? -Math.PI / 2 - span / 2 + i * step : Math.PI / 2 + span / 2 - i * step;
    const x = 100 + Math.cos(a) * r, y = 100 + Math.sin(a) * r;
    const rot = (a * 180) / Math.PI + (top ? 90 : -90);
    const d = pixelTextPath(c, px);
    return <g key={i} transform={`translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${rot.toFixed(2)}) translate(${(-2.5 * px).toFixed(2)},${(-3.5 * px).toFixed(2)})`}><Outlined d={d} o={px * .5} fill={fill} /></g>;
  })}</g>;
}

function Mark({ identity, cx, cy, scale, fill, shadow = INK }: { identity: TeamIdentity; cx: number; cy: number; scale: number; fill: string; shadow?: string }) {
  const d = MARKS[identity.logo] ?? MARKS.star;
  const t = `translate(${cx - 25 * scale},${cy - 26 * scale}) scale(${scale})`;
  return <g>
    <path d={d} transform={`translate(${cx - 25 * scale + scale * 1.2},${cy - 26 * scale + scale * 1.2}) scale(${scale})`} fill={shadow} fillRule="evenodd" opacity=".55" />
    <path d={d} transform={t} fill={fill} fillRule="evenodd" stroke={INK} strokeWidth={1.2} paintOrder="stroke" />
  </g>;
}

/** The body of a crest in a 200×200 box, for use inside other SVGs (the court's centre circle). */
export const CrestArt = memo(function CrestArt({ team, identity, layout }: { team: Pick<LeagueTeam, 'teamId' | 'name'>; identity: TeamIdentity; layout?: CrestLayout }) {
  const { city, nickname } = splitTeamName(team.name);
  const kind = layout ?? crestLayout(team.teamId);
  const { primary, secondary } = identity;
  if (kind === 'roundel') return <g shapeRendering="geometricPrecision">
    <circle cx="100" cy="100" r="97" fill={INK} />
    <circle cx="100" cy="100" r="92" fill={secondary} />
    <circle cx="100" cy="100" r="64" fill={INK} />
    <circle cx="100" cy="100" r="61" fill={primary} />
    <circle cx="100" cy="100" r="61" fill="none" stroke={CREAM} strokeOpacity=".25" strokeWidth="2" strokeDasharray="4 4" />
    <ArcText text={city || identity.abbreviation} r={77} top px={city.length > 12 ? 2.4 : 3.2} fill={CREAM} />
    <ArcText text={nickname} r={77} top={false} px={nickname.length > 12 ? 2.4 : 3.2} fill={CREAM} />
    {[-1, 1].map(s => <path key={s} d="M0 -6L2 -2H6L3 1L4 6L0 3L-4 6L-3 1L-6 -2H-2Z" fill={CREAM} stroke={INK} strokeWidth="1" transform={`translate(${100 + s * 80},100)`} />)}
    <Mark identity={identity} cx={100} cy={100} scale={1.75} fill={CREAM} />
  </g>;
  if (kind === 'wordmark') return <g shapeRendering="geometricPrecision">
    <Mark identity={identity} cx={100} cy={96} scale={3.2} fill={secondary} shadow={primary} />
    <rect x="12" y="38" width="176" height="20" fill={secondary} stroke={INK} strokeWidth="3" />
    <Word text={city || identity.abbreviation} cx={100} y={48} maxWidth={160} maxPx={2.4} fill={CREAM} />
    <Word text={nickname} cx={100} y={120} maxWidth={186} maxPx={7} fill={CREAM} outline={primary} outer />
    <rect x="46" y="150" width="108" height="6" fill={secondary} stroke={INK} strokeWidth="2" />
  </g>;
  return <g shapeRendering="geometricPrecision">
    <path d="M22 18H178V112L158 146L128 168L100 184L72 168L42 146L22 112Z" fill={INK} />
    <path d="M28 24H172V110L154 141L126 161L100 176L74 161L46 141L28 110Z" fill={primary} />
    <path d="M28 24H172V56H28Z" fill={secondary} />
    <Word text={city || identity.abbreviation} cx={100} y={40} maxWidth={134} maxPx={3} fill={CREAM} />
    <Mark identity={identity} cx={100} cy={100} scale={1.55} fill={CREAM} />
    <path d="M8 124H192L184 136L192 148H8L16 136Z" fill={secondary} stroke={INK} strokeWidth="3" />
    <Word text={nickname} cx={100} y={136} maxWidth={164} maxPx={3.4} fill={CREAM} />
  </g>;
});

/** A detailed team crest with the team's name, for team headers and the court. */
export function TeamCrest({ team, size = 120, layout, label }: { team: Pick<LeagueTeam, 'teamId' | 'name' | 'identity'>; size?: number; layout?: CrestLayout; label?: string }) {
  const identity = resolveTeamIdentity(team);
  return <svg className="team-crest" width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={label ?? `${team.name} crest`}>
    <CrestArt team={team} identity={identity} layout={layout} />
  </svg>;
}
