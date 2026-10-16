import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import { teamLineups, bestFive, shotChart, zonePct, ZONES, type ShotChart, type ShotZone } from '../simulation/lineupLab';
import '../improvements.css';

const fmt = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));

/** Zones laid out like a half court (baseline at the bottom). x/y/w/h in a 300x220 box. */
const LAYOUT: Record<ShotZone, { x: number; y: number; w: number; h: number }> = {
  corner3: { x: 4, y: 150, w: 44, h: 66 },
  arc3: { x: 4, y: 4, w: 292, h: 50 },
  long2: { x: 52, y: 58, w: 196, h: 40 },
  mid: { x: 52, y: 102, w: 196, h: 44 },
  paint: { x: 100, y: 150, w: 100, h: 34 },
  rim: { x: 120, y: 188, w: 60, h: 28 },
};

function Court({ chart, league }: { chart: ShotChart; league: ShotChart }) {
  return (
    <svg className="shot-court" viewBox="0 0 300 220" role="img" aria-label="Shot chart by zone">
      <rect x={1} y={1} width={298} height={218} className="shot-floor" />
      {ZONES.map(z => {
        const box = LAYOUT[z.id], line = chart[z.id], avg = zonePct(league[z.id]), pct = zonePct(line);
        const diff = line.fga ? pct - avg : 0;
        const tone = !line.fga ? 'none' : diff > 0.03 ? 'hot' : diff < -0.03 ? 'cold' : 'even';
        const boxes = z.id === 'corner3' ? [box, { ...box, x: 300 - box.x - box.w }] : [box];
        return boxes.map((b, i) => <g key={`${z.id}${i}`}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} className={`shot-zone ${tone}`} />
          {i === 0 && <text x={b.x + b.w / 2} y={b.y + b.h / 2 - 2} className="shot-pct">{line.fga ? `${Math.round(pct * 100)}%` : '–'}</text>}
          {i === 0 && <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 10} className="shot-count">{line.fgm}/{line.fga}</text>}
        </g>);
      })}
    </svg>
  );
}

export function LineupLabPage({ league, controlledTeamId, onSelectPlayer }: { league: League; controlledTeamId: string | null; onSelectPlayer: (id: string) => void }) {
  const [teamId, setTeamId] = useState(controlledTeamId ?? league.teams[0]?.teamId ?? '');
  const [playerId, setPlayerId] = useState('');
  const [minPoss, setMinPoss] = useState(40);
  const team = league.teams.find(t => t.teamId === teamId);
  const rows = useMemo(() => (teamId ? teamLineups(league, teamId) : []), [league, teamId]);
  const leagueChart = useMemo(() => shotChart(league), [league]);
  const chart = useMemo(() => shotChart(league, playerId ? { playerId } : { teamId }), [league, teamId, playerId]);
  const best = bestFive(rows, Math.max(minPoss, 40));
  const shown = rows.filter(r => r.possessions >= minPoss).sort((a, b) => b.net - a.net).slice(0, 15);
  const names = (ids: string[]) => ids.map((id, i) => <span key={id}>{i ? ', ' : ''}<button className="link-button" onClick={() => onSelectPlayer(id)}>{id}</button></span>);
  return (
    <div className="lineup-lab">
      <div className="season-feature-header"><div><span className="pixel-eyebrow">THIS SEASON</span><h2>Lineup Lab</h2></div></div>
      <div className="fa-controls">
        <select value={teamId} onChange={e => { setTeamId(e.target.value); setPlayerId(''); }}>{league.teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select>
        <label>Min. possessions <select value={minPoss} onChange={e => setMinPoss(Number(e.target.value))}>{[10, 20, 40, 80, 150].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      </div>
      {rows.length === 0 ? <p className="empty-state">No games played yet this season.</p> : <>
        {best && <div className="rvy-score"><div><b>Best five: {fmt(best.net)} per 100</b><span>{names(best.players)}</span>
          <small>{best.possessions} possessions together · {best.offRtg.toFixed(1)} offense, {best.defRtg.toFixed(1)} defense</small></div></div>}
        <div className="stat-table-scroll"><table className="db-table lineup-table">
          <thead><tr><th className="col-name">Lineup</th><th className="num">Poss</th><th className="num">Off</th><th className="num">Def</th><th className="num">Net</th></tr></thead>
          <tbody>{shown.map(r => <tr key={r.players.join('|')}>
            <td className="col-name">{names(r.players)}</td><td className="num">{r.possessions}</td><td className="num">{r.offRtg.toFixed(1)}</td><td className="num">{r.defRtg.toFixed(1)}</td>
            <td className={`num ${r.net >= 0 ? 'good-text' : 'bad-text'}`}>{fmt(r.net)}</td></tr>)}</tbody>
        </table></div>
        {shown.length === 0 && <p className="hint-text">No lineup has played {minPoss} possessions together yet. Lower the minimum.</p>}
      </>}
      <h3>Shot chart</h3>
      <div className="fa-controls">
        <select value={playerId} onChange={e => setPlayerId(e.target.value)}>
          <option value="">{team?.name ?? 'Team'} (whole team)</option>
          {team?.seasons.map(p => <option key={p.playerId} value={p.playerId}>{p.playerId}</option>)}
        </select>
      </div>
      <div className="shot-wrap">
        <Court chart={chart} league={leagueChart} />
        <table className="db-table"><thead><tr><th className="col-name">Zone</th><th className="num">FG</th><th className="num">FG%</th><th className="num">League</th></tr></thead>
          <tbody>{ZONES.map(z => <tr key={z.id}><td className="col-name">{z.label}</td><td className="num">{chart[z.id].fgm}/{chart[z.id].fga}</td>
            <td className="num">{chart[z.id].fga ? `${(zonePct(chart[z.id]) * 100).toFixed(1)}%` : '—'}</td><td className="num">{(zonePct(leagueChart[z.id]) * 100).toFixed(1)}%</td></tr>)}</tbody></table>
      </div>
      <p className="hint-text">Green zones beat the league average by 3 points or more, red ones trail it. Built from every possession of this season's games.</p>
    </div>
  );
}
