import type { NbaHistory } from '../history/nbaHistoryData';
import { RNG } from '../simulation/engine/rng';
import { simulateGame } from '../simulation/engine/game';
import type { GameResult } from '../simulation/boxscore';
import type { PlayerSeason } from '../simulation/types';
import { DEFAULT_GAME_SETTINGS, ERA_PRESETS } from '../simulation/types';
import { calculateOverall } from '../simulation/engine/overall';
import { cardPool, cardPlayer, type HuntCard, type Rarity } from './cards';
import { huntTeams, type HuntTeam } from './teams';
import { ERAS, eraCoach, eraOf, underEra, type HuntEra } from './eras';

/*
 * A League Hunt run. Draft a squad of eight player-season cards under a Legacy Points cap, then travel through
 * the eras: five real teams, each tougher than the last and each played under its own era's rules, then a boss,
 * one of the greatest teams ever. Every win raises the cap and brings a new card; every loss costs a life.
 * Everything is seeded, so a run replays the same way.
 */

export const SQUAD_SIZE = 8;
export const SQUAD_MAX = 10;
export const START_CAP = 72;
export const CAP_PER_WIN = 8;
export const START_LIVES = 3;
export const MIN_OFFER_OVR = 45;

export interface HuntStop { eraId: string; teamId: string; boss?: boolean }
export interface HuntStopResult { stop: number; teamId: string; us: number; them: number; won: boolean }
export type HuntStage = 'draft' | 'stop' | 'reward' | 'won' | 'lost';
export interface HuntRun {
  version: 1;
  seed: number;
  stage: HuntStage;
  squad: string[];
  cap: number;
  lives: number;
  stops: HuntStop[];
  stopIndex: number;
  /** Cards on the table: the draft pick or the reward after a win. */
  offer: string[];
  draftRound: number;
  attempts: number;
  results: HuntStopResult[];
}

const TIERS = [57, 60, 62.5, 64.5, 66.5];

function pickTeam(teams: HuntTeam[], era: HuntEra, target: number, rng: RNG, used: Set<string>): HuntTeam {
  const inEra = teams.filter(t => t.end >= era.from && t.end <= era.to && !used.has(t.id));
  const pool = (inEra.length ? inEra : teams).filter(t => !used.has(t.id));
  // Any team within a couple of points of the target, so the same stop rarely repeats from run to run.
  const close = pool.filter(t => Math.abs(t.strength - target) <= 2);
  const near = close.length >= 3 ? close : [...pool].sort((a, b) => Math.abs(a.strength - target) - Math.abs(b.strength - target)).slice(0, 8);
  return near[rng.nextInt(near.length)];
}

/** A new run: five stops in five different eras, then the boss. */
export function newRun(h: NbaHistory, seed: number): HuntRun {
  const rng = new RNG(seed);
  const teams = huntTeams(h);
  const eras = [...ERAS].sort(() => rng.next() - 0.5).slice(0, TIERS.length).sort((a, b) => a.from - b.from);
  const used = new Set<string>();
  const stops: HuntStop[] = eras.map((era, i) => { const t = pickTeam(teams, era, TIERS[i], rng, used); used.add(t.id); return { eraId: era.id, teamId: t.id }; });
  // The boss: one of the best champions ever, played under its own era's rules.
  const greats = teams.filter(t => t.champion && !used.has(t.id)).sort((a, b) => b.strength - a.strength).slice(0, 12);
  const boss = greats[rng.nextInt(greats.length)];
  stops.push({ eraId: eraOf(boss.end).id, teamId: boss.id, boss: true });
  const run: HuntRun = { version: 1, seed, stage: 'draft', squad: [], cap: START_CAP, lives: START_LIVES, stops, stopIndex: 0, offer: [], draftRound: 0, attempts: 0, results: [] };
  return { ...run, offer: offer(h, run, 'draft') };
}

export const spent = (h: NbaHistory, ids: string[]) => ids.reduce((n, id) => n + (cardPool(h).byId.get(id)?.cost ?? 0), 0);

