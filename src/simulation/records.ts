import type { GameResult, PlayerStatLine } from './boxscore';
import type { League, TeamSeasonSummary } from './league';
import type { GMLeagueExtras } from './gm';
import type { PlayerSeason, SeasonStatTotals } from './types';
import type { PlayerAdvanced } from './advancedStats';
import type { MissingStat } from './types';
import { currentSeasonAdvanced, regularSeasonContext } from './advancedStats';

/* ---------------------------------------------------------------------------------------------
 * The league record book. Single-game records are captured live after every game (box scores of
 * older seasons are not kept), everything else is derived from archived season lines, team season
 * summaries and award history, so it always reflects the real saved league.
 * ------------------------------------------------------------------------------------------- */

export interface RecordEntry {
  value: number; playerId?: string; teamId?: string; opponentId?: string; season: string; date?: string; detail?: string;
}
export interface RecordBook { version: 1; game: Record<string, RecordEntry[]> }
export type RecordGroup = 'Single Game' | 'Season' | 'Career' | 'Playoffs' | 'Team' | 'Awards';
export type RecordFormat = 'int' | 'dec1' | 'dec2' | 'dec3' | 'pct';
export interface RecordDef { id: string; group: RecordGroup; section: string; title: string; format: RecordFormat; lowerIsBetter?: boolean; qualifier?: string }
export interface RecordResult { def: RecordDef; entries: RecordEntry[] }

const KEEP = 10;

/* ------------------------------ single-game (live) ------------------------------ */
interface PlayerGameCat { id: string; title: string; format?: RecordFormat; value: (l: PlayerStatLine, won: boolean, rookie: boolean) => number | null }
const PLAYER_GAME: PlayerGameCat[] = [
  { id: 'pts', title: 'Points', value: l => l.points },
  { id: 'reb', title: 'Rebounds', value: l => l.oreb + l.dreb },
  { id: 'oreb', title: 'Offensive rebounds', value: l => l.oreb },
  { id: 'dreb', title: 'Defensive rebounds', value: l => l.dreb },
  { id: 'ast', title: 'Assists', value: l => l.ast },
  { id: 'stl', title: 'Steals', value: l => l.stl },
  { id: 'blk', title: 'Blocks', value: l => l.blk },
  { id: 'tpm', title: 'Three-pointers made', value: l => l.tpm },
  { id: 'tpa', title: 'Three-pointers attempted', value: l => l.tpa },
  { id: 'fgm', title: 'Field goals made', value: l => l.fgm },
  { id: 'fga', title: 'Field goals attempted', value: l => l.fga },
  { id: 'ftm', title: 'Free throws made', value: l => l.ftm },
  { id: 'fta', title: 'Free throws attempted', value: l => l.fta },
  { id: 'tov', title: 'Turnovers', value: l => l.tov },
  { id: 'min', title: 'Minutes played', format: 'dec1', value: l => l.minutes },
  { id: 'pra', title: 'Points + rebounds + assists', value: l => l.points + l.oreb + l.dreb + l.ast },
  { id: 'stocks', title: 'Steals + blocks', value: l => l.stl + l.blk },
  { id: 'gmsc', title: 'Game Score', format: 'dec1', value: l => l.points + 0.4 * l.fgm - 0.7 * l.fga - 0.4 * (l.fta - l.ftm) + 0.7 * l.oreb + 0.3 * l.dreb + l.stl + 0.7 * l.ast + 0.7 * l.blk - 0.4 * l.pf - l.tov },
  { id: 'perfect3', title: 'Threes made without a miss', value: l => l.tpm > 0 && l.tpm === l.tpa ? l.tpm : null },
  { id: 'perfectFg', title: 'Field goals made without a miss', value: l => l.fgm > 0 && l.fgm === l.fga ? l.fgm : null },
  { id: 'perfectFt', title: 'Free throws made without a miss', value: l => l.ftm > 0 && l.ftm === l.fta ? l.ftm : null },
  { id: 'ptsLoss', title: 'Points in a loss', value: (l, won) => won ? null : l.points },
  { id: 'rookiePts', title: 'Points by a rookie', value: (l, _w, rookie) => rookie ? l.points : null },
  { id: 'fgPct', title: 'Field-goal percentage (15+ FGA)', format: 'pct', value: l => l.fga >= 15 ? l.fgm / l.fga : null },
];
interface TeamGameCat { id: string; title: string; format?: RecordFormat; lower?: boolean; value: (own: TeamGameLine, opp: TeamGameLine) => number | null }
interface TeamGameLine { pts: number; fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number; oreb: number; dreb: number; ast: number; stl: number; blk: number; tov: number }
const TEAM_GAME: TeamGameCat[] = [
  { id: 'pts', title: 'Points scored', value: o => o.pts },
  { id: 'fewestAllowed', title: 'Fewest points allowed', lower: true, value: (_o, x) => x.pts },
  { id: 'margin', title: 'Margin of victory', value: (o, x) => o.pts > x.pts ? o.pts - x.pts : null },
  { id: 'tpm', title: 'Three-pointers made', value: o => o.tpm },
  { id: 'tpa', title: 'Three-pointers attempted', value: o => o.tpa },
  { id: 'ast', title: 'Assists', value: o => o.ast },
  { id: 'reb', title: 'Rebounds', value: o => o.oreb + o.dreb },
  { id: 'oreb', title: 'Offensive rebounds', value: o => o.oreb },
  { id: 'stl', title: 'Steals', value: o => o.stl },
  { id: 'blk', title: 'Blocks', value: o => o.blk },
  { id: 'ftm', title: 'Free throws made', value: o => o.ftm },
  { id: 'fewestTov', title: 'Fewest turnovers', lower: true, value: o => o.tov },
  { id: 'tov', title: 'Most turnovers', value: o => o.tov },
  { id: 'combined', title: 'Combined points (both teams)', value: (o, x) => o.pts + x.pts },
  { id: 'fewestCombined', title: 'Fewest combined points', lower: true, value: (o, x) => o.pts + x.pts },
  { id: 'ptsLoss', title: 'Points in a loss', value: (o, x) => o.pts < x.pts ? o.pts : null },
  { id: 'fgPct', title: 'Field-goal percentage (60+ FGA)', format: 'pct', value: o => o.fga >= 60 ? o.fgm / o.fga : null },
];

