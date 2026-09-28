import { TeamLink, TeamText } from './TeamLink';
import { useState } from 'react';
import type { League, LeagueTeam } from '../simulation/league';
import type { GMLeagueExtras, FutureDraftPick } from '../simulation/gm';
import {
  validateTrade, executeTrade, computeTradeValue, evaluateTradeSides, tradeTolerance, canManageTeam, isTradeDeadlinePassed,
  tradeableFuturePicks, computeFutureDraftPickValue, canProtectPick, setPickProtection, PICK_PROTECTION_OPTIONS,
} from '../simulation/gm';
import { computeTeamOverallAverage } from '../simulation/teamStatus';
import { tradeVerdict, TradePlayerCompareTable, ImprovementMeter } from './gmShared';
import { PlayerNameTag } from './PlayerAvatar';
import { TradeScale } from './trade/TradeScale';
import { counterOffer, aiAccepts, recordTalkRound, talksClosed, talkState, PATIENCE, type Counter } from '../simulation/tradeTalks';

interface Props {
  sandboxMode?: boolean;
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  onChange: (league: League, extras: GMLeagueExtras) => void;
  onToast?: (message: string, tone?: 'info' | 'success' | 'error') => void;
}

function pickLabel(pick: FutureDraftPick): string {
  return `${pick.year} Round ${pick.round}${pick.protection ? ` (${pick.protection.label})` : ''}`;
}

