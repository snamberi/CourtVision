import type { NbaHistory } from '../history/nbaHistoryData';
import { simulateGame } from '../simulation/engine/game';
import type { GameResult } from '../simulation/boxscore';
import type { PlayerSeason } from '../simulation/types';
import { DEFAULT_GAME_SETTINGS, ERA_PRESETS } from '../simulation/types';
import type { CoachTendencies } from '../simulation/league';
import { cardPool, cardPlayer } from './cards';
import { huntTeams, type HuntTeam } from './teams';
import { eraCoach, eraOf, underEra } from './eras';
import { withRotation } from './run';

/*
 * Legend Challenges: short scenarios from real NBA history, one series or one game long. You coach the real
 * team-season against the real opponent, under that era's rules, choosing a game plan before every game. Each
 * scenario scores the run and gives stars: 1 for pushing the favourite (a game won, or a single game kept close),
 * 2 for pulling it off, 3 for pulling it off in style (the scenario's own extra goal).
 */

export type GamePlan = 'balanced' | 'star' | 'pace' | 'defense' | 'threes';
export const GAME_PLANS: { id: GamePlan; label: string; note: string }[] = [
  { id: 'balanced', label: 'Balanced', note: 'Play your normal game.' },
  { id: 'star', label: 'Feed the star', note: 'The ball goes to your best player.' },
  { id: 'pace', label: 'Push the pace', note: 'Run on every miss: more possessions.' },
  { id: 'defense', label: 'Lock down', note: 'Aggressive, switching defense.' },
  { id: 'threes', label: 'Let it fly', note: 'Hunt threes (where the era allows).' },
];

export interface LegendScenario {
  id: string; title: string; blurb: string;
  you: string; opp: string; // HuntTeam ids `${abbr}@${end}`
  /** 'game' = one game; 'series' = best of seven. */
  format: 'game' | 'series';
  /** Series already under way: your wins and theirs. */
  start?: [number, number];
  /** Whether you host game 1..7 (for a single game, [host]). */
  hosts: boolean[];
  /** The 3-star extra goal. */
  bonus: { text: string; test: (run: LegendRun) => boolean };
}

const games = (run: LegendRun) => run.games.length + (run.scenario().start ? run.scenario().start![0] + run.scenario().start![1] : 0);
const margins = (run: LegendRun) => run.games.map(g => g.us - g.them);

export const LEGEND_SCENARIOS: LegendScenario[] = [
  { id: 'jazz98', title: "Beat Jordan: the '98 Finals", blurb: "You're the 62-win Jazz with home court. Stockton and Malone against Jordan's last dance.", you: 'UTA@1998', opp: 'CHI@1998', format: 'series', hosts: [true, true, false, false, false, true, true],
    bonus: { text: 'Win it in six games or fewer', test: r => r.won() && games(r) <= 6 } },
  { id: 'stop73', title: 'Stop the 73-win Warriors', blurb: "2016 Finals, down 3-1 to the best regular season ever. Three straight, two of them in Oakland.", you: 'CLE@2016', opp: 'GSW@2016', format: 'series', start: [1, 3], hosts: [false, false, true, true, false, true, false],
    bonus: { text: 'Win the three games by 20+ points combined', test: r => r.won() && margins(r).reduce((n, m) => n + m, 0) >= 20 } },
  { id: 'sonics96', title: 'Upset the 72-10 Bulls', blurb: 'Payton and Kemp against the greatest record of its day. Chicago has home court.', you: 'SEA@1996', opp: 'CHI@1996', format: 'series', hosts: [false, false, true, true, true, false, false],
    bonus: { text: 'Win it in six games or fewer', test: r => r.won() && games(r) <= 6 } },
  { id: 'spurs13', title: 'Game 7 in Miami', blurb: "2013: Duncan, Parker and Ginobili against LeBron's Heat. One game, their building.", you: 'SAS@2013', opp: 'MIA@2013', format: 'game', hosts: [false],
    bonus: { text: 'Win by 10 or more', test: r => r.won() && (margins(r)[0] ?? 0) >= 10 } },
  { id: 'pistons04', title: "Goin' to work: the '04 Pistons", blurb: 'Nobody gave Detroit a chance against Shaq, Kobe, Malone and Payton.', you: 'DET@2004', opp: 'LAL@2004', format: 'series', hosts: [false, false, true, true, true, false, false],
    bonus: { text: 'Win it in five games or fewer', test: r => r.won() && games(r) <= 5 } },
  { id: 'believe07', title: 'We Believe', blurb: 'The 8th-seeded Warriors against the 67-win Mavericks in round one.', you: 'GSW@2007', opp: 'DAL@2007', format: 'series', hosts: [false, false, true, true, false, true, false],
    bonus: { text: 'Win it in six games or fewer', test: r => r.won() && games(r) <= 6 } },
  { id: 'showtime84', title: 'Showtime in the Garden', blurb: "1984 Finals: Magic and Kareem against Bird's Celtics, Boston with home court.", you: 'LAL@1984', opp: 'BOS@1984', format: 'series', hosts: [false, false, true, true, true, false, false],
    bonus: { text: 'Win at least one game in Boston', test: r => r.won() && r.games.some((g, i) => !r.scenario().hosts[i] && g.us > g.them) } },
  { id: 'knicks94', title: "Game 7 in Houston, '94", blurb: "Ewing's Knicks, one win from the title, in Hakeem's building.", you: 'NYK@1994', opp: 'HOU@1994', format: 'game', hosts: [false],
    bonus: { text: 'Win by 8 or more', test: r => r.won() && (margins(r)[0] ?? 0) >= 8 } },
];
export const legendScenario = (id: string) => LEGEND_SCENARIOS.find(s => s.id === id);

