import type { NbaHistory } from './nbaHistoryData';
import type { FranchiseHistoryRecord } from '../simulation/league';
import { formatSeasonYear } from '../simulation/calendar';

/*
 * Dynasty rankings: every run of two or more titles (each within four seasons of the last), from real NBA history and
 * from this league, scored the same way so your league's dynasties line up against the 60s Celtics or the 90s Bulls.
 * Score: 10 per title, 4 per lost Finals inside the run, plus how far above .500 the team played across it.
 * Seasons are the year a season ends (2016 = 2015-16), like the rest of the game's display.
 */

export const TITLE_POINTS = 10;
export const FINALS_POINTS = 4;
export const MAX_GAP = 4;

export interface DynastyRow {
  key: string; source: 'real' | 'league'; teamId: string; teamName: string;
  from: number; to: number; titles: number[]; finalsLosses: number; wins: number; losses: number; score: number; yours?: boolean;
}

interface SeasonLine { season: number; champion: string | null; runnerUp: string | null; names: Map<string, string>; records: Map<string, [number, number]> }

/** Groups each team's titles into runs (no more than MAX_GAP seasons between titles) and scores runs of 2+. */
export function findRuns(lines: SeasonLine[], source: DynastyRow['source']): DynastyRow[] {
  const sorted = [...lines].sort((a, b) => a.season - b.season);
  const byTeam = new Map<string, number[]>();
  for (const l of sorted) if (l.champion) (byTeam.get(l.champion) ?? byTeam.set(l.champion, []).get(l.champion)!).push(l.season);
  const out: DynastyRow[] = [];
  for (const [teamId, titles] of byTeam) {
    let run: number[] = [];
    const flush = () => {
      if (run.length >= 2) {
        const from = run[0], to = run[run.length - 1], span = sorted.filter(l => l.season >= from && l.season <= to);
        let wins = 0, losses = 0, finalsLosses = 0;
        for (const l of span) {
          const r = l.records.get(teamId);
          if (r) { wins += r[0]; losses += r[1]; }
          if (l.runnerUp === teamId) finalsLosses++;
        }
        const pct = wins + losses > 0 ? wins / (wins + losses) : 0.5;
        const score = run.length * TITLE_POINTS + finalsLosses * FINALS_POINTS + Math.round((pct - 0.5) * 10 * span.length);
        const last = span[span.length - 1];
        out.push({ key: `${source}:${teamId}:${from}`, source, teamId, teamName: last.names.get(teamId) ?? teamId, from, to, titles: [...run], finalsLosses, wins, losses, score });
      }
      run = [];
    };
    for (const s of titles) { if (run.length && s - run[run.length - 1] > MAX_GAP) flush(); run.push(s); }
    flush();
  }
  return out;
}

/** Real NBA dynasties (BAA/NBA), grouped by franchise so a move keeps one history; named by the city at the time. */
export function realDynasties(h: NbaHistory): DynastyRow[] {
  const nba = h.teams.filter(t => t.league === 'NBA' || t.league === 'BAA');
  const franchiseOf = new Map(nba.map(t => [`${t.season}:${t.abbr}`, t.franchise ?? t.abbr]));
  const bySeason = new Map<number, typeof nba>();
  for (const t of nba) (bySeason.get(t.season) ?? bySeason.set(t.season, []).get(t.season)!).push(t);
  const lines: SeasonLine[] = h.champions.map(c => {
    const teams = bySeason.get(c.season) ?? [];
    const fr = (abbr: string) => franchiseOf.get(`${c.season}:${abbr}`) ?? abbr;
    return {
      season: c.season, champion: fr(c.champion), runnerUp: c.runnerUp ? fr(c.runnerUp) : null,
      names: new Map(teams.map(t => [t.franchise ?? t.abbr, t.name])),
      records: new Map(teams.filter(t => t.w != null && t.l != null).map(t => [t.franchise ?? t.abbr, [t.w!, t.l!] as [number, number]])),
    };
  });
  return findRuns(lines, 'real');
}

/** This league's dynasties, from its own completed seasons (imported real seasons are left to the real list). */
export function leagueDynasties(history: FranchiseHistoryRecord[], userTeamId?: string | null): DynastyRow[] {
  const lines: SeasonLine[] = history.filter(r => !r.imported).map(r => {
    const ts = r.teamSeasons ?? [];
    const names = new Map(ts.map(t => [t.teamId, t.teamName]));
    if (r.championTeamId && r.championTeamName) names.set(r.championTeamId, r.championTeamName);
    return {
      season: Number(formatSeasonYear(r.season)), champion: r.championTeamId, runnerUp: ts.find(t => t.playoffFinish === 'Finals')?.teamId ?? null,
      names, records: new Map(ts.map(t => [t.teamId, [t.wins, t.losses] as [number, number]])),
    };
  }).filter(l => Number.isFinite(l.season));
  return findRuns(lines, 'league').map(d => (userTeamId && d.teamId === userTeamId ? { ...d, yours: true } : d));
}

export function tierOf(d: DynastyRow): 'Legendary' | 'Dynasty' | 'Run' {
  return d.titles.length >= 5 ? 'Legendary' : d.titles.length >= 3 ? 'Dynasty' : 'Run';
}

export interface DynastyRanking { rows: (DynastyRow & { rank: number })[]; best: (DynastyRow & { rank: number }) | null; yourBest: (DynastyRow & { rank: number }) | null; above: DynastyRow | null; below: DynastyRow | null }

/** Real and league dynasties in one table, best first (ties: more titles, then the earlier run). */
export function rankDynasties(real: DynastyRow[], league: DynastyRow[]): DynastyRanking {
  const rows = [...real, ...league].sort((a, b) => b.score - a.score || b.titles.length - a.titles.length || a.from - b.from).map((d, i) => ({ ...d, rank: i + 1 }));
  const best = rows.find(d => d.source === 'league') ?? null;
  const yourBest = rows.find(d => d.yours) ?? null;
  const pivot = yourBest ?? best;
  const realRows = rows.filter(d => d.source === 'real');
  return {
    rows, best, yourBest,
    above: pivot ? [...realRows].reverse().find(d => d.rank < pivot.rank) ?? null : null,
    below: pivot ? realRows.find(d => d.rank > pivot.rank) ?? null : null,
  };
}
