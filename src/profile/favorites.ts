import { localRead, type Read } from '../lib/kv';

/*
 * Your favourite team and player (set on the Profile tab). The team is picked for you wherever you choose a team (you
 * can still change it); the player comes up more often in the Career Mode wheel and the League Hunt reels: when a spin
 * lands on his rarity, FAV_BOOST more chance it is him, until you get him once in that run. Shared-seed modes (the
 * weekly career, the Daily Legend) leave the odds alone so everyone plays the same draw.
 */

export const FAVORITES_KEY = 'cv-favorites';
export const FAVORITES_EVENT = 'courtvision:favorites';
/** The extra chance to land your favourite player when a spin lands on his rarity. */
export const FAV_BOOST = 0.15;

export interface Favorites { team?: string; player?: string }

/** Today's franchises by city (the game ships no official team names). */
export const REAL_FRANCHISES: { id: string; city: string }[] = [
  ['ATL', 'Atlanta'], ['BOS', 'Boston'], ['BRK', 'Brooklyn'], ['CHO', 'Charlotte'], ['CHI', 'Chicago'], ['CLE', 'Cleveland'],
  ['DAL', 'Dallas'], ['DEN', 'Denver'], ['DET', 'Detroit'], ['GSW', 'Golden State'], ['HOU', 'Houston'], ['IND', 'Indiana'],
  ['LAC', 'LA'], ['LAL', 'Los Angeles'], ['MEM', 'Memphis'], ['MIA', 'Miami'], ['MIL', 'Milwaukee'], ['MIN', 'Minnesota'],
  ['NOP', 'New Orleans'], ['NYK', 'New York'], ['OKC', 'Oklahoma City'], ['ORL', 'Orlando'], ['PHI', 'Philadelphia'], ['PHO', 'Phoenix'],
  ['POR', 'Portland'], ['SAC', 'Sacramento'], ['SAS', 'San Antonio'], ['TOR', 'Toronto'], ['UTA', 'Utah'], ['WAS', 'Washington'],
].map(([id, city]) => ({ id, city }));

/** Where each franchise played before (so a 1990s league still finds your team). */
const LINEAGE: Record<string, string[]> = {
  ATL: ['STL', 'MLH', 'TRI'], BRK: ['NJN', 'NYN'], CHO: ['CHA', 'CHH'], DET: ['FTW'], GSW: ['SFW', 'PHW'], HOU: ['SDR'],
  LAC: ['SDC', 'BUF'], LAL: ['MNL'], MEM: ['VAN'], NOP: ['NOH', 'NOK'], OKC: ['SEA'], PHI: ['SYR'], SAC: ['KCK', 'KCO', 'CIN', 'ROC'],
  UTA: ['NOJ'], WAS: ['WSB', 'CAP', 'BAL', 'CHZ', 'CHP'],
};

export function readFavorites(read: Read = localRead): Favorites {
  try {
    const f = JSON.parse(read(FAVORITES_KEY) ?? '{}') as Favorites;
    return { ...(typeof f.team === 'string' && f.team ? { team: f.team } : {}), ...(typeof f.player === 'string' && f.player ? { player: f.player } : {}) };
  } catch { return {}; }
}

export function setFavorites(next: Favorites): void {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FAVORITES_EVENT));
}

/** Your favourite team among these team ids (or the city it played in back then), if it is there. */
export function favoriteTeamIn(teamIds: string[], fav = readFavorites().team): string | undefined {
  if (!fav) return undefined;
  const ids = new Map(teamIds.map(id => [id.toUpperCase(), id]));
  for (const id of [fav, ...(LINEAGE[fav] ?? [])]) { const hit = ids.get(id); if (hit) return hit; }
  return undefined;
}

/** The team a picker starts on: your favourite when it is in the list, else the first. */
export const defaultTeam = (teamIds: string[]) => favoriteTeamIn(teamIds) ?? teamIds[0] ?? '';
