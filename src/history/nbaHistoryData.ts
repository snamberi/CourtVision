import { gunzipSync, strFromU8 } from 'fflate';
import { yearFreeNames } from './nameYears';

/* Built-in NBA history reference data (public/data/nba-history.v1.bin, gzipped JSON, produced by
 * scripts/nba-history/build_nba_history.py). Loaded lazily — only when a historical league is created or the
 * NBA History archive is opened — and never copied wholesale into saves.
 * Seasons are END years in this file (2016 = 2015-16). */

import { NBA_HISTORY_DATASET, type RatingSource } from './datasetInfo';
export { NBA_HISTORY_DATASET, ratingSourceLabel, type RatingSource } from './datasetInfo';
// Gzipped JSON with a neutral extension so hosts don't add Content-Encoding and decompress it on the way.
export const NBA_HISTORY_URL = `data/${NBA_HISTORY_DATASET}.bin`;

export type StatField = 'g' | 'gs' | 'mp' | 'fg' | 'fga' | 'x3p' | 'x3pa' | 'ft' | 'fta' | 'orb' | 'drb' | 'trb' | 'ast' | 'stl' | 'blk' | 'tov' | 'pf' | 'pts' | 'trp_dbl';
export type AdvField = 'per' | 'ts_percent' | 'x3p_ar' | 'f_tr' | 'orb_percent' | 'drb_percent' | 'trb_percent' | 'ast_percent' | 'stl_percent' | 'blk_percent'
  | 'tov_percent' | 'usg_percent' | 'ows' | 'dws' | 'ws' | 'ws_48' | 'obpm' | 'dbpm' | 'bpm' | 'vorp';

export interface HistPlayer {
  idx: number; id: string; displayName: string; name: string; aliases: string[]; pos: string | null; heightIn: number | null; weightLb: number | null;
  birthDate: string | null; college: string | null; firstSeason: number | null; lastSeason: number | null; debutDate: string | null; hallOfFame: boolean;
  draft: { year: number; round: number | null; pick: number | null; team: string } | null;
}
/** One regular-season row: a team stint, or (isAggregate) the whole season of a traded player. null = not recorded. */
export interface HistSeasonRow {
  player: number; season: number; league: 'BAA' | 'NBA' | 'ABA'; team: string; isAggregate: boolean; stintIndex: number; age: number | null; pos: string | null;
  stats: Record<StatField, number | null>; adv: Record<AdvField, number | null> | null; experience: number | null;
}
export interface HistTeamSeason {
  season: number; league: string; abbr: string; name: string; franchise: string | null; conference: 'east' | 'west' | null; division: string | null;
  playoffs: boolean; w: number | null; l: number | null; ortg: number | null; drtg: number | null; pace: number | null; srs: number | null; arena: string | null;
}
export interface HistAward { season: number; award: string; player: number; firstVotes: number | null; pointsWon: number | null; pointsMax: number | null; share: number | null; winner: boolean }
export interface HistTeamAward { season: number; league: string; award: 'allLeague' | 'allDefense' | 'allRookie' | 'aba-allLeague'; rank: number | null; player: number; pos: string }
export interface HistChampion { season: number; champion: string; runnerUp: string; result: string; finalsMvp: number | null; rosterCredit: number[] }
export interface HistDraftPick { year: number; league: string; pick: number | null; round: number | null; team: string; player: number | null; name: string; college: string | null }
/** Start-of-season rating on Court Vision's Overall scale, computed from statistics by the builder. */
export interface HistRating { player: number; season: number; ovr: number; source: RatingSource }

export interface NbaHistory {
  manifest: {
    schema: number; dataset: string; builtAt: string; sources: { name: string; url: string; commit?: string; license: string; retrieved: string }[];
    coverage: { seasons: [number, number]; supportedStartYears: [number, number] };
    ratingMethod: {
      description: string; distribution: string;
      bpmFromPerWs48: { coef: number[]; n: number; correlation: number };
      valueFromWsPtsAst: { coef: number[]; n: number; correlation: number };
      validation: { mvpMedianRankNextSeason: number; allNbaFirstTeamMedianRankNextSeason: number; mvpTop5Share: number };
    };
    report: string[]; gaps: string[];
    /** Structural limits of the data (what is not included). */
    limitations?: string[];
  };
  players: HistPlayer[];
  seasons: HistSeasonRow[];
  teams: HistTeamSeason[];
  awards: HistAward[];
  teamAwards: HistTeamAward[];
  allStars: { season: number; league: string; player: number; team: string; replaced: boolean }[];
  allStarMvp: { season: number; player: number }[];
  champions: HistChampion[];
  coachOfYear: { season: number; coach: string; team: string }[];
  drafts: HistDraftPick[];
  ratings: HistRating[];
  // indexes
  byId: Map<string, HistPlayer>;
  seasonsByPlayer: Map<number, HistSeasonRow[]>;
  ratingsByPlayer: Map<number, Map<number, HistRating>>;
}

const STAT_FIELDS: StatField[] = ['g', 'gs', 'mp', 'fg', 'fga', 'x3p', 'x3pa', 'ft', 'fta', 'orb', 'drb', 'trb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts', 'trp_dbl'];
const ADV_FIELDS: AdvField[] = ['per', 'ts_percent', 'x3p_ar', 'f_tr', 'orb_percent', 'drb_percent', 'trb_percent', 'ast_percent', 'stl_percent', 'blk_percent',
  'tov_percent', 'usg_percent', 'ows', 'dws', 'ws', 'ws_48', 'obpm', 'dbpm', 'bpm', 'vorp'];
