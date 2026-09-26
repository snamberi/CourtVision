import { useState } from 'react';
import type { League } from '../simulation/league';
import { formatSeasonYear } from '../simulation/calendar';
import { summerStandings, type SummerGame } from '../simulation/draftSeason';
import { BoxScoreTable } from './BoxScoreTable';
import { PlayerNameTag } from './PlayerAvatar';
import { TeamLink } from './TeamLink';
import { PixelTrophy } from './PixelTrophy';

interface Props {
  league: League;
  controlledTeamId: string | null;
  canPlay: boolean;
  busy: boolean;
  onPlay: () => void;
  onContinue?: () => void;
  onSelectPlayer: (id: string) => void;
}

/** Summer League: rookies, young players and invited free agents, right after the draft. */
export function SummerLeaguePage({ league, controlledTeamId, canPlay, busy, onPlay, onContinue, onSelectPlayer }: Props) {
  const sl = league.summerLeague;
  const [openGame, setOpenGame] = useState<string | null>(null);
  const name = (id: string | null) => league.teams.find(t => t.teamId === id)?.name ?? id ?? '—';
  const current = sl && sl.season === league.season;
  const header = <div className="stats-section-header"><h4>Summer League</h4></div>;

  if (!sl || (!current && canPlay)) {
    return <div className="summer-league">
      {header}
      <section className="dashboard-panel summer-intro">
        <p>After the draft, every team sends its rookies and young players to Summer League. Teams short of players invite undrafted free agents looking for a contract.</p>
        <p className="hint-text">Four 40-minute games each, then the two best records play for the title. It's a showcase: results don't change ratings, season stats or contracts.</p>
        {canPlay ? <button className="primary" disabled={busy} onClick={onPlay}>{busy ? 'Playing…' : `Play the ${formatSeasonYear(league.season)} Summer League`}</button>
          : <p className="hint-text">Summer League opens when the draft is complete.</p>}
      </section>
      {sl && <p className="hint-text">Last played: {formatSeasonYear(sl.season)}, won by {name(sl.championTeamId)}.</p>}
    </div>;
  }

  const standings = summerStandings(sl);
  const leaders = Object.values(sl.lines).filter(l => l.gp >= 2).sort((a, b) => b.pts / b.gp - a.pts / a.gp).slice(0, 15);
  const mine = controlledTeamId ? sl.games.filter(g => g.homeTeamId === controlledTeamId || g.awayTeamId === controlledTeamId || g.final) : sl.games.filter(g => g.final);
  const myPlayers = controlledTeamId ? Object.values(sl.lines).filter(l => l.teamId === controlledTeamId).sort((a, b) => b.pts - a.pts) : [];
  const final = sl.games.find(g => g.final);
  const pg = (v: number, gp: number) => (v / Math.max(1, gp)).toFixed(1);

  return <div className="summer-league">
    {header}
    <section className="summer-banner">
      <div><PixelTrophy award="champion" size={34} /><div><small>{formatSeasonYear(sl.season)} SUMMER LEAGUE CHAMPIONS</small><b><TeamLink name={name(sl.championTeamId)} /></b>
        {final && <span className="hint-text">Beat {name(final.homeTeamId === sl.championTeamId ? final.awayTeamId : final.homeTeamId)} {Math.max(final.homeScore, final.awayScore)}–{Math.min(final.homeScore, final.awayScore)} in the final</span>}</div></div>
      {sl.mvpId && <div><PixelTrophy award="mvp" size={34} /><div><small>SUMMER LEAGUE MVP</small><button className="prospect-name" onClick={() => onSelectPlayer(sl.mvpId!)}><PlayerNameTag playerId={sl.mvpId} size={26} /></button></div></div>}
      {onContinue && <button className="primary" onClick={onContinue}>Continue to re-signing</button>}
    </section>

    <div className="gm-office-grid">
      <section className="dashboard-panel">
        <h5>All-Summer team</h5>
        <ul className="summer-list">{sl.allSummer.map(id => { const l = sl.lines[id]; return <li key={id}>
          <button className="prospect-name" onClick={() => onSelectPlayer(id)}><PlayerNameTag playerId={id} size={22} /></button>
          <span className="hint-text">{name(l?.teamId ?? null)} · {l ? `${pg(l.pts, l.gp)} PTS · ${pg(l.reb, l.gp)} REB · ${pg(l.ast, l.gp)} AST` : ''}</span></li>; })}</ul>
      </section>
      {controlledTeamId && <section className="dashboard-panel">
        <h5>Your summer roster</h5>
        {myPlayers.length ? <div className="finances-table-wrap"><table className="db-table stat-line-table">
          <thead><tr><th>Player</th><th>GP</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>FG%</th></tr></thead>
          <tbody>{myPlayers.map(l => <tr key={l.playerId}><td><button className="prospect-name" onClick={() => onSelectPlayer(l.playerId)}><PlayerNameTag playerId={l.playerId} size={20} /></button>{sl.invitees.includes(l.playerId) && <small className="hint-text"> · invite</small>}</td>
            <td>{l.gp}</td><td>{pg(l.min, l.gp)}</td><td>{pg(l.pts, l.gp)}</td><td>{pg(l.reb, l.gp)}</td><td>{pg(l.ast, l.gp)}</td><td>{l.fga ? `${(l.fgm / l.fga * 100).toFixed(1)}%` : '—'}</td></tr>)}</tbody>
        </table></div> : <p className="hint-text">Your team had no one eligible this summer.</p>}
        <p className="hint-text">Invited free agents are unsigned: sign the ones who impressed during free agency.</p>
      </section>}
    </div>

    <section className="dashboard-panel">
      <h5>{controlledTeamId ? 'Your games and the final' : 'The final'}</h5>
      <ul className="summer-games">{mine.map(g => <SummerGameRow key={g.id} g={g} name={name} open={openGame === g.id} onToggle={() => setOpenGame(openGame === g.id ? null : g.id)} onSelectPlayer={onSelectPlayer} />)}</ul>
    </section>

    <div className="gm-office-grid">
      <section className="dashboard-panel">
        <h5>Standings</h5>
        <div className="finances-table-wrap"><table className="db-table stat-line-table">
          <thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>DIFF</th></tr></thead>
          <tbody>{standings.map((r, i) => <tr key={r.teamId} className={r.teamId === controlledTeamId ? 'current-season-row' : undefined}><td>{i + 1}</td><td><TeamLink name={name(r.teamId)} /></td><td>{r.w}</td><td>{r.l}</td><td>{r.diff > 0 ? '+' : ''}{r.diff}</td></tr>)}</tbody>
        </table></div>
      </section>
      <section className="dashboard-panel">
        <h5>Scoring leaders</h5>
        <div className="finances-table-wrap"><table className="db-table stat-line-table">
          <thead><tr><th>Player</th><th>Team</th><th>GP</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
          <tbody>{leaders.map(l => <tr key={l.playerId} className={l.teamId === controlledTeamId ? 'current-season-row' : undefined}>
            <td><button className="prospect-name" onClick={() => onSelectPlayer(l.playerId)}><PlayerNameTag playerId={l.playerId} size={20} /></button></td>
            <td><TeamLink name={name(l.teamId)} /></td><td>{l.gp}</td><td>{pg(l.pts, l.gp)}</td><td>{pg(l.reb, l.gp)}</td><td>{pg(l.ast, l.gp)}</td></tr>)}</tbody>
        </table></div>
      </section>
    </div>
  </div>;
}