/** Rarity odds for an offer: the draft opens with one star, rewards get better as the run goes on. */
function rarityWeights(run: HuntRun, kind: 'draft' | 'reward'): Record<Rarity, number> {
  if (kind === 'draft') return run.draftRound === 0 ? { common: 0, rare: 0, epic: 6, legendary: 4 } : { common: 55, rare: 32, epic: 11, legendary: 2 };
  const s = run.stopIndex;
  return { common: Math.max(10, 45 - s * 8), rare: 35, epic: 15 + s * 4, legendary: 5 + s * 3 };
}

function offer(h: NbaHistory, run: HuntRun, kind: 'draft' | 'reward'): string[] {
  const pool = cardPool(h);
  const rng = new RNG(run.seed * 31 + (kind === 'draft' ? run.draftRound : 100 + run.stopIndex * 7 + run.attempts));
  const weights = rarityWeights(run, kind);
  const order: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
  const taken = new Set(run.squad.map(id => pool.byId.get(id)?.playerId));
  const out: HuntCard[] = [];
  for (let tries = 0; out.length < 3 && tries < 200; tries++) {
    const rarity = order[rng.weightedPick(order.map(r => weights[r]))];
    const list = pool.byRarity[rarity];
    const c = list[rng.nextInt(list.length)];
    if (c.ovr < MIN_OFFER_OVR || taken.has(c.playerId) || out.some(o => o.playerId === c.playerId)) continue;
    out.push(c);
  }
  return out.map(c => c.id);
}

/** Whether a card fits the cap (leaving room to fill the squad with the cheapest cards), optionally replacing one. */
export function affordable(h: NbaHistory, run: HuntRun, cardId: string, replacing?: string): boolean {
  const pool = cardPool(h);
  const card = pool.byId.get(cardId);
  if (!card) return false;
  const squad = run.squad.filter(id => id !== replacing);
  const openAfter = run.stage === 'draft' ? Math.max(0, SQUAD_SIZE - squad.length - 1) : 0;
  return spent(h, squad) + card.cost + openAfter * 6 <= run.cap;
}

export function draftPick(h: NbaHistory, run: HuntRun, cardId: string): HuntRun {
  if (run.stage !== 'draft' || !run.offer.includes(cardId) || !affordable(h, run, cardId)) return run;
  const next: HuntRun = { ...run, squad: [...run.squad, cardId], draftRound: run.draftRound + 1 };
  if (next.squad.length >= SQUAD_SIZE) return { ...next, stage: 'stop', offer: [] };
  const o = offer(h, next, 'draft');
  // Nothing affordable on the table: swap in the cheapest commons that fit.
  if (!o.some(id => affordable(h, next, id))) {
    const cheap = cardPool(h).byRarity.common.filter(c => c.ovr >= MIN_OFFER_OVR && !next.squad.some(s => cardPool(h).byId.get(s)?.playerId === c.playerId));
    const rng = new RNG(run.seed + next.draftRound * 13);
    return { ...next, offer: [0, 1, 2].map(() => cheap[rng.nextInt(cheap.length)].id) };
  }
  return { ...next, offer: o };
}

/** Squad strength on the same scale as a team's: its best eight, starters weighted more. */
export function strengthOf(cards: HuntCard[]): number {
  const best = [...cards].sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  const w = best.reduce((n, _, i) => n + (i < 5 ? 1.2 : 0.7), 0);
  return w ? Math.round(best.reduce((n, c, i) => n + c.ovr * (i < 5 ? 1.2 : 0.7), 0) / w * 10) / 10 : 0;
}

/** Minutes by rank: the starters play most of the game. */
function withRotation(players: PlayerSeason[]): PlayerSeason[] {
  const mins = [34, 33, 32, 31, 29, 21, 18, 15, 14, 13];
  return [...players].sort((a, b) => calculateOverall(b) - calculateOverall(a)).map((p, i) => ({ ...p, rotationRole: i < 5 ? 'starter' as const : 'bench' as const, minutes: { mode: 'TARGET' as const, target: mins[i] ?? 8 } }));
}

