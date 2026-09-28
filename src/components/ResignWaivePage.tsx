import type { League } from '../simulation/league';
import type { GMLeagueExtras, Contract } from '../simulation/gm';
import { useState } from 'react';
import { waiveToFreeAgency, priorTeamId } from '../simulation/gm';
import type { PlayerSeason } from '../simulation/types';
import { signingDecision, signFreeAgentChecked } from '../simulation/freeAgentDecision';
import type { SeasonTransitionSummary } from '../simulation/seasonTransition';
import { FreeAgentTable } from './FreeAgentTable';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  summary: SeasonTransitionSummary | null;
  onChange: (league: League, extras: GMLeagueExtras) => void;
  onContinue: () => void;
  onSelectPlayer: (playerId: string) => void;
}

export function ResignWaivePage({ league, extras, controlledTeamId, summary, onChange, onContinue, onSelectPlayer }: Props) {
  const team = controlledTeamId ? league.teams.find((t) => t.teamId === controlledTeamId) : league.teams[0];
  const myOwnFreeAgents = team ? extras.freeAgents.filter((s) => priorTeamId(s) === team.teamId) : [];

  const [message, setMessage] = useState<string | null>(null);
  // Your own players (Bird rights: no cap-room limit) only care about how last season went and how they were treated.
  const quote = (p: PlayerSeason) => team ? signingDecision(league, extras, p, team.teamId) : null;
  const resign = (playerId: string, contract: Omit<Contract, 'playerId' | 'teamId'>, base: GMLeagueExtras = extras) => {
    if (!team) return;
    // signFreeAgentChecked applies the league AND the extras from one operation, so the player moves off the
    // free-agent list and onto the roster together.
    const result = signFreeAgentChecked(league, base, playerId, team.teamId, contract);
    if (!result.decision.accepted) { setMessage(result.decision.reason); return; }
    setMessage(`${playerId} re-signed.`);
    onChange(result.league, result.extras);
  };

  return (
    <div className="settings-page">
      <section>
        <h4>Re-sign Your Own Free Agents</h4>
        <p className="hint-text">
          Before the open market starts, you get an exclusive window to re-sign anyone who was on your own roster
          last season (expired contracts or players you waived). Anyone you don't re-sign now heads into general
          free agency, fair game for every team.
        </p>
        {summary && (
          <p className="hint-text">
            This offseason: {summary.retiredPlayerIds.length} retired, {summary.expiredToFreeAgencyIds.length} hit free
            agency via expiring contracts, {summary.retainedViaOptionIds.length} were retained via a contract option.
          </p>
        )}
      </section>

      {message && <p className="hint-text" role="status">{message}</p>}
      {team && (
        myOwnFreeAgents.length > 0 ? (
          <FreeAgentTable
            title={`${team.name} — Your Free Agents`}
            players={myOwnFreeAgents}
            team={team}
            contracts={extras.contracts}
            capSettings={extras.capSettings}
            canSign
            onSign={resign}
            quote={quote}
            onSelectPlayer={onSelectPlayer}
            talks={{ league, extras, teamId: team.teamId, onUpdate: e => onChange(league, e), onAgree: resign }}
          />
        ) : (
          <section><p className="hint-text">None of your own players are free agents this offseason.</p></section>
        )
      )}

      {team && (
        <section>
          <h4>Waive a Current Player</h4>
          <p className="hint-text">Waived players go straight into the general free-agent pool for any team, including yours, to sign later.</p>
          <div className="badge-grid">
            {team.seasons.map((s) => (
              <button
                key={s.playerId}
                className="fa-card"
                onClick={() => {
                  const { league: l, extras: e } = waiveToFreeAgency(league, extras, s.playerId, team.teamId, controlledTeamId);
                  onChange(l, e);
                }}
              >
                Waive {s.playerId}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <button className="primary" onClick={onContinue}>Done Re-signing — Continue to Free Agency</button>
      </section>
    </div>
  );
}

