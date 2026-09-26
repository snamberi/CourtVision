import { useState } from 'react';
import { LEGEND_TEAM_TEMPLATES, buildLegendTeam } from '../simulation/legends';
import { simulateGame } from '../simulation/engine/game';
import { DEFAULT_GAME_SETTINGS, ERA_PRESETS } from '../simulation/types';
import type { GameResult } from '../simulation/boxscore';
import { BoxScoreTable } from './BoxScoreTable';
import { PossessionLogView } from './PossessionLogView';

export function LegendsPage({ sandboxMode, seed }: { sandboxMode: boolean; seed: number }) {
  const [homeIdx, setHomeIdx] = useState(0);
  const [awayIdx, setAwayIdx] = useState(1);
  const [eraKey, setEraKey] = useState<keyof typeof ERA_PRESETS>('modern');
  const [result, setResult] = useState<GameResult | null>(null);

  const run = () => {
    const home = buildLegendTeam(LEGEND_TEAM_TEMPLATES[homeIdx]);
    const away = buildLegendTeam(LEGEND_TEAM_TEMPLATES[awayIdx]);
    const r = simulateGame({
      home, away,
      settings: { ...DEFAULT_GAME_SETTINGS, sandboxMode, seed, era: ERA_PRESETS[eraKey] },
    });
    setResult(r);
  };

  return (
    <div className="legends-page">
      <p className="hint-text">
        These are era-styled demo teams generated for this sandbox — not official historical
        ratings. Swap in a real, legally-sourced historical dataset later without changing any
        of the engine or UI code below.
      </p>
      <div className="legends-controls">
        <select value={homeIdx} onChange={(e) => setHomeIdx(Number(e.target.value))}>
          {LEGEND_TEAM_TEMPLATES.map((t, i) => <option key={t.id} value={i}>{t.label}</option>)}
        </select>
        <span>vs</span>
        <select value={awayIdx} onChange={(e) => setAwayIdx(Number(e.target.value))}>
          {LEGEND_TEAM_TEMPLATES.map((t, i) => <option key={t.id} value={i}>{t.label}</option>)}
        </select>
        <select value={eraKey} onChange={(e) => setEraKey(e.target.value as keyof typeof ERA_PRESETS)}>
          {Object.keys(ERA_PRESETS).map((k) => <option key={k} value={k}>{k} rules</option>)}
        </select>
        <button className="primary" onClick={run}>Simulate</button>
      </div>

      {result && (
        <>
          <div className="scoreboard">
            <span>{result.homeTeamId} {result.homeScore}</span>
            <span className="dash">–</span>
            <span>{result.awayScore} {result.awayTeamId}</span>
          </div>
          <div className="box-scores">
            <BoxScoreTable box={result.homeBox} title={result.homeTeamId} />
            <BoxScoreTable box={result.awayBox} title={result.awayTeamId} />
          </div>
          <PossessionLogView log={result.possessionLog} />
        </>
      )}
    </div>
  );
}
