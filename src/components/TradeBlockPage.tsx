import { TeamLink } from './TeamLink';
import type { League } from '../simulation/league';
import type { GMLeagueExtras, FutureDraftPick } from '../simulation/gm';
import { canManageTeam, toggleTradeBlock, computeTradeValue, tradeableFuturePicks, computeFutureDraftPickValue, togglePickOnBlock, isTradeDeadlinePassed } from '../simulation/gm';
import { PlayerNameTag } from './PlayerAvatar';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  onChange: (league: League, extras: GMLeagueExtras) => void;
  onSelectPlayer: (id: string) => void;
}

function pickLabel(pick: FutureDraftPick): string {
  return `${pick.year} Round ${pick.round}${pick.protection ? ` (${pick.protection.label})` : ''}`;
}

export function TradeBlockPage({ league, extras, controlledTeamId, onChange, onSelectPlayer }: Props) {
  const blockedPlayers = league.teams.flatMap((t) => t.seasons.filter((s) => extras.tradeBlock.includes(s.playerId)).map((s) => ({ season: s, team: t })));
  const currentYear = parseInt((league.season ?? '2026').slice(0, 4), 10);
  const picksOnBlock = extras.picksOnBlock ?? [];
  const blockedPicks = (extras.futurePicks ?? [])
    .filter((p) => picksOnBlock.includes(p.id))
    .map((pick) => ({ pick, team: league.teams.find((t) => t.teamId === pick.currentOwnerTeamId) }));

  const deadlinePassed = isTradeDeadlinePassed(league);
  const showValues = extras.tradeSettings.showValues === true;

  return (
    <div>
      {deadlinePassed && <p className="calendar-banner">Trade deadline has passed for this season - listed players and picks can't be traded away until next season.</p>}
      <p className="hint-text">Players and future draft picks any team has marked as available for trade discussion.</p>
      {blockedPlayers.length === 0 && blockedPicks.length === 0 && <p className="empty-state">Nothing on the trade block yet.</p>}

      {blockedPlayers.length > 0 && (
        <table className="db-table">
          <thead><tr><th>Player</th><th>Team</th>{showValues && <th>Trade Value</th>}<th></th></tr></thead>
          <tbody>
            {blockedPlayers.map(({ season, team }) => (
              <tr key={season.playerId}>
                <td onClick={() => onSelectPlayer(season.playerId)} style={{ cursor: 'pointer' }}><PlayerNameTag playerId={season.playerId} teamId={season.teamId} jerseyNumber={season.jerseyNumber} size={22} /></td>
                <td><TeamLink name={team.name} /></td>
                {showValues && <td>{computeTradeValue(season).toFixed(0)}</td>}
                <td>
                  {canManageTeam(controlledTeamId, team.teamId) && (
                    <button onClick={() => onChange(league, toggleTradeBlock(extras, season.playerId))}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {blockedPicks.length > 0 && (
        <>
          <h5 className="stats-subheading">Draft Picks on the Block</h5>
          <table className="db-table">
            <thead><tr><th>Pick</th><th>Team</th>{showValues && <th>Value</th>}<th></th></tr></thead>
            <tbody>
              {blockedPicks.map(({ pick, team }) => (
                <tr key={pick.id}>
                  <td>{pickLabel(pick)}</td>
                  <td><TeamLink name={team?.name ?? pick.currentOwnerTeamId} /></td>
                  {showValues && <td>{computeFutureDraftPickValue(pick, league, currentYear)}</td>}
                  <td>
                    {team && canManageTeam(controlledTeamId, team.teamId) && (
                      <button onClick={() => onChange(league, togglePickOnBlock(extras, pick.id))}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h5>Add your players to the block</h5>
      {league.teams.filter((t) => canManageTeam(controlledTeamId, t.teamId)).map((t) => (
        <div key={t.teamId} className="badge-grid">
          {t.seasons.filter((s) => !extras.tradeBlock.includes(s.playerId)).map((s) => (
            <button key={s.playerId} className="fa-card" onClick={() => onChange(league, toggleTradeBlock(extras, s.playerId))}>
              Add <PlayerNameTag playerId={s.playerId} teamId={s.teamId} jerseyNumber={s.jerseyNumber} size={20} />
            </button>
          ))}
        </div>
      ))}

      <h5>Add your draft picks to the block</h5>
      {league.teams.filter((t) => canManageTeam(controlledTeamId, t.teamId)).map((t) => {
        const available = tradeableFuturePicks(extras, t.teamId).filter((p) => !picksOnBlock.includes(p.id));
        return (
          <div key={t.teamId} className="badge-grid">
            {available.length === 0 && <p className="hint-text">No draft picks available to list.</p>}
            {available.map((pick) => (
              <button key={pick.id} className="fa-card" onClick={() => onChange(league, togglePickOnBlock(extras, pick.id))}>
                Add {pickLabel(pick)}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
