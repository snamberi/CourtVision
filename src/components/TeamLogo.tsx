import { resolveTeamIdentity } from '../simulation/teamIdentity';
import type { LeagueTeam } from '../simulation/league';
const MARKS = {
  bolt: 'M35 9H20L13 29H25L19 43L39 22H27Z',
  crown: 'M11 18L19 25L25 13L31 25L39 18V34H11ZM13 37H37V41H13Z',
  mountain: 'M7 37L20 15L27 26L32 19L44 37ZM19 22L15 29H24Z',
  wings: 'M6 17H19L25 28L31 17H44V23H35L29 32H39V37H11V32H21L15 23H6Z',
  star: 'M25 10L30 21H42L33 29L36 41L25 34L14 41L17 29L8 21H20Z',
  tower: 'M12 12H18V18H22V12H28V18H32V12H38V25H33V40H17V25H12ZM23 29V40H27V29Z',
};
export function TeamLogo({ team, size = 64 }: { team: Pick<LeagueTeam, 'teamId' | 'name' | 'identity'>; size?: number }) {
  const identity = resolveTeamIdentity(team);
  return <svg className="team-logo" width={size} height={size} viewBox="0 0 50 58" shapeRendering="crispEdges" role="img" aria-label={`${team.name} logo`}>
    <path d="M8 1H42V5H48V43H42V49H34V55H16V49H8V43H2V5H8Z" fill={identity.secondary} stroke="#f3e7ca" strokeWidth="2" />
    <path d="M8 7H42V39H36V45H14V39H8Z" fill={identity.primary} />
    <path d={MARKS[identity.logo]} fill="#f3e7ca" />
    <rect x="6" y="42" width="38" height="12" fill="#0b1018" />
    <text x="25" y="51" textAnchor="middle" fill="#f3e7ca" fontFamily="monospace" fontWeight="bold" fontSize="8">{identity.abbreviation}</text>
  </svg>;
}
