import type { NbaHistory, HistPlayer, HistSeasonRow } from '../history/nbaHistoryData';
import { NBA_HISTORY_DATASET } from '../history/datasetInfo';
import { seedFor } from '../history/historicalLeague';
import { buildRealPlayer } from '../history/realPlayers';
import type { PlayerSeason } from '../simulation/types';

/*
 * League Hunt cards: one card is one real season of one real player ("1996 Michael Jordan"). Ratings come from the
 * NBA history data, ranked within each season, so a 1965 star and a 2016 star stand on the same scale. Rarity
 * follows the rating; every card costs Legacy Points against your squad budget.
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
export const RARITY_COST: Record<Rarity, number> = { common: 6, rare: 10, epic: 16, legendary: 25 };

export interface HuntCard {
  /** `${playerId}@${endYear}` */
  id: string;
  playerId: string;
  name: string;
  /** Season END year (1996 = 1995-96). */
  end: number;
  ovr: number;
  pos: string;
  team: string;
  teamName: string;
  rarity: Rarity;
  cost: number;
  ppg: number; rpg: number; apg: number;
}

const NBA = new Set(['BAA', 'NBA']);
export const seasonLabel = (end: number) => `${end - 1}-${String(end).slice(2)}`;

export interface CardPool {
  cards: HuntCard[];
  byId: Map<string, HuntCard>;
  /** Cards by rarity, for weighted offers. */
  byRarity: Record<Rarity, HuntCard[]>;
}

const pools = new WeakMap<NbaHistory, CardPool>();

/** Every real player-season worth a card: 25+ games in the NBA/BAA and a rating. Built once per dataset. */
export function cardPool(h: NbaHistory): CardPool {
  const cached = pools.get(h);
  if (cached) return cached;
  const raw: Omit<HuntCard, 'rarity' | 'cost'>[] = [];
  const teamNames = new Map(h.teams.map(t => [`${t.abbr}|${t.season}`, t.name]));
  for (const p of h.players) {
    const rows = (h.seasonsByPlayer.get(p.idx) ?? []).filter(r => NBA.has(r.league));
    const ratings = h.ratingsByPlayer.get(p.idx);
    if (!rows.length || !ratings) continue;
    const ends = [...new Set(rows.map(r => r.season))];
    for (const end of ends) {
      const rs = rows.filter(r => r.season === end);
      const agg = rs.find(r => r.isAggregate) ?? rs[0];
      const g = agg.stats.g ?? 0;
      const rating = ratings.get(end);
      if (g < 25 || !rating) continue;
      const team = rs.filter(r => !r.isAggregate).at(-1)?.team ?? agg.team;
      const per = (v: number | null) => (v == null || !g ? 0 : Math.round(v / g * 10) / 10);
      raw.push({ id: `${p.id}@${end}`, playerId: p.id, name: p.displayName, end, ovr: rating.ovr, pos: shortPos(agg.pos ?? p.pos), team, teamName: teamNames.get(`${team}|${end}`) ?? team,
        ppg: per(agg.stats.pts), rpg: per(agg.stats.trb), apg: per(agg.stats.ast) });
    }
  }
  // Rarity by rating across all of history: the top 2% are Legendary, the next 8% Epic, the next 25% Rare.
  const sorted = raw.map(c => c.ovr).sort((a, b) => b - a);
  const at = (share: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
  const cut = { legendary: at(0.02), epic: at(0.1), rare: at(0.35) };
  const cards: HuntCard[] = raw.map(c => {
    const rarity: Rarity = c.ovr >= cut.legendary ? 'legendary' : c.ovr >= cut.epic ? 'epic' : c.ovr >= cut.rare ? 'rare' : 'common';
    return { ...c, rarity, cost: RARITY_COST[rarity] };
  });
  const pool: CardPool = { cards, byId: new Map(cards.map(c => [c.id, c])), byRarity: { common: [], rare: [], epic: [], legendary: [] } };
  for (const c of cards) pool.byRarity[c.rarity].push(c);
  pools.set(h, pool);
  return pool;
}

function shortPos(pos: string | null): string {
  if (!pos) return 'F';
  const first = pos.split(/[-/, ]/)[0].toUpperCase();
  return ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'].includes(first) ? first : 'F';
}

/** The playable player for a card: his ratings and skills from that season. */
export function cardPlayer(h: NbaHistory, card: HuntCard, teamId: string): PlayerSeason {
  const p: HistPlayer | undefined = h.byId.get(card.playerId);
  if (!p) throw new Error(`Unknown player ${card.playerId}`);
  const seed = seedFor(h, p, card.end, [card.end]);
  const row: HistSeasonRow | undefined = (h.seasonsByPlayer.get(p.idx) ?? []).find(r => r.season === card.end && NBA.has(r.league));
  const age = row?.age ?? 27;
  const player = buildRealPlayer({ ...seed, rating: { ...seed.rating, ovr: card.ovr } }, String(card.end - 1), teamId, age, card.ovr, NBA_HISTORY_DATASET);
  return { ...player, playerId: `${card.name} '${String(card.end).slice(2)}`, seasonStats: undefined, careerHistory: [] };
}
