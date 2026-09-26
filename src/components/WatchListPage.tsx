import { PixelIcon } from './PixelIcon';
import { TeamLink } from './TeamLink';
import type { LeagueTeam } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { toggleWatchList } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { primaryPosition } from '../simulation/teamStatus';
import { perGameAverages } from '../simulation/careerStats';
import type { PlayerSeason } from '../simulation/types';
import { PlayerNameTag } from './PlayerAvatar';

interface Props {
  teams: LeagueTeam[];
  extras: GMLeagueExtras;
  onExtrasChange: (extras: GMLeagueExtras) => void;
  onSelectPlayer: (playerId: string) => void;
}

export function WatchListPage({ teams, extras, onExtrasChange, onSelectPlayer }: Props) {
  const watchIds = new Set(extras.watchList ?? []);
  const teamNameByPlayer = new Map<string, string>();
  const seasonByPlayer = new Map<string, PlayerSeason>();
  for (const t of teams) for (const s of t.seasons) { seasonByPlayer.set(s.playerId, s); teamNameByPlayer.set(s.playerId, t.name); }
  for (const s of extras.freeAgents) { seasonByPlayer.set(s.playerId, s); teamNameByPlayer.set(s.playerId, 'Free Agent'); }

  const rows = [...watchIds]
    .map((id) => seasonByPlayer.get(id))
    .filter((s): s is PlayerSeason => !!s)
    .map((s) => ({ season: s, overall: calculateOverall(s), avg: perGameAverages(s.seasonStats) }))
    .sort((a, b) => b.overall - a.overall);

  return (
    <div className="watch-list-page">
      <h4>Watch List</h4>
      <p className="hint-text">
        Players you're tracking as trade targets, prospects to watch, or rivals — tap <PixelIcon name="star" /> Watch on any player's
        profile to add them here.
      </p>
      {rows.length === 0 ? (
        <p className="empty-state">Nobody on your watch list yet.</p>
      ) : (
        <table className="db-table stat-line-table">
          <thead>
            <tr><th className="col-name">Name</th><th>Team</th><th>Pos</th><th>Age</th><th>Ovr</th><th>PPG</th><th>RPG</th><th>APG</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.season.playerId}>
                <td className="col-name" style={{ cursor: 'pointer' }} onClick={() => onSelectPlayer(r.season.playerId)}>
                  <PlayerNameTag playerId={r.season.playerId} teamId={r.season.teamId} jerseyNumber={r.season.jerseyNumber} size={24} />
                </td>
                <td><TeamLink name={teamNameByPlayer.get(r.season.playerId) ?? '—'} /></td>
                <td>{primaryPosition(r.season)}</td>
                <td>{r.season.age}</td>
                <td>{r.overall}</td>
                <td>{r.avg.ppg.toFixed(1)}</td>
                <td>{r.avg.rpg.toFixed(1)}</td>
                <td>{r.avg.apg.toFixed(1)}</td>
                <td><button onClick={() => onExtrasChange(toggleWatchList(extras, r.season.playerId))}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