export interface LegendGame { us: number; them: number; plan: GamePlan; home: boolean; seed: number }
export interface LegendRunState { scenarioId: string; games: LegendGame[] }
/** A run with its derived answers. */
export interface LegendRun extends LegendRunState {
  scenario: () => LegendScenario; wins: () => number; losses: () => number; done: () => boolean; won: () => boolean;
}
export function legendRun(state: LegendRunState): LegendRun {
  const sc = legendScenario(state.scenarioId)!;
  const [w0, l0] = sc.start ?? [0, 0];
  const wins = () => w0 + state.games.filter(g => g.us > g.them).length;
  const losses = () => l0 + state.games.filter(g => g.us < g.them).length;
  const done = () => sc.format === 'game' ? state.games.length >= 1 : wins() >= 4 || losses() >= 4;
  const won = () => sc.format === 'game' ? (state.games[0] ? state.games[0].us > state.games[0].them : false) : wins() >= 4;
  return { ...state, scenario: () => sc, wins, losses, done, won };
}

/** Score and stars of a finished (or abandoned) run. */
export function scoreLegend(run: LegendRun): { score: number; stars: 0 | 1 | 2 | 3 } {
  const sc = run.scenario();
  const margin = run.games.reduce((n, g) => n + g.us - g.them, 0);
  const won = run.won();
  if (sc.format === 'game') {
    const m = run.games[0] ? run.games[0].us - run.games[0].them : -99;
    const stars = won ? (sc.bonus.test(run) ? 3 : 2) : m >= -5 && run.games.length ? 1 : 0;
    return { score: Math.max(0, (won ? 1000 : 0) + m * 12 + (stars === 3 ? 400 : 0)), stars };
  }
  const gameWins = run.games.filter(g => g.us > g.them).length;
  const saved = won ? 7 - games(run) : 0;
  const stars = won ? (sc.bonus.test(run) ? 3 : 2) : gameWins > 0 ? 1 : 0;
  return { score: Math.max(0, gameWins * 250 + margin * 5 + (won ? 1000 + saved * 150 : 0) + (stars === 3 ? 400 : 0)), stars };
}

function planCoach(base: CoachTendencies, plan: GamePlan): CoachTendencies {
  switch (plan) {
    case 'star': return { ...base, starUsage: Math.min(100, (base.starUsage ?? 50) + 30) };
    case 'pace': return { ...base, paceTendency: Math.min(100, base.paceTendency + 18) };
    case 'defense': return { ...base, defensiveAggression: Math.min(100, (base.defensiveAggression ?? 50) + 25), switchingFrequency: Math.min(100, (base.switchingFrequency ?? 50) + 20) };
    case 'threes': return { ...base, threePointFrequency: Math.min(100, base.threePointFrequency + (base.threePointFrequency < 10 ? 3 : 25)) };
    default: return base;
  }
}

