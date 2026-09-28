import { useState } from 'react';
import type { League, LeagueTeam } from '../simulation/league';
import { computeStandings } from '../simulation/league';
import { businessOf, gate, jerseySales, referencePrice, buyUpgrade, setTicketPrice, UPGRADES, MAX_LEVEL, loanPayments, homeCourtEdge, baseMerch, type Upgrade } from '../simulation/business';
import { fanMoodLabel } from '../simulation/press';

const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

/** Ticket prices, arena upgrades and jersey sales for the team you run. */
export function BusinessPanel({ league, team, onChange }: { league: League; team: LeagueTeam; onChange: (team: LeagueTeam) => void }) {
  const winPct = computeStandings(league).find(r => r.teamId === team.teamId)?.winPct ?? 0.5;
  const fans = league.press?.fans ?? 55;
  const plan = businessOf(team, winPct);
  const [price, setPrice] = useState(plan.ticketPrice);
  const now = gate(team, winPct, fans, price);
  const ref = referencePrice(team, winPct);
  const jerseys = jerseySales(team, winPct, fans);
  const leagueJerseys = league.teams.flatMap(t => jerseySales(t, computeStandings(league).find(r => r.teamId === t.teamId)?.winPct ?? 0.5, t.teamId === team.teamId ? fans : 55).slice(0, 2).map(s => ({ ...s, team: t.name })))
    .sort((a, b) => b.units - a.units).slice(0, 5);
  const merch = baseMerch(team, winPct) + jerseys.reduce((n, s) => n + s.revenue, 0);
  const tone = price > ref * 1.15 ? 'Fans grumble about prices: fan mood slips at every home game.' : price < ref * 0.9 ? 'Bargain seats: fans appreciate it, but you leave money on the table.' : 'Fair prices: no effect on fan mood.';

  return <section className="business-panel">
    <h3>Business</h3>
    <div className="business-kpis">
      <div><small>Fan mood</small><b>{fanMoodLabel(fans)}</b><span>{Math.round(fans)}/100</span></div>
      <div><small>Attendance</small><b>{now.attendance.toLocaleString()}</b><span>{Math.round(now.fill * 100)}% of {now.capacity.toLocaleString()}</span></div>
      <div><small>Ticket revenue</small><b>{money(now.ticketRevenue)}</b><span>a season</span></div>
      <div><small>Merchandise</small><b>{money(merch)}</b><span>jerseys + team gear</span></div>
      <div><small>Upgrade payments</small><b>{money(loanPayments(plan))}</b><span>a season</span></div>
    </div>

    <div className="business-block">
      <h4>Ticket price</h4>
      <label className="business-price"><input type="range" min={20} max={300} value={price} onChange={e => setPrice(Number(e.target.value))} aria-label="Ticket price" /><b>${price}</b></label>
      <p className="hint-text">Fair price for your market and record: about ${ref}. {tone}</p>
      <button className="primary" disabled={price === plan.ticketPrice && !!team.business} onClick={() => onChange(setTicketPrice(team, price, winPct))}>Set price</button>
    </div>

    <div className="business-block">
      <h4>Arena</h4>
      <p className="hint-text">Every upgrade shows up on your court during home games. Home-court edge now: <b>+{homeCourtEdge(team).toFixed(1)}</b> decision-making and help defense for your players at home.</p>
      <table className="db-table"><thead><tr><th className="col-name">Upgrade</th><th>Level</th><th>Effect</th><th>Next level</th><th /></tr></thead><tbody>
        {(Object.keys(UPGRADES) as Upgrade[]).map(u => { const lvl = plan.arena[u], cost = lvl < MAX_LEVEL ? UPGRADES[u].cost[lvl] : null; return <tr key={u}>
          <td className="col-name">{UPGRADES[u].label}</td><td>{'■'.repeat(lvl)}{'□'.repeat(MAX_LEVEL - lvl)}</td><td>{UPGRADES[u].effect}</td>
          <td>{cost ? `${money(cost)} (${money(cost / 5)}/yr × 5)` : 'Maxed'}</td>
          <td>{cost && <button onClick={() => { const next = buyUpgrade(team, u, winPct); if (next) onChange(next); }}>Build</button>}</td></tr>; })}
      </tbody></table>
    </div>

    <div className="business-block business-jerseys">
      <div><h4>Your jersey sales</h4><ol>{jerseys.slice(0, 5).map(s => <li key={s.playerId}><span>{s.playerId}</span><b>{s.units.toLocaleString()}</b><small>{money(s.revenue)}</small></li>)}</ol></div>
      <div><h4>League best-sellers</h4><ol>{leagueJerseys.map(s => <li key={s.playerId}><span>{s.playerId} <small>{s.team}</small></span><b>{s.units.toLocaleString()}</b></li>)}</ol></div>
    </div>
  </section>;
}
