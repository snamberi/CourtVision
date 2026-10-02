import type { NbaHistory } from '../history/nbaHistoryData';
import type { League } from '../simulation/league';
import type { GMLeagueExtras, TradeDifficulty } from '../simulation/gm';
import { computeAskingSalary } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { ERA_PRESETS } from '../simulation/types';
import { RNG } from '../simulation/engine/rng';
import { cardPool, cardPlayer, type HuntCard } from '../hunt/cards';
import { ERAS, type HuntEra } from '../hunt/eras';
import { top100 } from '../career/legacy';

/*
 * The All-Time Draft: 30 teams take turns (snake order) picking from every player in NBA history at his best season,
 * 13 rounds. You hold one slot; AI GMs draft the best player left, weighed by what their roster still needs (guards,
 * forwards, bigs) and a little taste of their own. Then the league plays under one era's rules with the full GM game:
 * one season, or on and on with aging and development.
 *
 * Everything is seeded: the draft order, the era of the Draft of the Week and every AI pick, so the same seed and the
 * same picks give the same draft.
 */

export const ROUNDS = 13;
export const TEAMS = 30;
const POOL_SIZE = 900;

export type Group = 'G' | 'F' | 'C';
export const groupOf = (pos: string): Group => (pos.startsWith('C') ? 'C' : pos.includes('G') ? 'G' : 'F');
const TARGET: Record<Group, { min: number; max: number }> = { G: { min: 4, max: 6 }, F: { min: 4, max: 6 }, C: { min: 2, max: 4 } };

export interface DraftTeam { id: string; name: string }
export interface DraftConfig { seed: number; eraId: string; userTeam: string; userSlot: number; teams: DraftTeam[]; difficulty: TradeDifficulty; weekly?: string }
export interface DraftPick { teamId: string; cardId: string; overall: number }
export interface DraftState { version: 1; config: DraftConfig; order: string[]; picks: DraftPick[] }

const legendRanks = new WeakMap<NbaHistory, Map<string, number>>();
/** A player's place in the all-time Top 100 (or undefined). */
export function legendRank(h: NbaHistory, playerId: string): number | undefined {
  let m = legendRanks.get(h);
  if (!m) { m = new Map(top100(h).filter(e => e.idx != null).map(e => [h.players[e.idx!].id, e.rank])); legendRanks.set(h, m); }
  return m.get(playerId);
}
/**
 * What a player is worth on draft day: his best-season rating, plus his all-time standing (the Top 100, +1 to +3.5),
 * a little less for the pre-1965 game. Ratings are measured against each player's own season and many legends share
 * the top rating, so this decides between them: Jordan and LeBron go before a 1950s scoring leader.
 */
export function draftValue(h: NbaHistory, c: HuntCard): number {
  const r = legendRank(h, c.playerId);
  return c.ovr + (r ? 1 + (101 - r) / 40 : 0) - (c.end < 1965 ? 2 : 0);
}

const pools = new WeakMap<NbaHistory, HuntCard[]>();
/** Every player once, at his best season (highest rating; on ties, his most productive season), best first. */
export function draftPool(h: NbaHistory): HuntCard[] {
  const cached = pools.get(h);
  if (cached) return cached;
  const best = new Map<string, HuntCard>();
  for (const c of cardPool(h).cards) {
    const cur = best.get(c.playerId);
    const output = (x: HuntCard) => x.ppg + x.rpg + x.apg;
    if (!cur || c.ovr > cur.ovr || (c.ovr === cur.ovr && output(c) > output(cur))) best.set(c.playerId, c);
  }
  const list = [...best.values()].sort((a, b) => draftValue(h, b) - draftValue(h, a) || b.ppg - a.ppg).slice(0, POOL_SIZE);
  pools.set(h, list);
  return list;
}

