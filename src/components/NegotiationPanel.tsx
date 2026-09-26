import { useState } from 'react';
import type { League } from '../simulation/league';
import type { Contract, GMLeagueExtras } from '../simulation/gm';
import type { PlayerSeason } from '../simulation/types';
import { AGENTS, STYLE_BLURB, makeOffer, openNegotiation, storeNegotiation, walkAway, currentNegotiation } from '../simulation/agents';
import { signingDecision } from '../simulation/freeAgentDecision';
import { personalityOf } from '../simulation/personality';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  player: PlayerSeason;
  teamId: string;
  /** Saves talks that are still going (or ended without a deal). */
  onUpdate: (extras: GMLeagueExtras) => void;
  /** Signs the agreed deal, starting from extras that already record the talks. */
  onAgree: (contract: Omit<Contract, 'playerId' | 'teamId'>, extras: GMLeagueExtras) => void;
  onClose: () => void;
}

const money = (n: number) => `$${(n / 1e6).toFixed(1)}M`;

/** Contract talks with a player's agent: the demand, the back-and-forth, and your offer. */
export function NegotiationPanel({ league, extras, player, teamId, onUpdate, onAgree, onClose }: Props) {
  const talks = currentNegotiation(league, extras, player.playerId, teamId) ?? openNegotiation(league, extras, player, teamId);
  const [salary, setSalary] = useState(talks?.demand.salary ?? extras.capSettings.minSalary);
  const [years, setYears] = useState(talks?.demand.years ?? 2);
  const [option, setOption] = useState(talks?.demand.playerOption ?? false);
  if (!talks) return <div className="negotiation-panel"><p className="hint-text">{player.playerId} won't talk to this team.</p><button onClick={onClose}>Close</button></div>;
  const agent = AGENTS.find(a => a.id === talks.agentId)!;
  const persona = personalityOf(player);
  const max = extras.capSettings.salaryCap * extras.capSettings.maxSalaryPctOfCap;
  const open = talks.status === 'open';

  const submit = () => {
    const required = signingDecision(league, extras, player, teamId).required;
    const { negotiation, outcome } = makeOffer(talks, { salary, years, playerOption: option }, required);
    const next = storeNegotiation(extras, negotiation);
    if (outcome === 'agreed' && negotiation.deal) onAgree(negotiation.deal, next);
    else {
      onUpdate(next);
      if (outcome === 'countered') { setSalary(negotiation.demand.salary); setYears(negotiation.demand.years); }
    }
  };

  return <div className="negotiation-panel" aria-label={`Contract talks with ${player.playerId}`}>
    <div className="negotiation-head">
      <div className="negotiation-agent">
        <span className="pixel-eyebrow">AGENT</span>
        <b>{agent.name}</b>
        <small>{agent.agency}</small>
        <span className={`negotiation-style style-${agent.style.toLowerCase()}`} title={STYLE_BLURB[agent.style]}>{agent.style}</span>
      </div>
      <div className="negotiation-client">
        <span className="pixel-eyebrow">CLIENT</span>
        <b>{player.playerId}</b>
        <small>{persona.type} · age {player.age}</small>
      </div>
      <div className="negotiation-demand">
        <span className="pixel-eyebrow">{talks.ultimatum ? 'ULTIMATUM' : 'ASKING'}</span>
        <b>{money(talks.demand.salary)}</b>
        <small>{talks.demand.years} yrs{talks.demand.playerOption ? ' · player option' : ''}</small>
      </div>
      <div className="negotiation-patience" title="Rounds of talks left before they walk">
        <span className="pixel-eyebrow">PATIENCE</span>
        <span className="negotiation-meter">{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < talks.patience ? 'on' : ''} />)}</span>
        <small>{open ? `${talks.patience} round${talks.patience === 1 ? '' : 's'} left` : talks.status === 'agreed' ? 'Deal done' : 'Walked away'}</small>
      </div>
    </div>
    <ol className="negotiation-log">
      {talks.log.map((line, i) => <li key={i} className={`from-${line.from}`}><span>{line.from === 'agent' ? agent.name.split(' ')[0] : 'You'}</span>{line.text}</li>)}
    </ol>
    {open ? <div className="negotiation-offer">
      <label>Salary per year
        <input type="range" min={extras.capSettings.minSalary} max={max} step={250_000} value={salary} onChange={e => setSalary(Number(e.target.value))} aria-label="Salary per year" />
        <b>{money(salary)}</b>
      </label>
      <label>Years
        <select value={years} onChange={e => setYears(Number(e.target.value))} aria-label="Years">{[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>{y}</option>)}</select>
      </label>
      <label className="negotiation-check"><input type="checkbox" checked={option} onChange={e => setOption(e.target.checked)} /> Player option on the last year</label>
      <div className="negotiation-actions">
        <button className="primary" onClick={submit}>Make offer</button>
        <button onClick={() => { setSalary(talks.demand.salary); setYears(talks.demand.years); setOption(talks.demand.playerOption); }}>Match their ask</button>
        <button onClick={() => { onUpdate(storeNegotiation(extras, walkAway(talks))); onClose(); }}>End talks</button>
        <button className="link-button" onClick={onClose}>Close</button>
      </div>
      <p className="hint-text">{STYLE_BLURB[agent.style]} Years away from what he wants and leaving out an option he asked for both lower the value of your offer. Lowball offers cost extra patience.</p>
    </div> : <div className="negotiation-actions"><button onClick={onClose}>Close</button></div>}
  </div>;
}
