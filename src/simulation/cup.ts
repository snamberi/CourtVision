import type { League, ScheduledGame } from './league';
import { hasConferenceStructure, teamGameInput } from './league';
import type { PlayerStatLine, TeamBoxScore } from './boxscore';
import { simulateGame } from './engine/game';
import { RNG } from './engine/rng';
import { calculateOverall } from './engine/overall';

/* The In-Season Cup, run inside the regular season like the NBA's:
 *  - Group stage: teams are drawn into groups of about five (within their conference when there is one). One early
 *    regular-season meeting between every pair in a group also counts as a Cup game, so the schedule, standings and
 *    season stats are untouched.
 *  - Knockouts: the night the last group game is played, the group winners plus wildcards (eight teams) play
 *    quarterfinals, semifinals and a final. These are extra games: they don't count in the standings or season
 *    stats, and nobody is injured in them.
 *  - Honors: champion, Cup MVP and an All-Cup team, archived with the season. */

export interface CupGroup { id: string; name: string; conference: 'east' | 'west' | null; teamIds: string[] }
export type CupStage = 'qf' | 'sf' | 'final';
export interface CupGame {
  id: string; stage: CupStage; slot: number; homeTeamId: string; awayTeamId: string;
  homeScore: number; awayScore: number; winnerTeamId: string; homeBox: TeamBoxScore; awayBox: TeamBoxScore;
}
export interface CupState {
  season: string;
  groups: CupGroup[];
  /** Set the night the group stage ends. */
  qualifiers?: string[];
  knockout?: CupGame[];
  championTeamId: string | null;
  runnerUpTeamId: string | null;
  mvpId: string | null;
  allCup: string[];
  /** The champion's roster the night they won, for players' trophy shelves. */
  championPlayerIds?: string[];
}
export interface CupArchive { championTeamId: string | null; runnerUpTeamId: string | null; mvpId: string | null; allCup: string[]; qualifiers: string[]; championPlayerIds?: string[] }

export const CUP_NAME = 'In-Season Cup';
const MIN_TEAMS = 8;

function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

const strength = (league: League, teamId: string) => {
  const t = league.teams.find(x => x.teamId === teamId);
  return t ? t.seasons.map(calculateOverall).sort((a, b) => b - a).slice(0, 8).reduce((n, v) => n + v, 0) : 0;
};

/** Pots by roster strength, then a seeded draw: every group gets one team from each pot, like the real draw. */
function drawGroups(league: League, teamIds: string[], count: number, conference: CupGroup['conference'], prefix: string, rng: RNG): CupGroup[] {
  const sorted = [...teamIds].sort((a, b) => strength(league, b) - strength(league, a) || a.localeCompare(b));
  const groups: CupGroup[] = Array.from({ length: count }, (_, i) => ({ id: `${prefix}${String.fromCharCode(65 + i)}`, name: `${conference ? `${conference === 'east' ? 'East' : 'West'} ` : ''}Group ${String.fromCharCode(65 + i)}`, conference, teamIds: [] }));
  for (let p = 0; p < sorted.length; p += count) {
    const pot = sorted.slice(p, p + count);
    for (let i = pot.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [pot[i], pot[j]] = [pot[j], pot[i]]; }
    pot.forEach((id, i) => groups[i].teamIds.push(id));
  }
  return groups;
}