export interface LegendSide { teamId: string; name: string; seasons: PlayerSeason[] }
function side(h: NbaHistory, t: HuntTeam, id: string): LegendSide {
  const pool = cardPool(h), era = eraOf(t.end);
  const cards = t.roster.map(c => pool.byId.get(c)!).filter(Boolean);
  return { teamId: id, name: `${t.end - 1}-${String(t.end).slice(2)} ${t.name}`, seasons: withRotation(cards.map(c => underEra(cardPlayer(h, c, id), era))) };
}
export function legendTeams(h: NbaHistory, sc: LegendScenario): { you: LegendSide; opp: LegendSide } | null {
  const teams = huntTeams(h);
  const a = teams.find(t => t.id === sc.you), b = teams.find(t => t.id === sc.opp);
  if (!a || !b) return null;
  return { you: side(h, a, a.abbr), opp: side(h, b, b.abbr === a.abbr ? `${b.abbr}2` : b.abbr) };
}

/** A small edge for whoever hosts: the crowd. */
const HOME_EDGE = 1.2;

/** Plays the next game of a run with your game plan. Returns the result (for the box score and replay) and the new state. */
export function playLegendGame(h: NbaHistory, state: LegendRunState, plan: GamePlan, seed: number): { result: GameResult; home: LegendSide; away: LegendSide; state: LegendRunState } | null {
  const run = legendRun(state), sc = run.scenario();
  if (run.done()) return null;
  const sides = legendTeams(h, sc);
  if (!sides) return null;
  const idx = (sc.start ? sc.start[0] + sc.start[1] : 0) + state.games.length;
  const youHost = sc.format === 'game' ? sc.hosts[0] : sc.hosts[idx] ?? false;
  const end = Number(sc.you.split('@')[1]), era = eraOf(end);
  const boost = (s: LegendSide) => Object.fromEntries(s.seasons.map(p => [p.playerId, HOME_EDGE]));
  const you = { ...sides.you, coach: planCoach(eraCoach(era), plan), chemistry: 78, ...(youHost ? { boost: boost(sides.you) } : {}) };
  const opp = { ...sides.opp, coach: eraCoach(era), chemistry: 78, ...(youHost ? {} : { boost: boost(sides.opp) }) };
  const decade = `${Math.floor(Math.min(2020, Math.max(1960, end)) / 10) * 10}s` as keyof typeof ERA_PRESETS;
  const result = simulateGame({ home: youHost ? you : opp, away: youHost ? opp : you, isPlayoffs: true,
    settings: { ...DEFAULT_GAME_SETTINGS, era: ERA_PRESETS[decade] ?? DEFAULT_GAME_SETTINGS.era, seed, injuriesEnabled: false } });
  const us = youHost ? result.homeScore : result.awayScore, them = youHost ? result.awayScore : result.homeScore;
  return { result, home: youHost ? sides.you : sides.opp, away: youHost ? sides.opp : sides.you, state: { ...state, games: [...state.games, { us, them, plan, home: youHost, seed }] } };
}

// ---------------------------------------------------------------- best results (this browser)
export interface LegendRecord { best: number; stars: number; attempts: number }
const KEY = 'cv-legend-records', RUN_KEY = 'cv-legend-run';
export function loadLegendRecords(): Record<string, LegendRecord> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, LegendRecord>; } catch { return {}; }
}
export function saveLegendResult(run: LegendRun): Record<string, LegendRecord> {
  const all = loadLegendRecords(), { score, stars } = scoreLegend(run), prev = all[run.scenarioId];
  const out = { ...all, [run.scenarioId]: { best: Math.max(prev?.best ?? 0, score), stars: Math.max(prev?.stars ?? 0, stars), attempts: (prev?.attempts ?? 0) + 1 } };
  try { localStorage.setItem(KEY, JSON.stringify(out)); } catch { /* storage blocked */ }
  return out;
}
export function loadLegendRun(): LegendRunState | null {
  try { const r = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null') as LegendRunState | null; return r && legendScenario(r.scenarioId) ? r : null; } catch { return null; }
}
export function storeLegendRun(r: LegendRunState | null) {
  try { if (r) localStorage.setItem(RUN_KEY, JSON.stringify(r)); else localStorage.removeItem(RUN_KEY); } catch { /* storage blocked */ }
}
