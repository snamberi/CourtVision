import type { TeamIdentity } from '../simulation/teamIdentity';
import { MARKS } from '../visuals/logoMarks';

/*
 * Rafter banners, drawn as pixel cloth: a hanging rod, the team's colors with stitched trim, the team mark and a
 * swallow-tail hem. Championship and Cup banners, dynasty banners and retired jerseys share the frame.
 */

const PIXEL = "'Press Start 2P', monospace";
const W = 72, H = 124;

function Frame({ main, trim, children, label, className }: { main: string; trim: string; children: React.ReactNode; label: string; className: string }) {
  const stitches = [];
  for (let y = 14; y < 98; y += 6) stitches.push(<rect key={`l${y}`} x="11" y={y} width="2" height="3" fill={trim} opacity=".55" />, <rect key={`r${y}`} x={W - 13} y={y} width="2" height="3" fill={trim} opacity=".55" />);
  return <svg className={`history-banner ${className}`} viewBox={`0 0 ${W} ${H}`} width={W} height={H} shapeRendering="crispEdges" role="img" aria-label={label}>
    {/* rod and cords */}
    <rect x="2" y="1" width={W - 4} height="4" fill="#6b778a" /><rect x="0" y="0" width="4" height="6" fill="#aab4c3" /><rect x={W - 4} y="0" width="4" height="6" fill="#aab4c3" />
    <rect x="16" y="5" width="2" height="4" fill="#aab4c3" /><rect x={W - 18} y="5" width="2" height="4" fill="#aab4c3" />
    {/* cloth: trim, body, a darker fold down one side, swallow-tail hem */}
    <path d={`M6 8H${W - 6}V100L${W / 2 + 12} 112L${W / 2} 104L${W / 2 - 12} 112L6 100Z`} fill={trim} />
    <path d={`M9 11H${W - 9}V98L${W / 2 + 11} 108L${W / 2} 100L${W / 2 - 11} 108L9 98Z`} fill={main} />
    <path d={`M${W - 17} 11H${W - 9}V98L${W - 17} 102Z`} fill="#000" opacity=".16" />
    <path d={`M9 11H15V100L9 98Z`} fill="#fff" opacity=".07" />
    {stitches}
    {children}
  </svg>;
}

const Mark = ({ identity, x, y, scale, fill }: { identity: TeamIdentity; x: number; y: number; scale: number; fill: string }) =>
  <path d={MARKS[identity.logo] ?? MARKS.star} transform={`translate(${x} ${y}) scale(${scale})`} fill={fill} fillRule="evenodd" />;

const Trophy = ({ x, y, fill }: { x: number; y: number; fill: string }) =>
  <path d={`M${x} ${y}H${x + 12}V${y + 2}H${x + 15}V${y + 7}H${x + 12}V${y + 9}H${x + 9}V${y + 11}H${x + 11}V${y + 14}H${x + 1}V${y + 11}H${x + 3}V${y + 9}H${x}V${y + 7}H${x - 3}V${y + 2}H${x}ZM${x - 1} ${y + 3}V${y + 6}H${x}V${y + 3}ZM${x + 12} ${y + 3}V${y + 6}H${x + 13}V${y + 3}Z`} fill={fill} fillRule="evenodd" />;

/** League title: the team's color, gold trim, trophy and year. */
export function TitleBanner({ identity, year }: { identity: TeamIdentity; year: string }) {
  return <Frame className="banner-title" main={identity.primary} trim="#ffd166" label={`Champions ${year}`}>
    <Mark identity={identity} x={W / 2 - 9} y={13} scale={0.36} fill={identity.secondary} />
    <text x={W / 2} y="40" textAnchor="middle" fill="#fff4d9" fontFamily={PIXEL} fontSize="5.5">WORLD</text>
    <text x={W / 2} y="48" textAnchor="middle" fill="#fff4d9" fontFamily={PIXEL} fontSize="5.5">CHAMPIONS</text>
    <Trophy x={W / 2 - 6} y={54} fill="#ffd166" />
    <text x={W / 2} y="86" textAnchor="middle" fill="#ffd166" fontFamily={PIXEL} fontSize="10">{year}</text>
    <text x={W / 2} y="97" textAnchor="middle" fill="#f4f0e6" fontFamily="monospace" fontWeight="bold" fontSize="7">{identity.abbreviation}</text>
  </Frame>;
}

