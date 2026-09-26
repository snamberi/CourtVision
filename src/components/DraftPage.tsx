import { TeamLink, TeamText } from './TeamLink';
import { rookieScale } from '../simulation/draftSeason';
import { useEffect, useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras, TradeProposal } from '../simulation/gm';
import { currentDraftOrder, draftProspect, computeDraftPickValue, validateTrade, executeTrade, computeTradeValue, tradePackageValue } from '../simulation/gm';
import { autoDraftAIPicksUntilUserTurn, teamOnTheClock, draftOnePick, simEntireDraft } from '../simulation/aiGM';
import { rankedProspects, prospectComparison } from '../simulation/draftScouting';
import { perceivedPotential } from '../simulation/scouting';
import { ScoutingBoard } from './ScoutingBoard';
import { calculateOverall } from '../simulation/engine/overall';
import { PlayerNameTag } from './PlayerAvatar';
import { DraftLotteryShow } from './DraftLotteryShow';
import { tradeDownOffers } from '../simulation/draftNight';

const PICK_CLOCK = 60;

interface Props {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  onChange: (league: League, extras: GMLeagueExtras) => void;
  onSelectPlayer: (id: string) => void;
  /** The draft is done and Summer League hasn't been played yet this offseason. */
  summerLeagueReady?: boolean;
  onOpenSummerLeague?: () => void;
}

