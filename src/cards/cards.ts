import type { League, FranchiseHistoryRecord, TeamSeasonRosterLine } from '../simulation/league';
import { resolveTeamIdentity } from '../simulation/teamIdentity';
import { localRead, type Read } from '../lib/kv';

/*
 * Trading cards. Every player gets a card for every season, built from the season as the league archived it (the
 * franchise history's team rosters and awards). The card changes with the season he had: a rookie card, an All-Star
 * foil, a championship ring card, a gold MVP border, and the legendary holo for the true greats. Your own roster's
 * cards come to you at the end of each season, plus packs (for wins and playoff rounds) that pull cards from the whole
 * league, so you can chase complete team sets. The album lives in this browser (and syncs with your account); sets
 * and legendary cards unlock profile cosmetics (see cosmetics.ts).
 */

export type CardVariant = 'base' | 'rookie' | 'allstar' | 'champion' | 'mvp' | 'legend';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const VARIANT_LABEL: Record<CardVariant, string> = { base: 'Base', rookie: 'Rookie card', allstar: 'All-Star foil', champion: 'Champion ring', mvp: 'MVP gold', legend: 'Legendary holo' };
export const RARITY_OF: Record<CardVariant, Rarity> = { base: 'common', rookie: 'rare', allstar: 'rare', champion: 'epic', mvp: 'legendary', legend: 'legendary' };

export interface TradingCard {
  id: string; league: string; playerId: string; season: string;
  teamId: string; teamName: string; abbr: string; primary: string; secondary: string;
  jersey: number | null; pos: string; age: number; ovr: number; pts: number; reb: number; ast: number;
  variant: CardVariant; rarity: Rarity;
}
export interface CardSet { key: string; league: string; teamId: string; teamName: string; season: string; ids: string[] }

