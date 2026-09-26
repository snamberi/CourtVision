import { useMemo, useState } from 'react';
import { TeamLink } from './TeamLink';
import { TeamLogo } from './TeamLogo';
import type { League, ScheduledGame } from '../simulation/league';
import { computeStandings } from '../simulation/league';
import { addDays, DAYS_PER_ROUND, seasonStartDate } from '../simulation/calendar';

interface Props {
  league: League;
  controlledTeamId?: string | null;
  onViewGame: (gameId: string) => void;
}

const dateOf = (league: League, round: number) => addDays(seasonStartDate(league.season), round * DAYS_PER_ROUND);
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

interface TeamGame { game: ScheduledGame; home: boolean; opponent: string; date: string; outcome?: 'W' | 'L'; us?: number; them?: number }

function teamGames(league: League, teamId: string): TeamGame[] {
  return league.schedule.filter(g => g.homeTeamId === teamId || g.awayTeamId === teamId).map(game => {
    const home = game.homeTeamId === teamId, r = game.played ? game.result : undefined;
    const us = r ? (home ? r.homeScore : r.awayScore) : undefined, them = r ? (home ? r.awayScore : r.homeScore) : undefined;
    return { game, home, opponent: home ? game.awayTeamId : game.homeTeamId, date: dateOf(league, game.round), us, them, outcome: us == null || them == null ? undefined : us > them ? 'W' : 'L' };
  });
}

function streak(games: TeamGame[]): string {
  const done = games.filter(g => g.outcome);
  if (!done.length) return '—';
  const last = done[done.length - 1].outcome!;
  let n = 0;
  for (let i = done.length - 1; i >= 0 && done[i].outcome === last; i--) n++;
  return `${last}${n}`;
}

