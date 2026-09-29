import type { NbaHistory } from '../history/nbaHistoryData';
import { simulateGame } from '../simulation/engine/game';
import type { GameResult } from '../simulation/boxscore';
import type { PlayerSeason } from '../simulation/types';
import { DEFAULT_GAME_SETTINGS, ERA_PRESETS } from '../simulation/types';
import { cardPool, cardPlayer } from './cards';
import { huntTeams, type HuntTeam } from './teams';
import { eraCoach, eraRules, underEra, type HuntEra } from './eras';
import { withRotation } from './run';

/*
 * Dream Matchup: any two real team-seasons, under the rules of any era. The '96 Bulls against the '17 Warriors with
 * no three-point line? Here it is. A player who was on both teams (a different season each) plays for both.
 */

export interface DreamGame { result: GameResult; home: { teamId: string; name: string; seasons: PlayerSeason[] }; away: { teamId: string; name: string; seasons: PlayerSeason[] }; era: HuntEra }

const side = (h: NbaHistory, t: HuntTeam, era: HuntEra, id: string) => {
  const pool = cardPool(h);
  const cards = t.roster.map(c => pool.byId.get(c)!).filter(Boolean);
  return { teamId: id, name: `${t.end - 1}-${String(t.end).slice(2)} ${t.name}`, seasons: withRotation(cards.map(c => underEra(cardPlayer(h, c, id), era))), coach: eraCoach(era), chemistry: 75 };
};

export function dreamGame(h: NbaHistory, homeId: string, awayId: string, era: HuntEra, seed: number): DreamGame | null {
  const teams = huntTeams(h);
  const a = teams.find(t => t.id === homeId), b = teams.find(t => t.id === awayId);
  if (!a || !b || a.id === b.id) return null;
  // Team ids must differ even for the same franchise in two seasons.
  const home = side(h, a, era, a.abbr), away = side(h, b, era, b.abbr === a.abbr ? `${b.abbr}2` : b.abbr);
  const decade = `${Math.floor(Math.min(2020, Math.max(1960, era.from)) / 10) * 10}s` as keyof typeof ERA_PRESETS;
  const result = simulateGame({ home, away, rules: eraRules(era), settings: { ...DEFAULT_GAME_SETTINGS, era: ERA_PRESETS[decade] ?? DEFAULT_GAME_SETTINGS.era, seed, injuriesEnabled: false, teamChemistryEnabled: false } });
  return { result, home, away, era };
}

/** Team-seasons for a season END year, best first. */
export const teamsIn = (h: NbaHistory, end: number) => huntTeams(h).filter(t => t.end === end).sort((a, b) => b.strength - a.strength);
export const seasonEnds = (h: NbaHistory) => [...new Set(huntTeams(h).map(t => t.end))].sort((a, b) => b - a);