function insert(list: RecordEntry[] | undefined, entry: RecordEntry, lower = false): RecordEntry[] | null {
  const cur = list ?? [];
  const worst = cur[cur.length - 1];
  if (cur.length >= KEEP && worst && (lower ? entry.value >= worst.value : entry.value <= worst.value)) return null;
  const next = [...cur, entry].sort((a, b) => lower ? a.value - b.value : b.value - a.value);
  return next.slice(0, KEEP);
}
function teamLine(box: GameResult['homeBox']): TeamGameLine {
  const t: TeamGameLine = { pts: box.points, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0 };
  for (const l of Object.values(box.players)) { t.fgm += l.fgm; t.fga += l.fga; t.tpm += l.tpm; t.tpa += l.tpa; t.ftm += l.ftm; t.fta += l.fta; t.oreb += l.oreb; t.dreb += l.dreb; t.ast += l.ast; t.stl += l.stl; t.blk += l.blk; t.tov += l.tov; }
  return t;
}

/** Adds one game to the record book. Returns the same book when nothing changed. */
export function recordGame(book: RecordBook | undefined, result: GameResult, ctx: { season: string; date?: string; playoffs: boolean; isRookie: (playerId: string) => boolean }): RecordBook {
  const base: RecordBook = book ?? { version: 1, game: {} };
  let game = base.game, changed = false;
  const scope = ctx.playoffs ? 'po' : 'rs';
  const put = (key: string, entry: RecordEntry, lower = false) => {
    const next = insert(game[key], entry, lower);
    if (!next) return;
    if (!changed) { game = { ...game }; changed = true; }
    game[key] = next;
  };
  for (const [box, teamId, oppId, won] of [[result.homeBox, result.homeTeamId, result.awayTeamId, result.homeScore > result.awayScore], [result.awayBox, result.awayTeamId, result.homeTeamId, result.awayScore > result.homeScore]] as const) {
    for (const line of Object.values(box.players)) {
      if (line.minutes <= 0) continue;
      const rookie = ctx.isRookie(line.playerId);
      for (const cat of PLAYER_GAME) {
        const v = cat.value(line, won, rookie);
        if (v == null || v <= 0) continue;
        put(`p:${scope}:${cat.id}`, { value: Math.round(v * 1000) / 1000, playerId: line.playerId, teamId, opponentId: oppId, season: ctx.season, date: ctx.date,
          detail: `${line.points} PTS · ${line.oreb + line.dreb} REB · ${line.ast} AST · ${result.homeTeamId === teamId ? result.homeScore : result.awayScore}–${result.homeTeamId === teamId ? result.awayScore : result.homeScore} ${won ? 'W' : 'L'}` });
      }
    }
  }
  const home = teamLine(result.homeBox), away = teamLine(result.awayBox);
  for (const [own, opp, teamId, oppId] of [[home, away, result.homeTeamId, result.awayTeamId], [away, home, result.awayTeamId, result.homeTeamId]] as const) {
    for (const cat of TEAM_GAME) {
      if ((cat.id === 'combined' || cat.id === 'fewestCombined') && teamId !== result.homeTeamId) continue; // count each game once
      const v = cat.value(own, opp);
      if (v == null || (!cat.lower && v <= 0)) continue;
      put(`t:${scope}:${cat.id}`, { value: Math.round(v * 1000) / 1000, teamId, opponentId: oppId, season: ctx.season, date: ctx.date, detail: `${own.pts}–${opp.pts}` }, cat.lower);
    }
  }
  return changed ? { ...base, game } : base;
}
/** Seeds the book from games still stored in the league (current season and playoffs) for saves made before records existed. */
export function backfillRecordBook(league: League): League {
  if (league.recordBook) return league;
  const rookie = rookieCheck(league);
  let book: RecordBook = { version: 1, game: {} };
  for (const g of league.schedule) if (g.result) book = recordGame(book, g.result, { season: league.season ?? '', playoffs: false, isRookie: rookie });
  for (const round of league.playoffBracket?.rounds ?? []) for (const s of round) for (const r of s.games) book = recordGame(book, r, { season: league.season ?? '', playoffs: true, isRookie: rookie });
  return { ...league, recordBook: book };
}
export function rookieCheck(league: League): (id: string) => boolean {
  const map = new Map<string, boolean>();
  for (const t of league.teams) for (const p of t.seasons) map.set(p.playerId, (p.careerHistory?.length ?? 0) === 0);
  return id => map.get(id) ?? false;
}

