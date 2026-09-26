import { useState } from 'react';
import type { PlayerSeason } from '../simulation/types';
import { runPlayerScript, CODE_MODE_EXAMPLES, CODE_MODE_DOCS } from '../simulation/codeApi';

interface Props {
  season: PlayerSeason;
  onChange: (next: PlayerSeason) => void;
}

export function CodeMode({ season, onChange }: Props) {
  const [code, setCode] = useState(CODE_MODE_EXAMPLES[0].code);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PlayerSeason[]>([]);

  const run = () => {
    const result = runPlayerScript(season, code);
    setLogs(result.logs);
    setError(result.error);
    if (!result.error) {
      setHistory((h) => [...h, season]);
      onChange(result.season);
    }
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    onChange(prev);
    setHistory((h) => h.slice(0, -1));
  };

  return (
    <div className="code-mode">
      <div className="code-mode-main">
        <h4>Code Mode — {season.playerId}</h4>
        <textarea
          className="code-editor"
          value={code}
          spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
          rows={14}
        />
        <div className="code-mode-actions">
          <button className="primary" onClick={run}>Run</button>
          <button disabled={history.length === 0} onClick={undo}>Undo</button>
          <select onChange={(e) => setCode(CODE_MODE_EXAMPLES[Number(e.target.value)].code)} defaultValue="">
            <option value="" disabled>Load example…</option>
            {CODE_MODE_EXAMPLES.map((ex, i) => <option key={ex.label} value={i}>{ex.label}</option>)}
          </select>
        </div>
        {error && <pre className="code-error">{error}</pre>}
        {logs.length > 0 && (
          <div className="code-console">
            {logs.map((l, i) => <div key={i}>{'>'} {l}</div>)}
          </div>
        )}
        <p className="hint-text">
          Changes apply to the same player data the visual editor uses — switch to
          Player Editor to see (or continue adjusting) the result of this script.
        </p>
      </div>
      <pre className="code-docs">{CODE_MODE_DOCS}</pre>
    </div>
  );
}
