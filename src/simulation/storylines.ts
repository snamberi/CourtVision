import type { League, ScheduledGame } from './league';
import { computeStandings } from './league';
import type { GMLeagueExtras } from './gm';
import { seasonRows } from './records';
import { rivalryKey, rivalryTable } from './rivalry';
import { perGameAverages } from './careerStats';

/*
 * Storylines: what the league is talking about right now, all derived from the save (nothing stored).
 *  - Chases: active players closing in on a career milestone or a name on the all-time list (with every real
 *    player loaded, that list runs back to 1946).
 *  - Revenge games: a player about to face a team he left in the last two seasons.
 *  - Rivalry games coming up, with a line of trash talk from the rivalry's history.
 *  - Streaks, the scoring-title race and the race for the top seed.
 */

export type StorylineKind = 'chase' | 'revenge' | 'rivalry' | 'streak' | 'race';
export interface Storyline { id: string; kind: StorylineKind; headline: string; detail: string; weight: number; playerId?: string; teamIds: string[] }

const MILESTONES = { points: [10000, 15000, 20000, 25000, 30000, 35000, 40000], reb: [5000, 10000, 15000], ast: [5000, 7500, 10000, 12500], stl: [1500, 2000, 2500], blk: [1500, 2000, 2500, 3000], tpm: [1000, 2000, 3000, 4000] };
/** How deep into the all-time list a pass is news, and the least a game a player must add for a chase to count. */
const PASS_RANKS: Record<StatKey, number> = { points: 60, reb: 40, ast: 40, stl: 25, blk: 25, tpm: 30 };
/** A name on the all-time list is only worth passing once he has a real total. */
const PASS_FLOOR: Record<StatKey, number> = { points: 10000, reb: 5000, ast: 3000, stl: 1000, blk: 800, tpm: 800 };
const MIN_PACE: Record<StatKey, number> = { points: 12, reb: 6, ast: 4, stl: 1, blk: 1, tpm: 1.2 };
const STAT_LABEL = { points: 'points', reb: 'rebounds', ast: 'assists', stl: 'steals', blk: 'blocks', tpm: 'threes' } as const;
type StatKey = keyof typeof MILESTONES;
const statOf = (t: { points: number; oreb: number; dreb: number; ast: number; stl: number; blk: number; tpm: number }, k: StatKey) => (k === 'reb' ? t.oreb + t.dreb : t[k]);

function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const fmt = (n: number) => Math.round(n).toLocaleString();

/** The next few days of games (the first unplayed round and the two after it). */
function upcoming(league: League): ScheduledGame[] {
  const next = league.schedule.filter(g => !g.played);
  if (!next.length) return [];
  const first = Math.min(...next.map(g => g.round));
  return next.filter(g => g.round <= first + 2);
}