export function TradePage({ league, extras, controlledTeamId, onChange, onToast, sandboxMode = false }: Props) {
  const deadlinePassed = isTradeDeadlinePassed(league);
  const showValues = extras.tradeSettings.showValues === true;
  const tradingBlocked = deadlinePassed;
  const currentYear = parseInt((league.season ?? '2026').slice(0, 4), 10);
  const [selectedAId, setTeamAId] = useState(controlledTeamId ?? league.teams[0].teamId);
  const teamAId = sandboxMode ? selectedAId : controlledTeamId ?? ''; 
  const [teamBId, setTeamBId] = useState(league.teams.find((t) => t.teamId !== teamAId)?.teamId ?? league.teams[0].teamId);
  const [fromA, setFromA] = useState<string[]>([]);
  const [fromB, setFromB] = useState<string[]>([]);
  const [picksFromA, setPicksFromA] = useState<string[]>([]);
  const [picksFromB, setPicksFromB] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [counter, setCounter] = useState<Counter | null>(null);

  const teamA = league.teams.find((t) => t.teamId === teamAId)!;
  const teamB = league.teams.find((t) => t.teamId === teamBId)!;
  if (!teamA || !teamB) return <p className="empty-state">Control a team to propose trades, or enable Sandbox Mode to manage any team.</p>;
  const canManageA = canManageTeam(controlledTeamId, teamAId);
  const teamAPicks = tradeableFuturePicks(extras, teamAId);
  const teamBPicks = tradeableFuturePicks(extras, teamBId);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  // Each front office values the deal from its own situation (contender / middle / rebuilding).
  const sides = evaluateTradeSides(league, extras, { teamAId, teamBId, playersFromA: fromA, playersFromB: fromB, picksFromA, picksFromB });
  const directionLabel = (d: string) => d === 'contender' ? 'Contender' : d === 'rebuilding' ? 'Rebuilding' : 'Middle';
  const salaryA = fromA.reduce((s, id) => s + (extras.contracts[id]?.annualSalary ?? 0), 0);
  const salaryB = fromB.reduce((s, id) => s + (extras.contracts[id]?.annualSalary ?? 0), 0);

  const projectedRoster = (team: LeagueTeam, outgoingIds: string[], incoming: typeof team.seasons): LeagueTeam => ({
    ...team,
    seasons: [...team.seasons.filter((s) => !outgoingIds.includes(s.playerId)), ...incoming],
  });
  const incomingForA = teamB.seasons.filter(s => fromB.includes(s.playerId));
  const incomingForB = teamA.seasons.filter(s => fromA.includes(s.playerId));
  const avgBeforeA = computeTeamOverallAverage(teamA);
  const avgAfterA = computeTeamOverallAverage(projectedRoster(teamA, fromA, incomingForA));
  const avgBeforeB = computeTeamOverallAverage(teamB);
  const avgAfterB = computeTeamOverallAverage(projectedRoster(teamB, fromB, incomingForB));

  const resetSelection = () => { setFromA([]); setFromB([]); setPicksFromA([]); setPicksFromB([]); };

  // When the other side is an AI-controlled team, the rejection reads as their front office's response
  // rather than a generic validation error — same underlying reasons (see validateTrade), different voice.
  const respondingTeam = controlledTeamId && teamAId === controlledTeamId ? teamB : controlledTeamId && teamBId === controlledTeamId ? teamA : null;

  const propose = () => {
    if (!canManageA) { setMessage('You can only propose trades involving your own team.'); return; }
    const proposal = { teamAId, teamBId, playersFromA: fromA, playersFromB: fromB, picksFromA, picksFromB };
    if (respondingTeam && talksClosed(league, extras, respondingTeam.teamId)) { setMessage(`${respondingTeam.name} have broken off talks for now. Try again in a few game days.`); return; }
    const validation = validateTrade(league, extras, proposal);
    if (!validation.valid) {
      // An AI front office answers a lowball with a counter rather than a flat no, when one exists.
      const answer = respondingTeam && controlledTeamId ? counterOffer(league, extras, proposal, controlledTeamId) : null;
      setCounter(answer);
      setMessage(answer ? null : respondingTeam
        ? `${respondingTeam.name} won't make this deal: ${validation.reasons.join(' ')}`
        : `Trade blocked: ${validation.reasons.join(' ')}`);
      if (!answer) onToast?.('Trade rejected — see the details on the Trade page.', 'error');
      return;
    }
    setCounter(null);
    const { league: newLeague, extras: newExtras } = executeTrade(league, extras, proposal);
    onChange(newLeague, newExtras);
    resetSelection();
    setMessage(respondingTeam ? `${respondingTeam.name} accepted the trade.` : 'Trade executed.');
    onToast?.(`Trade executed between ${teamA.name} and ${teamB.name}.`, 'success');
  };

  const acceptCounter = () => {
    if (!counter) return;
    if (!controlledTeamId || !aiAccepts(league, extras, counter.proposal, controlledTeamId)) { setCounter(null); setMessage('That counter is no longer on the table.'); return; }
    const { league: newLeague, extras: newExtras } = executeTrade(league, extras, counter.proposal);
    onChange(newLeague, newExtras);
    resetSelection(); setCounter(null);
    setMessage('Deal done on their terms.');
    onToast?.(`Trade executed between ${teamA.name} and ${teamB.name}.`, 'success');
  };
  const declineCounter = () => {
    if (!counter || !respondingTeam) return;
    const r = recordTalkRound(league, extras, respondingTeam.teamId);
    onChange(league, r.extras);
    setCounter(null);
    setMessage(r.closed ? `${respondingTeam.name} have heard enough and hang up. Talks are off for a few game days.` : `You turned down their counter. ${respondingTeam.name} are still listening.`);
  };
  const editCounter = () => {
    if (!counter) return;
    const p = counter.proposal;
    setFromA(p.playersFromA); setFromB(p.playersFromB); setPicksFromA(p.picksFromA ?? []); setPicksFromB(p.picksFromB ?? []);
    setCounter(null);
  };

  const forceThrough = () => {
    if (!sandboxMode) return;
    if (!canManageA) { setMessage('You can only propose trades involving your own team.'); return; }
    const proposal = { teamAId, teamBId, playersFromA: fromA, playersFromB: fromB, picksFromA, picksFromB };
    const { league: newLeague, extras: newExtras } = executeTrade(league, extras, proposal);
    onChange(newLeague, newExtras);
    resetSelection();
    setMessage('Trade forced through (sandbox override).');
    onToast?.('Trade forced through, bypassing validation.', 'info');
  };

  const cycleProtection = (pick: FutureDraftPick) => {
    const idx = pick.protection ? PICK_PROTECTION_OPTIONS.findIndex((o) => o.topN === pick.protection!.topN) : -1;
    const next = idx + 1 >= PICK_PROTECTION_OPTIONS.length ? null : PICK_PROTECTION_OPTIONS[idx + 1];
    onChange(league, setPickProtection(extras, pick.id, next));
  };

  const renderPickList = (picks: FutureDraftPick[], selected: string[], setSelected: (v: string[]) => void) => (
    picks.length === 0 ? <p className="hint-text">No tradeable future picks.</p> : (
      <div className="badge-grid">
        {picks.slice().sort((a, b) => a.year - b.year || a.round - b.round).map((pick) => (
          <label key={pick.id} className="badge-chip">
            <input type="checkbox" checked={selected.includes(pick.id)} onChange={() => toggle(selected, setSelected, pick.id)} />
            {pickLabel(pick)} {showValues && <> (value {computeFutureDraftPickValue(pick, league, currentYear)})</>}
            {canProtectPick(pick) && (
              <button
                type="button"
                className="pick-protection-toggle"
                title="Click to cycle protection level (none → top-4 → top-8 → top-10 → lottery → none)"
                onClick={(e) => { e.preventDefault(); cycleProtection(pick); }}
              >
                {pick.protection ? pick.protection.label : 'Protect…'}
              </button>
            )}
          </label>
        ))}
      </div>
    )
  );

  return (
    <div className="trade-view">
      <label className="trade-value-toggle"><input type="checkbox" checked={showValues} onChange={e => onChange(league, { ...extras, tradeSettings: { ...extras.tradeSettings, showValues: e.target.checked } })} /> Show trade values across the league</label>
      {deadlinePassed && <p className="calendar-banner">Trade deadline has passed for this season - trades are locked.</p>}
      {!canManageA && <p className="calendar-banner">You can only build trades starting from your own team.</p>}
      <div className="trade-columns" data-tour="trade">
        <div>
          {sandboxMode ? <select value={teamAId} onChange={(e) => { setTeamAId(e.target.value); setFromA([]); setPicksFromA([]); }}>
            {league.teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
          </select> : <h3><TeamLink name={teamA.name} /></h3>}
          <div className="badge-grid">
            {teamA.seasons.map((s) => (
              <label key={s.playerId} className="badge-chip">
                <input type="checkbox" checked={fromA.includes(s.playerId)} onChange={() => toggle(fromA, setFromA, s.playerId)} />
                <PlayerNameTag playerId={s.playerId} teamId={s.teamId} jerseyNumber={s.jerseyNumber} size={22} /> (${(extras.contracts[s.playerId]?.annualSalary ?? 0).toLocaleString()}{showValues && <>, value {computeTradeValue(s).toFixed(0)}</>})
              </label>
            ))}
          </div>
          <h5 className="stats-subheading">Draft Picks</h5>
          {renderPickList(teamAPicks, picksFromA, setPicksFromA)}
        </div>
        <div>
          <select value={teamBId} onChange={(e) => { setTeamBId(e.target.value); setFromB([]); setPicksFromB([]); }}>
            {league.teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
          </select>
          <div className="badge-grid">
            {teamB.seasons.map((s) => (
              <label key={s.playerId} className="badge-chip">
                <input type="checkbox" checked={fromB.includes(s.playerId)} onChange={() => toggle(fromB, setFromB, s.playerId)} />
                <PlayerNameTag playerId={s.playerId} teamId={s.teamId} jerseyNumber={s.jerseyNumber} size={22} /> (${(extras.contracts[s.playerId]?.annualSalary ?? 0).toLocaleString()}{showValues && <>, value {computeTradeValue(s).toFixed(0)}</>})
              </label>
            ))}
          </div>
          <h5 className="stats-subheading">Draft Picks</h5>
          {renderPickList(teamBPicks, picksFromB, setPicksFromB)}
        </div>
      </div>
      <p className="hint-text">
        Protecting a pick means it stays with its original team if it would land inside the protected range on draft
        night - the other side gets nothing for it that year. Only your own unresolved pick can be protected.
      </p>

      <TradeScale aName={teamA.name} bName={teamB.name} aiSide={teamAId === controlledTeamId ? 'b' : teamBId === controlledTeamId ? 'a' : 'b'} view={teamAId === controlledTeamId || teamBId !== controlledTeamId ? sides.b : sides.a}
        tolerance={tradeTolerance(extras)} empty={!fromA.length && !fromB.length && !picksFromA.length && !picksFromB.length} />
      <div className="trade-comparison">
        <div><strong><TeamLink name={teamA.name} /> sends:</strong> ${salaryA.toLocaleString()} <small className="hint-text">· {directionLabel(sides.a.direction)}{showValues && <> · their view: give {sides.a.give.toFixed(0)} / get {sides.a.receive.toFixed(0)}</>}</small></div>
        <div><strong><TeamLink name={teamB.name} /> sends:</strong> ${salaryB.toLocaleString()} <small className="hint-text">· {directionLabel(sides.b.direction)}{showValues && <> · their view: give {sides.b.give.toFixed(0)} / get {sides.b.receive.toFixed(0)}</>}</small></div>
        <div className={`trade-verdict ${tradeVerdict(sides.a.give, sides.a.receive).className}`}>{teamA.name}: {tradeVerdict(sides.a.give, sides.a.receive).label}</div>
        <div className={`trade-verdict ${tradeVerdict(sides.b.give, sides.b.receive).className}`}>{teamB.name}: {tradeVerdict(sides.b.give, sides.b.receive).label}</div>
      </div>

      <div className="trade-compare-columns">
        <TradePlayerCompareTable showValues={showValues} title={`${teamA.name} gives up`} players={incomingForB} />
        <TradePlayerCompareTable showValues={showValues} title={`${teamA.name} receives`} players={incomingForA} />
      </div>

      <div className="trade-comparison improvement-meters">
        <ImprovementMeter label={`${teamA.name} avg overall`} before={avgBeforeA} after={avgAfterA} />
        <ImprovementMeter label={`${teamB.name} avg overall`} before={avgBeforeB} after={avgAfterB} />
      </div>

      <div className="trade-actions">
        <button
          className="primary"
          disabled={tradingBlocked || (fromA.length === 0 && fromB.length === 0 && picksFromA.length === 0 && picksFromB.length === 0)}
          title={tradingBlocked ? 'Trading is not allowed right now — see the banner above.' : undefined}
          onClick={propose}
        >
          Propose Trade
        </button>
        {sandboxMode && <button
          disabled={deadlinePassed || (fromA.length === 0 && fromB.length === 0 && picksFromA.length === 0 && picksFromB.length === 0)}
          title={deadlinePassed ? 'The deadline has passed — even a sandbox override can\'t bypass that.' : 'Skip the cap/value/roster-size validation and execute this trade exactly as built.'}
          onClick={forceThrough}
        >
          Force Through (Sandbox)
        </button>}
      </div>
      {message && <p className="hint-text"><TeamText text={message} /></p>}
      {counter && respondingTeam && <div className="trade-counter" role="group" aria-label="Counter-offer">
        <span className="pixel-eyebrow">COUNTER-OFFER · {(extras.teamPersonalities?.[respondingTeam.teamId] ?? 'balanced').toUpperCase()} FRONT OFFICE</span>
        <p><TeamText text={counter.text} /></p>
        <p className="hint-text">Their patience: {Math.max(0, PATIENCE[extras.teamPersonalities?.[respondingTeam.teamId] ?? 'balanced'] - talkState(league, extras, respondingTeam.teamId).rounds)} more round(s) before they hang up.</p>
        <div className="trade-counter-actions"><button className="primary" onClick={acceptCounter}>Accept counter</button><button onClick={editCounter}>Put it in the builder</button><button onClick={declineCounter}>Decline</button></div>
      </div>}
    </div>
  );
}