export function newDraft(config: DraftConfig): DraftState {
  const rng = new RNG(config.seed);
  const others = config.teams.map(t => t.id).filter(id => id !== config.userTeam).sort(() => rng.next() - 0.5);
  const slot = Math.max(0, Math.min(config.teams.length - 1, config.userSlot));
  const order = [...others.slice(0, slot), config.userTeam, ...others.slice(slot)];
  return { version: 1, config, order, picks: [] };
}

export const totalPicks = (s: DraftState) => s.order.length * ROUNDS;
export const isDone = (s: DraftState) => s.picks.length >= totalPicks(s);

/** Who is on the clock (snake order: the order reverses every round). */
export function onClock(s: DraftState): { overall: number; round: number; pick: number; teamId: string } | null {
  if (isDone(s)) return null;
  const n = s.order.length, overall = s.picks.length, round = Math.floor(overall / n), inRound = overall % n;
  const idx = round % 2 === 0 ? inRound : n - 1 - inRound;
  return { overall: overall + 1, round: round + 1, pick: inRound + 1, teamId: s.order[idx] };
}

export const takenIds = (s: DraftState) => new Set(s.picks.map(p => p.cardId));
export function available(h: NbaHistory, s: DraftState): HuntCard[] { const t = takenIds(s); return draftPool(h).filter(c => !t.has(c.id)); }
export function rosterOf(h: NbaHistory, s: DraftState, teamId: string): HuntCard[] {
  const pool = cardPool(h).byId;
  return s.picks.filter(p => p.teamId === teamId).map(p => pool.get(p.cardId)!).filter(Boolean);
}

/** How much a team wants a player right now: his rating, plus what the roster still needs, plus the GM's taste. */
export function pickScore(card: HuntCard, value: number, roster: HuntCard[], picksLeft: number, taste: number): number {
  const g = groupOf(card.pos);
  const count = roster.filter(c => groupOf(c.pos) === g).length;
  const short = (Object.keys(TARGET) as Group[]).reduce((n, k) => n + Math.max(0, TARGET[k].min - roster.filter(c => groupOf(c.pos) === k).length), 0);
  let score = value + taste;
  if (count < TARGET[g].min && short >= picksLeft) score += 20; // must fill a hole now
  else if (count < TARGET[g].min) score += 3;
  if (count >= TARGET[g].max) score -= 25;
  return score;
}

/** The pick an AI GM (or "auto-pick" for you) makes. */
/** Difficulty: on Rookie the AI GMs draft loosely (more reaches), on Legend they barely miss. Your own auto-pick is untouched. */
export const AI_SLOPPINESS: Record<TradeDifficulty, number> = { easy: 4, normal: 1, hard: 0.35 };
const aiSloppiness = (s: DraftState, teamId: string) => (teamId === s.config.userTeam ? 1 : AI_SLOPPINESS[s.config.difficulty] ?? 1);

export function autoPick(h: NbaHistory, s: DraftState, teamId: string): HuntCard {
  const roster = rosterOf(h, s, teamId);
  const picksLeft = ROUNDS - roster.length;
  const rng = new RNG(s.config.seed * 31 + s.picks.length * 7717 + teamId.charCodeAt(0));
  const pool = available(h, s).slice(0, 60);
  let best = pool[0], bestScore = -Infinity;
  for (const c of pool) {
    const sc = pickScore(c, draftValue(h, c), roster, picksLeft, rng.next() * 2.5 * aiSloppiness(s, teamId) + (teamId === s.config.userTeam ? 0 : (teamId.charCodeAt(1) % 3) * (groupOf(c.pos) === 'C' ? 0.5 : 0)));
    if (sc > bestScore) { bestScore = sc; best = c; }
  }
  return best;
}

export function makePick(s: DraftState, cardId: string): DraftState {
  const clock = onClock(s);
  if (!clock || takenIds(s).has(cardId)) return s;
  return { ...s, picks: [...s.picks, { teamId: clock.teamId, cardId, overall: clock.overall }] };
}

