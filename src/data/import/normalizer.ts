import type { PlayerSeason } from '../../simulation/types';
import { makeDefaultSeason } from '../../simulation/presets/samplePlayers';
import { slugifyName } from './nameMatching';
import type { RawStatRow } from './parser';

/**
 * Maps the columns of an arbitrary box-score CSV to the fields this pipeline
 * understands. Only `name` and `season` are required — everything else is
 * optional and simply skipped (leaving the default-season baseline) if absent.
 */
export interface ColumnMapping {
  name: string;
  season: string;
  team?: string;
  heightInches?: string;
  ppg?: string;
  apg?: string;
  rpg?: string;
  spg?: string;
  bpg?: string;
  tovPg?: string;
  fgPct?: string;
  tpPct?: string;
  ftPct?: string;
  tpaPg?: string;
  position?: string;
}

export interface NormalizedImportRow {
  playerId: string;
  displayName: string;
  season: PlayerSeason;
  sourceRow: RawStatRow;
  warnings: string[];
}

function num(row: RawStatRow, col: string | undefined): number | undefined {
  if (!col) return undefined;
  const v = parseFloat(row[col]);
  return Number.isFinite(v) ? v : undefined;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * IMPORTANT (spec sections 62/130/131): these attribute estimates are derived
 * from ordinary box-score statistics using simple heuristics. They are NOT
 * official player ratings from any commercial product, and must always carry
 * `source: 'generated'` so the UI can label them "Estimated (Generated)"
 * rather than implying they came from a licensed dataset.
 */
export function normalizeStatRow(row: RawStatRow, mapping: ColumnMapping): NormalizedImportRow {
  const warnings: string[] = [];
  const displayName = row[mapping.name]?.trim();
  const seasonLabel = row[mapping.season]?.trim();
  if (!displayName) warnings.push('Missing player name.');
  if (!seasonLabel) warnings.push('Missing season label.');

  const playerId = slugifyName(displayName || `unknown-${Math.random().toString(36).slice(2, 8)}`);
  const season = makeDefaultSeason(playerId, seasonLabel || 'unknown-season', row[mapping.team ?? '']?.trim() || null);
  season.source = 'generated';

  const height = num(row, mapping.heightInches);
  if (height != null) {
    if (height < 48 || height > 96) warnings.push(`Height ${height}in looks implausible; left unchanged.`);
    else season.attributes.physical.heightInches = height;
  }

  const ppg = num(row, mapping.ppg);
  const apg = num(row, mapping.apg);
  const rpg = num(row, mapping.rpg);
  const spg = num(row, mapping.spg);
  const bpg = num(row, mapping.bpg);
  const tov = num(row, mapping.tovPg);
  const fgPct = num(row, mapping.fgPct);
  const tpPct = num(row, mapping.tpPct);
  const ftPct = num(row, mapping.ftPct);
  const tpa = num(row, mapping.tpaPg);

  if (fgPct != null) {
    if (fgPct < 0 || fgPct > 1) warnings.push(`FG% ${fgPct} outside [0,1]; ignored.`);
    else season.attributes.offense.finishing = clamp(30 + fgPct * 130, 25, 99);
  }
  if (tpPct != null) {
    if (tpPct < 0 || tpPct > 1) warnings.push(`3P% ${tpPct} outside [0,1]; ignored.`);
    else {
      const rating = clamp(20 + tpPct * 220, 25, 99);
      season.attributes.offense.threePoint = rating;
      season.attributes.offense.corner3 = rating;
      season.attributes.offense.aboveBreak3 = rating;
      season.attributes.offense.catchAndShoot = rating;
      season.attributes.offense.pullUp3 = clamp(rating - 3, 25, 99);
    }
  }
  if (ftPct != null) {
    if (ftPct < 0 || ftPct > 1) warnings.push(`FT% ${ftPct} outside [0,1]; ignored.`);
    else season.attributes.offense.freeThrow = clamp(ftPct * 100, 25, 99);
  }
  if (apg != null) {
    season.attributes.offense.passing = clamp(40 + apg * 6, 30, 99);
    season.attributes.offense.passingIQ = clamp(40 + apg * 5, 30, 99);
    season.tendencies.ballDominance = clamp(20 + apg * 8, 10, 95);
  }
  if (tov != null && apg != null) {
    // more assists per turnover => higher ball security/decision making estimate
    const ratio = tov > 0 ? apg / tov : apg > 0 ? 4 : 1.5;
    season.attributes.offense.ballSecurity = clamp(40 + ratio * 12, 25, 99);
    season.attributes.offense.decisionMaking = clamp(40 + ratio * 10, 25, 99);
  }
  if (spg != null) {
    season.attributes.defense.steal = clamp(30 + spg * 35, 25, 99);
    season.attributes.defense.stealIQ = clamp(30 + spg * 30, 25, 99);
  }
  if (bpg != null) {
    season.attributes.defense.block = clamp(25 + bpg * 30, 20, 99);
    season.attributes.defense.rimProtection = clamp(25 + bpg * 28, 20, 99);
  }
  if (rpg != null) {
    season.attributes.offense.offensiveRebounding = clamp(20 + rpg * 6, 15, 99);
    season.attributes.defense.defensiveRebounding = clamp(20 + rpg * 7, 15, 99);
  }
  if (ppg != null) {
    season.tendencies.role.shotCreator = clamp(20 + ppg * 3, 10, 95);
  }
  if (tpa != null) {
    season.tendencies.threePointTargets = { target: tpa };
  }

  const posRaw = mapping.position ? row[mapping.position]?.trim().toUpperCase() : undefined;
  const validPositions = ['PG', 'SG', 'SF', 'PF', 'C'];
  if (posRaw) {
    if (!validPositions.includes(posRaw)) {
      warnings.push(`Unrecognized position "${posRaw}"; left as default suitability.`);
    } else {
      season.positions = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0, [posRaw]: 100 } as PlayerSeason['positions'];
    }
  }

  return { playerId, displayName: displayName || playerId, season, sourceRow: row, warnings };
}

export function normalizeImportBatch(rows: RawStatRow[], mapping: ColumnMapping): NormalizedImportRow[] {
  return rows.map((row) => normalizeStatRow(row, mapping));
}
