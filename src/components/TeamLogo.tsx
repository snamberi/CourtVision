import { resolveTeamIdentity } from '../simulation/teamIdentity';
import type { LeagueTeam } from '../simulation/league';
import { MARKS } from '../visuals/logoMarks';
import { TeamCrest } from './TeamCrest';
import { pixelTextPath, pixelTextWidth } from '../visuals/pixelFont';
import { useId } from 'react';
import { TeamMark } from './TeamMark';

export function TeamLogo({ team, size = 64 }: { team: Pick<LeagueTeam, 'teamId' | 'name' | 'identity'>; size?: number }) {
  const id = useId();
  // Big logos (headers, the court) get the full crest with the team's name; small ones stay a compact badge.
  if (size >= 96) return <TeamCrest team={team} size={size} label={`${team.name} logo`} />;
  const identity = resolveTeamIdentity(team);
  const abbr = identity.abbreviation.slice(0, 4);
  const px = abbr.length > 3 ? 1.5 : 2;
  const text = pixelTextPath(abbr, px), w = pixelTextWidth(abbr) * px;
  return <svg className="team-logo" width={size} height={size} viewBox="0 0 50 58" shapeRendering="crispEdges" role="img" aria-label={`${team.name} logo`}>
    <defs><clipPath id={id}><path d="M8 7H42V39H36V45H14V39H8Z" /></clipPath></defs>
    {/* Outer frame with a stepped bevel: light on the top-left, dark on the bottom-right. */}
    <path d="M8 1H42V5H48V43H42V49H34V55H16V49H8V43H2V5H8Z" fill="#0b1018" />
    <path d="M9 2H41V6H47V42H41V48H33V54H17V48H9V42H3V6H9Z" fill={identity.secondary} />
    <path d="M9 2H41V4H9ZM3 6H5V42H3Z" fill="#fff" opacity=".35" />
    <path d="M45 6H47V42H45ZM17 52H33V54H17Z" fill="#000" opacity=".3" />
    {/* The field in the primary colour with a light band across the top. */}
    <path d="M8 7H42V39H36V45H14V39H8Z" fill="#0b1018" transform="translate(0,1)" opacity=".5" />
    <path d="M8 7H42V39H36V45H14V39H8Z" fill={identity.primary} />
    <g clipPath={`url(#${id})`}><rect x="8" y="7" width="34" height="9" fill="#fff" opacity=".14" /><path d="M10 9H40V38H34V42H16V38H10Z" fill="none" stroke={identity.secondary} strokeWidth=".5" strokeDasharray="1 2" opacity=".45" /><rect x="8" y="36" width="34" height="9" fill="#000" opacity=".16" /></g>
    {/* The mark with a hard drop shadow and an ink outline. */}
    <path d={MARKS[identity.logo] ?? MARKS.star} fill="#0b1018" fillRule="evenodd" transform="translate(1.5,1.5)" opacity=".55" />
    <TeamMark logo={identity.logo} accent={identity.secondary} />
    {/* The abbreviation in the game's pixel font on a dark plate. */}
    <rect x="5" y="41" width="40" height="13" fill="#0b1018" />
    <rect x="6" y="42" width="38" height="1" fill={identity.secondary} opacity=".8" />
    <path d="M6 52H44V53H6ZM4 8H5V10H4ZM45 8H46V10H45" fill="#fff3df" opacity=".25" />
    <path d={text} fill="#f3e7ca" transform={`translate(${(25 - w / 2).toFixed(2)},${(47.5 - 3.5 * px).toFixed(2)})`} />
  </svg>;
}
