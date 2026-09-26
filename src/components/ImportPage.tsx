import { useState } from 'react';
import { parseCSV } from '../data/import/parser';
import { normalizeImportBatch, type NormalizedImportRow, type ColumnMapping } from '../data/import/normalizer';
import { validateImportBatch, type DataQualityReport } from '../data/import/validate';
import { SAMPLE_IMPORT_CSV } from '../data/import/sampleData';
import type { LeagueTeam } from '../simulation/league';

const DEFAULT_MAPPING: ColumnMapping = {
  name: 'name', season: 'season', team: 'team', heightInches: 'heightInches', position: 'position',
  ppg: 'ppg', apg: 'apg', rpg: 'rpg', spg: 'spg', bpg: 'bpg', tovPg: 'tovPg',
  fgPct: 'fgPct', tpPct: 'tpPct', ftPct: 'ftPct', tpaPg: 'tpaPg',
};

interface Props {
  teams: LeagueTeam[];
  onAddToTeam: (teamId: string, rows: NormalizedImportRow[]) => void;
  onBuildLeague: (teamNames: string[], rowsByTeam: Record<string, NormalizedImportRow[]>) => void;
}

export function ImportPage({ teams, onAddToTeam, onBuildLeague }: Props) {
  const [csvText, setCsvText] = useState(SAMPLE_IMPORT_CSV);
  const [rows, setRows] = useState<NormalizedImportRow[] | null>(null);
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetTeamId, setTargetTeamId] = useState(teams[0]?.teamId ?? '');

  const runPipeline = () => {
    const raw = parseCSV(csvText);
    const normalized = normalizeImportBatch(raw, DEFAULT_MAPPING);
    setRows(normalized);
    setReport(validateImportBatch(normalized));
    setSelected(new Set(normalized.map((r) => r.playerId)));
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addSelected = () => {
    if (!rows || !targetTeamId) return;
    onAddToTeam(targetTeamId, rows.filter((r) => selected.has(r.playerId)));
  };

  const buildLeague = () => {
    if (!rows) return;
    const selectedRows = rows.filter((r) => selected.has(r.playerId));
    const rowsByTeam: Record<string, NormalizedImportRow[]> = {};
    for (const r of selectedRows) {
      const teamName = r.season.teamId || 'UNASSIGNED';
      (rowsByTeam[teamName] ??= []).push(r);
    }
    onBuildLeague(Object.keys(rowsByTeam), rowsByTeam);
  };

  return (
    <div className="import-page">
      <p className="hint-text">
        Import pipeline: Raw CSV → Parser → Normalizer (estimates attributes from box-score
        stats — tagged "generated", never claimed as official ratings) → Player Matching →
        Validation → ready to add to a team roster. Paste your own CSV or use the loaded
        fictional sample.
      </p>
      <textarea
        className="code-editor" rows={8} spellCheck={false}
        value={csvText} onChange={(e) => setCsvText(e.target.value)}
      />
      <div className="code-mode-actions">
        <button className="primary" onClick={runPipeline}>Run Import Pipeline</button>
        <button onClick={() => setCsvText(SAMPLE_IMPORT_CSV)}>Load Sample Data</button>
      </div>

      {report && (
        <div className="quality-report">
          <h4>Data Quality Report</h4>
          <ul>
            <li>Total rows: {report.totalRows}</li>
            <li className={report.duplicatePlayerSeasons.length ? 'warn' : ''}>
              Duplicate player/season pairs: {report.duplicatePlayerSeasons.length}
              {report.duplicatePlayerSeasons.length > 0 && ` (${report.duplicatePlayerSeasons.join('; ')})`}
            </li>
            <li className={report.impossibleHeights.length ? 'warn' : ''}>
              Implausible heights: {report.impossibleHeights.length}
              {report.impossibleHeights.length > 0 && ` (${report.impossibleHeights.join('; ')})`}
            </li>
            <li className={report.invalidPercentages.length ? 'warn' : ''}>
              Invalid percentages: {report.invalidPercentages.length}
              {report.invalidPercentages.length > 0 && ` (${report.invalidPercentages.join('; ')})`}
            </li>
            <li>Rows with warnings: {report.rowsWithWarnings}</li>
            <li className={report.clean ? 'ok' : 'warn'}>Overall: {report.clean ? 'Clean' : 'Issues found (see above)'}</li>
          </ul>
        </div>
      )}

      {rows && (
        <>
          <table className="db-table">
            <thead><tr><th></th><th>Name</th><th>Season</th><th>3PT (est.)</th><th>Warnings</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.playerId}>
                  <td><input type="checkbox" checked={selected.has(r.playerId)} onChange={() => toggle(r.playerId)} /></td>
                  <td>{r.displayName}</td>
                  <td>{r.season.season}</td>
                  <td>{r.season.attributes.offense.threePoint.toFixed(0)}</td>
                  <td className="hint-text">{r.warnings.join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="code-mode-actions">
            <select value={targetTeamId} onChange={(e) => setTargetTeamId(e.target.value)}>
              {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
            </select>
            <button className="primary" disabled={teams.length === 0} onClick={addSelected}>Add {selected.size} selected to team</button>
            <button onClick={buildLeague}>Build New League From Selected (grouped by Team column)</button>
          </div>
        </>
      )}
    </div>
  );
}