export interface HuntGame { result: GameResult; home: { teamId: string; name: string; seasons: PlayerSeason[] }; away: { teamId: string; name: string; seasons: PlayerSeason[] }; won: boolean; era: HuntEra }

/** Plays the current stop. Your squad is the home team; the opponent plays without anyone who is on your squad. */
export function playStop(h: NbaHistory, run: HuntRun): { run: HuntRun; game: HuntGame } | null {
  if (run.stage !== 'stop') return null;
  const stop = run.stops[run.stopIndex];
  const team = huntTeams(h).find(t => t.id === stop.teamId)!;
  const era = ERAS.find(e => e.id === stop.eraId) ?? eraOf(team.end);
  const pool = cardPool(h);
  const mine = run.squad.map(id => pool.byId.get(id)!).filter(Boolean);
  const mineIds = new Set(mine.map(c => c.playerId));
  const theirs = team.roster.map(id => pool.byId.get(id)!).filter(c => c && !mineIds.has(c.playerId));
  const home = { teamId: 'HUNT', name: 'Your squad', seasons: withRotation(mine.map(c => underEra(cardPlayer(h, c, 'HUNT'), era))), coach: eraCoach(era), chemistry: 70 };
  const away = { teamId: team.abbr === 'HUNT' ? 'OPP' : team.abbr, name: team.name, seasons: withRotation(theirs.map(c => underEra(cardPlayer(h, c, team.abbr), era))), coach: eraCoach(era), chemistry: 75 };
  const decade = `${Math.floor(Math.min(2020, Math.max(1960, team.end - 1)) / 10) * 10}s` as keyof typeof ERA_PRESETS;
  const result = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, era: ERA_PRESETS[decade] ?? DEFAULT_GAME_SETTINGS.era, seed: run.seed * 101 + run.stopIndex * 7919 + run.attempts * 17, injuriesEnabled: false, teamChemistryEnabled: false } });
  const won = result.homeScore > result.awayScore;
  const results = [...run.results, { stop: run.stopIndex, teamId: team.id, us: result.homeScore, them: result.awayScore, won }];
  let next: HuntRun;
  if (won && stop.boss) next = { ...run, results, stage: 'won', offer: [] };
  else if (won) { const r = { ...run, results, stage: 'reward' as const, cap: run.cap + CAP_PER_WIN, attempts: 0 }; next = { ...r, offer: offer(h, r, 'reward') }; }
  else next = run.lives - 1 <= 0 ? { ...run, results, lives: 0, stage: 'lost', offer: [] } : { ...run, results, lives: run.lives - 1, attempts: run.attempts + 1 };
  return { run: next, game: { result, home, away, won, era } };
}

/** After a win: take the new card (into an open spot, or replacing one), or pass; then on to the next stop. */
export function takeReward(h: NbaHistory, run: HuntRun, cardId: string | null, replacing?: string): HuntRun {
  if (run.stage !== 'reward') return run;
  const advance = (squad: string[]): HuntRun => ({ ...run, squad, offer: [], stage: 'stop', stopIndex: run.stopIndex + 1, attempts: 0 });
  if (!cardId) return advance(run.squad);
  if (!run.offer.includes(cardId) || !affordable(h, run, cardId, replacing)) return run;
  if (!replacing && run.squad.length >= SQUAD_MAX) return run;
  return advance(replacing ? run.squad.map(id => (id === replacing ? cardId : id)) : [...run.squad, cardId]);
}

/** Between stops you can release a card to free Legacy Points (the squad never drops below five). */
export function releaseCard(run: HuntRun, cardId: string): HuntRun {
  if ((run.stage !== 'stop' && run.stage !== 'reward') || run.squad.length <= 5 || !run.squad.includes(cardId)) return run;
  return { ...run, squad: run.squad.filter(id => id !== cardId) };
}