/** Draws this season's groups and marks their group games in the schedule. Once per season, before the window passes. */
export function setupCup(league: League): League {
  if (!league.season || league.cup?.season === league.season || league.teams.length < MIN_TEAMS || !league.schedule.length) return league;
  if ((league.seasonPhase ?? 'regular_season') !== 'regular_season') return league;
  const rounds = league.schedule.map(g => g.round);
  const maxRound = Math.max(...rounds);
  const windowStart = Math.floor(maxRound * 0.08), windowEnd = Math.ceil(maxRound * 0.42);
  const firstUnplayed = league.schedule.find(g => !g.played)?.round ?? Infinity;
  if (firstUnplayed > windowEnd - 3) return league; // the season is too far along: the Cup starts next season
  const rng = new RNG(hash(`cup:${league.season}`));
  let groups: CupGroup[];
  if (hasConferenceStructure(league)) {
    groups = (['east', 'west'] as const).flatMap(conf => {
      const ids = league.teams.filter(t => t.conferenceId === conf).map(t => t.teamId);
      return ids.length >= 4 ? drawGroups(league, ids, Math.max(1, Math.round(ids.length / 5)), conf, conf[0].toUpperCase(), rng) : [];
    });
  } else {
    groups = drawGroups(league, league.teams.map(t => t.teamId), Math.max(2, Math.round(league.teams.length / 5)), null, 'G', rng);
  }
  const schedule: ScheduledGame[] = league.schedule.map(g => g.cupGroupId ? { ...g, cupGroupId: undefined } : g);
  const lo = Math.max(windowStart, firstUnplayed);
  // An 82-game schedule has every group pairing inside the window (about November). Shorter seasons look a little
  // further ahead; a pairing that still doesn't meet simply plays one fewer group game (tables use win percentage).
  for (const hi of [windowEnd, Math.ceil(maxRound * 0.7)]) {
    for (const group of groups) {
      for (let i = 0; i < group.teamIds.length; i++) for (let j = i + 1; j < group.teamIds.length; j++) {
        const a = group.teamIds[i], b = group.teamIds[j];
        const meets = (g: ScheduledGame) => (g.homeTeamId === a && g.awayTeamId === b) || (g.homeTeamId === b && g.awayTeamId === a);
        if (schedule.some(g => g.cupGroupId === group.id && meets(g))) continue;
        const idx = schedule.findIndex(g => !g.played && g.round >= lo && g.round <= hi && !g.cupGroupId && meets(g));
        if (idx >= 0) schedule[idx] = { ...schedule[idx], cupGroupId: group.id };
      }
    }
  }
  if (!schedule.some(g => g.cupGroupId)) return league;
  return { ...league, schedule, cup: { season: league.season, groups, championTeamId: null, runnerUpTeamId: null, mvpId: null, allCup: [] } };
}

export interface CupRow { teamId: string; w: number; l: number; pf: number; pa: number; played: number; remaining: number }

export function cupGroupTable(league: League, group: CupGroup): CupRow[] {
  const rows = new Map<string, CupRow>(group.teamIds.map(id => [id, { teamId: id, w: 0, l: 0, pf: 0, pa: 0, played: 0, remaining: 0 }]));
  for (const g of league.schedule) {
    if (g.cupGroupId !== group.id) continue;
    const home = rows.get(g.homeTeamId), away = rows.get(g.awayTeamId);
    if (!home || !away) continue;
    if (!g.played || !g.result) { home.remaining++; away.remaining++; continue; }
    const hs = g.result.homeScore, as = g.result.awayScore;
    home.played++; away.played++;
    home.pf += hs; home.pa += as; away.pf += as; away.pa += hs;
    if (hs > as) { home.w++; away.l++; } else { away.w++; home.l++; }
  }
  const pct = (r: CupRow) => r.played ? r.w / r.played : 0;
  return [...rows.values()].sort((a, b) => pct(b) - pct(a) || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || a.teamId.localeCompare(b.teamId));
}

export function cupGroupStageComplete(league: League): boolean {
  const games = league.schedule.filter(g => g.cupGroupId);
  return games.length > 0 && games.every(g => g.played);
}
export const cupGroupGamesLeft = (league: League) => league.schedule.filter(g => g.cupGroupId && !g.played).length;

