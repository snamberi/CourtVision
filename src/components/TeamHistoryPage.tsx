import { CupBanner, DynastyBanner, JerseyBanner, TitleBanner } from './Banners';
import { TeamLink } from './TeamLink';
import { fx } from './statFormat';
import { dynasties, teamRivals } from '../simulation/rivalry';
import { Fragment, useMemo, useState } from 'react';
import type { League, LeagueTeam, PlayoffFinish, TeamSeasonRosterLine } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { PlayerSeason, SeasonStatTotals } from '../simulation/types';
import { resolveTeamIdentity } from '../simulation/teamIdentity';
import { useTeamIdentity } from '../visuals/TeamIdentityContext';
import { TeamLogo } from './TeamLogo';
import { formatSeasonYear } from '../simulation/calendar';
import { seasonAdvancedWithStints, regularSeasonContext } from '../simulation/advancedStats';
import { buildTeamSeasonSummaries } from '../simulation/seasonTransition';
import { primaryPosition } from '../simulation/teamStatus';
import { teamTrophyEntries } from '../simulation/leagueAnalytics';
import { TrophyShelf } from './TrophyShelf';

interface SeasonLine {
  season: string; wins: number | null; losses: number | null; ortg?: number; drtg?: number; finish: PlayoffFinish | 'In progress' | null;
  playoffRecord?: string; roster: TeamSeasonRosterLine[]; inProgress?: boolean; reconstructed?: boolean;
  /** Real NBA season imported with the league (team record only; rosters live in the NBA History archive). */
  imported?: boolean; teamName?: string;
}

function everyone(league: League, extras?: GMLeagueExtras): PlayerSeason[] {
  const seen = new Set<string>(), out: PlayerSeason[] = [];
  const push = (p?: PlayerSeason) => { if (p && !seen.has(p.playerId)) { seen.add(p.playerId); out.push(p); } };
  league.teams.forEach(t => t.seasons.forEach(push)); extras?.freeAgents.forEach(push); (league.retiredPlayers ?? []).forEach(r => push(r.finalSeasonData));
  return out;
}
function lineFromTotals(p: PlayerSeason, s: SeasonStatTotals, age: number, overall: number, ws = 0, per = 0): TeamSeasonRosterLine {
  const g = Math.max(1, s.gamesPlayed);
  return { playerId: p.playerId, jerseyNumber: p.jerseyNumber, position: primaryPosition(p), age, overall, gp: s.gamesPlayed, min: s.minutes / g, pts: s.points / g, reb: (s.oreb + s.dreb) / g, ast: s.ast / g, stl: s.stl / g, blk: s.blk / g, per, ws };
}

/** Every season this franchise has played: archived summaries, older seasons rebuilt from player careers, and the season in progress. */
function franchiseSeasons(league: League, team: LeagueTeam, extras?: GMLeagueExtras): SeasonLine[] {
  const out: SeasonLine[] = [];
  const players = everyone(league, extras);
  for (const h of league.franchiseHistory ?? []) {
    const s = h.teamSeasons?.find(t => t.teamId === team.teamId);
    if (s) { out.push({ season: h.season, wins: s.wins, losses: s.losses, ortg: s.ortg, drtg: s.drtg, finish: s.playoffFinish, playoffRecord: s.playoffWins + s.playoffLosses ? `${s.playoffWins}–${s.playoffLosses}` : undefined, roster: s.roster, ...(h.imported ? { imported: true, teamName: s.teamName } : {}) }); continue; }
    if (h.imported) continue; // the franchise did not exist yet in that real season
    // Seasons archived before team summaries existed: rebuild the roster from each player's career log.
    // A career line split across teams contributes only the stint played here.
    const roster = players.flatMap(p => (p.careerHistory ?? []).filter(c => c.season === h.season).flatMap(c => c.stints?.length
      ? c.stints.filter(st => st.teamId === team.teamId && st.stats.gamesPlayed > 0).map(st => lineFromTotals(p, st.stats, c.age, c.overall, st.advanced?.ws ?? 0, st.advanced?.per ?? 0))
      : c.teamId === team.teamId && c.stats.gamesPlayed > 0 ? [lineFromTotals(p, c.stats, c.age, c.overall, c.advanced?.ws ?? 0, c.advanced?.per ?? 0)] : [])).sort((a, b) => b.ws - a.ws || b.pts - a.pts);
    out.push({ season: h.season, wins: null, losses: null, finish: h.championTeamId === team.teamId ? 'Champion' : null, roster, reconstructed: true });
  }
  const archived = new Set(out.map(s => s.season));
  if (!archived.has(league.season ?? '')) {
    // Same builder the rollover archives with: everyone who played for this team this season, traded and waived players included.
    const ctx = regularSeasonContext(league), t = ctx.teams.get(team.teamId);
    const { combined, stints } = seasonAdvancedWithStints(league, ctx, extras?.freeAgents ?? []);
    const roster = buildTeamSeasonSummaries(league, ctx, combined, null, extras?.freeAgents ?? [], stints).find(s => s.teamId === team.teamId)?.roster ?? [];
    if (t || roster.length) out.push({ season: league.season ?? '', wins: t?.wins ?? 0, losses: t?.losses ?? 0, ortg: t?.ortg, drtg: t?.drtg, finish: 'In progress', roster, inProgress: true });
  }
  return out;
}