function chases(league: League, extras: GMLeagueExtras | undefined, out: Storyline[]) {
  const active = new Map(league.teams.flatMap(t => t.seasons.map(p => [p.playerId, { p, teamId: t.teamId }] as const)));
  const { careers } = seasonRows(league, extras);
  for (const k of Object.keys(MILESTONES) as StatKey[]) {
    const board = careers.map(c => ({ id: c.playerId, v: statOf(c.totals, k) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    const rank = new Map(board.map((x, i) => [x.id, i]));
    for (const [id, { p, teamId }] of active) {
      const i = rank.get(id);
      if (i == null) continue;
      const total = board[i].v;
      // His pace: this season once he has five games, otherwise last season's.
      const last = p.careerHistory?.[p.careerHistory.length - 1];
      const src = (p.seasonStats?.gamesPlayed ?? 0) >= 5 ? p.seasonStats! : last?.stats;
      if (!src?.gamesPlayed) continue;
      const pace = statOf(src, k) / src.gamesPlayed;
      if (pace < MIN_PACE[k]) continue; // not a real threat to add to this list
      // A round milestone within about ten games.
      const next = MILESTONES[k].find(m => m > total);
      if (next && next - total <= pace * 10) {
        const need = next - total;
        out.push({ id: `chase:${k}:${id}:${next}`, kind: 'chase', playerId: id, teamIds: [teamId], weight: 60 + next / MILESTONES[k][0] * 5 - need / pace,
          headline: `${id} is ${fmt(need)} ${STAT_LABEL[k]} from ${fmt(next)}`, detail: `At ${pace.toFixed(1)} a game this season, about ${Math.max(1, Math.ceil(need / pace))} game${Math.ceil(need / pace) === 1 ? '' : 's'} away.` });
      }
      // Passing a name on the all-time list (top 100), within about five games.
      if (i > 0 && i <= PASS_RANKS[k] && board[i - 1].v >= PASS_FLOOR[k]) {
        const ahead = board[i - 1];
        const gap = ahead.v - total + 1;
        if (gap <= pace * 5) {
          const retired = !active.has(ahead.id);
          out.push({ id: `pass:${k}:${id}:${ahead.id}`, kind: 'chase', playerId: id, teamIds: [teamId], weight: 70 + (100 - i) * 0.4 - gap / pace,
            headline: `${id} needs ${fmt(gap)} ${STAT_LABEL[k]} to pass ${ahead.id} for #${i} all-time`, detail: `${ahead.id}${retired ? ' (retired)' : ''} has ${fmt(ahead.v)}. ${id} has ${fmt(total)}.` });
        }
      }
    }
  }
}

function revenge(league: League, out: Storyline[]) {
  const season = Number(league.season ?? 0);
  const current = new Map(league.teams.flatMap(t => t.seasons.map(p => [p.playerId, t.teamId] as const)));
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  for (const g of upcoming(league)) {
    for (const [side, other] of [[g.homeTeamId, g.awayTeamId], [g.awayTeamId, g.homeTeamId]] as const) {
      for (const p of league.teams.find(t => t.teamId === side)?.seasons ?? []) {
        const stints = (p.careerHistory ?? []).filter(h => Number(h.season) >= season - 2).flatMap(h => [h.teamId, ...(h.stints ?? []).map(s => s.teamId)]);
        const earlier = (p.seasonStints ?? []).map(s => s.teamId);
        if (![...stints, ...earlier].includes(other) || current.get(p.playerId) === other) continue;
        const years = (p.careerHistory ?? []).filter(h => h.teamId === other || h.stints?.some(s => s.teamId === other)).length;
        const lastLine = (p.seasonStats?.gamesPlayed ?? 0) >= 5 ? p.seasonStats : p.careerHistory?.[p.careerHistory.length - 1]?.stats;
        const star = lastLine?.gamesPlayed ? perGameAverages(lastLine).ppg : 0;
        if (star < 10 && years < 3) continue; // a story when he mattered there, or still matters
        out.push({ id: `revenge:${g.id}:${p.playerId}`, kind: 'revenge', playerId: p.playerId, teamIds: [side, other], weight: 45 + star + years * 3,
          headline: `${p.playerId} faces ${name(other)}, his old team`, detail: `${years ? `${years} season${years === 1 ? '' : 's'} there. ` : ''}${name(side)} vs ${name(other)}, day ${g.round + 1}.` });
      }
    }
  }
}

const TRASH = [
  (a: string, b: string) => `"We haven't forgotten last time." — ${a} locker room on ${b}`,
  (a: string, b: string) => `"Circle this one on the calendar." — ${a} on ${b}`,
  (a: string, b: string) => `"They know what's coming." — ${a} on ${b}`,
  (a: string, b: string) => `"Just another game? Come on." — ${a} on ${b}`,
];
function rivalryGames(league: League, out: Storyline[]) {
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const seen = new Set<string>();
  const games = upcoming(league);
  if (!games.length) return;
  const table = new Map(rivalryTable(league).map(r => [rivalryKey(r.a, r.b), r]));
  for (const g of games) {
    const r = table.get(rivalryKey(g.homeTeamId, g.awayTeamId));
    if (!r?.level || seen.has(`${r.a}|${r.b}`)) continue;
    seen.add(`${r.a}|${r.b}`);
    const last = r.eliminations[r.eliminations.length - 1];
    const loser = last ? (last.winner === r.a ? r.b : r.a) : null;
    const speaker = loser ?? g.awayTeamId, target = speaker === r.a ? r.b : r.a;
    const line = TRASH[hash(`${g.round}|${r.a}|${r.b}`) % TRASH.length](name(speaker), name(target));
    out.push({ id: `rivalry:${r.a}:${r.b}:${g.round}`, kind: 'rivalry', teamIds: [r.a, r.b], weight: 40 + r.total,
      headline: `${r.level}: ${name(g.awayTeamId)} at ${name(g.homeTeamId)}`,
      detail: `${last ? `${name(last.winner)} knocked them out in ${last.season}. ` : ''}Head to head: ${name(r.a)} ${r.winsA}–${r.winsB} ${name(r.b)}. ${line}` });
  }
}

function streaks(league: League, out: Storyline[]) {
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const played = league.schedule.filter(g => g.played && g.result).sort((a, b) => a.round - b.round);
  for (const t of league.teams) {
    const games = played.filter(g => g.homeTeamId === t.teamId || g.awayTeamId === t.teamId);
    let n = 0, won: boolean | null = null;
    for (let i = games.length - 1; i >= 0; i--) {
      const g = games[i], w = (g.homeTeamId === t.teamId) === (g.result!.homeScore > g.result!.awayScore);
      if (won === null) won = w; else if (w !== won) break;
      n++;
    }
    if (n >= 6) out.push({ id: `streak:${t.teamId}:${n}:${won}`, kind: 'streak', teamIds: [t.teamId], weight: 30 + n * 3,
      headline: `${name(t.teamId)} ${won ? 'have won' : 'have lost'} ${n} straight`, detail: won ? 'The hottest team in the league right now.' : 'Something has to change.' });
  }
}

function races(league: League, out: Storyline[]) {
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const players = league.teams.flatMap(t => t.seasons.map(p => ({ p, t: t.teamId }))).filter(x => (x.p.seasonStats?.gamesPlayed ?? 0) >= 10)
    .map(x => ({ ...x, ppg: perGameAverages(x.p.seasonStats).ppg })).sort((a, b) => b.ppg - a.ppg);
  if (players.length >= 2 && players[0].ppg - players[1].ppg < 1.2) {
    out.push({ id: `race:scoring:${players[0].p.playerId}:${players[1].p.playerId}`, kind: 'race', playerId: players[0].p.playerId, teamIds: [players[0].t, players[1].t], weight: 50,
      headline: `Scoring title: ${players[0].p.playerId} ${players[0].ppg.toFixed(1)}, ${players[1].p.playerId} ${players[1].ppg.toFixed(1)}`, detail: `${(players[0].ppg - players[1].ppg).toFixed(1)} points a game between them.` });
  }
  const standings = computeStandings(league).sort((a, b) => b.winPct - a.winPct);
  const confs = [...new Set(league.teams.map(t => t.conferenceId ?? ''))];
  const played = league.schedule.filter(g => g.played).length / Math.max(1, league.schedule.length);
  if (played < 0.5) return;
  for (const c of confs) {
    const rows = standings.filter(r => (league.teams.find(t => t.teamId === r.teamId)?.conferenceId ?? '') === c);
    if (rows.length < 2) continue;
    const gb = ((rows[0].wins - rows[1].wins) + (rows[1].losses - rows[0].losses)) / 2;
    if (gb <= 2) out.push({ id: `race:seed:${c}`, kind: 'race', teamIds: [rows[0].teamId, rows[1].teamId], weight: 45 - gb * 3,
      headline: `Race for the ${c ? `${c[0].toUpperCase()}${c.slice(1)} ` : ''}top seed: ${name(rows[0].teamId)} lead ${name(rows[1].teamId)} by ${gb === 0 ? 'nothing' : `${gb} game${gb === 1 ? '' : 's'}`}`,
      detail: `${rows[0].wins}-${rows[0].losses} against ${rows[1].wins}-${rows[1].losses}.` });
  }
}

/** Everything worth talking about right now, most interesting first. `teamId` floats your own team's stories up. */
export function storylines(league: League, extras?: GMLeagueExtras, teamId?: string | null): Storyline[] {
  const phase = league.seasonPhase ?? 'regular_season';
  if (phase !== 'regular_season' && phase !== 'all_star' && phase !== 'playoffs') return [];
  const out: Storyline[] = [];
  chases(league, extras, out);
  revenge(league, out);
  rivalryGames(league, out);
  streaks(league, out);
  races(league, out);
  const mine = (s: Storyline) => (teamId && s.teamIds.includes(teamId) ? 25 : 0);
  const unique = new Map(out.map(s => [s.id, s]));
  const sorted = [...unique.values()].sort((a, b) => b.weight + mine(b) - (a.weight + mine(a)));
  // One chase per player (his best), so a single scorer doesn't fill the page.
  const chased = new Set<string>();
  return sorted.filter(s => s.kind !== 'chase' || !s.playerId || (!chased.has(s.playerId) && !!chased.add(s.playerId)));
}