/** Group winners, then the best runners-up (one per conference when there are conferences) to make eight. */
export function cupQualifiers(league: League, cup: CupState): { teamId: string; conference: CupGroup['conference']; winner: boolean }[] {
  const tables = cup.groups.map(g => ({ g, rows: cupGroupTable(league, g) }));
  const score = (r: CupRow) => (r.played ? r.w / r.played : 0) * 1000 + (r.pf - r.pa) / 100;
  const winners = tables.map(t => ({ teamId: t.rows[0].teamId, conference: t.g.conference, winner: true, s: score(t.rows[0]) }));
  const rest = tables.flatMap(t => t.rows.slice(1).map(r => ({ teamId: r.teamId, conference: t.g.conference, winner: false, s: score(r) }))).sort((a, b) => b.s - a.s);
  const picked = [...winners].sort((a, b) => b.s - a.s).slice(0, MIN_TEAMS);
  const confs = [...new Set(cup.groups.map(g => g.conference))];
  if (confs.length === 2 && confs.every(c => c)) {
    for (const c of confs) while (picked.filter(p => p.conference === c).length < MIN_TEAMS / 2) {
      const next = rest.find(r => r.conference === c && !picked.includes(r));
      if (!next) break; picked.push(next);
    }
  }
  for (const r of rest) { if (picked.length >= MIN_TEAMS) break; if (!picked.includes(r)) picked.push(r); }
  return picked.slice(0, MIN_TEAMS).sort((a, b) => b.s - a.s).map(({ teamId, conference, winner }) => ({ teamId, conference, winner }));
}

function play(league: League, stage: CupStage, slot: number, home: string, away: string, seed: number): CupGame {
  const r = simulateGame({
    home: teamGameInput(league, home), away: teamGameInput(league, away),
    settings: { ...league.settings, seed, injuriesEnabled: false }, rules: league.rulesSettings, moraleImpact: league.coachingSettings?.moraleImpact,
  });
  return { id: `cup-${stage}-${slot}`, stage, slot, homeTeamId: home, awayTeamId: away, homeScore: r.homeScore, awayScore: r.awayScore,
    winnerTeamId: r.homeScore > r.awayScore ? home : away, homeBox: r.homeBox, awayBox: r.awayBox };
}

/** Called after every completed game day: plays the knockouts the night the group stage finishes. */
export function advanceCup(league: League): League {
  const cup = league.cup;
  if (!cup || cup.knockout || cup.season !== league.season || !cupGroupStageComplete(league)) return league;
  const qualifiers = cupQualifiers(league, cup);
  if (qualifiers.length < 2) return league;
  const seed = hash(`cup-ko:${cup.season}`);
  const games: CupGame[] = [];
  // Brackets: by conference (1v4, 2v3, conference finals, then East vs West) when possible, else 1v8, 4v5, 2v7, 3v6.
  const byConf = (['east', 'west'] as const).map(c => qualifiers.filter(q => q.conference === c).map(q => q.teamId));
  let qfPairs: [string, string][];
  if (byConf.every(list => list.length === 4)) qfPairs = byConf.flatMap(s => [[s[0], s[3]], [s[1], s[2]]] as [string, string][]);
  else { const s = qualifiers.map(q => q.teamId); qfPairs = [[s[0], s[7]], [s[3], s[4]], [s[1], s[6]], [s[2], s[5]]].filter(p => p[0] && p[1]) as [string, string][]; }
  qfPairs.forEach(([a, b], i) => games.push(play(league, 'qf', i, a, b, seed + i)));
  const qfWinners = games.filter(g => g.stage === 'qf').map(g => g.winnerTeamId);
  const seedOf = (id: string) => qualifiers.findIndex(q => q.teamId === id);
  const higherFirst = (a: string, b: string): [string, string] => seedOf(a) <= seedOf(b) ? [a, b] : [b, a];
  const sfPairs: [string, string][] = [];
  for (let i = 0; i + 1 < qfWinners.length; i += 2) sfPairs.push(higherFirst(qfWinners[i], qfWinners[i + 1]));
  sfPairs.forEach(([a, b], i) => games.push(play(league, 'sf', i, a, b, seed + 10 + i)));
  const finalists = games.filter(g => g.stage === 'sf').map(g => g.winnerTeamId);
  let championTeamId: string | null = null, runnerUpTeamId: string | null = null;
  if (finalists.length === 2) {
    const [a, b] = higherFirst(finalists[0], finalists[1]);
    const f = play(league, 'final', 0, a, b, seed + 20);
    games.push(f);
    championTeamId = f.winnerTeamId; runnerUpTeamId = f.winnerTeamId === a ? b : a;
  }
  const { mvpId, allCup } = cupHonors({ ...league, cup: { ...cup, knockout: games } }, games, championTeamId);
  const championPlayerIds = league.teams.find(t => t.teamId === championTeamId)?.seasons.map(s => s.playerId) ?? [];
  return { ...league, cup: { ...cup, qualifiers: qualifiers.map(q => q.teamId), knockout: games, championTeamId, runnerUpTeamId, mvpId, allCup, championPlayerIds } };
}

