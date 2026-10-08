import type { NbaHistory } from '../history/nbaHistoryData';
import { RNG } from '../simulation/engine/rng';
import { simulateGame } from '../simulation/engine/game';
import { DEFAULT_GAME_SETTINGS, ERA_PRESETS } from '../simulation/types';
import { cardPool, cardPlayer, type HuntCard } from '../hunt/cards';
import { eraCoach, eraOf, eraRules } from '../hunt/eras';
import { withRotation } from '../hunt/run';
import { fitBonds } from './run';
import { categories, categoryById, type CategoryInfo } from './categories';

/*
 * Draft Battle: two GMs, one category, a snake draft (1-2-2-1...). Eight players each, then a best-of-seven between
 * the two teams. Play against an AI rival GM (three levels) or pass the phone to a friend. Seeded: the same seed gives
 * the same category and the same series for the same picks.
 */

export const BATTLE_PICKS = 8;
export const BATTLE_WINS = 4;
export type BattleRival = 'rookie' | 'pro' | 'legend' | 'friend';
export const RIVALS: Record<BattleRival, { name: string; gm: string; blurb: string; top: number }> = {
  rookie: { name: 'Rookie GM', gm: 'Rookie Rick', blurb: 'Drafts on name value. Often reaches.', top: 12 },
  pro: { name: 'Pro GM', gm: 'Pro Paula', blurb: 'Takes one of the best few left, and fills positions.', top: 4 },
  legend: { name: 'Legend GM', gm: 'Legend Lou', blurb: 'Almost always takes the best player left.', top: 1 },
  friend: { name: 'A friend', gm: 'Player 2', blurb: 'Pass the device: you pick in turns.', top: 1 },
};

export interface BattleGame { a: number; b: number; top: string }
export interface Battle {
  v: 1;
  seed: number;
  cat: string;
  rival: BattleRival;
  names: [string, string];
  /** Picks in order: card ids (side follows the snake order). */
  picks: string[];
  games: BattleGame[];
  stage: 'draft' | 'series' | 'done';
}

/** Who picks at pick `n` (0-based): 0 = you, 1 = the rival. Snake: A B B A A B B A... */
export const sideAt = (n: number): 0 | 1 => (Math.floor((n + 1) / 2) % 2 === 0 ? 0 : 1);
export const sideCards = (b: Pick<Battle, 'picks'>, side: 0 | 1) => b.picks.filter((_, i) => sideAt(i) === side);
export const onClock = (b: Battle): 0 | 1 | null => (b.stage === 'draft' ? sideAt(b.picks.length) : null);

/** A category with room for sixteen picks (and a good spread of positions). */
export function battleCategory(h: NbaHistory, seed: number): CategoryInfo {
  const list = categories(h).filter(c => c.size >= 40 && c.group !== 'Names');
  return list[new RNG(seed * 13 + 7).nextInt(list.length)];
}

export function newBattle(h: NbaHistory, seed: number, rival: BattleRival, names: [string, string] = ['You', RIVALS[rival].gm], cat?: string): Battle {
  return { v: 1, seed, cat: cat && categoryById(h, cat) ? cat : battleCategory(h, seed).id, rival, names, picks: [], games: [], stage: 'draft' };
}

/** The players still on the board (each player once: a pick takes all his seasons). */
export function boardOf(h: NbaHistory, b: Battle): HuntCard[] {
  const taken = new Set(b.picks.map(id => cardPool(h).byId.get(id)?.playerId));
  return (categoryById(h, b.cat)?.pool ?? []).filter(c => !taken.has(c.playerId));
}

const POS_NEED = ['G', 'G', 'F', 'F', 'C'];
const posGroup = (pos: string) => (pos.includes('C') ? 'C' : pos.includes('G') ? 'G' : 'F');

/** The AI's pick: one of the best few left (by level), leaning to positions it hasn't filled. */
export function aiPick(h: NbaHistory, b: Battle): string | null {
  const board = boardOf(h, b);
  if (!board.length) return null;
  const mine = sideCards(b, 1).map(id => cardPool(h).byId.get(id)!);
  const have = mine.map(c => posGroup(c.pos));
  const need = new Set(POS_NEED.filter((p, i) => have.filter(x => x === p).length <= POS_NEED.slice(0, i).filter(x => x === p).length));
  const rival = RIVALS[b.rival === 'friend' ? 'pro' : b.rival];
  const rng = new RNG(b.seed * 7 + b.picks.length * 131 + 3);
  // Rookie GMs chase points per game; the others chase the rating, plus a little for a position they need.
  const value = (c: HuntCard) => (b.rival === 'rookie' ? c.ppg * 2 : c.ovr) + (need.has(posGroup(c.pos)) && mine.length < 5 ? 3 : 0);
  const ranked = [...board].sort((x, y) => value(y) - value(x));
  return ranked[rng.nextInt(Math.min(rival.top, ranked.length))].id;
}

/** A pick for whoever is on the clock; the AI answers at once (vs a friend, nobody answers for them). */
export function battlePick(h: NbaHistory, b: Battle, cardId: string): Battle {
  if (b.stage !== 'draft' || !boardOf(h, b).some(c => c.id === cardId)) return b;
  let next: Battle = { ...b, picks: [...b.picks, cardId] };
  while (next.rival !== 'friend' && next.picks.length < BATTLE_PICKS * 2 && sideAt(next.picks.length) === 1) {
    const id = aiPick(h, next);
    if (!id) break;
    next = { ...next, picks: [...next.picks, id] };
  }
  return next.picks.length >= BATTLE_PICKS * 2 || !boardOf(h, next).length ? { ...next, stage: 'series' } : next;
}

