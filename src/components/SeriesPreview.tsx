import { useMemo } from 'react';
import type { League } from '../simulation/league';
import { computeStandings } from '../simulation/league';
import { calculateOverall } from '../simulation/engine/overall';
import type { PlayoffSeries } from '../simulation/playoffs';
import { TeamLogo } from './TeamLogo';

/**
 * The playoff intro show: before your series tips off, the tale of the tape. Records, the regular-season meetings,
 * point differential, each side's three best players and a prediction from the rosters.
 */
export function SeriesPreview({ league, series, round }: { league: League; series: PlayoffSeries; round: string }) {
  const view = useMemo(() => {
    const standings = computeStandings(league);
    const side = (id: string | null) => {
      const team = league.teams.find(t => t.teamId === id);
      if (!team) return null;
      const row = standings.find(r => r.teamId === id);
      const stars = [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a)).slice(0, 3);
      const top8 = [...team.seasons].map(calculateOverall).sort((a, b) => b - a).slice(0, 8);
      const strength = top8.reduce((n, v) => n + v, 0) / Math.max(1, top8.length);
      return { team, row, stars, strength };
    };
    const a = side(series.teamAId), b = side(series.teamBId);
    if (!a || !b) return null;
    const meetings = league.schedule.filter(g => g.played && g.result && ((g.homeTeamId === a.team.teamId && g.awayTeamId === b.team.teamId) || (g.homeTeamId === b.team.teamId && g.awayTeamId === a.team.teamId)));
    const aWins = meetings.filter(g => (g.result!.homeScore > g.result!.awayScore ? g.homeTeamId : g.awayTeamId) === a.team.teamId).length;
    // Strength plus a little for point differential: a 3-point edge in roster strength is about a 75% favourite.
    const edge = (a.strength - b.strength) + ((a.row?.pointDiff ?? 0) - (b.row?.pointDiff ?? 0)) / Math.max(1, (a.row?.wins ?? 0) + (a.row?.losses ?? 0)) * 0.6;
    const pA = 1 / (1 + Math.exp(-edge / 2.2));
    const fav = pA >= 0.5 ? a : b, p = Math.max(pA, 1 - pA);
    const games = p > 0.85 ? 4 : p > 0.72 ? 5 : p > 0.6 ? 6 : 7;
    return { a, b, meetings: meetings.length, aWins, fav, p, games };
  }, [league, series.teamAId, series.teamBId]);
  if (!view) return null;
  const { a, b } = view;
  const ppg = (p: (typeof a.stars)[number]) => p.seasonStats && p.seasonStats.gamesPlayed ? (p.seasonStats.points / p.seasonStats.gamesPlayed).toFixed(1) : '—';
  return <section className="series-preview" aria-label="Series preview">
    <span className="pixel-eyebrow">SERIES PREVIEW · {round.toUpperCase()}</span>
    <div className="series-preview-sides">{[a, b].map((s, i) => <div key={s.team.teamId} className={`series-side ${i ? 'right' : ''}`}>
      <TeamLogo team={s.team} size={48} />
      <b>{s.team.name}</b>
      <small>{s.row ? `${s.row.wins}-${s.row.losses} · ${s.row.pointDiff > 0 ? '+' : ''}${s.row.pointDiff} pts` : ''}</small>
      <ul>{s.stars.map(p => <li key={p.playerId}><span>{p.playerId}</span><em>{calculateOverall(p)} OVR · {ppg(p)} ppg</em></li>)}</ul>
    </div>)}</div>
    <p className="series-preview-line">{view.meetings ? `Season series: ${a.team.name} ${view.aWins}-${view.meetings - view.aWins}.` : 'They did not meet in the regular season.'} <b>The pick: {view.fav.team.name} in {view.games}</b> ({Math.round(view.p * 100)}% to win the series).</p>
  </section>;
}