const KEYS = { album: 'cv-card-album', sets: 'cv-card-sets', packs: 'cv-card-packs', pool: 'cv-card-pool', seen: 'cv-card-seen' } as const;
export const ALBUM_EVENT = 'courtvision:cards';
const read = <T>(r: Read, k: string, fb: T): T => { try { return (JSON.parse(r(k) ?? 'null') as T) ?? fb; } catch { return fb; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

export const loadAlbum = (r: Read = localRead) => read<Record<string, TradingCard>>(r, KEYS.album, {});
export const loadSets = (r: Read = localRead) => read<Record<string, CardSet>>(r, KEYS.sets, {});
export const packsWaiting = (r: Read = localRead) => read<number>(r, KEYS.packs, 0);

/** The card a roster line earns for that season. */
export function variantOf(line: TeamSeasonRosterLine, rec: FranchiseHistoryRecord): CardVariant {
  const a = rec.fullAwards;
  if (rec.mvpPlayerId === line.playerId || rec.fmvpPlayerId === line.playerId) return 'mvp';
  if (line.overall >= 92) return 'legend';
  if (rec.championPlayerIds?.includes(line.playerId)) return 'champion';
  if (a?.allStars.some(w => w.playerId === line.playerId) || a?.allNBA.some(t => t.some(w => w.playerId === line.playerId))) return 'allstar';
  if (a?.roy?.playerId === line.playerId || a?.allRookie.some(t => t.some(w => w.playerId === line.playerId))) return 'rookie';
  return 'base';
}

/** Every card of one archived season, team by team (with the team's colours as they were then). */
export function seasonCards(league: League, rec: FranchiseHistoryRecord, leagueKey: string): { cards: TradingCard[]; sets: CardSet[] } {
  const cards: TradingCard[] = [], sets: CardSet[] = [];
  for (const ts of rec.teamSeasons ?? []) {
    const team = league.teams.find(t => t.teamId === ts.teamId);
    const id = resolveTeamIdentity(team ?? { teamId: ts.teamId, name: ts.teamName });
    const ids: string[] = [];
    for (const line of ts.roster) {
      if (line.gp <= 0) continue;
      const variant = variantOf(line, rec);
      const card: TradingCard = { id: `${leagueKey}|${rec.season}|${ts.teamId}|${line.playerId}`, league: leagueKey, playerId: line.playerId, season: rec.season,
        teamId: ts.teamId, teamName: ts.teamName, abbr: id.abbreviation, primary: id.primary, secondary: id.secondary, jersey: line.jerseyNumber ?? null,
        pos: line.position, age: line.age, ovr: line.overall, pts: line.pts, reb: line.reb, ast: line.ast, variant, rarity: RARITY_OF[variant] };
      cards.push(card); ids.push(card.id);
    }
    if (ids.length) sets.push({ key: `${leagueKey}|${rec.season}|${ts.teamId}`, league: leagueKey, teamId: ts.teamId, teamName: ts.teamName, season: rec.season, ids });
  }
  return { cards, sets };
}

const PACK_SIZE = 5, POOL_SEASONS = 3;
/**
 * A finished season: your roster's cards go straight into the album, every team's set is registered, the season's
 * cards join the pack pool, and packs are earned (one per 10 wins, one per playoff series won, at least one).
 * Each season is handled once per league. Returns what's new, for the toast.
 */
export function awardSeasonCards(league: League, leagueKey: string, userTeamId: string | null): { added: number; packs: number; season: string } | null {
  const seen = new Set(read<string[]>(localRead, KEYS.seen, []));
  const rec = [...(league.franchiseHistory ?? [])].reverse().find(r => !r.imported && r.teamSeasons?.length);
  if (!rec || seen.has(`${leagueKey}|${rec.season}`)) return null;
  const { cards, sets } = seasonCards(league, rec, leagueKey);
  const album = loadAlbum(), allSets = loadSets();
  let added = 0;
  for (const c of cards) if (c.teamId === userTeamId && !album[c.id]) { album[c.id] = c; added++; }
  for (const s of sets) allSets[s.key] = s;
  const mine = rec.teamSeasons!.find(t => t.teamId === userTeamId);
  const packs = mine ? Math.max(1, Math.floor(mine.wins / 10) + Math.floor(mine.playoffWins / 4)) : 1;
  const pool = [...read<TradingCard[]>(localRead, KEYS.pool, []).filter(c => c.league !== leagueKey || c.season !== rec.season), ...cards];
  const seasonsInPool = [...new Set(pool.map(c => `${c.league}|${c.season}`))].slice(-POOL_SEASONS);
  write(KEYS.album, album); write(KEYS.sets, allSets); write(KEYS.packs, packsWaiting() + packs);
  write(KEYS.pool, pool.filter(c => seasonsInPool.includes(`${c.league}|${c.season}`)));
  write(KEYS.seen, [...seen, `${leagueKey}|${rec.season}`].slice(-400));
  try { window.dispatchEvent(new Event(ALBUM_EVENT)); window.dispatchEvent(new Event('courtvision:progress')); } catch { /* no window */ }
  return { added, packs, season: rec.season };
}

const ODDS: [Rarity, number][] = [['legendary', 0.03], ['epic', 0.1], ['rare', 0.27], ['common', 0.6]];
/** Opens one pack: five cards from the recent seasons' pool, by rarity odds (new ones go in the album). */
export function openPack(rand: () => number = Math.random): TradingCard[] {
  const waiting = packsWaiting();
  const pool = read<TradingCard[]>(localRead, KEYS.pool, []);
  if (waiting <= 0 || !pool.length) return [];
  const byRarity = new Map<Rarity, TradingCard[]>(ODDS.map(([r]) => [r, pool.filter(c => c.rarity === r)]));
  const pulled: TradingCard[] = [];
  for (let i = 0; i < PACK_SIZE; i++) {
    let roll = rand(), rarity: Rarity = 'common';
    for (const [r, p] of ODDS) { if (roll < p) { rarity = r; break; } roll -= p; }
    // The last card of a pack is at least rare.
    if (i === PACK_SIZE - 1 && rarity === 'common') rarity = 'rare';
    const order: Rarity[] = ['legendary', 'epic', 'rare', 'common'];
    const list = order.slice(order.indexOf(rarity)).map(r => byRarity.get(r)!).find(l => l.length) ?? pool;
    pulled.push(list[Math.floor(rand() * list.length)]);
  }
  const album = loadAlbum();
  for (const c of pulled) album[c.id] = album[c.id] ?? c;
  write(KEYS.album, album); write(KEYS.packs, waiting - 1);
  try { window.dispatchEvent(new Event(ALBUM_EVENT)); window.dispatchEvent(new Event('courtvision:progress')); } catch { /* no window */ }
  return pulled;
}

export interface AlbumStats { cards: number; legendary: number; completeSets: number; sets: number }
export function albumStats(r: Read = localRead): AlbumStats {
  const album = loadAlbum(r), sets = Object.values(loadSets(r));
  return { cards: Object.keys(album).length, legendary: Object.values(album).filter(c => c.rarity === 'legendary').length,
    completeSets: sets.filter(s => s.ids.every(id => album[id])).length, sets: sets.length };
}