export function DraftPage({ league, extras, controlledTeamId, onChange, onSelectPlayer, summerLeagueReady, onOpenSummerLeague }: Props) {
  const scale = rookieScale(league, extras.capSettings);
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
  // War room: a pick clock when you're up, and teams calling to move into your slot.
  // The clock belongs to the pick: a new pick starts a fresh minute.
  const [clockState, setClockState] = useState({ pick: extras.draftPickIndex, left: PICK_CLOCK });
  const clock = clockState.pick === extras.draftPickIndex ? clockState.left : PICK_CLOCK;
  const [clockOn, setClockOn] = useState(true);
  const warRoom = myTurn && extras.draftDayOpen && !!controlledTeamId && onClock === controlledTeamId;
  const calls = useMemo(() => warRoom ? tradeDownOffers(league, extras, controlledTeamId!) : [], [warRoom, league, extras, controlledTeamId]);
  useEffect(() => {
    if (!warRoom || !clockOn) return;
    const t = setTimeout(() => {
      if (clock > 1) { setClockState({ pick: extras.draftPickIndex, left: clock - 1 }); return; }
      // Time's up: the best player on your board.
      const best = available[0];
      if (best && onClock) { const r = draftProspect(league, extras, best.playerId, onClock); onChange(r.league, r.extras); setMessage(`The clock ran out. You took the best player on your board: ${best.playerId}.`); }
    }, 1000);
    return () => clearTimeout(t);
  }, [warRoom, clockOn, clock]); // eslint-disable-line react-hooks/exhaustive-deps
  const takeCall = (offer: TradeProposal) => {
    const r = executeTrade(league, extras, offer);
    onChange(r.league, r.extras);
    setMessage(`Deal: you traded down with ${teamName(offer.teamAId)}.`);
  };
  const [lotterySeen, setLotterySeen] = useState(false);
  const showLottery = !!extras.lottery && !extras.lottery.revealed && !lotterySeen && extras.draftDayOpen && extras.draftPickIndex === 0;
  const lastPick = extras.draftPicksMade?.at(-1);

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

  if (showLottery) return <div className="draft-view"><DraftLotteryShow league={league} lottery={extras.lottery!} controlledTeamId={controlledTeamId}
    onDone={() => { setLotterySeen(true); onChange(league, { ...extras, lottery: { ...extras.lottery!, revealed: true } }); }} /></div>;

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
    {summerLeagueReady && onOpenSummerLeague && <div className="summer-cta"><div><b>Summer League is next.</b> <span className="hint-text">See your rookies play four games against the league's other young players before re-signing opens.</span></div><button className="primary" onClick={onOpenSummerLeague}>Go to Summer League</button></div>}
    {lastPick?.reaction && <p className={`draft-reaction reaction-${lastPick.reaction.toLowerCase().replace(/ /g, '-')}`} role="status">
      <b>{lastPick.reaction.toUpperCase()}</b> <TeamText text={`${teamName(lastPick.teamId)} take ${lastPick.playerId} at No. ${lastPick.pickNumber + 1}${lastPick.boardRank != null ? ` (No. ${lastPick.boardRank + 1} on the consensus board)` : ''}.`} /></p>}
    {warRoom && <section className="war-room" aria-label="War room">
      <div className="war-room-clock"><span className="pixel-eyebrow">YOU'RE ON THE CLOCK</span><b className={clock <= 10 ? 'urgent' : ''}>0:{String(Math.max(0, clock)).padStart(2, '0')}</b>
        <button onClick={() => setClockOn(o => !o)}>{clockOn ? 'Pause clock' : 'Resume clock'}</button></div>
      <div className="war-room-calls"><h4>📞 Calls</h4>{calls.length ? calls.map((c, i) => <div key={i} className="war-room-call"><span><TeamText text={c.note} /></span><button onClick={() => takeCall(c)}>Accept</button></div>)
        : <p className="hint-text">Nobody's calling to move up right now. You can still call around: use "Propose trade" on any pick below.</p>}</div>
      <p className="hint-text">Make your pick from the board below before the clock hits zero, or the war room takes the best player on your board.</p>
    </section>}
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
      <div className="draft-column"><h4>Draft results · two rounds</h4><div className="finances-table-wrap"><table className="db-table draft-results"><thead><tr><th>Pick</th><th>Team</th>{showValues && <th>Value</th>}<th>Selection</th><th>Reaction</th></tr></thead><tbody>
        {order.map((owner, slot) => { const selection = made.get(slot); return <tr key={slot} className={extras.draftDayOpen && slot === extras.draftPickIndex ? 'draft-current-pick-row' : ''}><td>{pickLabel(slot)}</td><td><TeamLink name={teamName(selection?.teamId ?? owner)} /></td>{showValues && <td>{computeDraftPickValue(slot, order, league)}</td>}<td>{selection ? <button className="prospect-name" onClick={() => onSelectPlayer(selection.playerId)}><PlayerNameTag playerId={selection.playerId} teamId={selection.teamId} size={22} /></button> : extras.draftDayOpen && slot >= extras.draftPickIndex && controlledTeamId && owner !== controlledTeamId ? <button onClick={() => { setTarget(slot); setOfferedPicks([]); setOfferedPlayers([]); }}>Propose trade</button> : '—'}</td>
          <td>{selection?.reaction ? <span className={`reaction-chip reaction-${selection.reaction.toLowerCase().replace(/ /g, '-')}`}>{selection.reaction}</span> : ''}</td></tr>; })}
      </tbody></table></div></div>
    </div>
    <details className="rookie-scale"><summary>Rookie scale · salary by pick</summary>
      <p className="hint-text">Every drafted player signs the slot's contract. First-rounders: {scale[0]?.years ?? 4} years (set in League Rules), last year a team option. Second-rounders: 2 years near the minimum.</p>
      <div className="rookie-scale-grid">{[1, 2].map(round => <div key={round} className="finances-table-wrap"><table className="db-table stat-line-table">
        <thead><tr><th>Round {round}</th><th>Salary</th><th>Years</th></tr></thead>
        <tbody>{scale.filter(r => r.round === round).map(r => <tr key={r.pick}><td>#{r.round === 1 ? r.pick : r.pick - n}</td><td>${(r.salary / 1e6).toFixed(2)}M</td><td>{r.years}</td></tr>)}</tbody>
      </table></div>)}</div>
    </details>
    <h4>Future draft picks</h4><div className="finances-table-wrap"><table className="db-table"><thead><tr><th>Team</th><th>Round 1</th><th>Round 2</th></tr></thead><tbody>{league.teams.map(t => {
      const owned = (extras.futurePicks ?? []).filter(p => p.currentOwnerTeamId === t.teamId).sort((a, b) => a.year - b.year);
      const list = (round: number) => owned.filter(p => p.round === round).map(p => `${p.year}${p.originalTeamId !== t.teamId ? ` via ${teamName(p.originalTeamId)}` : ''}${p.protection ? ` (${p.protection.label})` : ''}`).join(', ') || '—';
      return <tr key={t.teamId}><td><TeamLink name={t.name} /></td><td><TeamText text={list(1)} /></td><td><TeamText text={list(2)} /></td></tr>;
    })}</tbody></table></div>
  </div>;
}