/** The season calendar: your team's games month by month, or the whole league one game day at a time. */
export function SchedulePage({ league, controlledTeamId, onViewGame }: Props) {
  const teams = useMemo(() => [...league.teams].sort((a, b) => a.name.localeCompare(b.name)), [league.teams]);
  const [teamId, setTeamId] = useState<string>(controlledTeamId ?? teams[0]?.teamId ?? '');
  const [view, setView] = useState<'team' | 'league'>('team');
  const rounds = useMemo(() => [...new Set(league.schedule.map(g => g.round))].sort((a, b) => a - b), [league.schedule]);
  const nextRound = league.schedule.find(g => !g.played)?.round ?? rounds[rounds.length - 1] ?? 0;
  const [day, setDay] = useState(nextRound);
  const standings = useMemo(() => new Map(computeStandings(league).map(r => [r.teamId, r])), [league]);
  const record = (id: string) => { const r = standings.get(id); return r ? `${r.wins}-${r.losses}` : '0-0'; };
  const byId = useMemo(() => new Map(league.teams.map(t => [t.teamId, t])), [league.teams]);

  if (league.schedule.length === 0) return <div className="league-page"><h4>Schedule</h4><p className="empty-state">No schedule generated yet.</p></div>;

  const games = teamGames(league, teamId);
  const done = games.filter(g => g.outcome);
  const split = (home: boolean) => { const s = done.filter(g => g.home === home); return `${s.filter(g => g.outcome === 'W').length}-${s.filter(g => g.outcome === 'L').length}`; };
  const last10 = done.slice(-10);
  const next = games.find(g => !g.game.played);
  const months = new Map<string, TeamGame[]>();
  for (const g of games) { const key = g.date.slice(0, 7); months.set(key, [...(months.get(key) ?? []), g]); }
  const dayGames = league.schedule.filter(g => g.round === day);
  const dayIndex = rounds.indexOf(day);
  const team = byId.get(teamId);

  return <div className="league-page schedule-page">
    <header className="sched-head">
      <h4>Schedule</h4>
      <div className="sched-tabs" role="tablist">
        <button role="tab" aria-selected={view === 'team'} className={view === 'team' ? 'active' : ''} onClick={() => setView('team')}>Team calendar</button>
        <button role="tab" aria-selected={view === 'league'} className={view === 'league' ? 'active' : ''} onClick={() => setView('league')}>League by day</button>
      </div>
      {view === 'team' && <label className="sched-team-pick">Team <select value={teamId} onChange={e => setTeamId(e.target.value)}>
        {teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}{t.teamId === controlledTeamId ? ' (you)' : ''}</option>)}
      </select></label>}
    </header>

    {view === 'team' && team && <>
      <section className="sched-summary">
        <TeamLogo team={team} size={48} />
        <div><small>Record</small><b>{record(teamId)}</b></div>
        <div><small>Home</small><b>{split(true)}</b></div>
        <div><small>Away</small><b>{split(false)}</b></div>
        <div><small>Streak</small><b>{streak(games)}</b></div>
        <div><small>Left</small><b>{games.length - done.length}</b></div>
        <div className="sched-form" aria-label={`Last ${last10.length}: ${last10.map(g => g.outcome).join(' ')}`}>
          <small>Last {last10.length || 10}</small>
          <span>{last10.length ? last10.map((g, i) => <i key={i} className={g.outcome === 'W' ? 'w' : 'l'}>{g.outcome}</i>) : <em>No games yet</em>}</span>
        </div>
      </section>

      {next && <section className="sched-next">
        <span className="pixel-eyebrow">NEXT GAME · {fmt(next.date, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}</span>
        <div className="sched-next-body">
          <div className="sched-next-team"><TeamLogo team={team} size={56} /><b>{team.name}</b><small>{record(teamId)}</small></div>
          <span className="sched-next-at">{next.home ? 'VS' : '@'}</span>
          {byId.get(next.opponent) && <div className="sched-next-team"><TeamLogo team={byId.get(next.opponent)!} size={56} /><b><TeamLink teamId={next.opponent} /></b><small>{record(next.opponent)}</small></div>}
        </div>
        <p className="hint-text">{next.home ? 'Home game' : 'On the road'}{next.game.cupGroupId ? ' · counts for the In-Season Cup' : ''}</p>
      </section>}

      {[...months].map(([month, list]) => <section key={month} className="sched-month">
        <h5>{fmt(`${month}-01`, { month: 'long', year: 'numeric' })}<small>{list.filter(g => g.outcome === 'W').length}-{list.filter(g => g.outcome === 'L').length}</small></h5>
        <div className="sched-grid">{list.map(g => {
          const opp = byId.get(g.opponent), isNext = g === next;
          return <button key={g.game.id} className={`sched-tile ${g.outcome ? `result-${g.outcome.toLowerCase()}` : 'upcoming'}${isNext ? ' next' : ''}`}
            onClick={() => g.game.played && onViewGame(g.game.id)} disabled={!g.game.played} aria-label={`${fmt(g.date, { month: 'short', day: 'numeric' })}, ${g.home ? 'vs' : 'at'} ${opp?.name ?? g.opponent}${g.outcome ? `, ${g.outcome === 'W' ? 'won' : 'lost'} ${g.us}-${g.them}` : ''}`}>
            <span className="sched-date"><b>{fmt(g.date, { day: 'numeric' })}</b>{fmt(g.date, { weekday: 'short' })}</span>
            {opp && <TeamLogo team={opp} size={28} />}
            <span className="sched-opp"><small>{g.home ? 'vs' : '@'}</small>{opp?.name ?? g.opponent}</span>
            {g.game.cupGroupId && <span className="cup-tag" title="Also an In-Season Cup group game">CUP</span>}
            <span className="sched-result">{g.outcome ? <><i>{g.outcome}</i>{g.us}-{g.them}</> : isNext ? 'NEXT' : '—'}</span>
          </button>;
        })}</div>
      </section>)}
    </>}

    {view === 'league' && <>
      <div className="sched-day-nav">
        <button disabled={dayIndex <= 0} onClick={() => setDay(rounds[dayIndex - 1])}>◀</button>
        <select value={day} onChange={e => setDay(Number(e.target.value))} aria-label="Game day">
          {rounds.map(r => <option key={r} value={r}>{fmt(dateOf(league, r), { weekday: 'short', month: 'short', day: 'numeric' })}{r === nextRound ? ' · next' : ''}</option>)}
        </select>
        <button disabled={dayIndex >= rounds.length - 1} onClick={() => setDay(rounds[dayIndex + 1])}>▶</button>
        <button className="link-button" onClick={() => setDay(nextRound)}>Today</button>
      </div>
      <div className="sched-day-grid">{dayGames.map(g => {
        const r = g.played ? g.result : undefined, homeWon = r ? r.homeScore > r.awayScore : undefined;
        const side = (id: string, score: number | undefined, won: boolean | undefined) => { const t = byId.get(id); return <div className={`sched-side${won ? ' won' : ''}`}>
          {t && <TeamLogo team={t} size={30} />}<span><TeamLink teamId={id} /><small>{record(id)}</small></span><b>{score ?? ''}</b></div>; };
        return <article key={g.id} className={`sched-matchup${g.played ? ' played' : ''}`}>
          {side(g.awayTeamId, r?.awayScore, homeWon === false)}
          {side(g.homeTeamId, r?.homeScore, homeWon === true)}
          <footer>{g.cupGroupId && <span className="cup-tag">CUP</span>}{g.played ? <button className="link-button" onClick={() => onViewGame(g.id)}>Box score</button> : <span className="hint-text">Upcoming</span>}</footer>
        </article>;
      })}</div>
    </>}
  </div>;
}