/* ------------------------------ derived records ------------------------------ */
export interface SeasonRow {
  playerId: string; season: string; teamId: string | null; age: number; index: number;
  stats: SeasonStatTotals; dd: number; td: number; playoff?: SeasonStatTotals; adv?: PlayerAdvanced;
  /** Imported history: stats that season did not record (such seasons never qualify for those records). */
  missing?: MissingStat[];
}
interface CareerRow { playerId: string; totals: SeasonStatTotals; dd: number; td: number; playoff: SeasonStatTotals; seasons: number; ws: number; ows: number; dws: number; perMin: number; perMinutes: number; seasons20: number; seasons10ws: number; seasons1000: number; lastTeam: string | null; teamSeasons: Record<string, number>;
  /** Games in seasons that did not record a stat, so career averages divide by the games that did. */
  missingGames: Partial<Record<MissingStat, number>> }
/** Which recorded stats each record needs (by the record id's last part). */
const NEEDS: Record<string, MissingStat[]> = {
  pts: ['points'], reb: ['dreb'], oreb: ['oreb', 'rebSplit'], dreb: ['dreb', 'rebSplit'], ast: ['ast'], stl: ['stl'], blk: ['blk'], tpm: ['tpm'], tpa: ['tpa'],
  fgm: ['fgm'], fga: ['fga'], ftm: ['ftm'], fta: ['fta'], tov: ['tov'], min: ['minutes'], pf: ['pf'], clutch: ['clutchPoints'], dd: ['doubleDoubles'], td: ['tripleDoubles'],
  ppg: ['points'], rpg: ['dreb'], orpg: ['oreb', 'rebSplit'], drpg: ['dreb', 'rebSplit'], apg: ['ast'], spg: ['stl'], bpg: ['blk'], tpmpg: ['tpm'], mpg: ['minutes'], topg: ['tov'],
  ftmpg: ['ftm'], fgapg: ['fga'], fg: ['fga'], tp: ['tpa'], ft: ['fta'], ts: ['fta'], asttov: ['ast', 'tov'],
  pts36: ['minutes', 'points'], reb36: ['minutes', 'dreb'], ast36: ['minutes', 'ast'], stl36: ['minutes', 'stl'], blk36: ['minutes', 'blk'],
};
const needsOf = (id: string) => NEEDS[id.split(':').pop()!.replace(/^(20|35)/, '')] ?? [];
const Z = (): SeasonStatTotals => ({ gamesPlayed: 0, minutes: 0, points: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, ba: 0, blkAtt: 0, clutchPoints: 0 });
const addT = (a: SeasonStatTotals, b: SeasonStatTotals) => { for (const k of Object.keys(a) as (keyof SeasonStatTotals)[]) a[k] += b[k] ?? 0; };

function allPlayers(league: League, extras?: GMLeagueExtras): PlayerSeason[] {
  const seen = new Set<string>(), out: PlayerSeason[] = [];
  const push = (p: PlayerSeason | undefined) => { if (p && !seen.has(p.playerId)) { seen.add(p.playerId); out.push(p); } };
  league.teams.forEach(t => t.seasons.forEach(push));
  extras?.freeAgents.forEach(push);
  for (const r of league.retiredPlayers ?? []) push(r.finalSeasonData);
  return out;
}

export function seasonRows(league: League, extras?: GMLeagueExtras): { rows: SeasonRow[]; careers: CareerRow[] } {
  const current = currentSeasonAdvanced(league);
  const teamOf = new Map(league.teams.flatMap(t => t.seasons.map(p => [p.playerId, t.teamId] as const)));
  const rows: SeasonRow[] = [], careers: CareerRow[] = [];
  for (const p of allPlayers(league, extras)) {
    const history = p.careerHistory ?? [];
    const c: CareerRow = { playerId: p.playerId, totals: Z(), dd: 0, td: 0, playoff: Z(), seasons: 0, ws: 0, ows: 0, dws: 0, perMin: 0, perMinutes: 0, seasons20: 0, seasons10ws: 0, seasons1000: 0, lastTeam: null, teamSeasons: {}, missingGames: {} };
    const take = (row: SeasonRow) => {
      rows.push(row);
      if (row.stats.gamesPlayed > 0) {
        addT(c.totals, row.stats); c.dd += row.dd; c.td += row.td; c.seasons++;
        if (row.teamId) { c.teamSeasons[row.teamId] = (c.teamSeasons[row.teamId] ?? 0) + 1; c.lastTeam = row.teamId; }
        if (row.stats.points / row.stats.gamesPlayed >= 20 && row.stats.gamesPlayed >= 40) c.seasons20++;
        if (row.stats.points >= 1000) c.seasons1000++;
        for (const f of row.missing ?? []) c.missingGames[f] = (c.missingGames[f] ?? 0) + row.stats.gamesPlayed;
      }
      if (row.playoff) addT(c.playoff, row.playoff);
      if (row.adv) {
        const fin = (v: number) => (Number.isFinite(v) ? v : 0); // unrecorded (imported) values are skipped, not zeroed into NaN
        c.ws += fin(row.adv.ws); c.ows += fin(row.adv.ows); c.dws += fin(row.adv.dws);
        if (Number.isFinite(row.adv.per) && !row.missing?.includes('minutes')) { c.perMin += row.adv.per * row.stats.minutes; c.perMinutes += row.stats.minutes; }
        if (row.adv.ws >= 10) c.seasons10ws++;
      }
    };
    history.forEach((h, i) => take({ playerId: p.playerId, season: h.season, teamId: h.teamId, age: h.age, index: i, stats: h.stats, dd: h.milestones?.doubleDoubles ?? 0, td: h.milestones?.tripleDoubles ?? 0, playoff: h.playoffStats, adv: h.advanced, ...(h.missing?.length ? { missing: h.missing } : {}) }));
    const isActive = teamOf.has(p.playerId);
    if (isActive && p.seasonStats && p.seasonStats.gamesPlayed > 0) {
      take({ playerId: p.playerId, season: league.season ?? p.season, teamId: teamOf.get(p.playerId) ?? null, age: p.age, index: history.length, stats: p.seasonStats,
        dd: p.seasonMilestones?.doubleDoubles ?? 0, td: p.seasonMilestones?.tripleDoubles ?? 0, playoff: p.playoffStats, adv: current.get(p.playerId) });
    }
    if (c.seasons > 0 || c.playoff.gamesPlayed > 0) careers.push(c);
  }
  return { rows, careers };
}