const zip = <K extends string>(keys: K[], values: (number | null)[]): Record<K, number | null> =>
  Object.fromEntries(keys.map((k, i) => [k, values[i] ?? null])) as Record<K, number | null>;

type Raw = { manifest: NbaHistory['manifest']; players: unknown[][]; seasons: unknown[][]; teams: unknown[][]; awards: unknown[][]; teamAwards: unknown[][];
  allStars: unknown[][]; allStarMvp: unknown[][]; champions: unknown[][]; coachOfYear: unknown[][]; drafts: unknown[][]; ratings: unknown[][] };

/** Parses the gzipped asset bytes. */
export function parseNbaHistory(bytes: Uint8Array): NbaHistory {
  // Accept both the gzipped file and an already-decompressed body (a host may decode it in transit).
  const gz = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  const raw = JSON.parse(strFromU8(gz ? gunzipSync(bytes) : bytes)) as Raw;
  const players: HistPlayer[] = raw.players.map((r, idx) => {
    const [id, displayName, name, aliases, pos, heightIn, weightLb, birthDate, college, firstSeason, lastSeason, debutDate, hof, draft] = r as [
      string, string, string, string[], string | null, number | null, number | null, string | null, string | null, number | null, number | null, string | null, number,
      [number, number | null, number | null, string] | null];
    return { idx, id, displayName, name, aliases, pos, heightIn, weightLb, birthDate, college, firstSeason, lastSeason, debutDate, hallOfFame: hof === 1,
      draft: draft ? { year: draft[0], round: draft[1], pick: draft[2], team: draft[3] } : null };
  });
  // Shared names are told apart with "Jr." / "II" instead of a debut year in the name (see nameYears.ts).
  yearFreeNames(players).forEach((n, i) => { players[i].displayName = n; });
  const seasons: HistSeasonRow[] = raw.seasons.map(r => {
    const [player, season, league, team, agg, stintIndex, age, pos, st, adv, exp] = r as [number, number, 'BAA' | 'NBA' | 'ABA', string, number, number, number | null, string | null,
      (number | null)[], (number | null)[] | null, number | null];
    return { player, season, league, team, isAggregate: agg === 1, stintIndex, age, pos, stats: zip(STAT_FIELDS, st), adv: adv ? zip(ADV_FIELDS, adv) : null, experience: exp ?? null };
  });
  const teams: HistTeamSeason[] = raw.teams.map(r => {
    const [season, league, abbr, name, franchise, conference, division, po, w, l, ortg, drtg, pace, srs, arena] = r as [number, string, string, string, string | null,
      'east' | 'west' | null, string | null, number, number | null, number | null, number | null, number | null, number | null, number | null, string | null];
    return { season, league, abbr, name, franchise, conference, division, playoffs: po === 1, w, l, ortg, drtg, pace, srs, arena };
  });
  const h: NbaHistory = {
    manifest: raw.manifest, players, seasons, teams,
    awards: raw.awards.map(r => { const [season, award, player, firstVotes, pointsWon, pointsMax, share, win] = r as [number, string, number, number | null, number | null, number | null, number | null, number];
      return { season, award, player, firstVotes, pointsWon, pointsMax, share, winner: win === 1 }; }),
    teamAwards: raw.teamAwards.map(r => { const [season, league, award, rank, player, pos] = r as [number, string, HistTeamAward['award'], number | null, number, string];
      return { season, league, award, rank, player, pos }; }),
    allStars: raw.allStars.map(r => { const [season, league, player, team, rep] = r as [number, string, number, string, number]; return { season, league, player, team, replaced: rep === 1 }; }),
    allStarMvp: raw.allStarMvp.map(r => ({ season: r[0] as number, player: r[1] as number })),
    champions: raw.champions.map(r => { const [season, champion, runnerUp, result, finalsMvp, roster] = r as [number, string, string, string, number | null, number[]];
      return { season, champion, runnerUp, result, finalsMvp, rosterCredit: roster }; }),
    coachOfYear: raw.coachOfYear.map(r => ({ season: r[0] as number, coach: r[1] as string, team: r[2] as string })),
    drafts: raw.drafts.map(r => { const [year, league, pick, round, team, player, name, college] = r as [number, string, number | null, number | null, string, number | null, string, string | null];
      return { year, league, pick, round, team, player, name, college }; }),
    ratings: raw.ratings.map(r => { const [player, season, ovr, source] = r as [number, number, number, string]; return { player, season, ovr, source }; }),
    byId: new Map(), seasonsByPlayer: new Map(), ratingsByPlayer: new Map(),
  };
  for (const p of players) h.byId.set(p.id, p);
  for (const s of seasons) { const list = h.seasonsByPlayer.get(s.player) ?? []; list.push(s); h.seasonsByPlayer.set(s.player, list); }
  for (const list of h.seasonsByPlayer.values()) list.sort((a, b) => a.season - b.season || (a.isAggregate === b.isAggregate ? a.stintIndex - b.stintIndex : a.isAggregate ? -1 : 1));
  for (const r of h.ratings) { const m = h.ratingsByPlayer.get(r.player) ?? new Map(); m.set(r.season, r); h.ratingsByPlayer.set(r.player, m); }
  return h;
}

let cached: Promise<NbaHistory> | null = null;
/** Fetches and parses the asset once per session (browser). */
export function loadNbaHistory(): Promise<NbaHistory> {
  if (!cached) {
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
    cached = fetch(`${base}${NBA_HISTORY_URL}`).then(r => {
      if (!r.ok) throw new Error(`NBA history data could not be loaded (${r.status}).`);
      return r.arrayBuffer();
    }).then(buf => parseNbaHistory(new Uint8Array(buf))).catch(e => { cached = null; throw e; });
  }
  return cached;
}