/** In-Season Cup: cobalt and silver. */
export function CupBanner({ identity, year }: { identity: TeamIdentity; year: string }) {
  return <Frame className="banner-cup" main="#16325a" trim="#9fcbff" label={`In-Season Cup ${year}`}>
    <Mark identity={identity} x={W / 2 - 9} y={13} scale={0.36} fill="#9fcbff" />
    <text x={W / 2} y="40" textAnchor="middle" fill="#dbeafe" fontFamily={PIXEL} fontSize="5">IN-SEASON</text>
    <text x={W / 2} y="48" textAnchor="middle" fill="#dbeafe" fontFamily={PIXEL} fontSize="7">CUP</text>
    <Trophy x={W / 2 - 6} y={54} fill="#9fcbff" />
    <text x={W / 2} y="86" textAnchor="middle" fill="#9fcbff" fontFamily={PIXEL} fontSize="10">{year}</text>
    <text x={W / 2} y="97" textAnchor="middle" fill="#f4f0e6" fontFamily="monospace" fontWeight="bold" fontSize="7">{identity.abbreviation}</text>
  </Frame>;
}

/** Three titles in five seasons: black and gold with a trophy per title. */
export function DynastyBanner({ identity, from, to, titles }: { identity: TeamIdentity; from: string; to: string; titles: number }) {
  const n = Math.min(titles, 4);
  return <Frame className="banner-dynasty" main="#0b1018" trim="#ffd166" label={`Dynasty ${from} to ${to}, ${titles} titles`}>
    <rect x="9" y="11" width={W - 18} height="6" fill={identity.primary} />
    <text x={W / 2} y="30" textAnchor="middle" fill="#ffd166" fontFamily={PIXEL} fontSize="6.5">DYNASTY</text>
    {Array.from({ length: n }, (_, i) => <Trophy key={i} x={W / 2 - (n - 1) * 8 + i * 16 - 6} y={36} fill="#ffd166" />)}
    <text x={W / 2} y="68" textAnchor="middle" fill="#f4f0e6" fontFamily={PIXEL} fontSize="8">{from}</text>
    <text x={W / 2} y="78" textAnchor="middle" fill="#94a0b2" fontFamily={PIXEL} fontSize="5">TO {to}</text>
    <text x={W / 2} y="92" textAnchor="middle" fill="#ffd166" fontFamily="monospace" fontWeight="bold" fontSize="7">{titles} TITLES</text>
  </Frame>;
}

/** Retired number: a jersey in the team's colors with the number and the name. */
export function JerseyBanner({ identity, number, name, years }: { identity: TeamIdentity; number: number; name: string; years?: string }) {
  const last = name.split(' ').slice(1).join(' ') || name;
  const x = W / 2;
  return <Frame className="banner-jersey" main="#0b1018" trim={identity.primary} label={`Retired number ${number}, ${name}`}>
    <text x={x} y="22" textAnchor="middle" fill="#94a0b2" fontFamily={PIXEL} fontSize="4.5">RETIRED</text>
    <path d={`M${x - 10} 28H${x - 4}V30H${x + 4}V28H${x + 10}V32H${x + 17}V42H${x + 12}V70H${x - 12}V42H${x - 17}V32H${x - 10}Z`} fill={identity.primary} />
    <path d={`M${x - 4} 28H${x + 4}V33H${x - 4}Z`} fill={identity.secondary} />
    <rect x={x - 12} y="64" width="24" height="3" fill={identity.secondary} />
    <text x={x} y="58" textAnchor="middle" fill={identity.secondary} fontFamily={PIXEL} fontSize={number >= 10 ? 11 : 13}>{number}</text>
    <text x={x} y="84" textAnchor="middle" fill="#f4f0e6" fontFamily="monospace" fontWeight="bold" fontSize={last.length > 12 ? 4.2 : last.length > 9 ? 5.2 : 7}>{last.toUpperCase().slice(0, 16)}</text>
    {years && <text x={x} y="94" textAnchor="middle" fill="#94a0b2" fontFamily="monospace" fontSize="5.5">{years}</text>}
  </Frame>;
}
