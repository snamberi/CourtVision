import type { League, FranchiseHistoryRecord, TeamSeasonSummary } from './league';
import type { GMLeagueExtras } from './gm';
import { UPGRADES, type Upgrade } from './business';

/*
 * The franchise timeline: a team's history season by season, from the archive the league already keeps
 * (franchiseHistory: records, rosters, awards, the bracket), the retired numbers in the rafters, the big trades in
 * players' histories, and when each arena upgrade was built. Everything is derived; nothing new is stored.
 */

export type TimelineEventKind = 'title' | 'finals' | 'series' | 'game7' | 'award' | 'trade' | 'jersey' | 'arena' | 'draft';
export interface TimelineEvent { kind: TimelineEventKind; text: string }
export interface TimelineSeason {
  season: string; wins: number; losses: number; finish: string; champion: boolean;
  events: TimelineEvent[]; summary?: TeamSeasonSummary; record?: FranchiseHistoryRecord; current?: boolean;
}

const AWARD_NAMES: [keyof NonNullable<FranchiseHistoryRecord['fullAwards']>, string][] = [['mvp', 'MVP'], ['dpoy', 'Defensive Player of the Year'], ['roy', 'Rookie of the Year'], ['smoy', 'Sixth Man of the Year'], ['mip', 'Most Improved Player'], ['coy', 'Coach of the Year']];

export function franchiseTimeline(league: League, extras: GMLeagueExtras | undefined, teamId: string): TimelineSeason[] {
  const team = league.teams.find(t => t.teamId === teamId);
  const name = (id: string | null | undefined) => league.teams.find(t => t.teamId === id)?.name ?? id ?? '';
  const out: TimelineSeason[] = [];
  for (const rec of league.franchiseHistory ?? []) {
    const ts = rec.teamSeasons?.find(t => t.teamId === teamId);
    if (!ts) continue;
    const events: TimelineEvent[] = [];
    const champion = rec.championTeamId === teamId;
    if (champion) events.push({ kind: 'title', text: `Won the championship${rec.fmvpPlayerId ? ` (Finals MVP: ${rec.fmvpPlayerId})` : ''}` });
    else if (ts.playoffFinish === 'Finals') events.push({ kind: 'finals', text: 'Reached the Finals' });
    // Playoff series from the archived bracket.
    for (const [ri, round] of (rec.bracket?.rounds ?? []).entries()) for (const s of round) {
      if (s.teamAId !== teamId && s.teamBId !== teamId || !s.winnerTeamId) continue;
      const opp = s.teamAId === teamId ? s.teamBId : s.teamAId;
      const us = s.teamAId === teamId ? s.teamAWins : s.teamBWins, them = s.teamAId === teamId ? s.teamBWins : s.teamAWins;
      const seven = us + them === s.gamesToWin * 2 - 1 && s.gamesToWin >= 4;
      if (s.winnerTeamId === teamId && !(champion && ri === (rec.bracket!.rounds.length - 1))) events.push({ kind: seven ? 'game7' : 'series', text: `${seven ? 'Game 7 win' : 'Beat'} ${seven ? 'over ' : ''}${name(opp)} ${us}-${them}` });
      else if (s.winnerTeamId !== teamId && seven) events.push({ kind: 'game7', text: `Lost a Game 7 to ${name(opp)}` });
    }
    // Awards to this team's players.
    const roster = new Set(ts.roster.map(r => r.playerId));
    for (const [key, label] of AWARD_NAMES) {
      const w = rec.fullAwards?.[key] as { playerId?: string; teamId?: string } | null | undefined;
      if (w?.playerId && (roster.has(w.playerId) || w.teamId === teamId)) events.push({ kind: 'award', text: `${w.playerId}: ${label}` });
    }
    out.push({ season: rec.season, wins: ts.wins, losses: ts.losses, finish: ts.playoffFinish, champion, events, summary: ts, record: rec });
  }
  // The season in progress.
  if (league.season && !out.some(s => s.season === league.season)) {
    const games = league.schedule.filter(g => g.played && g.result && (g.homeTeamId === teamId || g.awayTeamId === teamId));
    const wins = games.filter(g => (g.homeTeamId === teamId) === (g.result!.homeScore > g.result!.awayScore)).length;
    out.push({ season: league.season, wins, losses: games.length - wins, finish: 'In progress', champion: false, events: [], current: true });
  }
  const at = (season: string) => out.find(s => s.season === season);
  // Numbers raised to the rafters.
  for (const j of team?.retiredJerseys ?? []) at(j.season)?.events.push({ kind: 'jersey', text: `Retired #${j.number} for ${j.playerId}` });
  // Big trades: good players who arrived by trade (from players' histories).
  const players = [...league.teams.flatMap(t => t.seasons), ...(extras?.freeAgents ?? []), ...(league.retiredPlayers ?? []).flatMap(r => r.finalSeasonData ? [r.finalSeasonData] : [])];
  const seen = new Set<string>();
  for (const p of players) for (const e of p.history ?? []) {
    if (e.type !== 'traded' || e.teamId !== teamId || seen.has(`${p.playerId}|${e.season}`)) continue;
    const ovr = p.careerHistory?.find(c => c.season === e.season)?.overall ?? 0;
    if (ovr && ovr < 72) continue;
    seen.add(`${p.playerId}|${e.season}`);
    at(e.season)?.events.push({ kind: 'trade', text: `Traded for ${p.playerId}` });
  }
  // Draft picks that became stars.
  for (const p of players) if (p.draftTeamId === teamId && p.draftRound === 1 && (p.draftPick ?? 99) <= 5 && p.draftYear) {
    const s = out.find(x => x.season.startsWith(String(p.draftYear)) || x.season === String(p.draftYear));
    s?.events.push({ kind: 'draft', text: `Drafted ${p.playerId} (#${p.draftPick})` });
  }
  // Arena upgrades, dated from their five-season payment plans.
  const seasonIdx = out.findIndex(s => s.current) >= 0 ? out.findIndex(s => s.current) : out.length - 1;
  for (const loan of team?.business?.loans ?? []) {
    const idx = seasonIdx - (5 - loan.seasonsLeft);
    const label = UPGRADES[loan.upgrade as Upgrade]?.label ?? loan.upgrade;
    out[Math.max(0, idx)]?.events.push({ kind: 'arena', text: `Arena: new ${label.toLowerCase()}` });
  }
  return out;
}

export const EVENT_ICON: Record<TimelineEventKind, string> = { title: '🏆', finals: '🥈', series: '▲', game7: '7', award: '★', trade: '⇄', jersey: '#', arena: '▦', draft: '✎' };