/** A pixel pennant in the team's colors. */
export function TeamHistoryPage({ league, extras, initialTeamId, onSelectPlayer, onOpenArchive }: { league: League; extras?: GMLeagueExtras; initialTeamId?: string | null; onSelectPlayer: (id: string) => void; onOpenArchive?: () => void }) {
  const [teamId, setTeamId] = useState(initialTeamId && league.teams.some(t => t.teamId === initialTeamId) ? initialTeamId : league.teams[0]?.teamId ?? '');
  const [open, setOpen] = useState<string | null>(null);
  const team = league.teams.find(t => t.teamId === teamId);
  const contextIdentity = useTeamIdentity(teamId);
  const seasons = useMemo(() => team ? franchiseSeasons(league, team, extras) : [], [league, team, extras]);
  const leaders = useMemo(() => {
    if (!team) return [];
    const totals = new Map<string, { pts: number; reb: number; ast: number; gp: number; ws: number; seasons: number }>();
    for (const s of seasons) for (const r of s.roster) {
      const t = totals.get(r.playerId) ?? { pts: 0, reb: 0, ast: 0, gp: 0, ws: 0, seasons: 0 };
      t.pts += r.pts * r.gp; t.reb += r.reb * r.gp; t.ast += r.ast * r.gp; t.gp += r.gp; t.ws += r.ws; t.seasons++; totals.set(r.playerId, t);
    }
    const cats: [string, (t: { pts: number; reb: number; ast: number; gp: number; ws: number; seasons: number }) => number, (v: number) => string][] = [
      ['Points', t => t.pts, v => Math.round(v).toLocaleString()], ['Rebounds', t => t.reb, v => Math.round(v).toLocaleString()], ['Assists', t => t.ast, v => Math.round(v).toLocaleString()],
      ['Games', t => t.gp, v => String(v)], ['Win Shares', t => t.ws, v => v.toFixed(1)], ['Seasons', t => t.seasons, v => String(v)],
    ];
    return cats.map(([label, value, show]) => ({ label, top: [...totals].map(([id, t]) => ({ id, v: value(t) })).sort((a, b) => b.v - a.v).slice(0, 3).map(x => ({ ...x, text: show(x.v) })) }));
  }, [team, seasons]);
  if (!team) return <p className="empty-state">No teams yet.</p>;
  const identity = contextIdentity ?? resolveTeamIdentity(team);
  const titles = seasons.filter(s => s.finish === 'Champion');
  const known = seasons.filter(s => s.wins != null && !s.inProgress);
  const wins = known.reduce((n, s) => n + (s.wins ?? 0), 0), losses = known.reduce((n, s) => n + (s.losses ?? 0), 0);
  const playoffs = seasons.filter(s => s.finish && s.finish !== 'Missed Playoffs' && s.finish !== 'Play-In' && s.finish !== 'In progress').length;
  const best = [...known].sort((a, b) => (b.wins! / Math.max(1, b.wins! + b.losses!)) - (a.wins! / Math.max(1, a.wins! + a.losses!)))[0];
  const retired = [...(team.retiredJerseys ?? [])].sort((a, b) => a.number - b.number);
  const cups = (league.franchiseHistory ?? []).filter(r => r.cup?.championTeamId === team.teamId).map(r => r.season);
  const teamDynasties = dynasties(league.franchiseHistory ?? []).filter(d => d.teamId === team.teamId);
  const rivals = teamRivals(league, team.teamId, 6);
  const trophies = teamTrophyEntries(league, team.teamId);
  const teamName = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  return <div className="team-history-page">
    <div className="team-history-head">
      <TeamLogo team={team} size={110} />
      <div><span className="pixel-eyebrow">FRANCHISE HISTORY</span><h2>{team.name}</h2>
        <label className="team-history-select">Team <select value={teamId} onChange={e => { setTeamId(e.target.value); setOpen(null); }}>{league.teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select></label></div>
    </div>
    <section className="history-rafters" aria-label="Banners">
      <h4>The Rafters</h4>
      {titles.length === 0 && retired.length === 0 && cups.length === 0 ? <p className="hint-text">No banners yet. Win a title or retire a legend's number to raise one.</p> : <div className="banner-row">
        {teamDynasties.map(d => <DynastyBanner key={d.from} identity={identity} from={formatSeasonYear(d.from)} to={formatSeasonYear(d.to)} titles={d.titles.length} />)}
        {titles.map(s => <TitleBanner key={s.season} identity={identity} year={formatSeasonYear(s.season)} />)}
        {cups.map(season => <CupBanner key={`cup-${season}`} identity={identity} year={formatSeasonYear(season)} />)}
        {retired.map(j => <button key={j.number} className="banner-button" onClick={() => onSelectPlayer(j.playerId)} title={`${j.playerId} — retired ${formatSeasonYear(j.season)}`}><JerseyBanner identity={identity} number={j.number} name={j.playerId} years={formatSeasonYear(j.season)} /></button>)}
      </div>}
    </section>
    <section className="history-trophy-case" aria-label="Trophy case">
      <h4>Trophy Case</h4>
      <TrophyShelf entries={trophies} size={44} empty="The case is empty. Titles, Coach and Executive of the Year, and your players' awards in this uniform will fill it." />
    </section>
    <div className="history-summary">
      <div><small>SEASONS</small><b>{seasons.length}</b></div>
      <div><small>RECORD</small><b>{known.length ? `${wins}–${losses}` : '—'}</b></div>
      <div><small>PLAYOFFS</small><b>{playoffs}</b></div>
      <div><small>TITLES</small><b>{titles.length}</b></div>
      <div><small>BEST SEASON</small><b>{best ? `${best.wins}–${best.losses}` : '—'}</b>{best && <small>{formatSeasonYear(best.season)}</small>}</div>
    </div>
    <section className="history-rivals"><h4>Rivalries</h4>
      {rivals.length === 0 ? <p className="hint-text">No rivalries yet. Playoff meetings, close games and trades between teams build them over time.</p>
        : <div className="stat-table-scroll"><table className="db-table history-rivals-table"><thead><tr><th className="col-name">Opponent</th><th>Level</th><th>Reg. season</th><th>Close games</th><th>Playoff series</th><th>Last playoff meeting</th><th>Heat</th></tr></thead>
          <tbody>{rivals.map(r => { const us = r.a === team.teamId, opp = us ? r.b : r.a, last = r.eliminations.at(-1);
            return <tr key={opp}><td className="col-name"><TeamLink teamId={opp} name={teamName(opp)} /></td>
              <td className={`rival-level rival-${(r.level ?? 'none').replace(/\s/g, '-').toLowerCase()}`}>{r.level ?? 'Building'}</td>
              <td>{us ? r.winsA : r.winsB}–{us ? r.winsB : r.winsA}</td><td>{r.closeGames}</td>
              <td>{r.series ? `${us ? r.seriesWinsA : r.seriesWinsB}–${us ? r.seriesWinsB : r.seriesWinsA}` : '—'}{r.gameSevens ? <small> · {r.gameSevens} Game 7{r.gameSevens > 1 ? 's' : ''}</small> : null}</td>
              <td>{last ? `${formatSeasonYear(last.season)} · ${last.winner === team.teamId ? 'won' : 'lost'}` : '—'}</td>
              <td><span className="heat-bar" title={r.total.toFixed(1)}><span style={{ width: `${Math.min(100, r.total / 45 * 100)}%` }} /></span></td></tr>; })}</tbody></table></div>}
    </section>
    <section><h4>Season by season</h4>
      {seasons.some(s => s.imported) && <p className="hint-text">Seasons before {formatSeasonYear(String(league.historical?.startYear ?? ''))} are real NBA results (records, ratings, playoff qualification and titles; playoff rounds and rosters are in the NBA History archive). Franchise leaders below count seasons played in this league.</p>}
      {seasons.length === 0 ? <p className="empty-state">No seasons yet.</p> : <div className="stat-table-scroll"><table className="db-table stat-line-table history-table">
        <thead><tr><th>Season</th><th>W</th><th>L</th><th>Win%</th><th>ORtg</th><th>DRtg</th><th>Playoffs</th><th className="col-name">Best player</th><th /></tr></thead>
        <tbody>{[...seasons].reverse().map(s => { const top = s.roster[0]; const isOpen = open === s.season; return <Fragment key={s.season}>
          <tr className={`${s.inProgress ? 'current-season-row' : ''} finish-${(s.finish ?? 'unknown').toLowerCase().replace(/\s/g, '-')}`}>
            <td title={s.imported ? `Real NBA season ${s.season}–${String((Number(s.season) + 1) % 100).padStart(2, '0')} (imported)` : undefined}>{formatSeasonYear(s.season)}{s.inProgress && ' *'}{s.imported && s.teamName && s.teamName !== team.name ? <small> {s.teamName}</small> : null}</td><td>{s.wins ?? '—'}</td><td>{s.losses ?? '—'}</td>
            <td>{s.wins != null && s.losses != null && s.wins + s.losses > 0 ? (s.wins / (s.wins + s.losses)).toFixed(3).replace(/^0/, '') : '—'}</td>
            <td>{fx(s.ortg)}</td><td>{fx(s.drtg)}</td>
            <td className="history-finish">{s.finish === 'Champion' ? '🏆 Champion' : s.finish ?? '—'}{s.playoffRecord && <small> ({s.playoffRecord})</small>}</td>
            <td className="col-name">{top ? <button className="link-button" onClick={() => onSelectPlayer(top.playerId)}>{top.playerId}</button> : '—'}{top && <small> {top.pts.toFixed(1)} PTS{top.ws ? ` · ${top.ws.toFixed(1)} WS` : ''}</small>}</td>
            <td>{s.imported ? (onOpenArchive ? <button onClick={onOpenArchive} title="Real rosters are in the NBA History archive">Archive</button> : null) : <button onClick={() => setOpen(isOpen ? null : s.season)} aria-expanded={isOpen}>{isOpen ? 'Hide roster' : 'Roster'}</button>}</td>
          </tr>
          {isOpen && <tr className="history-roster-row"><td colSpan={9}>
            {s.reconstructed && <p className="hint-text">Rebuilt from player career logs (team record and playoff results were not archived for this season).</p>}
            {s.roster.length === 0 ? <p className="hint-text">No player lines on record.</p> : <table className="db-table stat-line-table"><thead><tr><th>#</th><th className="col-name">Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>GP</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>PER</th><th>WS</th></tr></thead>
              <tbody>{s.roster.map(r => <tr key={r.playerId}><td>{r.jerseyNumber ?? ''}</td><td className="col-name"><button className="link-button" onClick={() => onSelectPlayer(r.playerId)}>{r.playerId}</button></td><td>{r.position}</td><td>{r.age}</td><td>{r.overall}</td><td>{r.gp}</td>
                <td>{Math.round(r.min)}</td><td>{Math.round(r.pts)}</td><td>{Math.round(r.reb)}</td><td>{Math.round(r.ast)}</td><td>{Math.round(r.stl)}</td><td>{Math.round(r.blk)}</td><td>{r.per ? r.per.toFixed(1) : '—'}</td><td>{r.ws ? r.ws.toFixed(1) : '—'}</td></tr>)}</tbody></table>}
          </td></tr>}
        </Fragment>; })}</tbody>
      </table></div>}
    </section>
    <section><h4>Franchise leaders</h4>
      <div className="franchise-leaders">{leaders.map(l => <div key={l.label} className="leader-card"><small>{l.label.toUpperCase()}</small>
        <ol>{l.top.map(x => <li key={x.id}><button className="link-button" onClick={() => onSelectPlayer(x.id)}>{x.id}</button><b>{x.text}</b></li>)}</ol></div>)}</div>
      <p className="hint-text">Regular-season totals with this franchise.</p>
    </section>
  </div>;
}

