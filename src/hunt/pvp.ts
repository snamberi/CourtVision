import type { NbaHistory } from '../history/nbaHistoryData';
import { simulateGame } from '../simulation/engine/game';
import { DEFAULT_GAME_SETTINGS, ERA_PRESETS } from '../simulation/types';
import { cardPool, cardPlayer } from './cards';
import { ERAS, eraCoach, eraRules, underEra, type HuntEra } from './eras';
import { gameBonuses, sixRotation, defended, SERIES_START, WINS_NEEDED, SQUAD_SIZE, type HuntRun, type SeriesState, type SeriesGame, type Focus } from './run';
import type { ItemId } from './items';
import type { BoostId } from './boosts';

/*
 * League Hunt PvP: a finished hunt's squad becomes your "ghost", and other players' squads challenge it in a
 * best-of-seven under one era's rules. Both sides keep everything they built (coach, training, boosts, items,
 * growth), and each game is simulated with the same engine as the hunt. The series is seeded by the match the server
 * hands out, so a result can be checked by replaying it.
 */

export interface Ghost {
  squad: string[]; coach?: string; items: ItemId[]; boosts: BoostId[]; focus?: Focus;
  growth: Record<Focus, number>; training: Record<string, number>;
  /** How far that hunt went (10 = won it all). */
  reached: number;
}

/** The ghost a finished hunt leaves behind (a full squad, and at least two series won). */
export function ghostFromRun(run: HuntRun): Ghost | null {
  if ((run.stage !== 'won' && run.stage !== 'lost') || run.squad.length < SQUAD_SIZE) return null;
  const reached = run.stage === 'won' ? 10 : run.seriesIndex;
  if (reached < 2) return null;
  return { squad: run.squad.slice(0, SQUAD_SIZE), ...(run.coach ? { coach: run.coach } : {}), items: [...run.items], boosts: [...run.boosts], ...(run.focus ? { focus: run.focus } : {}), growth: { ...run.growth }, training: { ...run.training }, reached };
}

/** Checks a ghost's shape and card ids (used before storing one). */
export function validGhost(h: NbaHistory, g: unknown): g is Ghost {
  const x = g as Ghost;
  if (!x || !Array.isArray(x.squad) || x.squad.length !== SQUAD_SIZE || !Array.isArray(x.items) || !Array.isArray(x.boosts) || typeof x.growth !== 'object' || typeof x.training !== 'object') return false;
  const pool = cardPool(h);
  return x.squad.every(id => pool.byId.has(id)) && new Set(x.squad).size === SQUAD_SIZE && x.items.length <= 6 && x.boosts.length <= 3
    && Object.values(x.growth).every(v => Number.isInteger(v) && v >= 0 && v <= 10) && Object.values(x.training).every(v => Number.isInteger(v) && v >= 0 && v <= 4);
}

const asRun = (g: Ghost, seed: number): HuntRun => ({
  version: 3, seed, stage: 'series', squad: g.squad, coach: g.coach, spin: 7, offer: [], guarantees: { star: 0, great: 1 }, lives: 1, coins: 0, items: g.items, boosts: g.boosts,
  focus: g.focus, growth: g.growth, training: g.training, series: [], seriesIndex: 0, attempts: 0, results: [],
});

export const pvpEra = (id: string): HuntEra => ERAS.find(e => e.id === id) ?? ERAS[ERAS.length - 1];

/** Plays the best-of-seven: `mine` at home in games 1, 2, 5 and 7. */
export function playPvp(h: NbaHistory, mine: Ghost, theirs: Ghost, seed: number, eraId: string): { games: SeriesGame[]; won: boolean } {
  const era = pvpEra(eraId);
  const pool = cardPool(h);
  const us = asRun(mine, seed), them = asRun(theirs, seed + 1);
  const decade = `${Math.floor(Math.min(2020, Math.max(1960, era.to - 1)) / 10) * 10}s` as keyof typeof ERA_PRESETS;
  const coach = { ...eraCoach(era), rotationDepth: SQUAD_SIZE };
  const games: SeriesGame[] = [];
  // Each side sees the series from its own bench (its wins, its streak).
  let st: SeriesState = { ...SERIES_START }, their: SeriesState = { ...SERIES_START };
  while (st.ourWins < WINS_NEEDED && st.theirWins < WINS_NEEDED) {
    const ours = gameBonuses(h, us, era, st).cards.map(({ card, bonus, defense }) => defended(underEra(cardPlayer(h, card, 'HOME', bonus), era), defense));
    const taken = new Set(ours.map(p => p.playerId));
    const theirsP = gameBonuses(h, them, era, their).cards.map(({ card, bonus, defense }) => {
      const p = defended(underEra(cardPlayer(h, pool.byId.get(card.id)!, 'AWAY', bonus), era), defense);
      return taken.has(p.playerId) ? { ...p, playerId: `${p.playerId} (2)` } : p;
    });
    const homeGame = [1, 2, 5, 7].includes(st.game);
    const home = { teamId: homeGame ? 'HOME' : 'AWAY', seasons: sixRotation(homeGame ? ours : theirsP), coach, chemistry: 72 };
    const away = { teamId: homeGame ? 'AWAY' : 'HOME', seasons: sixRotation(homeGame ? theirsP : ours), coach, chemistry: 72 };
    const r = simulateGame({ home, away, rules: eraRules(era), settings: { ...DEFAULT_GAME_SETTINGS, era: ERA_PRESETS[decade] ?? DEFAULT_GAME_SETTINGS.era, seed: seed * 101 + st.game * 17, injuriesEnabled: false, teamChemistryEnabled: false } });
    const myScore = homeGame ? r.homeScore : r.awayScore, theirScore = homeGame ? r.awayScore : r.homeScore;
    const myBox = homeGame ? r.homeBox : r.awayBox;
    const top = Object.entries(myBox.players).sort((a, b) => b[1].points - a[1].points)[0];
    const won = myScore > theirScore;
    games.push({ us: myScore, them: theirScore, won, top: top ? `${top[0]} ${top[1].points}` : '' });
    st = { game: st.game + 1, ourWins: st.ourWins + (won ? 1 : 0), theirWins: st.theirWins + (won ? 0 : 1), streak: won ? st.streak + 1 : 0, lostLast: !won };
    their = { game: their.game + 1, ourWins: their.ourWins + (won ? 0 : 1), theirWins: their.theirWins + (won ? 1 : 0), streak: won ? 0 : their.streak + 1, lostLast: won };
  }
  return { games, won: st.ourWins === WINS_NEEDED };
}

/** Elo: the expected score and the change for the challenger (K = 32). */
export function eloDelta(challenger: number, defender: number, won: boolean, k = 32): number {
  const expected = 1 / (1 + 10 ** ((defender - challenger) / 400));
  return Math.round(k * ((won ? 1 : 0) - expected));
}
