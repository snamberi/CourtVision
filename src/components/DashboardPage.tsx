import type { ReactNode } from 'react';
import { TeamLogo } from './TeamLogo';
import { useTeamIdentity } from '../visuals/TeamIdentityContext';
import { CupCard } from './CupPage';
import { OwnerOfficeCard } from './FrontOfficePanels';
import { TeamLink, TeamText } from './TeamLink';
import type { League, SeasonPhase } from '../simulation/league';
import { computeStandings, computeConferenceStandings, hasConferenceStructure, gamesRemainingForTeam, totalGamesForTeam } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { teamPayroll } from '../simulation/gm';
import { computeTeamFinances } from '../simulation/finances';
import { computeTeamStats } from '../simulation/teamStats';
import { generateNewsFeed } from '../simulation/news';
import { perGameAverages } from '../simulation/careerStats';
import { calculateOverall } from '../simulation/engine/overall';
import { primaryPosition, effectiveRotation } from '../simulation/teamStatus';
import type { PlayerSeason } from '../simulation/types';
import { PlayerAvatar, PlayerNameTag } from './PlayerAvatar';
import { PixelIcon } from './PixelIcon';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  seasonPhase: SeasonPhase;
  onGoTo: (tab: string) => void;
  onSelectPlayer?: (playerId: string) => void;
  /** Season road map, shown under the heading. */
  roadMap?: ReactNode;
  /** First-season checklist, shown beside the road map. */
  checklist?: ReactNode;
  /** Extra control beside "Manage roster" (the hidden checklist's chip). */
  headerExtra?: ReactNode;
  /** Simple mode before Staff & finances unlocks. */
  hideFinances?: boolean;
}

const PHASE_LABEL: Record<SeasonPhase, string> = {
  regular_season: 'Regular Season', all_star: 'All-Star Weekend', playoffs: 'Playoffs', awards_recap: 'Awards Recap',
  draft: 'Draft', resign_waive: 'Re-sign / Waive', free_agency: 'Free Agency', preseason: 'Preseason',
};

function leaderIn(players: PlayerSeason[], key: 'ppg' | 'rpg' | 'apg'): { player: PlayerSeason; value: number } | null {
  let best: { player: PlayerSeason; value: number } | null = null;
  for (const p of players) {
    const avg = perGameAverages(p.seasonStats);
    if (avg.gamesPlayed === 0) continue;
    const value = avg[key];
    if (!best || value > best.value) best = { player: p, value };
  }
  return best;
}

