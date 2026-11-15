import type { League, FranchiseHistoryRecord } from './league';
import type { SeasonAwards, AwardWinner, AwardBallotKey } from './awards';
import type { PlayerSeason, SeasonStatTotals } from './types';
import { emptySeasonStatTotals } from './types';
import { TROPHIES, TROPHY_ORDER, type TrophyKey } from './trophies';
import { currentSeasonAdvanced } from './advancedStats';
import { calculateOverall } from './engine/overall';
import { isRookieEligible } from './rookieEligibility';
import { primaryPosition } from './teamStatus';

export const AWARD_METRICS = {
  ppg: 'Points / game', rpg: 'Rebounds / game', apg: 'Assists / game', spg: 'Steals / game', bpg: 'Blocks / game',
  tovPg: 'Turnovers / game', mpg: 'Minutes / game', tpmPg: 'Threes / game', orpg: 'Offensive rebounds / game',
  points: 'Total points', reb: 'Total rebounds', ast: 'Total assists', stl: 'Total steals', blk: 'Total blocks',
  tov: 'Total turnovers', tpm: 'Total threes', minutes: 'Total minutes', gamesPlayed: 'Games played',
  fgPct: 'Field goal %', tpPct: 'Three-point %', ftPct: 'Free throw %', tsPct: 'True shooting %', efgPct: 'Effective FG %',
  ws: 'Win Shares', ows: 'Offensive Win Shares', dws: 'Defensive Win Shares', ws48: 'Win Shares / 48', per: 'PER',
  ortg: 'Offensive rating', drtg: 'Defensive rating', usgPct: 'Usage %', clutchPoints: 'Clutch points',
  wins: 'Team wins', winPct: 'Team win %', margin: 'Team point differential', overall: 'Overall rating',
  improvement: 'Overall improvement', leadership: 'Leadership', defensiveIQ: 'Defensive IQ', age: 'Age',
} as const;
export type AwardMetric = keyof typeof AWARD_METRICS;
export interface AwardCondition { metric: AwardMetric; op: 'gte' | 'lte'; value: number }
export interface AwardDefinition {
  id: string; name: string; short: string; description: string; enabled: boolean;
  kind: 'player' | 'team'; method: 'default' | 'formula' | 'manual'; scope: 'season' | 'playoffs' | 'finals';
  weights: Partial<Record<AwardMetric, number>>; order: 'highest' | 'lowest'; winners: number;
  minGames: number; minGamesShare: number; rookiesOnly: boolean; benchOnly: boolean; positions: string[];
  conditions: AwardCondition[]; conditionMode: 'all' | 'any'; color: string; image?: string; prestige: number;
}
export interface StudioWinner extends AwardWinner { period?: string; coachName?: string }
export interface AwardStudioState {
  definitions: AwardDefinition[];
  history: Record<string, Record<string, StudioWinner[]>>;
}
export const MAX_AWARD_IMAGE_BYTES = 400_000;
const builtin = (id: string): id is TrophyKey => Object.hasOwn(TROPHIES, id);
const ballotIds = new Set(['mvp','dpoy','roy','mip','smoy','cpoy','hustle','teammate','scoringChamp','reboundingChamp','assistsChamp','stealsChamp','blocksChamp','playerOfTheMonth','sharpshooter','floorGeneral','paintScorer','ironMan','rookieDefender']);
const field = (id: string) => id === 'pom' ? 'playerOfTheMonth' : id;
const selection = (id: string): ['allNBA' | 'allDefense' | 'allRookie', number] | null => {
  const m = /^(allLeague|allDefense|allRookie)([123])$/.exec(id);
  return m ? [m[1] === 'allLeague' ? 'allNBA' : m[1] as 'allDefense' | 'allRookie', Number(m[2]) - 1] : null;
};
const historyField: Partial<Record<TrophyKey, keyof FranchiseHistoryRecord>> = {
  fmvp: 'fmvpPlayerId', allStarMvp: 'allStarGameMVPPlayerId', risingStarsMvp: 'risingStarsMVPPlayerId',
  threePoint: 'threePointChampionId', dunk: 'dunkChampionId',
};
const defaults: Partial<Record<TrophyKey, Partial<Record<AwardMetric, number>>>> = {
  mvp: { ppg: 1, apg: 1.5, rpg: 1.2, spg: 1.5, bpg: 1.5, tovPg: -.5, winPct: 10, ws: 1.2 },
  dpoy: { spg: 3, bpg: 3, rpg: .3, defensiveIQ: .1, dws: 1.8 }, roy: { ppg: 1, apg: 1, rpg: 1, ws: .8 },
  scoringChamp: { ppg: 1 }, reboundingChamp: { rpg: 1 }, assistsChamp: { apg: 1 }, stealsChamp: { spg: 1 }, blocksChamp: { bpg: 1 },
  mip: { improvement: 1 }, cpoy: { clutchPoints: 1 }, coy: { wins: 1 }, eoy: { wins: 1 }, champion: { wins: 1 },
  hustle: { spg: 3, bpg: 3, orpg: 2.5 }, teammate: { apg: 2, tovPg: -1.5, leadership: .04 },
  sharpshooter: { tpmPg: 1, tpPct: 1 }, floorGeneral: { apg: 2, tovPg: -1 }, paintScorer: { points: 1, tpm: -3 },
  ironMan: { minutes: 1, gamesPlayed: 12 },
};
export function defaultAward(id: string): AwardDefinition {
  const t = builtin(id) ? TROPHIES[id] : null;
  return { id, name: t?.label ?? 'New Award', short: t?.short ?? 'Award', description: '', enabled: true,
    kind: ['champion', 'coy', 'eoy', 'cup'].includes(id) ? 'team' : 'player', method: t ? 'default' : 'formula',
    scope: id === 'fmvp' ? 'finals' : 'season', weights: { ...(defaults[id as TrophyKey] ?? { ppg: 1, apg: 1, rpg: 1 }) },
    order: 'highest', winners: selection(id) || id === 'allCup' ? 5 : id === 'allStar' ? 24 : 1,
    minGames: 0, minGamesShare: 0, rookiesOnly: /Rookie|rookie|^roy$/.test(id), benchOnly: id === 'smoy', positions: [],
    conditions: [], conditionMode: 'all', color: '#e9b949', prestige: t?.prestige ?? 1 };
}
export function awardDefinitions(league: League): AwardDefinition[] {
  const saved = new Map((league.awardStudio?.definitions ?? []).map(d => [d.id, d]));
  return [...TROPHY_ORDER.map(id => saved.get(id) ?? defaultAward(id)), ...[...saved.values()].filter(d => !builtin(d.id))];
}
export function awardDefinition(league: League | null | undefined, id: string): AwardDefinition {
  return league?.awardStudio?.definitions.find(d => d.id === id) ?? defaultAward(id);
}
/** Imported NBA history uses a few older labels than the trophy catalog. */
export function awardIdFromLabel(label: string): string | undefined {
  const name = label.replace(/^Unanimous /, '').replace(/ \(.*\)$/, '');
  if (name === 'NBA Champion') return 'champion';
  const team = /^All-NBA ([123])/.exec(name);
  if (team) return `allLeague${team[1]}`;
  return TROPHY_ORDER.find(id => TROPHIES[id].label === name || TROPHIES[id].short === name);
}
const finite = (n: unknown, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const bounded = (n: unknown, min: number, max: number, fallback = 0) => Math.max(min, Math.min(max, finite(n, fallback)));
export function validateAwardImage(image: unknown): string | undefined {
  if (image == null || image === '') return undefined;
  if (typeof image !== 'string' || image.length > MAX_AWARD_IMAGE_BYTES * 1.4 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)) {
    throw new Error('Award artwork must be a PNG, JPEG or WebP image smaller than 400 KB.');
  }
  return image;
}
export function normalizeAward(raw: unknown): AwardDefinition {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid award definition.');
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(r.id) || ['constructor', 'prototype', '__proto__'].includes(r.id)) throw new Error('Invalid award ID.');
  const d = defaultAward(r.id);
  const str = (value: unknown, max: number, fallback = '') => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
  const name = str(r.name, 100); if (!name) throw new Error('Give the award a name.');
  const weights: AwardDefinition['weights'] = {};
  if (r.weights && typeof r.weights === 'object') for (const k of Object.keys(AWARD_METRICS) as AwardMetric[]) {
    if (Object.hasOwn(r.weights, k)) weights[k] = bounded((r.weights as Record<string, unknown>)[k], -10000, 10000);
  }
  const conditions: AwardCondition[] = Array.isArray(r.conditions) ? r.conditions.slice(0, 30).flatMap(c => c && Object.hasOwn(AWARD_METRICS, c.metric) && ['gte', 'lte'].includes(c.op)
    ? [{ metric: c.metric as AwardMetric, op: c.op as AwardCondition['op'], value: bounded(c.value, -1e9, 1e9) }] : []) : [];
  return { ...d, name, short: str(r.short, 30, name) || name, description: str(r.description, 1000), enabled: r.enabled !== false,
    kind: r.kind === 'team' ? 'team' : 'player', method: r.method === 'manual' ? 'manual' : r.method === 'default' && builtin(d.id) ? 'default' : 'formula',
    scope: r.scope === 'playoffs' || r.scope === 'finals' ? r.scope : 'season', weights,
    order: r.order === 'lowest' ? 'lowest' : 'highest', winners: Math.round(bounded(r.winners, 1, 100, d.winners)),
    minGames: Math.round(bounded(r.minGames, 0, 1000)), minGamesShare: bounded(r.minGamesShare, 0, 1),
    rookiesOnly: r.rookiesOnly === true, benchOnly: r.benchOnly === true,
    positions: Array.isArray(r.positions) ? r.positions.filter((p): p is string => typeof p === 'string' && ['PG', 'SG', 'SF', 'PF', 'C'].includes(p)) : [],
    conditions, conditionMode: r.conditionMode === 'any' ? 'any' : 'all',
    color: typeof r.color === 'string' && /^#[\da-f]{6}$/i.test(r.color) ? r.color : d.color,
    image: validateAwardImage(r.image), prestige: bounded(r.prestige, 0, 1000, d.prestige) };
}
export function saveAwardDefinition(league: League, definition: AwardDefinition): League {
  if (!league.settings.sandboxMode) throw new Error('Enable Sandbox to edit awards.');
  const d = normalizeAward(definition);
  return { ...league, awardStudio: { history: league.awardStudio?.history ?? {}, definitions: [...(league.awardStudio?.definitions ?? []).filter(x => x.id !== d.id), d] } };
}
export function resetAwardDefinition(league: League, id: string): League {
  if (!league.settings.sandboxMode) throw new Error('Enable Sandbox to edit awards.');
  const definitions = (league.awardStudio?.definitions ?? []).filter(d => d.id !== id);
  if (builtin(id)) return { ...league, awardStudio: { history: league.awardStudio?.history ?? {}, definitions } };
  const omit = <T,>(data: Record<string,T> = {}) => Object.fromEntries(Object.entries(data).filter(([key]) => key !== id));
  return { ...league, awardStudio: { definitions, history: Object.fromEntries(Object.entries(league.awardStudio?.history ?? {}).map(([year,awards]) => [year,omit(awards)])) },
    franchiseHistory: league.franchiseHistory?.map(rec => rec.fullAwards ? { ...rec, fullAwards: { ...rec.fullAwards, custom: omit(rec.fullAwards.custom) } } : rec) };
}
function scopedLeague(league: League, scope: AwardDefinition['scope']): League {
  if (scope === 'season') return league;
  const series = scope === 'finals' ? league.playoffBracket?.rounds.at(-1) ?? [] : league.playoffBracket?.rounds.flat() ?? [];
  return awardLeagueForGames50(league, series.flatMap(s => s.games));
}
export function awardLeagueForGames50(league: League, games: import('./boxscore').GameResult[]): League {
  const totals = new Map<string, SeasonStatTotals>();
  for (const game of games) for (const box of [game.homeBox, game.awayBox]) for (const line of Object.values(box.players)) {
    if (line.minutes <= 0) continue;
    const t = totals.get(line.playerId) ?? emptySeasonStatTotals();
    for (const key of Object.keys(t) as (keyof SeasonStatTotals)[]) if (key !== 'gamesPlayed') t[key] += finite((line as unknown as Record<string, unknown>)[key]);
    t.gamesPlayed++; totals.set(line.playerId, t);
  }
  return { ...league, teams: league.teams.map(t => ({ ...t, seasons: t.seasons.map(p => ({ ...p, seasonStats: totals.get(p.playerId) ?? emptySeasonStatTotals(), seasonStints: [] })) })),
    schedule: games.map((result, i) => ({ id: `award-${i}`, round: i, homeTeamId: result.homeTeamId, awayTeamId: result.awayTeamId, played: true, result })) };
}
export function awardCandidates(league: League, definition: AwardDefinition): { winner: StudioWinner; metrics: Record<AwardMetric, number>; player?: PlayerSeason }[] {
  const l = scopedLeague(league, definition.scope), advanced = currentSeasonAdvanced(l);
  const teamStats = new Map(l.teams.map(t => [t.teamId, { wins: 0, games: 0, margin: 0 }]));
  for (const g of l.schedule) if (g.played && g.result) for (const home of [true, false]) {
    const row = teamStats.get(home ? g.homeTeamId : g.awayTeamId); if (!row) continue;
    const margin = (g.result.homeScore - g.result.awayScore) * (home ? 1 : -1); row.games++; row.wins += Number(margin > 0); row.margin += margin;
  }
  const output: ReturnType<typeof awardCandidates> = [];
  for (const team of l.teams) {
    const t = teamStats.get(team.teamId)!;
    const starters = team.rotationOrder?.slice(0, 5) ?? [...team.seasons].sort((a, b) => b.minutes.target - a.minutes.target).slice(0, 5).map(p => p.playerId);
    for (const p of team.seasons) {
      const s = p.seasonStats ?? emptySeasonStatTotals(), gp = s.gamesPlayed, adv = advanced.get(p.playerId);
      const pg = (v: number) => gp > 0 ? v / gp : 0;
      const metrics = Object.fromEntries(Object.keys(AWARD_METRICS).map(k => [k, 0])) as Record<AwardMetric, number>;
      Object.assign(metrics, s, { ppg: pg(s.points), rpg: pg(s.oreb + s.dreb), apg: pg(s.ast), spg: pg(s.stl), bpg: pg(s.blk),
        tovPg: pg(s.tov), mpg: pg(s.minutes), tpmPg: pg(s.tpm), orpg: pg(s.oreb), reb: s.oreb + s.dreb,
        fgPct: s.fga ? s.fgm / s.fga * 100 : 0, tpPct: s.tpa ? s.tpm / s.tpa * 100 : 0, ftPct: s.fta ? s.ftm / s.fta * 100 : 0,
        ...adv, tsPct: finite(adv?.tsPct) * 100, efgPct: finite(adv?.efgPct) * 100,
        wins: t.wins, winPct: t.games ? t.wins / t.games : 0, margin: t.games ? t.margin / t.games : 0,
        overall: calculateOverall(p), improvement: calculateOverall(p) - (p.previousOverall ?? calculateOverall(p)),
        leadership: p.attributes.mental.leadership, defensiveIQ: p.attributes.defense.defensiveIQ, age: p.age });
      for (const k of Object.keys(metrics) as AwardMetric[]) metrics[k] = finite(metrics[k]);
      if (gp < Math.max(definition.minGames, Math.ceil(t.games * definition.minGamesShare)) || !gp) continue;
      if (definition.rookiesOnly && !isRookieEligible(p)) continue;
      if (definition.benchOnly && (p.rotationRole === 'starter' || (p.rotationRole !== 'bench' && starters.includes(p.playerId)))) continue;
      if (definition.positions.length && !definition.positions.includes(primaryPosition(p))) continue;
      output.push({ winner: { playerId: p.playerId, teamId: team.teamId, teamName: team.name, score: 0 }, metrics, player: p });
    }
    if (definition.kind === 'team' && t.games >= Math.max(1, definition.minGames)) {
      const rows = output.filter(x => x.winner.teamId === team.teamId);
      const metrics = Object.fromEntries(Object.keys(AWARD_METRICS).map(k => [k, rows.length ? rows.reduce((n, r) => n + r.metrics[k as AwardMetric], 0) / (['points','reb','ast','stl','blk','tov','tpm','minutes','ws','ows','dws','ppg','rpg','apg','spg','bpg','tovPg','tpmPg','orpg'].includes(k) ? 1 : rows.length) : 0])) as Record<AwardMetric, number>;
      const sum = (k: keyof SeasonStatTotals) => team.seasons.reduce((n,p)=>n+(p.seasonStats?.[k] ?? 0),0);
      const fga=sum('fga'),fta=sum('fta'),tpa=sum('tpa');
      Object.assign(metrics, { wins: t.wins, gamesPlayed: t.games, winPct: t.wins / t.games, margin: t.margin / t.games, fgPct:fga?sum('fgm')/fga*100:0, tpPct:tpa?sum('tpm')/tpa*100:0, ftPct:fta?sum('ftm')/fta*100:0, tsPct:fga+.44*fta?sum('points')/(2*(fga+.44*fta))*100:0, efgPct:fga?(sum('fgm')+.5*sum('tpm'))/fga*100:0 });
      output.push({ winner: { playerId: team.teamId, teamId: team.teamId, teamName: team.name, coachName: team.coachIdentity?.coachId, score: 0 }, metrics });
    }
  }
  return output.filter(x => definition.kind === 'team' ? !x.player : !!x.player);
}
export function rankAward(league: League, d: AwardDefinition): StudioWinner[] {
  if (!d.enabled || d.method === 'manual') return [];
  return awardCandidates(league, d).filter(({ metrics }) => {
    const matches = d.conditions.map(c => c.op === 'gte' ? metrics[c.metric] >= c.value : metrics[c.metric] <= c.value);
    return !matches.length || (d.conditionMode === 'all' ? matches.every(Boolean) : matches.some(Boolean));
  }).map(({ winner, metrics }) => ({ ...winner, score: Object.entries(d.weights).reduce((n, [k, w]) => n + metrics[k as AwardMetric] * (w ?? 0), 0) }))
    .sort((a, b) => (d.order === 'lowest' ? a.score - b.score : b.score - a.score) || a.playerId.localeCompare(b.playerId));
}
export function readAwardWinners(id: string, awards?: SeasonAwards | null, record?: FranchiseHistoryRecord | null): StudioWinner[] {
  if (awards?.custom && Object.hasOwn(awards.custom, id)) return awards.custom[id];
  const sel = selection(id); if (sel) return awards?.[sel[0]]?.[sel[1]] ?? [];
  if (id === 'allStar') return awards?.allStars ?? [];
  if (id === 'pow' || id === 'pom') return (awards?.honors ?? []).filter(h => h.kind === (id === 'pow' ? 'week' : 'month')).map(h => ({ playerId: h.playerId, teamId: h.teamId, teamName: h.teamName, score: 0, period: h.label }));
  if (id === 'champion') return record?.championTeamId ? [{ playerId: record.championTeamId, teamId: record.championTeamId, teamName: record.championTeamName ?? record.championTeamId, score: 0 }] : [];
  const key = historyField[id as TrophyKey];
  if (key) { const playerId = record?.[key]; return typeof playerId === 'string' && playerId ? [{ playerId, teamId: null, teamName: '', score: 0 }] : []; }
  if (id === 'cup') return record?.cup?.championTeamId ? [{ playerId: record.cup.championTeamId, teamId: record.cup.championTeamId, teamName: record.cup.championTeamId, score: 0 }] : [];
  if (id === 'cupMvp') { const w = record?.cup?.mvpId; return w ? [{ playerId: w, teamId: null, teamName: '', score: 0 }] : []; }
  if (id === 'allCup') return record?.cup?.allCup?.map(w => ({ playerId: w, teamId: null, teamName: '', score: 0 })) ?? [];
  const w = awards?.[field(id) as keyof SeasonAwards];
  if (!w || typeof w !== 'object' || Array.isArray(w)) return [];
  if ('playerId' in w) return [w as AwardWinner, ...(awards?.coWinners?.[field(id) as AwardBallotKey] ?? [])];
  if ('teamId' in w) return [{ ...w, playerId: w.teamId } as StudioWinner];
  return [];
}
function writeWinners(awards: SeasonAwards, id: string, winners: StudioWinner[]): SeasonAwards {
  const out: SeasonAwards = { ...awards, custom: { ...awards.custom, [id]: winners }, ballots: { ...awards.ballots }, coWinners: { ...awards.coWinners }, votes: { ...awards.votes } };
  const sel = selection(id);
  if (sel) { const teams = [...out[sel[0]]]; teams[sel[1]] = winners; out[sel[0]] = teams; delete out.votes?.[sel[0]]; }
  else if (id === 'allStar') out.allStars = winners.map((w, i) => ({ ...w, starter: i < 10 }));
  else if (id === 'pow' || id === 'pom') out.honors = [...(out.honors ?? []).filter(h => h.kind !== (id === 'pow' ? 'week' : 'month')), ...winners.map((w, i) => ({ kind: (id === 'pow' ? 'week' : 'month') as 'week' | 'month', label: w.period ?? `${id === 'pow' ? 'Week' : 'Month'} ${i + 1}`, playerId: w.playerId, teamId: w.teamId ?? '', teamName: w.teamName, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, score: 0, gp: 0, round: i, conference: null, w: 0, l: 0, start: '', end: '' }))];
  else if (id === 'coy' || id === 'eoy') { out[id] = winners[0] ? { ...winners[0], teamId: winners[0].teamId ?? winners[0].playerId } : null; delete out.votes?.[id]; }
  else if (ballotIds.has(field(id))) {
    (out as unknown as Record<string, unknown>)[field(id)] = winners[0] ?? null;
    out.ballots[field(id) as AwardBallotKey] = winners;
    out.coWinners![field(id) as AwardBallotKey] = winners.slice(1);
    delete (out.votes as Record<string, unknown>)[field(id)];
  }
  return out;
}
export function applyAwardStudio<T extends SeasonAwards>(league: League, awards: T): T {
  if (!league.awardStudio) return awards;
  let out: SeasonAwards = awards;
  for (const d of awardDefinitions(league)) {
    if (d.enabled && d.method === 'default') continue;
    let winners = d.enabled && d.method === 'formula' ? ['pom','pow'].includes(d.id) ? readAwardWinners(d.id, awards) : rankAward(league, d) : [];
    const sel = selection(d.id);
    if (sel) { const used = new Set(out[sel[0]].slice(0, sel[1]).flat().map(w => w.playerId)); winners = winners.filter(w => !used.has(w.playerId)); }
    out = writeWinners(out, d.id, ['pom','pow'].includes(d.id) ? winners : winners.slice(0, d.winners));
  }
  for (const [id, winners] of Object.entries(league.awardStudio.history[league.season ?? ''] ?? {})) out = writeWinners(out, id, winners);
  return out as T;
}
export function emptyAwards(): SeasonAwards {
  return { mvp: null, dpoy: null, roy: null, mip: null, smoy: null, coy: null, cpoy: null, hustle: null, teammate: null,
    scoringChamp: null, reboundingChamp: null, assistsChamp: null, stealsChamp: null, blocksChamp: null, playerOfTheMonth: null,
    allNBA: [[], [], []], allDefense: [[], []], allRookie: [[], []], allStars: [], ballots: {}, minGamesRequired: 0 };
}
export function syncAwardRecord(record: FranchiseHistoryRecord, awards: SeasonAwards): FranchiseHistoryRecord {
  const out = { ...record, fullAwards: awards, mvpPlayerId: awards.mvp?.playerId ?? null, mvpTeamName: awards.mvp?.teamName ?? null,
    dpoyPlayerId: awards.dpoy?.playerId ?? null, royPlayerId: awards.roy?.playerId ?? null };
  for (const [id, entries] of Object.entries(awards.custom ?? {})) {
    const key = historyField[id as TrophyKey]; if (key) (out as unknown as Record<string, unknown>)[key] = entries[0]?.playerId ?? null;
    if (id === 'champion') { out.championTeamId = entries[0]?.teamId ?? null; out.championTeamName = entries[0]?.teamName ?? null;
      out.championPlayerIds = out.teamSeasons?.find(t => t.teamId === out.championTeamId)?.roster.map(p => p.playerId);
      if (out.bracket) out.bracket = { ...out.bracket, championTeamId: out.championTeamId };
    }
    if (['cup','cupMvp','allCup'].includes(id)) {
      out.cup = { championTeamId: null, runnerUpTeamId: null, mvpId: null, allCup: [], qualifiers: [], ...out.cup };
      if (id === 'cup') { out.cup.championTeamId = entries[0]?.teamId ?? null; out.cup.championPlayerIds = out.teamSeasons?.find(t => t.teamId === out.cup!.championTeamId)?.roster.map(p => p.playerId); }
      if (id === 'cupMvp') out.cup.mvpId = entries[0]?.playerId ?? null;
      if (id === 'allCup') out.cup.allCup = entries.map(w => w.playerId);
    }
  }
  return out;
}
export function editAwardHistory(league: League, season: string, id: string, entries: StudioWinner[]): League {
  if (!league.settings.sandboxMode) throw new Error('Enable Sandbox to edit award history.');
  if (!season.trim() || season.length > 40) throw new Error('Enter a valid season.');
  const definition = awardDefinition(league, id);
  const seen = new Set<string>();
  const winners = entries.filter(w => { const key = `${w.playerId}|${w.period ?? ''}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .map(w => ({ playerId: String(w.playerId).slice(0, 200), teamId: w.teamId ? String(w.teamId).slice(0, 200) : null,
      teamName: String(w.teamName ?? '').slice(0, 200), score: finite(w.score), ...(w.period ? { period: w.period.slice(0, 100) } : {}), ...(w.coachName ? { coachName: w.coachName.slice(0, 200) } : {}) }));
  if (winners.some(w => !w.playerId)) throw new Error('Every winner needs a player or team.');
  const history = { ...league.awardStudio?.history, [season]: { ...league.awardStudio?.history[season], [id]: winners } };
  let records = [...(league.franchiseHistory ?? [])];
  let record = records.find(r => r.season === season);
  if (!record && season !== league.season) record = { season, championTeamId: null, championTeamName: null, mvpPlayerId: null, mvpTeamName: null, dpoyPlayerId: null, royPlayerId: null, fmvpPlayerId: null };
  if (record) {
    const base = record.fullAwards ?? { ...emptyAwards(), ...Object.fromEntries((['mvp','dpoy','roy'] as const).map(key => [key, record[`${key}PlayerId`] ? { playerId: record[`${key}PlayerId`]!, teamId: null, teamName: key === 'mvp' ? record.mvpTeamName ?? '' : '', score: 0 } : null])) };
    const next = syncAwardRecord(record, writeWinners(base, id, winners));
    records = records.some(r => r.season === season) ? records.map(r => r.season === season ? next : r) : [...records, next].sort((a, b) => a.season.localeCompare(b.season, undefined, { numeric: true }));
  }
  // Imported historical honors also live on the player. Replace that award/year instead of retaining stale winners.
  const label = builtin(id) ? TROPHIES[id].label : definition.name;
  const patchPlayer = (p: PlayerSeason): PlayerSeason => {
    const matches = (a: {season:string;label:string}) => a.season === season && (awardIdFromLabel(a.label) === id || a.label === label || a.label === definition.name);
    if (!p.historicalAwards?.some(matches)) return p;
    return { ...p, historicalAwards: p.historicalAwards.filter(a => !matches(a)) };
  };
  return { ...league, teams: league.teams.map(t => ({ ...t, seasons: t.seasons.map(patchPlayer) })),
    retiredPlayers: league.retiredPlayers?.map(r => ({ ...r, ...(r.finalSeasonData ? { finalSeasonData: patchPlayer(r.finalSeasonData), keepData: true } : {}) })),
    franchiseHistory: records, awardStudio: { definitions: league.awardStudio?.definitions ?? [], history } };
}
export interface AwardPack { format: 'courtvision-awards'; version: 1; definitions: AwardDefinition[] }
export function exportAwardPack(league: League, ids?: string[]): AwardPack {
  return { format: 'courtvision-awards', version: 1, definitions: awardDefinitions(league).filter(d => !ids || ids.includes(d.id)).map(normalizeAward) };
}
export function parseAwardPack(text: string): AwardPack {
  if (text.length > 25_000_000) throw new Error('Award packs must be under 25 MB.');
  const data = JSON.parse(text);
  if (data?.format !== 'courtvision-awards' || data.version !== 1 || !Array.isArray(data.definitions) || data.definitions.length > 150) throw new Error('Choose a CourtVision award export (version 1, up to 150 awards).');
  const definitions = data.definitions.map(normalizeAward);
  if (new Set(definitions.map((d: AwardDefinition) => d.id)).size !== definitions.length) throw new Error('This pack has duplicate award IDs.');
  return { format: 'courtvision-awards', version: 1, definitions };
}
export function importAwardPack(league: League, pack: AwardPack, replace: boolean): League {
  if (!league.settings.sandboxMode) throw new Error('Enable Sandbox to import awards.');
  const parsed = parseAwardPack(JSON.stringify(pack));
  let out = league;
  for (const d of parsed.definitions) {
    const exists = builtin(d.id) || out.awardStudio?.definitions.some(x => x.id === d.id);
    out = saveAwardDefinition(out, exists && !replace ? { ...d, id: `award_${crypto.randomUUID()}`, method: d.method === 'default' ? 'formula' : d.method } : d);
  }
  return out;
}