/** The team rating shown before tip-off: the average of the best eight, plus chemistry. */
export function battleRating(h: NbaHistory, b: Battle, side: 0 | 1): number {
  const cards = sideCards(b, side).map(id => cardPool(h).byId.get(id)!).sort((x, y) => y.ovr - x.ovr);
  if (!cards.length) return 0;
  const w = [1.3, 1.25, 1.2, 1.15, 1.1, 0.8, 0.6, 0.5];
  const base = cards.reduce((n, c, i) => n + c.ovr * (w[i] ?? 0.4), 0) / cards.reduce((n, _, i) => n + (w[i] ?? 0.4), 0);
  return Math.round(base + Math.min(4, fitBonds(cards).reduce((n, x) => n + x.bonus, 0) / 2));
}

const ERA = eraOf(2010);

/** One game of the series (seeded by the game number). */
export function playBattleGame(h: NbaHistory, b: Battle): Battle {
  if (b.stage !== 'series') return b;
  const n = b.games.length;
  const team = (side: 0 | 1, abbr: string) => {
    const cards = sideCards(b, side).map(id => cardPool(h).byId.get(id)!);
    const bonds = fitBonds(cards);
    const bonus = (c: HuntCard) => Math.min(3, bonds.filter(x => x.cards.includes(c.id)).reduce((s, x) => s + x.bonus, 0));
    return withRotation(cards.map(c => cardPlayer(h, c, abbr, bonus(c))));
  };
  // Home court alternates 2-2-1-1-1.
  const aHome = [0, 1, 4, 6].includes(n);
  const A = { teamId: 'BTA', seasons: team(0, 'BTA'), coach: eraCoach(ERA), chemistry: 75 };
  const B = { teamId: 'BTB', seasons: team(1, 'BTB'), coach: eraCoach(ERA), chemistry: 75 };
  const r = simulateGame({ home: aHome ? A : B, away: aHome ? B : A, rules: eraRules(ERA), settings: { ...DEFAULT_GAME_SETTINGS, era: ERA_PRESETS['2010s'] ?? DEFAULT_GAME_SETTINGS.era, seed: b.seed * 97 + n * 7919 + b.picks.length, injuriesEnabled: false, teamChemistryEnabled: false } });
  const a = aHome ? r.homeScore : r.awayScore, bs = aHome ? r.awayScore : r.homeScore;
  let top = { name: '', pts: -1 };
  for (const box of [r.homeBox, r.awayBox]) for (const [name, l] of Object.entries(box.players)) if (l.minutes && l.points > top.pts) top = { name, pts: l.points };
  const games = [...b.games, { a, b: bs, top: `${top.name} ${top.pts}` }];
  const wa = games.filter(g => g.a > g.b).length, wb = games.length - wa;
  return { ...b, games, stage: wa >= BATTLE_WINS || wb >= BATTLE_WINS ? 'done' : 'series' };
}

export const seriesScore = (b: Pick<Battle, 'games'>) => { const a = b.games.filter(g => g.a > g.b).length; return { a, b: b.games.length - a }; };
export const battleWinner = (b: Battle): 0 | 1 | null => { if (b.stage !== 'done') return null; const s = seriesScore(b); return s.a > s.b ? 0 : 1; };

// ---------------------------------------------------------------- saving

export const BATTLE_KEY = 'cv-battle';
export const BATTLE_RECORDS_KEY = 'cv-battle-records';
export interface BattleRecords { played: number; won: number; byRival: Partial<Record<BattleRival, { played: number; won: number }>> }

export function loadBattle(): Battle | null {
  try { const b = JSON.parse(localStorage.getItem(BATTLE_KEY) ?? 'null') as Battle | null; return b && b.v === 1 && Array.isArray(b.picks) ? b : null; } catch { return null; }
}
export function saveBattle(b: Battle | null): void {
  try { if (b) localStorage.setItem(BATTLE_KEY, JSON.stringify(b)); else localStorage.removeItem(BATTLE_KEY); } catch { /* storage blocked */ }
}
export function loadBattleRecords(): BattleRecords {
  try { const r = JSON.parse(localStorage.getItem(BATTLE_RECORDS_KEY) ?? 'null') as BattleRecords | null; return r && Number.isFinite(r.played) ? { played: r.played, won: r.won, byRival: r.byRival ?? {} } : { played: 0, won: 0, byRival: {} }; } catch { return { played: 0, won: 0, byRival: {} }; }
}
/** Counts a finished battle once (vs a friend, a "win" is Player 1's). */
export function recordBattle(b: Battle): BattleRecords {
  const r = loadBattleRecords(), won = battleWinner(b) === 0;
  const x = r.byRival[b.rival] ?? { played: 0, won: 0 };
  const next: BattleRecords = { played: r.played + 1, won: r.won + (won ? 1 : 0), byRival: { ...r.byRival, [b.rival]: { played: x.played + 1, won: x.won + (won ? 1 : 0) } } };
  try { localStorage.setItem(BATTLE_RECORDS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return next;
}
