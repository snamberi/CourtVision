import { useState } from 'react';
import type { LeagueTeam } from '../simulation/league';
import { calculateRatings } from '../simulation/engine/overall';
import { perGameAverages } from '../simulation/careerStats';
import { humanize } from '../lib/humanize';

interface Props {
  teams: LeagueTeam[];
}

function allPlayers(teams: LeagueTeam[]) {
  return teams.flatMap((t) => t.seasons.map((s) => ({ season: s, teamName: t.name })));
}

export function ComparePage({ teams }: Props) {
  const players = allPlayers(teams);
  const [aId, setAId] = useState(players[0]?.season.playerId ?? '');
  const [bId, setBId] = useState(players[1]?.season.playerId ?? '');

  const a = players.find((p) => p.season.playerId === aId);
  const b = players.find((p) => p.season.playerId === bId);

  if (!a || !b) return <p className="empty-state">Not enough players to compare.</p>;

  const ratingsA = calculateRatings(a.season);
  const ratingsB = calculateRatings(b.season);
  const avgA = perGameAverages(a.season.seasonStats);
  const avgB = perGameAverages(b.season.seasonStats);

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
    </div>
  );
}