interface Candidate { value: number; entry: Omit<RecordEntry, 'value'> }
function top(cands: Candidate[], lower = false): RecordEntry[] {
  return cands.filter(c => Number.isFinite(c.value)).sort((a, b) => lower ? a.value - b.value : b.value - a.value).slice(0, 5).map(c => ({ ...c.entry, value: c.value }));
}
const per = (n: number, d: number) => d > 0 ? n / d : 0;

export function computeRecords(league: League, extras?: GMLeagueExtras): RecordResult[] {
  const out: RecordResult[] = [];
  const book = league.recordBook?.game ?? {};
  // Single game
  for (const [scope, label] of [['rs', 'Regular season'], ['po', 'Playoffs']] as const) {
    for (const cat of PLAYER_GAME) out.push({ def: { id: `game:p:${scope}:${cat.id}`, group: 'Single Game', section: `Player · ${label}`, title: `${cat.title} in a game`, format: cat.format ?? 'int' }, entries: (book[`p:${scope}:${cat.id}`] ?? []).slice(0, 5) });
    for (const cat of TEAM_GAME) out.push({ def: { id: `game:t:${scope}:${cat.id}`, group: 'Single Game', section: `Team · ${label}`, title: `${cat.title} in a game`, format: cat.format ?? 'int', lowerIsBetter: cat.lower }, entries: (book[`t:${scope}:${cat.id}`] ?? []).slice(0, 5) });
  }
  const { rows, careers } = seasonRows(league, extras);
  const qualAvg = (r: SeasonRow) => r.stats.gamesPlayed >= 40 || (r.season === league.season && r.stats.gamesPlayed >= 10);
  const qualMin = (r: SeasonRow) => r.stats.minutes >= 1000 || (r.season === league.season && r.stats.minutes >= 300);
  const seasonEntry = (r: SeasonRow) => ({ playerId: r.playerId, teamId: r.teamId ?? undefined, season: r.season, detail: `${r.stats.gamesPlayed} GP · age ${r.age}` });
  const add = (group: RecordGroup, section: string, id: string, title: string, format: RecordFormat, entries: RecordEntry[], qualifier?: string, lowerIsBetter?: boolean) =>
    out.push({ def: { id, group, section, title, format, qualifier, lowerIsBetter }, entries });
  const recorded = (r: { missing?: MissingStat[] }, id: string) => !r.missing || !needsOf(id).some(f => r.missing!.includes(f));
  const seasonRec = (section: string, id: string, title: string, format: RecordFormat, value: (r: SeasonRow) => number | null, qualify: (r: SeasonRow) => boolean = () => true, qualifier?: string, lower?: boolean) =>
    add('Season', section, `season:${id}`, title, format, top(rows.filter(r => r.stats.gamesPlayed > 0 && recorded(r, id) && qualify(r)).map(r => ({ value: value(r) ?? NaN, entry: seasonEntry(r) })), lower), qualifier, lower);
  const T = (k: keyof SeasonStatTotals) => (r: SeasonRow) => r.stats[k];
  const totals: [string, string, (r: SeasonRow) => number][] = [
    ['pts', 'Points', T('points')], ['reb', 'Rebounds', r => r.stats.oreb + r.stats.dreb], ['oreb', 'Offensive rebounds', T('oreb')], ['dreb', 'Defensive rebounds', T('dreb')],
    ['ast', 'Assists', T('ast')], ['stl', 'Steals', T('stl')], ['blk', 'Blocks', T('blk')], ['tpm', 'Three-pointers made', T('tpm')], ['tpa', 'Three-pointers attempted', T('tpa')],
    ['fgm', 'Field goals made', T('fgm')], ['fga', 'Field goals attempted', T('fga')], ['ftm', 'Free throws made', T('ftm')], ['fta', 'Free throws attempted', T('fta')],
    ['tov', 'Turnovers', T('tov')], ['min', 'Minutes played', T('minutes')], ['gp', 'Games played', T('gamesPlayed')], ['pf', 'Personal fouls', T('pf')], ['clutch', 'Clutch points', T('clutchPoints')],
    ['dd', 'Double-doubles', r => r.dd], ['td', 'Triple-doubles', r => r.td],
  ];
  for (const [id, title, v] of totals) seasonRec('Totals', `tot:${id}`, `${title} in a season`, id === 'min' ? 'int' : 'int', v);
  const avgs: [string, string, (s: SeasonStatTotals) => number][] = [
    ['ppg', 'Points per game', s => s.points], ['rpg', 'Rebounds per game', s => s.oreb + s.dreb], ['orpg', 'Offensive rebounds per game', s => s.oreb], ['drpg', 'Defensive rebounds per game', s => s.dreb],
    ['apg', 'Assists per game', s => s.ast], ['spg', 'Steals per game', s => s.stl], ['bpg', 'Blocks per game', s => s.blk], ['tpmpg', 'Threes made per game', s => s.tpm],
    ['mpg', 'Minutes per game', s => s.minutes], ['topg', 'Turnovers per game', s => s.tov], ['ftmpg', 'Free throws made per game', s => s.ftm], ['fgapg', 'Field-goal attempts per game', s => s.fga],
  ];
  for (const [id, title, v] of avgs) seasonRec('Averages', `avg:${id}`, `${title} (season)`, 'dec1', r => per(v(r.stats), r.stats.gamesPlayed), qualAvg, '40+ games');
  const pcts: [string, string, (s: SeasonStatTotals) => number, (s: SeasonStatTotals) => boolean, string][] = [
    ['fg', 'Field-goal percentage', s => per(s.fgm, s.fga), s => s.fga >= 300, '300+ FGA'],
    ['tp', 'Three-point percentage', s => per(s.tpm, s.tpa), s => s.tpa >= 150, '150+ 3PA'],
    ['ft', 'Free-throw percentage', s => per(s.ftm, s.fta), s => s.fta >= 150, '150+ FTA'],
    ['ts', 'True shooting percentage', s => per(s.points, 2 * (s.fga + 0.44 * s.fta)), s => s.fga >= 400, '400+ FGA'],
    ['efg', 'Effective FG percentage', s => per(s.fgm + 0.5 * s.tpm, s.fga), s => s.fga >= 400, '400+ FGA'],
  ];
  for (const [id, title, v, q, label] of pcts) seasonRec('Shooting', `pct:${id}`, `${title} (season)`, 'pct', r => v(r.stats), r => q(r.stats), label);
  const advs: [string, string, keyof PlayerAdvanced, RecordFormat, boolean?][] = [
    ['per', 'Player Efficiency Rating', 'per', 'dec1'], ['ws', 'Win Shares', 'ws', 'dec1'], ['ows', 'Offensive Win Shares', 'ows', 'dec1'], ['dws', 'Defensive Win Shares', 'dws', 'dec1'],
    ['ws48', 'Win Shares per 48 minutes', 'ws48', 'dec3'], ['usg', 'Usage rate', 'usgPct', 'dec1'], ['astp', 'Assist percentage', 'astPct', 'dec1'], ['trbp', 'Total rebound percentage', 'trbPct', 'dec1'],
    ['orbp', 'Offensive rebound percentage', 'orbPct', 'dec1'], ['drbp', 'Defensive rebound percentage', 'drbPct', 'dec1'], ['stlp', 'Steal percentage', 'stlPct', 'dec1'], ['blkp', 'Block percentage', 'blkPct', 'dec1'],
    ['ortg', 'Offensive rating', 'ortg', 'dec1'], ['drtg', 'Defensive rating (lowest)', 'drtg', 'dec1', true], ['tpar', 'Three-point attempt rate', 'tpar', 'pct'], ['ftr', 'Free-throw rate', 'ftr', 'pct'],
  ];
  for (const [id, title, key, fmt, lower] of advs) seasonRec('Advanced', `adv:${id}`, `${title} (season)`, fmt, r => r.adv ? r.adv[key] : null, r => !!r.adv && (id === 'ws' || id === 'ows' || id === 'dws' || qualMin(r)), id === 'ws' || id === 'ows' || id === 'dws' ? undefined : '1,000+ minutes', lower);
  seasonRec('Advanced', 'adv:asttov', 'Assist-to-turnover ratio (season)', 'dec2', r => per(r.stats.ast, Math.max(1, r.stats.tov)), r => r.stats.ast >= 200, '200+ assists');
  for (const [id, title, v] of [['pts36', 'Points per 36 minutes', (s: SeasonStatTotals) => s.points], ['reb36', 'Rebounds per 36 minutes', (s: SeasonStatTotals) => s.oreb + s.dreb], ['ast36', 'Assists per 36 minutes', (s: SeasonStatTotals) => s.ast], ['stl36', 'Steals per 36 minutes', (s: SeasonStatTotals) => s.stl], ['blk36', 'Blocks per 36 minutes', (s: SeasonStatTotals) => s.blk]] as const)
    seasonRec('Per 36 minutes', `p36:${id}`, `${title} (season)`, 'dec1', r => 36 * per(v(r.stats), r.stats.minutes), qualMin, '1,000+ minutes');
  const rookie = (r: SeasonRow) => r.index === 0;
  seasonRec('Rookies', 'rookie:pts', 'Points by a rookie (season)', 'int', T('points'), rookie);
  seasonRec('Rookies', 'rookie:ppg', 'Points per game by a rookie', 'dec1', r => per(r.stats.points, r.stats.gamesPlayed), r => rookie(r) && qualAvg(r), '40+ games');
  seasonRec('Rookies', 'rookie:rpg', 'Rebounds per game by a rookie', 'dec1', r => per(r.stats.oreb + r.stats.dreb, r.stats.gamesPlayed), r => rookie(r) && qualAvg(r), '40+ games');
  seasonRec('Rookies', 'rookie:apg', 'Assists per game by a rookie', 'dec1', r => per(r.stats.ast, r.stats.gamesPlayed), r => rookie(r) && qualAvg(r), '40+ games');
  seasonRec('Rookies', 'rookie:ws', 'Win Shares by a rookie', 'dec1', r => r.adv?.ws ?? null, r => rookie(r) && !!r.adv);
  seasonRec('By age', 'age:20ppg', 'Points per game, age 20 or younger', 'dec1', r => per(r.stats.points, r.stats.gamesPlayed), r => r.age <= 20 && qualAvg(r), '40+ games');
  seasonRec('By age', 'age:35ppg', 'Points per game, age 35 or older', 'dec1', r => per(r.stats.points, r.stats.gamesPlayed), r => r.age >= 35 && qualAvg(r), '40+ games');
  seasonRec('By age', 'age:35ws', 'Win Shares, age 35 or older', 'dec1', r => r.adv?.ws ?? null, r => r.age >= 35 && !!r.adv);

  // Career
  const careerEntry = (c: CareerRow) => ({ playerId: c.playerId, teamId: c.lastTeam ?? undefined, season: `${c.seasons} season${c.seasons === 1 ? '' : 's'}`, detail: `${c.totals.gamesPlayed} GP` });
  const careerRec = (section: string, id: string, title: string, format: RecordFormat, value: (c: CareerRow) => number | null, qualify: (c: CareerRow) => boolean = () => true, qualifier?: string) =>
    add('Career', section, `career:${id}`, title, format, top(careers.filter(qualify).map(c => ({ value: value(c) ?? NaN, entry: careerEntry(c) }))), qualifier);
  const careerTotals: [string, string, (c: CareerRow) => number][] = [
    ['pts', 'Points', c => c.totals.points], ['reb', 'Rebounds', c => c.totals.oreb + c.totals.dreb], ['oreb', 'Offensive rebounds', c => c.totals.oreb], ['dreb', 'Defensive rebounds', c => c.totals.dreb],
    ['ast', 'Assists', c => c.totals.ast], ['stl', 'Steals', c => c.totals.stl], ['blk', 'Blocks', c => c.totals.blk], ['tpm', 'Three-pointers made', c => c.totals.tpm], ['tpa', 'Three-pointers attempted', c => c.totals.tpa],
    ['fgm', 'Field goals made', c => c.totals.fgm], ['fga', 'Field goals attempted', c => c.totals.fga], ['ftm', 'Free throws made', c => c.totals.ftm], ['fta', 'Free throws attempted', c => c.totals.fta],
    ['tov', 'Turnovers', c => c.totals.tov], ['min', 'Minutes played', c => c.totals.minutes], ['gp', 'Games played', c => c.totals.gamesPlayed], ['pf', 'Personal fouls', c => c.totals.pf], ['clutch', 'Clutch points', c => c.totals.clutchPoints],
    ['dd', 'Double-doubles', c => c.dd], ['td', 'Triple-doubles', c => c.td],
  ];
  for (const [id, title, v] of careerTotals) careerRec('Totals', `tot:${id}`, `Career ${title.toLowerCase()}`, 'int', v);
  // Games in seasons that recorded the stat (imported early-era seasons may not have).
  const gamesFor = (c: CareerRow, id: string) => c.totals.gamesPlayed - Math.max(0, ...needsOf(id).map(f => c.missingGames[f] ?? 0));
  for (const [id, title, v] of avgs) careerRec('Averages', `avg:${id}`, `Career ${title.toLowerCase()}`, 'dec1', c => (gamesFor(c, id) > 0 ? per(v(c.totals), gamesFor(c, id)) : NaN), c => gamesFor(c, id) >= 300, '300+ games');
  const careerPct: [string, string, (s: SeasonStatTotals) => number, (s: SeasonStatTotals) => boolean, string][] = [
    ['fg', 'field-goal percentage', s => per(s.fgm, s.fga), s => s.fga >= 2000, '2,000+ FGA'], ['tp', 'three-point percentage', s => per(s.tpm, s.tpa), s => s.tpa >= 750, '750+ 3PA'],
    ['ft', 'free-throw percentage', s => per(s.ftm, s.fta), s => s.fta >= 750, '750+ FTA'], ['ts', 'true shooting percentage', s => per(s.points, 2 * (s.fga + 0.44 * s.fta)), s => s.fga >= 2000, '2,000+ FGA'],
    ['efg', 'effective FG percentage', s => per(s.fgm + 0.5 * s.tpm, s.fga), s => s.fga >= 2000, '2,000+ FGA'],
  ];
  for (const [id, title, v, q, label] of careerPct) careerRec('Shooting', `pct:${id}`, `Career ${title}`, 'pct', c => v(c.totals), c => q(c.totals), label);
  careerRec('Advanced', 'adv:ws', 'Career Win Shares', 'dec1', c => c.ws);
  careerRec('Advanced', 'adv:ows', 'Career Offensive Win Shares', 'dec1', c => c.ows);
  careerRec('Advanced', 'adv:dws', 'Career Defensive Win Shares', 'dec1', c => c.dws);
  careerRec('Advanced', 'adv:per', 'Career PER', 'dec1', c => per(c.perMin, c.perMinutes), c => c.perMinutes >= 5000, '5,000+ minutes');
  careerRec('Advanced', 'adv:ws48', 'Career Win Shares per 48 minutes', 'dec3', c => per(c.ws * 48, c.totals.minutes), c => c.totals.minutes >= 5000 && !c.missingGames.minutes, '5,000+ minutes');
  for (const [id, title, v] of [['pts36', 'points per 36 minutes', (s: SeasonStatTotals) => s.points], ['reb36', 'rebounds per 36 minutes', (s: SeasonStatTotals) => s.oreb + s.dreb], ['ast36', 'assists per 36 minutes', (s: SeasonStatTotals) => s.ast]] as const)
    careerRec('Per 36 minutes', `p36:${id}`, `Career ${title}`, 'dec1', c => 36 * per(v(c.totals), c.totals.minutes), c => c.totals.minutes >= 10000 && !needsOf(id).some(f => c.missingGames[f]), '10,000+ minutes');
  careerRec('Longevity', 'seasons', 'Seasons played', 'int', c => c.seasons);
  careerRec('Longevity', 'oneTeam', 'Seasons with one franchise', 'int', c => Math.max(0, ...Object.values(c.teamSeasons)));
  careerRec('Longevity', 'seasons20', 'Seasons averaging 20+ points', 'int', c => c.seasons20);
  careerRec('Longevity', 'seasons1000', '1,000-point seasons', 'int', c => c.seasons1000);
  careerRec('Longevity', 'seasons10ws', 'Seasons with 10+ Win Shares', 'int', c => c.seasons10ws);

  // Playoffs
  const po = rows.filter(r => r.playoff && r.playoff.gamesPlayed > 0);
  const poEntry = (r: SeasonRow) => ({ playerId: r.playerId, teamId: r.teamId ?? undefined, season: r.season, detail: `${r.playoff!.gamesPlayed} playoff games` });
  const poSeason: [string, string, (s: SeasonStatTotals) => number][] = [
    ['pts', 'Points', s => s.points], ['reb', 'Rebounds', s => s.oreb + s.dreb], ['ast', 'Assists', s => s.ast], ['stl', 'Steals', s => s.stl], ['blk', 'Blocks', s => s.blk],
    ['tpm', 'Three-pointers made', s => s.tpm], ['ftm', 'Free throws made', s => s.ftm], ['min', 'Minutes played', s => s.minutes],
  ];
  for (const [id, title, v] of poSeason) add('Playoffs', 'Single postseason', `po:season:${id}`, `${title} in one postseason`, 'int', top(po.map(r => ({ value: v(r.playoff!), entry: poEntry(r) }))));
  for (const [id, title, v] of [['ppg', 'Points per game', (s: SeasonStatTotals) => s.points], ['rpg', 'Rebounds per game', (s: SeasonStatTotals) => s.oreb + s.dreb], ['apg', 'Assists per game', (s: SeasonStatTotals) => s.ast]] as const)
    add('Playoffs', 'Single postseason', `po:season:${id}`, `${title} in one postseason`, 'dec1', top(po.filter(r => r.playoff!.gamesPlayed >= 8).map(r => ({ value: per(v(r.playoff!), r.playoff!.gamesPlayed), entry: poEntry(r) }))), '8+ games');
  const poCareer = careers.filter(c => c.playoff.gamesPlayed > 0);
  const poCareerEntry = (c: CareerRow) => ({ playerId: c.playerId, teamId: c.lastTeam ?? undefined, season: 'Career', detail: `${c.playoff.gamesPlayed} playoff games` });
  for (const [id, title, v] of [...poSeason, ['gp', 'Games played', (s: SeasonStatTotals) => s.gamesPlayed] as [string, string, (s: SeasonStatTotals) => number]])
    add('Playoffs', 'Career', `po:career:${id}`, `Career playoff ${title.toLowerCase()}`, 'int', top(poCareer.map(c => ({ value: v(c.playoff), entry: poCareerEntry(c) }))));
  for (const [id, title, v] of [['ppg', 'points per game', (s: SeasonStatTotals) => s.points], ['rpg', 'rebounds per game', (s: SeasonStatTotals) => s.oreb + s.dreb], ['apg', 'assists per game', (s: SeasonStatTotals) => s.ast]] as const)
    add('Playoffs', 'Career', `po:career:${id}`, `Career playoff ${title}`, 'dec1', top(poCareer.filter(c => c.playoff.gamesPlayed >= 25).map(c => ({ value: per(v(c.playoff), c.playoff.gamesPlayed), entry: poCareerEntry(c) }))), '25+ games');

  // Team seasons
  const teamRows = teamSeasonRows(league);
  const teamRec = (id: string, title: string, format: RecordFormat, v: (t: TeamSeasonSummary) => number, lower = false, qualifier?: string) =>
    add('Team', 'Season', `team:${id}`, title, format, top(teamRows.map(t => ({ value: v(t), entry: { teamId: t.teamId, season: t.season, detail: `${t.wins}–${t.losses} · ${t.inProgress ? 'in progress' : t.playoffFinish}` } })), lower), qualifier, lower);
  const pct = (t: TeamSeasonSummary) => per(t.wins, t.wins + t.losses);
  teamRec('wins', 'Most wins in a season', 'int', t => t.wins);
  teamRec('losses', 'Most losses in a season', 'int', t => t.losses);
  teamRec('winpct', 'Best winning percentage', 'pct', pct);
  teamRec('worstpct', 'Worst winning percentage', 'pct', pct, true);
  teamRec('ppg', 'Points per game', 'dec1', t => t.ppg);
  teamRec('oppLow', 'Fewest points allowed per game', 'dec1', t => t.oppPpg, true);
  teamRec('oppHigh', 'Most points allowed per game', 'dec1', t => t.oppPpg);
  teamRec('ortg', 'Offensive rating', 'dec1', t => t.ortg);
  teamRec('drtg', 'Defensive rating (lowest)', 'dec1', t => t.drtg, true);
  teamRec('net', 'Net rating', 'dec1', t => t.ortg - t.drtg);
  teamRec('worstNet', 'Worst net rating', 'dec1', t => t.ortg - t.drtg, true);
  teamRec('paceHigh', 'Fastest pace', 'dec1', t => t.pace);
  teamRec('paceLow', 'Slowest pace', 'dec1', t => t.pace, true);
  teamRec('diff', 'Point differential per game', 'dec1', t => t.ppg - t.oppPpg);
  teamRec('tpm', 'Threes made per game', 'dec1', t => t.tpmPg);
  teamRec('apg', 'Assists per game', 'dec1', t => t.apg);
  teamRec('rpg', 'Rebounds per game', 'dec1', t => t.rpg);
  teamRec('spg', 'Steals per game', 'dec1', t => t.spg);
  teamRec('bpg', 'Blocks per game', 'dec1', t => t.bpg);
  teamRec('poWins', 'Playoff wins in one postseason', 'int', t => t.playoffWins);

  // Awards & honors
  const history = league.franchiseHistory ?? [];
  const tally = (pick: (h: typeof history[number]) => (string | null | undefined)[]) => {
    const m = new Map<string, { n: number; last: string }>();
    for (const h of history) for (const id of pick(h)) if (id) { const x = m.get(id) ?? { n: 0, last: h.season }; x.n++; x.last = h.season; m.set(id, x); }
    return [...m].map(([id, x]) => ({ value: x.n, entry: { playerId: id, season: `last ${x.last}` } }));
  };
  const awardRec = (id: string, title: string, pick: (h: typeof history[number]) => (string | null | undefined)[]) => add('Awards', 'Players', `award:${id}`, title, 'int', top(tally(pick)));
  awardRec('mvp', 'Most MVP awards', h => [h.mvpPlayerId]);
  awardRec('dpoy', 'Most Defensive Player of the Year awards', h => [h.dpoyPlayerId]);
  awardRec('fmvp', 'Most Finals MVP awards', h => [h.fmvpPlayerId]);
  awardRec('rings', 'Most championships (player)', h => h.championPlayerIds ?? []);
  awardRec('allstar', 'Most All-Star selections', h => (h.fullAwards?.allStars ?? []).map(w => w.playerId));
  awardRec('allnba', 'Most All-League team selections', h => (h.fullAwards?.allNBA ?? []).flat().map(w => w.playerId));
  awardRec('alldef', 'Most All-Defensive team selections', h => (h.fullAwards?.allDefense ?? []).flat().map(w => w.playerId));
  awardRec('smoy', 'Most Sixth Man awards', h => [h.fullAwards?.smoy?.playerId]);
  awardRec('mip', 'Most Improved Player awards', h => [h.fullAwards?.mip?.playerId]);
  awardRec('scoring', 'Most scoring titles', h => [h.fullAwards?.scoringChamp?.playerId]);
  const ageAt = (playerId: string, season: string) => rows.find(r => r.playerId === playerId && r.season === season)?.age;
  const mvpAges = history.filter(h => h.mvpPlayerId).map(h => ({ age: ageAt(h.mvpPlayerId!, h.season), h })).filter(x => x.age != null);
  add('Awards', 'Players', 'award:youngMvp', 'Youngest MVP', 'int', top(mvpAges.map(x => ({ value: x.age!, entry: { playerId: x.h.mvpPlayerId!, season: x.h.season } })), true), undefined, true);
  add('Awards', 'Players', 'award:oldMvp', 'Oldest MVP', 'int', top(mvpAges.map(x => ({ value: x.age!, entry: { playerId: x.h.mvpPlayerId!, season: x.h.season } }))));
  const teamTally = (pick: (h: typeof history[number]) => (string | null | undefined)[]) => {
    const m = new Map<string, number>();
    for (const h of history) for (const id of pick(h)) if (id) m.set(id, (m.get(id) ?? 0) + 1);
    return [...m].map(([id, n]) => ({ value: n, entry: { teamId: id, season: 'All-time' } }));
  };
  add('Awards', 'Teams', 'award:titles', 'Most championships (team)', 'int', top(teamTally(h => [h.championTeamId])));
  add('Awards', 'Teams', 'award:finals', 'Most Finals appearances', 'int', top(teamTally(h => (h.teamSeasons ?? []).filter(t => t.playoffFinish === 'Champion' || t.playoffFinish === 'Finals').map(t => t.teamId))));
  add('Awards', 'Teams', 'award:playoffs', 'Most playoff appearances', 'int', top(teamTally(h => (h.teamSeasons ?? []).filter(t => t.playoffFinish !== 'Missed Playoffs' && t.playoffFinish !== 'Play-In').map(t => t.teamId))));
  return out;
}

