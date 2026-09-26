import { describe, it, expect } from 'vitest';
import { parseCSV } from '../data/import/parser';
import { normalizeNameForMatching, namesMatch, slugifyName } from '../data/import/nameMatching';
import { normalizeImportBatch, type ColumnMapping } from '../data/import/normalizer';
import { validateImportBatch } from '../data/import/validate';
import { SAMPLE_IMPORT_CSV } from '../data/import/sampleData';

const MAPPING: ColumnMapping = {
  name: 'name', season: 'season', team: 'team', heightInches: 'heightInches', position: 'position',
  ppg: 'ppg', apg: 'apg', rpg: 'rpg', spg: 'spg', bpg: 'bpg', tovPg: 'tovPg',
  fgPct: 'fgPct', tpPct: 'tpPct', ftPct: 'ftPct', tpaPg: 'tpaPg',
};

describe('CSV parser', () => {
  it('parses headers and rows, including quoted fields with embedded commas', () => {
    const rows = parseCSV('name,team\n"Smith, Jr., John",RIVER\nJane Doe,GRANITE');
    expect(rows.length).toBe(2);
    expect(rows[0].name).toBe('Smith, Jr., John');
    expect(rows[1].team).toBe('GRANITE');
  });

  it('handles the full sample dataset without dropping rows', () => {
    const rows = parseCSV(SAMPLE_IMPORT_CSV);
    expect(rows.length).toBe(6);
  });
});

describe('name matching', () => {
  it('strips suffixes, punctuation, casing, and accents for matching', () => {
    expect(namesMatch('Marcus Whitfield', 'MARCUS WHITFIELD JR.')).toBe(true);
    expect(namesMatch('Jóhn Smith', 'John Smith')).toBe(true);
    expect(namesMatch('Marcus Whitfield', 'Dario Kovacic')).toBe(false);
  });

  it('normalizeNameForMatching is stable and slugifyName produces a usable id', () => {
    expect(normalizeNameForMatching('Marcus Whitfield Jr.')).toBe('marcus whitfield');
    expect(slugifyName('Marcus Whitfield Jr.')).toBe('marcus-whitfield');
  });
});

describe('normalizer', () => {
  it('produces PlayerSeason records tagged as generated, never claimed as official', () => {
    const rows = parseCSV(SAMPLE_IMPORT_CSV);
    const normalized = normalizeImportBatch(rows, MAPPING);
    for (const r of normalized) {
      expect(r.season.source).toBe('generated');
    }
  });

  it('higher 3P% input produces a higher estimated three-point rating', () => {
    const rows = parseCSV(SAMPLE_IMPORT_CSV);
    const normalized = normalizeImportBatch(rows, MAPPING);
    const sharp = normalized.find((r) => r.displayName === 'Marcus Whitfield')!; // .41 3P%
    const poor = normalized.find((r) => r.displayName === 'Dario Kovacic')!; // .05 3P%
    expect(sharp.season.attributes.offense.threePoint).toBeGreaterThan(poor.season.attributes.offense.threePoint);
  });

  it('flags out-of-range percentages as warnings instead of applying garbage ratings', () => {
    const rows = parseCSV(SAMPLE_IMPORT_CSV);
    const normalized = normalizeImportBatch(rows, MAPPING);
    const bad = normalized.find((r) => r.displayName === 'Bad Data Row')!;
    expect(bad.warnings.some((w) => w.includes('FG%'))).toBe(true);
  });
});

describe('validator', () => {
  it('detects the deliberate near-duplicate player in the sample data', () => {
    const rows = parseCSV(SAMPLE_IMPORT_CSV);
    const normalized = normalizeImportBatch(rows, MAPPING);
    const report = validateImportBatch(normalized);
    expect(report.duplicatePlayerSeasons.length).toBeGreaterThan(0);
  });

  it('detects the implausible height in the sample data', () => {
    const rows = parseCSV(SAMPLE_IMPORT_CSV);
    const normalized = normalizeImportBatch(rows, MAPPING);
    const report = validateImportBatch(normalized);
    expect(report.impossibleHeights.length).toBeGreaterThan(0);
    expect(report.clean).toBe(false);
  });

  it('reports clean=true for a batch with no issues', () => {
    const rows = parseCSV('name,season\nClean Player,2024-25');
    const normalized = normalizeImportBatch(rows, { name: 'name', season: 'season' });
    const report = validateImportBatch(normalized);
    expect(report.clean).toBe(true);
  });
});