export function DashboardPage({ league, extras, controlledTeamId, seasonPhase, onGoTo, onSelectPlayer, roadMap, checklist, headerExtra, hideFinances = false }: Props) {
  const standings = computeStandings(league);
  const team = controlledTeamId ? league.teams.find((t) => t.teamId === controlledTeamId) : league.teams[0];
  const record = team ? standings.find((r) => r.teamId === team.teamId) : null;
  const unplayed = gamesRemainingForTeam(league, team?.teamId ?? null);
  const total = totalGamesForTeam(league, team?.teamId ?? null);

  const conferenceRows = hasConferenceStructure(league) && team?.conferenceId
    ? computeConferenceStandings(league)[team.conferenceId]
    : standings;
  const confRank = conferenceRows.findIndex((r) => r.teamId === team?.teamId) + 1;

  const allPlayers = league.teams.flatMap((t) => t.seasons);
  const teamStatRows = computeTeamStats(league);
  const myStats = teamStatRows.find((r) => r.teamId === team?.teamId);
  const rankOf = (key: 'ppg' | 'oppPpg' | 'rpg' | 'apg') => {
    if (!myStats) return null;
    const sorted = [...teamStatRows].sort((a, b) => (key === 'oppPpg' ? a[key] - b[key] : b[key] - a[key]));
    return sorted.findIndex((r) => r.teamId === myStats.teamId) + 1;
  };

  const finances = team ? computeTeamFinances(team, extras.contracts, extras.capSettings, league.rulesSettings, record?.winPct ?? 0.5) : null;
  const payroll = team ? teamPayroll(extras.contracts, team) : 0;
  const news = generateNewsFeed(league, extras, 6);

  const rotation = team ? effectiveRotation(team) : {};
  const starters = team
    ? [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a)).filter((s) => rotation[s.playerId] === 'starter').slice(0, 5)
    : [];

  const nextGame = team
    ? league.schedule.find((g) => !g.played && (g.homeTeamId === team.teamId || g.awayTeamId === team.teamId))
    : null;
  const opponentId = nextGame ? (nextGame.homeTeamId === team?.teamId ? nextGame.awayTeamId : nextGame.homeTeamId) : null;
  const opponent = opponentId ? league.teams.find((t) => t.teamId === opponentId) : null;

  const identity = useTeamIdentity(team?.teamId);
  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div><span className="pixel-eyebrow">{league.season} / {PHASE_LABEL[seasonPhase]}</span><h1>Franchise HQ</h1></div>
        <div className="dashboard-heading-actions">{headerExtra}<button onClick={() => onGoTo('roster')}><PixelIcon name="team" size={16} /> Manage roster</button></div>
      </div>
      {(roadMap || checklist) && <div className={`home-top ${checklist ? 'with-checklist' : ''}`}>{roadMap}{checklist}</div>}
      <div className="dashboard-hero" style={identity ? { ['--team-1' as string]: identity.primary, ['--team-2' as string]: identity.secondary } : undefined}>
        <div className="dashboard-franchise"><span className="pixel-eyebrow">{controlledTeamId ? 'YOUR FRANCHISE' : 'LEAGUE SPOTLIGHT'}</span>
          <div className="dashboard-franchise-row">{team && <TeamLogo team={team} size={64} />}<h2><TeamLink name={team?.name ?? 'Court Vision'} /></h2></div>
          <span className="dashboard-season">{PHASE_LABEL[seasonPhase]} · {total - unplayed} / {total} games</span></div>
        <div className="dashboard-hero-record">
          <span className="dashboard-hero-wl">{record ? `${record.wins}-${record.losses}` : '0-0'}</span>
          <span className="hint-text">
            {confRank > 0 ? `${ordinal(confRank)} in conference` : '—'} · {PHASE_LABEL[seasonPhase]}
          </span>
          <span className="hint-text">{total - unplayed}/{total} games played</span>
          {nextGame && opponent && (
            <span className="hint-text">
              Next: {nextGame.homeTeamId === team?.teamId ? 'vs' : '@'} <TeamLink name={opponent.name} />
            </span>
          )}
        </div>
      </div>

      {starters.length > 0 && <section className="lineup-showcase" aria-label="Starting five">
        <div className="lineup-showcase-header"><h5><PixelIcon name="court" size={16} /> Starting five</h5><span className="hint-text">Select a player to scout</span></div>
        <div className="lineup-sprites">
          {starters.map((player) => <button key={player.playerId} className="lineup-player" onClick={() => onSelectPlayer?.(player.playerId)} disabled={!onSelectPlayer}>
            <span className="lineup-player-position">{primaryPosition(player)}</span>
            <span className="lineup-player-ovr">{calculateOverall(player)}<small>OVR</small></span>
            <PlayerAvatar playerId={player.playerId} teamId={player.teamId} jerseyNumber={player.jerseyNumber} age={player.age} size={80} />
            <span className="lineup-player-name">{player.playerId}</span>
            <span className="lineup-player-detail">#{player.jerseyNumber ?? '—'} · {player.age} YRS</span>
          </button>)}
        </div>
      </section>}

      <div className="dashboard-duo">
        <OwnerOfficeCard league={league} extras={extras} onOpen={() => onGoTo('gmOffice')} />
        <CupCard league={league} controlledTeamId={controlledTeamId} onOpen={() => onGoTo('cup')} />
      </div>

      <div className="dashboard-columns">
        <section className="dashboard-panel">
          <h5>Conference</h5>
          <table className="db-table stat-line-table">
            <tbody>
              {conferenceRows.slice(0, 15).map((r, i) => (
                <tr key={r.teamId} className={r.teamId === team?.teamId ? 'current-season-row' : undefined}>
                  <td>{i + 1}</td>
                  <td className="col-name"><TeamLink name={league.teams.find((t) => t.teamId === r.teamId)?.name ?? r.teamId} /></td>
                  <td>{r.wins}-{r.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="dashboard-link" onClick={() => onGoTo('standings')}>» League Standings</button>
        </section>

        <section className="dashboard-panel">
          <h5>Team Leaders</h5>
          {team && (['ppg', 'rpg', 'apg'] as const).map((key) => {
            const lead = leaderIn(team.seasons, key);
            return (
              <p key={key} className="dashboard-leader">
                {lead ? (
                  <>
                    <span className="award-team-player" onClick={() => onSelectPlayer?.(lead.player.playerId)}>{lead.player.playerId}</span>
                    {' '}{lead.value.toFixed(1)} {key.replace('pg', '').toUpperCase()}
                  </>
                ) : <span className="hint-text">No games played yet.</span>}
              </p>
            );
          })}

          <h5>League Leaders</h5>
          {(['ppg', 'rpg', 'apg'] as const).map((key) => {
            const lead = leaderIn(allPlayers, key);
            return (
              <p key={key} className="dashboard-leader">
                {lead ? (
                  <>
                    <span className="award-team-player" onClick={() => onSelectPlayer?.(lead.player.playerId)}>{lead.player.playerId}</span>
                    {' '}{lead.value.toFixed(1)} {key.replace('pg', '').toUpperCase()}
                  </>
                ) : <span className="hint-text">No games played yet.</span>}
              </p>
            );
          })}
          <button className="dashboard-link" onClick={() => onGoTo('playerStats')}>» Player Stats</button>
        </section>

        <section className="dashboard-panel">
          <h5>Team Stats</h5>
          {myStats ? (
            <>
              <p className="dashboard-stat-line">Points: {myStats.ppg.toFixed(1)} ({ordinal(rankOf('ppg')!)})</p>
              <p className="dashboard-stat-line">Allowed: {myStats.oppPpg.toFixed(1)} ({ordinal(rankOf('oppPpg')!)})</p>
              <p className="dashboard-stat-line">Rebounds: {myStats.rpg.toFixed(1)} ({ordinal(rankOf('rpg')!)})</p>
              <p className="dashboard-stat-line">Assists: {myStats.apg.toFixed(1)} ({ordinal(rankOf('apg')!)})</p>
            </>
          ) : <p className="hint-text">No stats yet.</p>}
          <button className="dashboard-link" onClick={() => onGoTo('teamStats')}>» Team Stats</button>

          {!hideFinances && <><h5>Finances</h5>
          {finances && (
            <>
              <p className="dashboard-stat-line">Revenue: ${(finances.annualRevenue / 1_000_000).toFixed(1)}M</p>
              <p className="dashboard-stat-line">Profit: {finances.operatingIncome >= 0 ? '+' : ''}${(finances.operatingIncome / 1_000_000).toFixed(1)}M</p>
              <p className="dashboard-stat-line">Payroll: ${(payroll / 1_000_000).toFixed(1)}M</p>
              <p className="dashboard-stat-line">Salary Cap: ${(extras.capSettings.salaryCap / 1_000_000).toFixed(1)}M</p>
              <p className="dashboard-stat-line">Health: <span className={`fin-health-${finances.financialHealth.toLowerCase()}`}>{finances.financialHealth}</span></p>
            </>
          )}
          <button className="dashboard-link" onClick={() => onGoTo('finances')}>» Team Finances</button></>}
        </section>

        <section className="dashboard-panel">
          <h5>League Headlines</h5>
          {news.length === 0 ? (
            <p className="hint-text">Welcome to your new league!</p>
          ) : news.map((n) => (
            <div key={n.id} className="dashboard-news-item">
              <span className="news-card-team"><TeamLink name={n.teamName ?? 'League'} /></span>
              <p className="dashboard-news-body"><TeamText text={n.headline} /></p>
            </div>
          ))}
          <button className="dashboard-link" onClick={() => onGoTo('news')}>» News Feed</button>
        </section>
      </div>

      <section className="dashboard-panel dashboard-lineup">
        <h5>Starting Lineup</h5>
        {starters.length === 0 ? (
          <p className="hint-text">No lineup set.</p>
        ) : (
          <table className="db-table stat-line-table">
            <thead>
              <tr><th className="col-name">Name</th><th>Pos</th><th>Age</th><th>Ovr</th><th>Pot</th><th>Contract</th><th>MP</th><th>PTS</th><th>TRB</th><th>AST</th></tr>
            </thead>
            <tbody>
              {starters.map((s) => {
                const avg = perGameAverages(s.seasonStats);
                const contract = extras.contracts[s.playerId];
                return (
                  <tr key={s.playerId}>
                    <td className="col-name"><button className="player-name-button" onClick={() => onSelectPlayer?.(s.playerId)}><PlayerNameTag playerId={s.playerId} teamId={s.teamId} jerseyNumber={s.jerseyNumber} size={24} /></button></td>
                    <td>{primaryPosition(s)}</td>
                    <td>{s.age}</td>
                    <td>{calculateOverall(s)}</td>
                    <td>{s.development.potential.toFixed(0)}</td>
                    <td>{contract ? `$${(contract.annualSalary / 1_000_000).toFixed(1)}M · ${contract.yearsRemaining}y` : '—'}</td>
                    <td>{avg.mpg.toFixed(1)}</td>
                    <td>{avg.ppg.toFixed(1)}</td>
                    <td>{avg.rpg.toFixed(1)}</td>
                    <td>{avg.apg.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <button className="dashboard-link" onClick={() => onGoTo('roster')}>» Full Roster</button>
      </section>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
