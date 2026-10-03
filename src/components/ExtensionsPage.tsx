import { useState } from 'react';
import { plural } from '../lib/humanize';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { AGENTS, STYLE_BLURB, makeOffer, walkAway } from '../simulation/agents';
import { extensionStance, openExtension, storeExtensionTalks, extensionMinimum, signExtension } from '../simulation/extensions';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  onChange: (league: League, extras: GMLeagueExtras) => void;
  onSelectPlayer: (id: string) => void;
}

const money = (n: number) => `$${(n / 1e6).toFixed(1)}M`;

/** Extend your players during the season, before they reach free agency. */
export function ExtensionsPage({ league, extras, controlledTeamId, onChange, onSelectPlayer }: Props) {
  const team = league.teams.find(t => t.teamId === controlledTeamId);
  const [talkingTo, setTalkingTo] = useState<string | null>(null);
  const [salary, setSalary] = useState(0);
  const [years, setYears] = useState(3);
  if (!team) return <p className="empty-state">Extensions are for the team you run.</p>;
  const eligible = team.seasons.filter(p => (extras.contracts[p.playerId]?.yearsRemaining ?? 99) <= 2 || extras.contracts[p.playerId]?.extension)
    .sort((a, b) => calculateOverall(b) - calculateOverall(a));
  const player = team.seasons.find(p => p.playerId === talkingTo);
  const talks = player ? openExtension(league, extras, player, team.teamId) : null;

  const start = (id: string) => {
    const p = team.seasons.find(x => x.playerId === id)!;
    const t = openExtension(league, extras, p, team.teamId);
    if (!t) return;
    setTalkingTo(id); setSalary(t.demand.salary); setYears(t.demand.years);
    if (!extras.extensionTalks?.[id] || extras.extensionTalks[id].season !== league.season) onChange(league, storeExtensionTalks(extras, t));
  };
  const offer = () => {
    if (!talks || !player) return;
    const { negotiation, outcome } = makeOffer(talks, { salary, years, playerOption: false }, extensionMinimum(player, extras));
    const next = storeExtensionTalks(extras, negotiation);
    if (outcome === 'agreed') { const r = signExtension(league, next, player.playerId, { annualSalary: salary, years }); onChange(r.league, r.extras); }
    else { onChange(league, next); if (outcome === 'countered') setSalary(negotiation.demand.salary); }
  };

  return <div className="extensions-page">
    <header><span className="pixel-eyebrow">FRONT OFFICE</span><h2>Contract extensions</h2>
      <p className="hint-text">Players in the last two years of their deals can be extended during the season. The new deal starts when the current one ends. A player in his final year without an extension is in a contract year: he plays a little harder, and he'll hit free agency in the summer.</p></header>
    <div className="finances-table-wrap"><table className="db-table extensions-table"><thead><tr><th className="col-name">Player</th><th>OVR</th><th>Age</th><th>Contract</th><th>Status</th><th /></tr></thead><tbody>
      {eligible.map(p => { const c = extras.contracts[p.playerId]; const s = extensionStance(league, extras, p); const t = extras.extensionTalks?.[p.playerId]; const walked = !!t && t.season === league.season && t.status === 'walked';
        return <tr key={p.playerId}>
          <td className="col-name"><button className="link-button" onClick={() => onSelectPlayer(p.playerId)}>{p.playerId}</button>{p.contractYear && <span className="contract-year-tag" title="Playing for his next contract">CONTRACT YEAR</span>}</td>
          <td>{calculateOverall(p)}</td><td>{p.age}</td>
          <td>{c ? `${money(c.annualSalary)} · ${c.yearsRemaining} yr${c.yearsRemaining === 1 ? '' : 's'} left` : '—'}{c?.extension && <div className="hint-text">Extended: {c.extension.years} yrs at {money(c.extension.annualSalary)}</div>}</td>
          <td className="hint-text">{walked ? 'Talks broke down. He\'ll test free agency.' : s.open ? s.note : s.reason}</td>
          <td>{s.open && !walked && <button onClick={() => start(p.playerId)}>{t && t.season === league.season && t.status === 'open' ? 'Continue talks' : 'Open talks'}</button>}</td>
        </tr>; })}
      {eligible.length === 0 && <tr><td colSpan={6} className="hint-text">Nobody on your roster is in the last two years of his deal.</td></tr>}
    </tbody></table></div>

    {player && talks && <section className="negotiation-panel">
      {(() => { const agent = AGENTS.find(a => a.id === talks.agentId)!; return <p className="hint-text"><b>{agent.name}</b>, {agent.agency} · {agent.style}: {STYLE_BLURB[agent.style]}</p>; })()}
      <ol className="negotiation-log">{talks.log.map((l, i) => <li key={i} className={`from-${l.from}`}>{l.text}</li>)}</ol>
      {talks.status === 'open' ? <div className="negotiation-offer">
        <label>Salary <input type="range" min={extras.capSettings.minSalary} max={extras.capSettings.salaryCap * extras.capSettings.maxSalaryPctOfCap} step={50000} value={salary} onChange={e => setSalary(Number(e.target.value))} /><b>{money(salary)}</b></label>
        <label>Years <select value={years} onChange={e => setYears(Number(e.target.value))}>{[1, 2, 3, 4, 5].map(y => <option key={y}>{y}</option>)}</select></label>
        <button className="primary" onClick={offer}>Make offer</button>
        <button onClick={() => { onChange(league, storeExtensionTalks(extras, walkAway(talks))); setTalkingTo(null); }}>Walk away</button>
      </div> : <p className="hint-text">{talks.status === 'agreed' ? `Extension agreed: ${plural(talks.deal?.yearsRemaining ?? 0, 'year')} at ${money(talks.deal?.annualSalary ?? 0)} a year.` : 'Talks are over for this season.'}</p>}
      <button className="link-button" onClick={() => setTalkingTo(null)}>Close</button>
    </section>}
  </div>;
}
