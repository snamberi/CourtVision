import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { LeagueTeam } from '../simulation/league';
import type { PlayerSeason } from '../simulation/types';
import { resolveTeamIdentity, type TeamIdentity } from '../simulation/teamIdentity';
import type { Appearance } from './playerSprite';
const Context = createContext<Record<string, TeamIdentity>>({});
/** Looks chosen in Edit Player, by player id, so every avatar and court sprite of that player shows it. */
const Looks = createContext<Record<string, Appearance>>({});
export function TeamIdentityProvider({ teams, freeAgents = [], children }: { teams: LeagueTeam[]; freeAgents?: PlayerSeason[]; children: ReactNode }) {
  const value = useMemo(() => Object.fromEntries(teams.map(t => [t.teamId, resolveTeamIdentity(t)])), [teams]);
  const looks = useMemo(() => {
    const out: Record<string, Appearance> = {};
    for (const p of [...teams.flatMap(t => t.seasons), ...freeAgents]) if (p.appearance) out[p.playerId] = p.appearance;
    return out;
  }, [teams, freeAgents]);
  return <Context.Provider value={value}><Looks.Provider value={looks}>{children}</Looks.Provider></Context.Provider>;
}
export function useTeamIdentity(teamId: string | null | undefined): TeamIdentity | undefined {
  return useContext(Context)[teamId ?? ''];
}
export function usePlayerLook(playerId: string): Appearance | undefined {
  return useContext(Looks)[playerId];
}
