import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { LeagueTeam } from '../simulation/league';
import { routeHash } from '../navigation/routes';
const TeamLinks = createContext<{ teams: LeagueTeam[]; saveId: string | null }>({ teams: [], saveId: null });
export function TeamLinksProvider({ teams, saveId, children }: { teams: LeagueTeam[]; saveId: string | null; children: ReactNode }) {
  const value = useMemo(() => ({ teams, saveId }), [teams, saveId]);
  return <TeamLinks.Provider value={value}>{children}</TeamLinks.Provider>;
}
export function TeamLink({ name, teamId }: { name?: string | null; teamId?: string | null }) {
  const { teams, saveId } = useContext(TeamLinks);
  const matches = teamId ? teams.filter(t => t.teamId === teamId) : teams.filter(t => t.name === name || t.teamId === name);
  const team = matches.length === 1 ? matches[0] : null;
  const label = name ?? team?.name ?? teamId ?? '—';
  if (!team || !saveId) return <>{label}</>;
  return <a className="team-link" href={routeHash({ saveId, tab: 'teamProfile', team: team.teamId })} onClick={e => e.stopPropagation()} title={`View ${team.name}`}>{label}</a>;
}
/** Link team mentions in headlines without turning controls or HTML into links. */
export function TeamText({ text }: { text: string }) {
  const { teams } = useContext(TeamLinks);
  const names = [...new Set(teams.map(t => t.name))].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return <>{text}</>;
  const pattern = new RegExp(`(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return <>{text.split(pattern).map((part, i) => names.includes(part) ? <TeamLink key={i} name={part} /> : part)}</>;
}
