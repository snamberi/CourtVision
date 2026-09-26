import type { League } from './league';
import { addDays, daysBetween, DAYS_PER_ROUND } from './calendar';
import { awardOptions, awardRaceStandings, type RaceKey } from './awards';

/* In-season award races: a weekly ladder for the headline awards, and Players of the Week and Month for
 * each conference. Updated when a game day finishes, so it's the same whether days are played one game at
 * a time or all at once. Kept for the current season; the honors move into the season's awards at the rollover. */

export interface RaceEntry { id: string; score: number }

export interface RaceSnapshot {
  week: number;
  /** Date of the week's last game day. */
  date: string;
  races: Partial<Record<RaceKey, RaceEntry[]>>;
}

export interface PeriodHonor {
  kind: 'week' | 'month';
  /** "Week 3" or "November". */
  label: string;
  start: string;
  end: string;
  /** Last game day (schedule round) of the period. */
  round: number;
  /** Null in a league without conferences (one honoree league-wide). */
  conference: 'east' | 'west' | null;
  playerId: string;
  teamId: string;
  teamName: string;
  /** Games and his team's record over the period, and his per-game line. */
  gp: number; w: number; l: number;
  pts: number; reb: number; ast: number; stl: number; blk: number;
  score: number;
}

export interface AwardRaceState {
  season: string;
  /** The open week and month (null right after one closes, until the next game day). */
  week: { start: string; startRound: number } | null;
  month: { start: string; startRound: number } | null;
  ladder: RaceSnapshot[];
  honors: PeriodHonor[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthOf = (date: string) => Number(date.slice(5, 7)) - 1;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Best performer over a range of game days, per conference: production per game, availability and winning. */
export function periodHonors(league: League, kind: PeriodHonor['kind'], label: string, start: string, end: string, fromRound: number, toRound: number): PeriodHonor[] {
  const teamById = new Map(league.teams.map((t) => [t.teamId, t]));
  const conferences = league.teams.length > 0 && league.teams.every((t) => t.conferenceId);
  const teamGames = new Map<string, { gp: number; w: number }>();
  const acc = new Map<string, { teamId: string; gp: number; w: number; pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; miss: number }>();
  for (const g of league.schedule) {
    if (!g.played || !g.result || g.round < fromRound || g.round > toRound) continue;
    const r = g.result;
    for (const [box, won] of [[r.homeBox, r.homeScore > r.awayScore], [r.awayBox, r.awayScore > r.homeScore]] as const) {
      const tg = teamGames.get(box.teamId) ?? { gp: 0, w: 0 };
      tg.gp++; if (won) tg.w++;
      teamGames.set(box.teamId, tg);
      for (const line of Object.values(box.players)) {
        if (!line.minutes) continue;
        const a = acc.get(line.playerId) ?? { teamId: box.teamId, gp: 0, w: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, miss: 0 };
        a.teamId = box.teamId; a.gp++; if (won) a.w++;
        a.pts += line.points; a.reb += line.oreb + line.dreb; a.ast += line.ast; a.stl += line.stl; a.blk += line.blk; a.tov += line.tov;
        a.miss += (line.fga - line.fgm) + 0.5 * (line.fta - line.ftm);
        acc.set(line.playerId, a);
      }
    }
  }
  const best = new Map<string, PeriodHonor>();
  for (const [playerId, a] of acc) {
    const team = teamById.get(a.teamId);
    const tg = teamGames.get(a.teamId);
    if (!team || !tg || a.gp < Math.max(1, Math.ceil(tg.gp * 0.6))) continue;
    const perGame = (a.pts + 1.2 * a.reb + 1.5 * a.ast + 2 * a.stl + 2 * a.blk - a.tov - 0.5 * a.miss) / a.gp;
    const score = perGame * Math.sqrt(a.gp / tg.gp) + 5 * (a.w / a.gp);
    const conference = conferences ? team.conferenceId ?? null : null;
    const key = conference ?? 'league';
    const held = best.get(key);
    if (held && (held.score > score || (held.score === score && held.playerId < playerId))) continue;
    best.set(key, { kind, label, start, end, round: toRound, conference, playerId, teamId: a.teamId, teamName: team.name, gp: a.gp, w: a.w, l: a.gp - a.w,
      pts: r1(a.pts / a.gp), reb: r1(a.reb / a.gp), ast: r1(a.ast / a.gp), stl: r1(a.stl / a.gp), blk: r1(a.blk / a.gp), score: r1(score) });
  }
  return [...best.values()].sort((a, b) => (a.conference ?? '').localeCompare(b.conference ?? ''));
}

function snapshot(league: League, week: number, date: string): RaceSnapshot {
  const standings = awardRaceStandings(league, awardOptions(league.awardSettings));
  const races: RaceSnapshot['races'] = {};
  for (const k of Object.keys(standings) as RaceKey[]) races[k] = standings[k].map((w) => ({ id: w.playerId, score: w.score }));
  return { week, date, races };
}

/**
 * Called when the last game of a regular-season game day is applied. Closes the week after its seventh
 * day (and the month before the calendar turns): records the ladder and names the Players of the Week/Month.
 */
export function advanceAwardRace(league: League, round: number): League {
  const date = league.calendarDate;
  if (!date) return league;
  const season = league.season ?? '';
  const prev = league.awardRace?.season === season ? league.awardRace : null;
  const week = prev?.week ?? { start: date, startRound: round };
  const month = prev?.month ?? { start: date, startRound: round };
  let ladder = prev?.ladder ?? [];
  const honors = [...(prev?.honors ?? [])];
  const over = !league.schedule.some((g) => !g.played);
  let nextWeek: AwardRaceState['week'] = week;
  let nextMonth: AwardRaceState['month'] = month;
  if (over || daysBetween(week.start, date) >= 6) {
    const n = ladder.length + 1;
    honors.push(...periodHonors(league, 'week', `Week ${n}`, week.start, date, week.startRound, round));
    ladder = [...ladder, snapshot(league, n, date)];
    nextWeek = null;
  }
  if (over || monthOf(addDays(date, DAYS_PER_ROUND)) !== monthOf(date)) {
    honors.push(...periodHonors(league, 'month', MONTHS[monthOf(month.start)], month.start, date, month.startRound, round));
    nextMonth = null;
  }
  return { ...league, awardRace: { season, week: nextWeek, month: nextMonth, ladder, honors } };
}

/** Rank movement since the last saved weekly ladder: positive = climbed. Null = new to the top of the ladder. Undefined = no ladder yet. */
export function ladderTrend(race: AwardRaceState | undefined, key: RaceKey, playerId: string, currentRank: number): number | null | undefined {
  const last = race?.ladder.at(-1);
  if (!last) return undefined;
  const before = (last.races[key] ?? []).findIndex((e) => e.id === playerId);
  return before < 0 ? null : before - currentRank;
}