function SummerGameRow({ g, name, open, onToggle, onSelectPlayer }: { g: SummerGame; name: (id: string) => string; open: boolean; onToggle: () => void; onSelectPlayer: (id: string) => void }) {
  return <li className={`summer-game${g.final ? ' summer-game--final' : ''}`}>
    <div className="summer-game-line">
      <span className="summer-game-day">{g.final ? 'FINAL' : `DAY ${g.day}`}</span>
      <span className={g.awayScore > g.homeScore ? 'won' : ''}>{name(g.awayTeamId)} {g.awayScore}</span>
      <span className="hint-text">@</span>
      <span className={g.homeScore > g.awayScore ? 'won' : ''}>{name(g.homeTeamId)} {g.homeScore}</span>
      {g.homeBox && g.awayBox && <button onClick={onToggle} aria-expanded={open}>{open ? 'Hide box score' : 'Box score'}</button>}
    </div>
    {open && g.homeBox && g.awayBox && <div className="summer-box">
      <BoxScoreTable box={g.awayBox} title={name(g.awayTeamId)} onSelectPlayer={onSelectPlayer} />
      <BoxScoreTable box={g.homeBox} title={name(g.homeTeamId)} onSelectPlayer={onSelectPlayer} />
    </div>}
  </li>;
}
