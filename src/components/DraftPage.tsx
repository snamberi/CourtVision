import { TeamLink, TeamText } from './TeamLink';
import { useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras, TradeProposal } from '../simulation/gm';
import { currentDraftOrder, draftProspect, computeDraftPickValue, validateTrade, executeTrade, computeTradeValue, tradePackageValue } from '../simulation/gm';
import { autoDraftAIPicksUntilUserTurn, teamOnTheClock, draftOnePick, simEntireDraft } from '../simulation/aiGM';
import { rankedProspects, prospectComparison } from '../simulation/draftScouting';
import { perceivedPotential } from '../simulation/scouting';
import { ScoutingBoard } from './ScoutingBoard';
import { calculateOverall } from '../simulation/engine/overall';
import { PlayerNameTag } from './PlayerAvatar';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  onChange: (league: League, extras: GMLeagueExtras) => void;
  onSelectPlayer: (id: string) => void;
}

export function DraftPage({ league, extras, controlledTeamId, onChange, onSelectPlayer }: Props) {
  const order = currentDraftOrder(league, extras);
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [offeredPicks, setOfferedPicks] = useState<number[]>([]);
  const [offeredPlayers, setOfferedPlayers] = useState<string[]>([]);
  const n = Math.max(1, league.teams.length);
  const pickLabel = (slot: number) => `R${Math.floor(slot / n) + 1} · #${slot % n + 1}`;
  const teamName = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const showValues = extras.tradeSettings.showValues === true;
  const onClock = teamOnTheClock(league, extras);
  const myTurn = onClock != null && (controlledTeamId == null || onClock === controlledTeamId);
  const available = rankedProspects(extras.draftClass, p => perceivedPotential(p, league, extras, controlledTeamId));
  const shortlist = available.slice(0, 3);
  const made = new Map((extras.draftPicksMade ?? []).map(p => [p.pickNumber, p]));
  const myPicks = order.map((owner, slot) => ({ owner, slot })).filter(p => p.owner === controlledTeamId && p.slot >= extras.draftPickIndex && !made.has(p.slot));
  const myPlayers = league.teams.find(t => t.teamId === controlledTeamId)?.seasons ?? [];
  const proposal: TradeProposal | null = target != null && controlledTeamId ? {
    teamAId: controlledTeamId, teamBId: order[target], playersFromA: offeredPlayers, playersFromB: [], currentPicksFromA: offeredPicks, currentPicksFromB: [target],
  } : null;
  const validation = proposal ? validateTrade(league, extras, proposal) : null;
  const targetAvailable = target != null && extras.draftDayOpen && target >= extras.draftPickIndex && !made.has(target) && order[target] !== controlledTeamId;

  const confirmTrade = () => {
    if (!proposal || !targetAvailable) return;
    const check = validateTrade(league, extras, proposal);
    if (!check.valid) { setMessage(check.reasons.join(' ')); return; }
    const result = executeTrade(league, extras, proposal);
    onChange(result.league, result.extras);
    setMessage(`${teamName(proposal.teamBId)} accepted your package for ${pickLabel(target!)}.`);
    setTarget(null); setOfferedPicks([]); setOfferedPlayers([]);
  };
  const buildOffer = () => {
    if (!proposal || !targetAvailable) return;
    const bundles: number[][] = [[]];
    for (const p of myPicks.slice(0, 12)) {
      const additions = bundles.filter(b => b.length < 3).map(b => [...b, p.slot]);
      bundles.push(...additions);
    }
    let best: TradeProposal | null = null;
    let bestCost = Infinity;
    const wanted = computeDraftPickValue(target!, order, league);
    for (const picks of bundles) for (const players of [[], ...myPlayers.map(p => [p.playerId])]) {
      const candidate = { ...proposal, currentPicksFromA: picks, playersFromA: players };
      if (!validateTrade(league, extras, candidate).valid) continue;
      const value = tradePackageValue(league, extras, candidate.teamAId, players, [], picks);
      const cost = Math.abs(value - wanted) + players.length * 2;
      if (cost < bestCost) { bestCost = cost; best = candidate; }
    }
    if (!best) { setMessage('No balanced package is available from these picks and players. Try a different pick.'); return; }
    setOfferedPicks(best.currentPicksFromA ?? []); setOfferedPlayers(best.playersFromA);
    setMessage('Suggested offer ready to review. Nothing has been traded yet.');
  };

  return <div className="draft-view">
    <div className="draft-night-header" data-tour="draft"><div><span className="eyebrow">DRAFT NIGHT</span><h3>Build the next era</h3><p className="hint-text">2 rounds · {n} picks per round · {Math.min(extras.draftPickIndex, order.length)} / {order.length} selected</p></div>
      <div className="code-mode-actions">
        {extras.draftDayOpen && <><button onClick={() => { const r = draftOnePick(league, extras); onChange(r.league, r.extras); setMessage(r.pick ? `${r.pick.teamName} selected ${r.pick.playerId}.` : 'Draft complete.'); }}>Sim One Pick</button>
          {controlledTeamId && <button onClick={() => { const r = autoDraftAIPicksUntilUserTurn(league, extras, controlledTeamId); onChange(r.league, r.extras); setMessage(`${r.picks.length} picks simulated.`); }}>To Your Next Pick</button>}
          <button onClick={() => { const r = simEntireDraft(league, extras); onChange(r.league, r.extras); setMessage(`Draft complete. ${r.picks.length} selections made; undrafted players are now free agents.`); }}>To End of Draft</button></>}
      </div>
    </div>
    {!extras.draftDayOpen && <p className="calendar-banner">{extras.draftPickIndex > 0 ? (league.seasonPhase === 'draft' ? 'Draft complete. Continue to re-signing and free agency.' : 'Draft complete. View the selections below.') : 'The draft opens after the season recap.'}</p>}
    {onClock && <div className="draft-clock-banner"><div className="draft-clock-card"><span className="hint-text">On the clock · {pickLabel(extras.draftPickIndex)}</span><strong><TeamLink name={teamName(onClock)} /></strong></div>
      {order[extras.draftPickIndex + 1] && <div className="draft-clock-card"><span className="hint-text">Up next · {pickLabel(extras.draftPickIndex + 1)}</span><strong><TeamLink name={teamName(order[extras.draftPickIndex + 1])} /></strong></div>}
      {myTurn && <div className="draft-clock-card draft-youre-up">Your selection</div>}
    </div>}
    {message && <p className="hint-text" role="status"><TeamText text={message} /></p>}

    {extras.draftDayOpen && extras.draftPickIndex < 5 && shortlist.length > 0 && <section className="prospect-spotlight" aria-label="Top prospect comparison">
      <div className="section-label">TOP FIVE SPOTLIGHT · PICK {extras.draftPickIndex + 1}</div><h4>Three best players still on the board</h4>
      <p className="hint-text">Ranked by your scouts' potential read and current ability. Highlighted ratings lead this group.</p>
      <div className="finances-table-wrap"><table className="db-table prospect-comparison"><thead><tr><th>Category</th>{shortlist.map(p => <th key={p.playerId}><button className="prospect-name" onClick={() => onSelectPlayer(p.playerId)}><PlayerNameTag playerId={p.playerId} size={30} />{p.trueSeason.archetypeLabel}</button></th>)}</tr></thead>
        <tbody>{(Object.keys(prospectComparison(shortlist[0].trueSeason)) as (keyof ReturnType<typeof prospectComparison>)[]).map(key => {
          const values = shortlist.map(p => prospectComparison(p.trueSeason)[key]);
          return <tr key={key}><th>{key}</th>{values.map((value, i) => <td key={shortlist[i].playerId} className={value === Math.max(...values) ? 'prospect-best' : ''}>{key === 'Height' ? `${Math.floor(value / 12)}′ ${Math.round(value % 12)}″` : value}</td>)}</tr>;
        })}</tbody></table></div>
    </section>}

    {target != null && <section className="draft-trade-proposal" aria-label="Draft trade package"><h4>Trade for {pickLabel(target)} · <TeamLink name={teamName(order[target])} /></h4>
      <p className="hint-text">Combine picks and a player to negotiate a fair return. {showValues && `Target value: ${computeDraftPickValue(target, order, league)}.`}</p>
      {!targetAvailable ? <p>This pick is no longer available.</p> : <>
        <div className="draft-package-grid"><fieldset><legend>Your remaining picks</legend>{myPicks.length === 0 && <p>No picks remaining.</p>}{myPicks.map(p => <label key={p.slot} className="badge-chip"><input type="checkbox" checked={offeredPicks.includes(p.slot)} onChange={() => setOfferedPicks(prev => prev.includes(p.slot) ? prev.filter(x => x !== p.slot) : [...prev, p.slot])} />{pickLabel(p.slot)}{showValues && ` · value ${computeDraftPickValue(p.slot, order, league)}`}</label>)}</fieldset>
          <fieldset><legend>Players to offer</legend><div className="draft-player-options">{myPlayers.map(p => <label key={p.playerId} className="badge-chip"><input type="checkbox" checked={offeredPlayers.includes(p.playerId)} onChange={() => setOfferedPlayers(prev => prev.includes(p.playerId) ? prev.filter(x => x !== p.playerId) : [...prev, p.playerId])} />{p.playerId} · {calculateOverall(p)} OVR{showValues && ` · value ${Math.round(computeTradeValue(p))}`}</label>)}</div></fieldset></div>
        <p className={validation?.valid ? 'value-ok' : 'hint-text'}>{validation?.valid ? 'The other team is willing to accept this package.' : validation?.reasons.join(' ')}</p>
        <div className="code-mode-actions"><button onClick={buildOffer}>Build fair offer</button><button className="primary" disabled={!validation?.valid} onClick={confirmTrade}>Confirm Trade</button></div>
      </>}<button onClick={() => setTarget(null)}>Cancel</button>
    </section>}

    <ScoutingBoard league={league} extras={extras} controlledTeamId={controlledTeamId} myTurn={myTurn} onChange={onChange} onSelectPlayer={onSelectPlayer}
      onDraft={id => { if (!onClock) return; const r = draftProspect(league, extras, id, onClock); onChange(r.league, r.extras); setMessage(`${teamName(onClock)} selected ${id}.`); }} />

    <div className="draft-columns draft-columns-single">
      <div className="draft-column"><h4>Draft results · two rounds</h4><div className="finances-table-wrap"><table className="db-table draft-results"><thead><tr><th>Pick</th><th>Team</th>{showValues && <th>Value</th>}<th>Selection</th></tr></thead><tbody>
        {order.map((owner, slot) => { const selection = made.get(slot); return <tr key={slot} className={extras.draftDayOpen && slot === extras.draftPickIndex ? 'draft-current-pick-row' : ''}><td>{pickLabel(slot)}</td><td><TeamLink name={teamName(selection?.teamId ?? owner)} /></td>{showValues && <td>{computeDraftPickValue(slot, order, league)}</td>}<td>{selection ? <button className="prospect-name" onClick={() => onSelectPlayer(selection.playerId)}><PlayerNameTag playerId={selection.playerId} teamId={selection.teamId} size={22} /></button> : extras.draftDayOpen && slot >= extras.draftPickIndex && controlledTeamId && owner !== controlledTeamId ? <button onClick={() => { setTarget(slot); setOfferedPicks([]); setOfferedPlayers([]); }}>Propose trade</button> : '—'}</td></tr>; })}
      </tbody></table></div></div>
    </div>
    <h4>Future draft picks</h4><div className="finances-table-wrap"><table className="db-table"><thead><tr><th>Team</th><th>Round 1</th><th>Round 2</th></tr></thead><tbody>{league.teams.map(t => {
      const owned = (extras.futurePicks ?? []).filter(p => p.currentOwnerTeamId === t.teamId).sort((a, b) => a.year - b.year);
      const list = (round: number) => owned.filter(p => p.round === round).map(p => `${p.year}${p.originalTeamId !== t.teamId ? ` via ${teamName(p.originalTeamId)}` : ''}${p.protection ? ` (${p.protection.label})` : ''}`).join(', ') || '—';
      return <tr key={t.teamId}><td><TeamLink name={t.name} /></td><td><TeamText text={list(1)} /></td><td><TeamText text={list(2)} /></td></tr>;
    })}</tbody></table></div>
  </div>;
}
