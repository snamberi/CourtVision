import { resolveTeamIdentity } from '../simulation/teamIdentity';
import type { LeagueTeam } from '../simulation/league';
import { MARKS } from '../visuals/logoMarks';
import { TeamCrest } from './TeamCrest';

export function TeamLogo({ team, size = 64 }: { team: Pick<LeagueTeam, 'teamId' | 'name' | 'identity'>; size?: number }) {
  // Big logos (headers, the court) get the full crest with the team's name; small ones stay a compact badge.
  if (size >= 96) return <TeamCrest team={team} size={size} label={`${team.name} logo`} />;
  const identity = resolveTeamIdentity(team);
  return <svg className="team-logo" width={size} height={size} viewBox="0 0 50 58" shapeRendering="crispEdges" role="img" aria-label={`${team.name} logo`}>
    <path d="M8 1H42V5H48V43H42V49H34V55H16V49H8V43H2V5H8Z" fill={identity.secondary} stroke="#f3e7ca" strokeWidth="2" />
    <path d="M8 7H42V39H36V45H14V39H8Z" fill={identity.primary} />
    <path d={MARKS[identity.logo] ?? MARKS.star} fill="#f3e7ca" fillRule="evenodd" />
    <rect x="6" y="42" width="38" height="12" fill="#0b1018" />
    <text x="25" y="51" textAnchor="middle" fill="#f3e7ca" fontFamily="monospace" fontWeight="bold" fontSize="8">{identity.abbreviation}</text>
  </svg>;
}
