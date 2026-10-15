import { relicRunOpts } from '../relics/apply';
import { TeamLink } from './TeamLink';
import type { League } from '../simulation/league';
import type { GMLeagueExtras, FutureDraftPick } from '../simulation/gm';
import { canManageTeam, toggleTradeBlock, computeTradeValue, tradeableFuturePicks, computeFutureDraftPickValue, togglePickOnBlock, isTradeDeadlinePassed, validateTrade, executeTrade } from '../simulation/gm';
import { seekTradeOffers, type SoughtOffer } from '../simulation/seekOffers';
import { calculateOverall } from '../simulation/engine/overall';
import { useState } from 'react';
import { PlayerNameTag } from './PlayerAvatar';
import './seekTrade.css';

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
  const myTeam = league.teams.find(t => t.teamId === controlledTeamId);
  const myBlock = myTeam ? myTeam.seasons.filter(s => extras.tradeBlock.includes(s.playerId)).length + tradeableFuturePicks(extras, myTeam.teamId).filter(p => picksOnBlock.includes(p.id)).length : 0;
  const [offers, setOffers] = useState<SoughtOffer[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const seek = () => {
    if (!myTeam) return;
    // The Phone Tree (a secret relic): four more teams pick up.
    const found = seekTradeOffers(league, extras, myTeam.teamId, relicRunOpts().phoneTree ? 16 : 12);
    setOffers(found);
    setNote(found.length ? null : 'No team can make a fair offer for this package right now. Try a different mix of players or picks.');
  };
  const accept = (o: SoughtOffer) => {
    const check = validateTrade(league, extras, o.proposal);
    if (!check.valid) { setNote(check.reasons[0] ?? 'That deal is no longer possible.'); return; }
    const done = executeTrade(league, extras, o.proposal);
    onChange(done.league, done.extras);
    setOffers(null);
    setNote(`Deal done with ${league.teams.find(t => t.teamId === o.proposal.teamBId)?.name ?? o.proposal.teamBId}.`);
  };
  const playerLine = (teamId: string, ids: string[]) => ids.map(id => { const p = league.teams.find(t => t.teamId === teamId)?.seasons.find(s => s.playerId === id); return p ? `${id} (${calculateOverall(p)})` : id; });
  const pickLine = (ids: string[] = []) => ids.map(id => { const pk = extras.futurePicks?.find(x => x.id === id); return pk ? pickLabel(pk) : id; });

  return (
    <div>
      {deadlinePassed && <p className="calendar-banner">Trade deadline has passed for this season - listed players and picks can't be traded away until next season.</p>}
      <p className="hint-text">Players and future draft picks any team has marked as available for trade discussion.</p>
      {blockedPlayers.length === 0 && blockedPicks.length === 0 && <p className="empty-state">Nothing on the trade block yet.</p>}
      {myTeam && <section className="seek-trade" aria-label="Seek trade offers">
        <div className="seek-trade-head">
          <div><b>Seek trade</b><small>Put everything you want to move on the block, then every team answers at once with offers you can accept on the spot.</small></div>
          <button className="primary" disabled={!myBlock || deadlinePassed} onClick={seek}>Seek trade{myBlock ? ` (${myBlock} on the block)` : ''}</button>
        </div>
        {!myBlock && <p className="hint-text">Add your players or picks to the block below first.</p>}
        {note && <p className="hint-text" role="status">{note}</p>}
        {offers && offers.length > 0 && <ol className="seek-trade-offers">{offers.map((o, i) => {
          const them = league.teams.find(t => t.teamId === o.proposal.teamBId);
          const get = [...playerLine(o.proposal.teamBId, o.proposal.playersFromB), ...pickLine(o.proposal.picksFromB)];
          return <li key={`${o.proposal.teamBId}-${i}`}>
            <span className="seek-offer-team"><TeamLink name={them?.name ?? o.proposal.teamBId} /></span>
            <span className="seek-offer-get">You get: <b>{get.join(', ')}</b></span>
            {showValues && <small>Value to you {Math.round(o.yourValue)}</small>}
            <button className="primary" onClick={() => accept(o)}>Accept</button>
          </li>;
        })}</ol>}
      </section>}

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
