import { generateFullLeague, type GeneratedLeague } from './leagueGenerator';
import { WORLD_LEAGUES, worldEra, type WorldLeagueId } from './worldLeagues';

/** A new league of one of the other leagues: its clubs and players, its rules and season, no World Games. */
export function buildWorldLeague(id: WorldLeagueId, seed: number, year: number): GeneratedLeague {
  const def = WORLD_LEAGUES[id];
  const g = generateFullLeague(seed, def.clubs.length, def.rosterSize, def.games, String(year), { balanced: true, priorSeasons: false, world: def });
  const settings = { ...g.league.settings, era: worldEra(def, g.league.settings.era), gamesPerSeason: def.games };
  return { league: { ...g.league, settings, worldLeague: id, worldGames: { history: [], off: true } }, extras: g.extras };
}