/** Archived team seasons plus the season in progress (so current-season marks count too). */
export function teamSeasonRows(league: League): (TeamSeasonSummary & { season: string; inProgress?: boolean })[] {
  const out: (TeamSeasonSummary & { season: string; inProgress?: boolean })[] = [];
  for (const h of league.franchiseHistory ?? []) for (const t of h.teamSeasons ?? []) out.push({ ...t, season: h.season });
  const ctx = regularSeasonContext(league);
  const archived = new Set((league.franchiseHistory ?? []).map(h => h.season));
  if (!archived.has(league.season ?? '')) for (const [teamId, t] of ctx.teams) if (t.games >= 10) {
    out.push({ season: league.season ?? '', teamId, teamName: league.teams.find(x => x.teamId === teamId)?.name ?? teamId, wins: t.wins, losses: t.losses,
      ppg: t.pts / t.games, oppPpg: t.opp.pts / t.games, ortg: t.ortg, drtg: t.drtg, pace: t.pace, tpmPg: t.tpm / t.games, apg: t.ast / t.games,
      rpg: (t.oreb + t.dreb) / t.games, spg: t.stl / t.games, bpg: t.blk / t.games, playoffFinish: 'Missed Playoffs', playoffWins: 0, playoffLosses: 0, roster: [], inProgress: true });
  }
  return out;
}
