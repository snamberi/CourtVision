import type { League } from './league';
import type { GMLeagueExtras } from './gm';
import { syncPotential } from './engine/potential';

/** Applies the potential rules to every player (roster and free agents). Idempotent; unchanged objects are kept. */
export function syncLeaguePotentials(league: League, extras: GMLeagueExtras): { league: League; extras: GMLeagueExtras } {
  const rules = league.rulesSettings;
  let teamsChanged = false;
  const teams = league.teams.map(t => {
    let changed = false;
    const seasons = t.seasons.map(p => { const n = syncPotential(p, rules); if (n !== p) changed = true; return n; });
    if (!changed) return t;
    teamsChanged = true;
    return { ...t, seasons };
  });
  let faChanged = false;
  const freeAgents = extras.freeAgents.map(p => { const n = syncPotential(p, rules); if (n !== p) faChanged = true; return n; });
  return { league: teamsChanged ? { ...league, teams } : league, extras: faChanged ? { ...extras, freeAgents } : extras };
}