/** AI GMs pick until it is your turn (or the draft is over). */
export function runAi(h: NbaHistory, s: DraftState): DraftState {
  let cur = s;
  for (let clock = onClock(cur); clock && clock.teamId !== cur.config.userTeam; clock = onClock(cur)) cur = makePick(cur, autoPick(h, cur, clock.teamId).id);
  return cur;
}

/** A team's strength: the average rating of its best eight, the way rotations work. */
export function teamStrength(roster: HuntCard[]): number {
  const top = roster.map(c => c.ovr).sort((a, b) => b - a).slice(0, 8);
  return top.length ? Math.round(top.reduce((a, b) => a + b, 0) / top.length * 10) / 10 : 0;
}

export const eraById = (id: string): HuntEra => ERAS.find(e => e.id === id) ?? ERAS[ERAS.length - 1];

/**
 * The league the draft leaves: the base league's 30 franchises (names, schedule, coaches, finances) with the drafted
 * rosters, contracts scaled so every payroll sits around the cap, the next 60 best players as free agents, no imported
 * history, and the chosen era's rules. Real players develop through Court Vision's own systems from here.
 */
export function buildDraftLeague(h: NbaHistory, s: DraftState, base: { league: League; extras: GMLeagueExtras }): { league: League; extras: GMLeagueExtras } {
  const season = base.league.season ?? '2025-26';
  const rng = new RNG(s.config.seed * 13 + 5);
  const usedNames = new Map<string, number>();
  const toPlayer = (card: HuntCard, teamId: string | null) => {
    const p = cardPlayer(h, card, teamId ?? 'FA');
    const n = usedNames.get(card.name) ?? 0;
    usedNames.set(card.name, n + 1);
    return { ...p, playerId: n ? `${card.name} (${card.end})` : card.name, teamId, season, careerHistory: [], seasonStats: undefined };
  };
  const cap = base.extras.capSettings;
  const contracts: GMLeagueExtras['contracts'] = {};
  const teams = base.league.teams.map(t => {
    const cards = rosterOf(h, s, t.teamId);
    const seasons = cards.map(c => toPlayer(c, t.teamId));
    const asks = seasons.map(p => computeAskingSalary(calculateOverall(p), cap));
    const scale = Math.min(1, (cap.salaryCap * 1.08) / Math.max(1, asks.reduce((a, b) => a + b, 0)));
    const taken = new Set<number>();
    const withNumbers = seasons.map((p, i) => {
      contracts[p.playerId] = { playerId: p.playerId, teamId: t.teamId, annualSalary: Math.round(asks[i] * scale / 10_000) * 10_000, yearsRemaining: 1 + rng.nextInt(4), playerOption: false, teamOption: false };
      let j = p.jerseyNumber ?? 0;
      for (let k = 0; taken.has(j) && k < 100; k++) j = (j + 1) % 100;
      taken.add(j);
      return { ...p, jerseyNumber: j };
    });
    return { ...t, seasons: withNumbers };
  });
  const freeAgents = available(h, s).slice(0, 60).map(c => toPlayer(c, null));
  const era = eraById(s.config.eraId);
  const decade = `${Math.floor(Math.min(2020, Math.max(1960, era.to - 1)) / 10) * 10}s`;
  const league: League = {
    ...base.league, teams, franchiseHistory: [], retiredPlayers: undefined, historical: undefined,
    allTimeDraft: { seed: s.config.seed, eraId: s.config.eraId, ...(s.config.weekly ? { weekly: s.config.weekly } : {}) },
    settings: { ...base.league.settings, era: ERA_PRESETS[decade] ?? base.league.settings.era },
  };
  const extras: GMLeagueExtras = { ...base.extras, contracts, freeAgents, tradeSettings: { ...base.extras.tradeSettings, difficulty: s.config.difficulty } };
  return { league, extras };
}

// ---------------------------------------------------------------- saving the draft in progress

const KEY = 'cv-draft-state';
export function saveDraft(s: DraftState | null): void { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } }
export function loadDraft(): DraftState | null { try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as DraftState | null; return s?.version === 1 ? s : null; } catch { return null; } }
