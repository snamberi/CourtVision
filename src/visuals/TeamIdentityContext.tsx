import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { LeagueTeam } from '../simulation/league';
import { resolveTeamIdentity, type TeamIdentity } from '../simulation/teamIdentity';
const Context = createContext<Record<string, TeamIdentity>>({});
export function TeamIdentityProvider({ teams, children }: { teams: LeagueTeam[]; children: ReactNode }) {
  const value = useMemo(() => Object.fromEntries(teams.map(t => [t.teamId, resolveTeamIdentity(t)])), [teams]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTeamIdentity(teamId: string | null | undefined): TeamIdentity | undefined {
  return useContext(Context)[teamId ?? ''];
}