export interface CupLine { playerId: string; teamId: string; gp: number; min: number; pts: number; reb: number; ast: number; stl: number; blk: number; fgm: number; fga: number }

/** Every player's Cup games: group games from the schedule plus the knockouts. */
export function cupLines(league: League, cup: CupState | undefined = league.cup): CupLine[] {
  const lines = new Map<string, CupLine>();
  const addBox = (box: TeamBoxScore) => {
    for (const s of Object.values(box.players) as PlayerStatLine[]) {
      if (s.minutes <= 0) continue;
      const l = lines.get(s.playerId) ?? { playerId: s.playerId, teamId: box.teamId, gp: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0 };
      l.gp++; l.min += s.minutes; l.pts += s.points; l.reb += s.oreb + s.dreb; l.ast += s.ast; l.stl += s.stl; l.blk += s.blk; l.fgm += s.fgm; l.fga += s.fga; l.teamId = box.teamId;
      lines.set(s.playerId, l);
    }
  };
  for (const g of league.schedule) if (g.cupGroupId && g.played && g.result) { addBox(g.result.homeBox); addBox(g.result.awayBox); }
  for (const g of cup?.knockout ?? []) { addBox(g.homeBox); addBox(g.awayBox); }
  return [...lines.values()];
}

const impact = (l: CupLine) => (l.pts + l.reb * 1.1 + l.ast * 1.4 + (l.stl + l.blk) * 1.8 - (l.fga - l.fgm) * 0.5) / Math.max(1, l.gp);

function cupHonors(league: League, knockout: CupGame[], championTeamId: string | null): { mvpId: string | null; allCup: string[] } {
  const lines = cupLines(league);
  // MVP: the champion's best player over the whole Cup, with the knockout games weighted double.
  const koLines = new Map<string, number>();
  for (const g of knockout) for (const box of [g.homeBox, g.awayBox]) for (const s of Object.values(box.players) as PlayerStatLine[]) {
    if (s.minutes > 0) koLines.set(s.playerId, (koLines.get(s.playerId) ?? 0) + s.points + (s.oreb + s.dreb) * 1.1 + s.ast * 1.4 + (s.stl + s.blk) * 1.8 - (s.fga - s.fgm) * 0.5);
  }
  const champs = lines.filter(l => l.teamId === championTeamId).sort((a, b) => (impact(b) + (koLines.get(b.playerId) ?? 0) / 3) - (impact(a) + (koLines.get(a.playerId) ?? 0) / 3) || a.playerId.localeCompare(b.playerId));
  const allCup = lines.filter(l => l.gp >= 3).sort((a, b) => impact(b) - impact(a) || a.playerId.localeCompare(b.playerId)).slice(0, 5).map(l => l.playerId);
  const mvpId = champs[0]?.playerId ?? null;
  return { mvpId, allCup: mvpId && !allCup.includes(mvpId) ? [mvpId, ...allCup.slice(0, 4)] : allCup };
}

export const cupArchive = (cup: CupState): CupArchive => ({ championTeamId: cup.championTeamId, runnerUpTeamId: cup.runnerUpTeamId, mvpId: cup.mvpId, allCup: cup.allCup, qualifiers: cup.qualifiers ?? [],
  ...(cup.championPlayerIds ? { championPlayerIds: cup.championPlayerIds } : {}) });

export function cupStatus(league: League): 'none' | 'group' | 'complete' {
  const cup = league.cup;
  if (!cup || cup.season !== league.season) return 'none';
  return cup.knockout ? 'complete' : 'group';
}
