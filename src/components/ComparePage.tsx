import { useMemo, useState } from 'react';
import type { League, LeagueTeam } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { PlayerSeason } from '../simulation/types';
import { calculateRatings } from '../simulation/engine/overall';
import { perGameAverages } from '../simulation/careerStats';
import { humanize } from '../lib/humanize';
import { overallCurve, careerComps, careerPool } from '../simulation/careerComps';
import '../improvements.css';

interface Props {
  teams: LeagueTeam[];
  league?: League;
  extras?: GMLeagueExtras;
  onSelectPlayer?: (id: string) => void;
}

function allPlayers(teams: LeagueTeam[], freeAgents: PlayerSeason[]) {
  return [...teams.flatMap((t) => t.seasons.map((s) => ({ season: s, teamName: t.name }))), ...freeAgents.map(s => ({ season: s, teamName: 'Free agent' }))];
}

/** Both players' Overall by age on one small chart. */
function CurveChart({ a, b }: { a: PlayerSeason; b: PlayerSeason }) {
  const ca = [...overallCurve(a)].sort((x, y) => x[0] - y[0]), cb = [...overallCurve(b)].sort((x, y) => x[0] - y[0]);
  const all = [...ca, ...cb];
  if (all.length < 2) return null;
  const minAge = Math.min(...all.map(p => p[0])), maxAge = Math.max(...all.map(p => p[0]), minAge + 1);
  const lo = Math.min(...all.map(p => p[1])) - 3, hi = Math.max(...all.map(p => p[1])) + 3;
  const W = 320, H = 140, x = (age: number) => 24 + ((age - minAge) / (maxAge - minAge)) * (W - 34), y = (o: number) => H - 18 - ((o - lo) / (hi - lo)) * (H - 28);
  const path = (c: [number, number][]) => c.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
  return (
    <figure className="cmp-curve">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Overall by age: ${a.playerId} and ${b.playerId}`}>
        <line x1={24} x2={W - 10} y1={H - 18} y2={H - 18} className="cmp-axis" />
        <text x={24} y={H - 4} className="cmp-tick">{minAge}</text><text x={W - 22} y={H - 4} className="cmp-tick">{maxAge}</text>
        <text x={2} y={y(hi - 3) + 4} className="cmp-tick">{Math.round(hi - 3)}</text><text x={2} y={y(lo + 3) + 4} className="cmp-tick">{Math.round(lo + 3)}</text>
        <path d={path(ca)} className="cmp-line a" /><path d={path(cb)} className="cmp-line b" />
        {ca.map(p => <rect key={`a${p[0]}`} x={x(p[0]) - 2} y={y(p[1]) - 2} width={4} height={4} className="cmp-dot a" />)}
        {cb.map(p => <rect key={`b${p[0]}`} x={x(p[0]) - 2} y={y(p[1]) - 2} width={4} height={4} className="cmp-dot b" />)}
      </svg>
      <figcaption><span className="cmp-key a" /> {a.playerId} <span className="cmp-key b" /> {b.playerId} · Overall by age</figcaption>
    </figure>
  );
}

export function ComparePage({ teams, league, extras, onSelectPlayer }: Props) {
  const players = allPlayers(teams, extras?.freeAgents ?? []);
  const [aId, setAId] = useState(players[0]?.season.playerId ?? '');
  const [bId, setBId] = useState(players[1]?.season.playerId ?? '');
  const pool = useMemo(() => (league ? careerPool(league, extras?.freeAgents ?? []) : []), [league, extras?.freeAgents]);

  const a = players.find((p) => p.season.playerId === aId);
  const b = players.find((p) => p.season.playerId === bId);

  if (!a || !b) return <p className="empty-state">Not enough players to compare.</p>;

  const ratingsA = calculateRatings(a.season);
  const ratingsB = calculateRatings(b.season);
  const avgA = perGameAverages(a.season.seasonStats);
  const avgB = perGameAverages(b.season.seasonStats);
  const contractA = extras?.contracts[a.season.playerId], contractB = extras?.contracts[b.season.playerId];
  const money = (n?: number) => (n ? `$${(n / 1e6).toFixed(1)}M` : '—');
  const comps = (p: PlayerSeason) => careerComps(p, pool);
  const link = (id: string) => (onSelectPlayer ? <button className="link-button" onClick={() => onSelectPlayer(id)}>{id}</button> : id);

  const row = (label: string, valA: number, valB: number, decimals = 0) => (
    <tr key={label}>
      <td className={valA > valB ? 'cmp-winner' : ''}>{valA.toFixed(decimals)}</td>
      <td className="cmp-label">{label}</td>
      <td className={valB > valA ? 'cmp-winner' : ''}>{valB.toFixed(decimals)}</td>
    </tr>
  );

  return (
    <div className="compare-page">
      <div className="cmp-selectors">
        <select value={aId} onChange={(e) => setAId(e.target.value)}>
          {players.map((p) => <option key={p.season.playerId} value={p.season.playerId}>{p.season.playerId} ({p.teamName})</option>)}
        </select>
        <span>vs</span>
        <select value={bId} onChange={(e) => setBId(e.target.value)}>
          {players.map((p) => <option key={p.season.playerId} value={p.season.playerId}>{p.season.playerId} ({p.teamName})</option>)}
        </select>
      </div>

      {extras && <table className="compare-table">
        <thead><tr><th>{a.season.playerId}</th><th>Contract</th><th>{b.season.playerId}</th></tr></thead>
        <tbody>
          <tr><td>{a.teamName}</td><td className="cmp-label">Team</td><td>{b.teamName}</td></tr>
          <tr><td>{money(contractA?.annualSalary)}</td><td className="cmp-label">Salary</td><td>{money(contractB?.annualSalary)}</td></tr>
          <tr><td>{contractA ? `${contractA.yearsRemaining} yr${contractA.yearsRemaining === 1 ? '' : 's'}` : '—'}</td><td className="cmp-label">Years left</td><td>{contractB ? `${contractB.yearsRemaining} yr${contractB.yearsRemaining === 1 ? '' : 's'}` : '—'}</td></tr>
        </tbody>
      </table>}

      <CurveChart a={a.season} b={b.season} />

      <table className="compare-table">
        <thead>
          <tr><th>{a.season.playerId}</th><th>Overall Ratings</th><th>{b.season.playerId}</th></tr>
        </thead>
        <tbody>
          {row('Overall', ratingsA.overall, ratingsB.overall)}
          {row('Offensive Rating', ratingsA.offensiveRating, ratingsB.offensiveRating, 1)}
          {row('Defensive Rating', ratingsA.defensiveRating, ratingsB.defensiveRating, 1)}
          {row('Shooting Rating', ratingsA.shootingRating, ratingsB.shootingRating, 1)}
          {row('Playmaking Rating', ratingsA.playmakingRating, ratingsB.playmakingRating, 1)}
          {row('Rebounding Rating', ratingsA.reboundingRating, ratingsB.reboundingRating, 1)}
          {row('Physical Rating', ratingsA.physicalRating, ratingsB.physicalRating, 1)}
          {row('Age', a.season.age, b.season.age)}
          {row('Potential', a.season.development.potential, b.season.development.potential)}
        </tbody>
      </table>

      <table className="compare-table">
        <thead>
          <tr><th>{a.season.playerId}</th><th>Season Stats/Game</th><th>{b.season.playerId}</th></tr>
        </thead>
        <tbody>
          {row('Games Played', avgA.gamesPlayed, avgB.gamesPlayed)}
          {row('PPG', avgA.ppg, avgB.ppg, 1)}
          {row('RPG', avgA.rpg, avgB.rpg, 1)}
          {row('APG', avgA.apg, avgB.apg, 1)}
          {row('SPG', avgA.spg, avgB.spg, 2)}
          {row('BPG', avgA.bpg, avgB.bpg, 2)}
          {row('FG%', avgA.fgPct * 100, avgB.fgPct * 100, 1)}
          {row('3P%', avgA.tpPct * 100, avgB.tpPct * 100, 1)}
          {row('TS%', avgA.tsPct * 100, avgB.tsPct * 100, 1)}
        </tbody>
      </table>

      <table className="compare-table">
        <thead>
          <tr><th>{a.season.playerId}</th><th>Key Attributes</th><th>{b.season.playerId}</th></tr>
        </thead>
        <tbody>
          {(['threePoint', 'ballHandling', 'finishing', 'passing'] as const).map((k) =>
            row(humanize(k), a.season.attributes.offense[k], b.season.attributes.offense[k]))}
          {(['perimeterDefense', 'block', 'steal', 'defensiveRebounding'] as const).map((k) =>
            row(humanize(k), a.season.attributes.defense[k], b.season.attributes.defense[k]))}
        </tbody>
      </table>

      {league && <div className="cmp-comps">
        {[a.season, b.season].map(p => { const list = comps(p); return (
          <div key={p.playerId}>
            <h4>{p.playerId} plays like…</h4>
            {list.length ? <ul>{list.map(c => <li key={c.playerId}>{link(c.playerId)}: {c.thenOverall} at age {c.atAge}, peaked at {c.peakOverall} (age {c.peakAge}).</li>)}</ul>
              : <p className="hint-text">No close career match yet. Comps come from players with careers on record at his age and beyond.</p>}
          </div>); })}
      </div>}
    </div>
  );
}
