export interface RawStatRow {
  [column: string]: string;
}

/**
 * Small, dependency-free CSV parser (handles quoted fields with embedded
 * commas). Not a full RFC-4180 implementation, but sufficient for the
 * plain box-score CSVs this pipeline is designed to accept.
 */
export function parseCSV(text: string): RawStatRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = splitCSVLine(lines[0]);
  const rows: RawStatRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const row: RawStatRow = {};
    header.forEach((col, idx) => { row[col.trim()] = (cells[idx] ?? '').trim(); });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}
