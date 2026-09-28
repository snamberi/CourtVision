import { signingDecision, signFreeAgentChecked, strengthRanking } from '../simulation/freeAgentDecision';
import { TeamLink, TeamText } from './TeamLink';
import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { Contract, GMLeagueExtras } from '../simulation/gm';
import {
  capSpaceRemaining, signFreeAgent, canManageTeam, hasRosterRoom,
} from '../simulation/gm';
import { runFreeAgencyAI } from '../simulation/aiGM';
import { addDays, formatDisplayDate } from '../simulation/calendar';
import { FreeAgentTable } from './FreeAgentTable';

interface Props {
  sandboxMode?: boolean;
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  onChange: (league: League, extras: GMLeagueExtras) => void;
  onSelectPlayer: (id: string) => void;
}

export function FreeAgencyPage({ league, extras, controlledTeamId, onChange, onSelectPlayer, sandboxMode = false }: Props) {
  const [selectedTeamId, setSignTeamId] = useState(controlledTeamId ?? league.teams[0]?.teamId ?? '');
  const signTeamId = sandboxMode ? selectedTeamId : controlledTeamId ?? ''; 
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const manageableTeams = league.teams.filter((t) => canManageTeam(controlledTeamId, t.teamId));
  const signTeam = league.teams.find((t) => t.teamId === signTeamId);
  const ranking = useMemo(() => strengthRanking(league), [league]);
  const signTeamCapSpace = signTeam ? capSpaceRemaining(extras.contracts, signTeam, extras.capSettings) : 0;
  const signTeamOverCap = extras.capSettings.enforceCapOnTrades && signTeamCapSpace <= 0;
  const signTeamRosterFull = signTeam ? !hasRosterRoom(signTeam, extras.capSettings) : false;
  const inSeasonFlowWindow = extras.freeAgencyDaysRemaining > 0;

  const runAIPass = () => {
    const result = runFreeAgencyAI(league, extras, controlledTeamId, Date.now());
    onChange(result.league, result.extras);
    setAiMessage(result.signings.length > 0
      ? `AI teams signed: ${result.signings.map((s) => `${s.playerId} (${s.teamName})`).join(', ')}.`
      : 'No AI teams needed to sign anyone right now.');
  };

  const advanceOneDay = () => {
    const result = runFreeAgencyAI(league, extras, controlledTeamId, Date.now());
    onChange({ ...result.league, calendarDate: addDays(result.league.calendarDate ?? '', 1) }, { ...result.extras, freeAgencyDaysRemaining: Math.max(0, extras.freeAgencyDaysRemaining - 1) });
    setAiMessage(result.signings.length > 0
      ? `Day ${31 - extras.freeAgencyDaysRemaining}: AI teams signed ${result.signings.map((s) => `${s.playerId} (${s.teamName})`).join(', ')}.`
      : `Day ${31 - extras.freeAgencyDaysRemaining}: quiet day around the league.`);
  };

  const skipToEnd = () => {
    let current = { league, extras };
    let totalSignings = 0;
    for (let i = 0; i < extras.freeAgencyDaysRemaining; i++) {
      const result = runFreeAgencyAI(current.league, current.extras, controlledTeamId, Date.now() + i);
      totalSignings += result.signings.length;
      current = { league: result.league, extras: result.extras };
    }
    onChange({ ...current.league, calendarDate: addDays(current.league.calendarDate ?? '', extras.freeAgencyDaysRemaining) }, { ...current.extras, freeAgencyDaysRemaining: 0 });
    setAiMessage(`Skipped to the end of free agency - ${totalSignings} AI signings happened around the league.`);
  };

  const signPlayer = (playerId: string, contract: Omit<Contract, 'playerId' | 'teamId'>, base: GMLeagueExtras = extras) => {
    if (!signTeam || (!sandboxMode && signTeamId !== controlledTeamId)) return;
    // Players decide for themselves outside sandbox mode (the same rules AI teams, Auto Play and re-signing use).
    const result = sandboxMode ? { ...signFreeAgent(league, base, playerId, signTeamId, contract), decision: null }
      : signFreeAgentChecked(league, base, playerId, signTeamId, contract, { ranking });
    if (result.decision && !result.decision.accepted) { setAiMessage(result.decision.reason); return; }
    if (result.league === league && result.extras === base) {
      setAiMessage("That signing didn't go through — check that free agency is open, the roster has room, and the player is still a free agent.");
      return;
    }
    onChange(result.league, result.extras);
    setAiMessage(`Signed ${playerId} to ${signTeam?.name}.`);
  };
  return (
    <div>
      {!extras.freeAgencyOpen && <p className="calendar-banner">Free agency isn't open right now.</p>}
      {inSeasonFlowWindow && (
        <p className="calendar-banner">
          Free Agency: {extras.freeAgencyDaysRemaining} day{extras.freeAgencyDaysRemaining === 1 ? '' : 's'} remaining
          {league.calendarDate && ` — ${formatDisplayDate(league.calendarDate)}`}
        </p>
      )}
      <div className="code-mode-actions">
        <button disabled={!extras.freeAgencyOpen} onClick={runAIPass} title="Let AI-controlled teams sign free agents to fill out thin rosters">
          Run AI Free Agency Pass
        </button>
        {inSeasonFlowWindow && (
          <>
            <button onClick={advanceOneDay}>Advance 1 Day</button>
            <button onClick={skipToEnd}>Skip to End of Free Agency</button>
          </>
        )}
      </div>
      {aiMessage && <p className="hint-text"><TeamText text={aiMessage} /></p>}
      {sandboxMode ? <label className="rating-row">
        <span className="rating-label">Sign to</span>
        <select aria-label="Signing team" value={signTeamId} onChange={(e) => setSignTeamId(e.target.value)}>
          {manageableTeams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
        </select>
      </label> : <p>Signing for: <TeamLink name={signTeam?.name ?? 'No team controlled — view only'} /></p>}
      {signTeamOverCap && (
        <p className="calendar-banner">
          <TeamLink name={signTeam?.name} /> is over the salary cap (${(signTeamCapSpace / 1_000_000).toFixed(1)}M space) and cannot sign free agents.
        </p>
      )}
      {signTeamRosterFull && !signTeamOverCap && (
        <p className="calendar-banner">
          <TeamLink name={signTeam?.name} />'s roster is full ({extras.capSettings.maxRosterSize} players) — release someone on the Roster page before signing anyone else.
        </p>
      )}
      {extras.freeAgents.length === 0 ? (
        <p className="empty-state">No free agents currently available. Release a player on the Roster page to open one up.</p>
      ) : (
        <FreeAgentTable
          title="Free Agents"
          players={extras.freeAgents}
          team={signTeam ?? null}
          contracts={extras.contracts}
          capSettings={extras.capSettings}
          canSign={!!signTeam && extras.freeAgencyOpen && !signTeamOverCap && !signTeamRosterFull}
          disabledReason={
            !extras.freeAgencyOpen ? 'Free agency is not open yet.'
              : signTeamRosterFull ? `${signTeam?.name}'s roster is full.`
              : undefined
          }
          onSign={signPlayer}
          talks={signTeam && !sandboxMode ? { league, extras, teamId: signTeam.teamId, onUpdate: e => onChange(league, e), onAgree: signPlayer } : undefined}
          onSelectPlayer={onSelectPlayer}
          quote={sandboxMode || !signTeam ? undefined : (p) => signingDecision(league, extras, p, signTeamId, undefined, { ranking })}
        />
      )}
    </div>
  );
}
