import type { NormalizedImportRow } from './normalizer';
import { normalizeNameForMatching } from './nameMatching';

export interface DataQualityReport {
  totalRows: number;
  duplicatePlayerSeasons: string[]; // "name (season)" pairs appearing more than once
  impossibleHeights: string[];
  invalidPercentages: string[]; // carried over from row-level warnings
  missingNames: number;
  missingSeasons: number;
  rowsWithWarnings: number;
  clean: boolean;
}

export function validateImportBatch(rows: NormalizedImportRow[]): DataQualityReport {
  const seen = new Map<string, number>();
  const duplicates = new Set<string>();
  let missingNames = 0;
  let missingSeasons = 0;
  let rowsWithWarnings = 0;
  const impossibleHeights: string[] = [];
  const invalidPercentages: string[] = [];

  for (const r of rows) {
    const key = `${normalizeNameForMatching(r.displayName)}::${r.season.season}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if ((seen.get(key) ?? 0) > 1) duplicates.add(`${r.displayName} (${r.season.season})`);

    if (!r.displayName || r.displayName.startsWith('unknown-')) missingNames++;
    if (!r.season.season || r.season.season === 'unknown-season') missingSeasons++;

    const heightWarnings = r.warnings.filter((w) => w.toLowerCase().includes('height'));
    impossibleHeights.push(...heightWarnings.map((w) => `${r.displayName}: ${w}`));

    const pctWarnings = r.warnings.filter((w) => w.includes('%'));
    invalidPercentages.push(...pctWarnings.map((w) => `${r.displayName}: ${w}`));

    if (r.warnings.length > 0) rowsWithWarnings++;
  }

  const report: DataQualityReport = {
    totalRows: rows.length,
    duplicatePlayerSeasons: [...duplicates],
    impossibleHeights,
    invalidPercentages,
    missingNames,
    missingSeasons,
    rowsWithWarnings,
    clean: duplicates.size === 0 && impossibleHeights.length === 0 && invalidPercentages.length === 0 && missingNames === 0 && missingSeasons === 0,
  };
  return report;
}
