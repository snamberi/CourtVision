import type { RNG } from './engine/rng';
import type { CareerSeasonRecord, PlayerSeason, SeasonMilestones, SeasonStatTotals } from './types';
import { emptySeasonMilestones } from './types';
import { calculateOverall } from './engine/overall';

/**
 * "Season zero": back-fills a believable stat history for players in a freshly generated league, so
 * career tables, awards (Most Improved), free-agent last-season lines, and the player profile don't
 * start completely blank. The history is entirely synthetic - derived from each player's own
 * attributes, minutes role, and age - and is stored exactly like real archived seasons
 * (`careerHistory`), so every existing page reads it with no special handling.
 */

/** Maximum prior seasons back-filled for any one player. */
export const MAX_PRIOR_SEASONS = 3;
/** Youngest age a player could have already logged an NBA-style season (a 19-year-old is a true rookie: no history). */
const FIRST_POSSIBLE_SEASON_AGE = 19;

/** The season label `yearsBack` seasons before `label` - handles both "2026" and "2026-27" styles. */
export function previousSeasonLabel(label: string, yearsBack = 1): string {
  const range = label.match(/^(\d{4})-(\d{2})$/);
  if (range) {
    const start = parseInt(range[1], 10) - yearsBack;
    return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
  }
  const year = label.match(/^(\d{4})$/);
  if (year) return String(parseInt(year[1], 10) - yearsBack);
  return `${label}-prior${yearsBack}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const noise = (rng: RNG, spread: number) => 1 + (rng.next() * 2 - 1) * spread;

/** How many prior seasons this player plausibly has: bounded by age (and draft year, when known). */
export function priorSeasonCount(player: PlayerSeason, currentSeasonLabel: string): number {
  const byAge = Math.max(0, player.age - FIRST_POSSIBLE_SEASON_AGE);
  let n = byAge;
  const startYear = parseInt(currentSeasonLabel.slice(0, 4), 10);
  const draftStart = player.draftYear ? parseInt(player.draftYear.slice(0, 4), 10) : NaN;
  if (!Number.isNaN(startYear) && !Number.isNaN(draftStart)) n = Math.min(n, Math.max(0, startYear - draftStart));
  return Math.min(MAX_PRIOR_SEASONS, n);
}

interface RateModel {
  mpg: number;
  fgaPerMin: number;
  threeShare: number;
  fg2Pct: number;
  fg3Pct: number;
  ftaPerFga: number;
  ftPct: number;
  orebPerMin: number;
  drebPerMin: number;
  astPerMin: number;
  stlPerMin: number;
  blkPerMin: number;
  tovPerMin: number;
  pfPerMin: number;
}

/** Per-minute production rates implied by the player's ratings at a given overall (attributes drive the shape; overall drives the scale). */
function rateModel(player: PlayerSeason, overall: number): RateModel {
  const o = player.attributes.offense;
  const d = player.attributes.defense;
  const inside = (o.finishing + o.closeShot + o.drivingLayup) / 3;
  const creation = (o.passing + o.ballHandling) / 2;
  const skill = (overall - 50) / 100;

  // Role: the player's own minutes target, nudged by how good they are (stars play more than their nominal band).
  const mpg = clamp((player.minutes?.target ?? 24) + skill * 6, 8, 38);

  const fgaPerMin = clamp(0.34 + skill * 0.2 + (o.shotIQ - 50) * 0.0006, 0.26, 0.6);
  const threeShare = clamp((o.threePoint - 30) / 90, 0.04, 0.6);
  const fg2Pct = clamp(0.44 + (inside - 50) * 0.0025 + (o.midrange - 50) * 0.0008, 0.4, 0.68);
  const fg3Pct = clamp(0.3 + (o.threePoint - 50) * 0.0028, 0.25, 0.43);

  return {
    mpg,
    fgaPerMin,
    threeShare,
    fg2Pct,
    fg3Pct,
    ftaPerFga: clamp(0.16 + (o.finishing - 50) * 0.003 + (o.drivingDunk - 50) * 0.0015, 0.08, 0.42),
    ftPct: clamp(0.55 + (o.freeThrow - 50) * 0.005, 0.5, 0.92),
    orebPerMin: clamp(0.015 + (o.offensiveRebounding - 30) * 0.0016, 0.008, 0.11),
    drebPerMin: clamp(0.05 + (d.defensiveRebounding - 30) * 0.0045, 0.04, 0.3),
    astPerMin: clamp(0.03 + (creation - 40) * 0.0045, 0.02, 0.32),
    stlPerMin: clamp(0.008 + (d.steal - 40) * 0.0006, 0.005, 0.04),
    blkPerMin: clamp(0.004 + (d.block - 30) * 0.0009, 0.002, 0.065),
    tovPerMin: clamp(0.02 + fgaPerMin * 0.06 + creation * 0.0002, 0.02, 0.09),
    pfPerMin: clamp(0.07 + (60 - d.defensiveDiscipline) * 0.0004, 0.05, 0.1),
  };
}

/** Synthesizes one season's totals + milestones from a rate model. Internally consistent: fgm <= fga, tpm <= fgm, points = 2*fgm + tpm + ftm. */
function synthesizeSeason(
  player: PlayerSeason, overall: number, gamesInSeason: number, rng: RNG,
): { stats: SeasonStatTotals; milestones: SeasonMilestones } {
  const m = rateModel(player, overall);

  // Availability: rotation players miss some games; deep-bench players appear in fewer.
  const availability = clamp(0.62 + rng.next() * 0.36 - (m.mpg < 14 ? 0.08 : 0), 0.35, 1);
  const gp = Math.max(1, Math.round(gamesInSeason * availability));
  const gameMinutes = m.mpg * noise(rng, 0.06);
  const minutes = Math.round(gp * gameMinutes);

  const fga = Math.round(minutes * m.fgaPerMin * noise(rng, 0.08));
  const tpa = Math.min(fga, Math.round(fga * m.threeShare * noise(rng, 0.1)));
  const twoAtt = fga - tpa;
  const tpm = Math.min(tpa, Math.round(tpa * m.fg3Pct * noise(rng, 0.06)));
  const twoMade = Math.min(twoAtt, Math.round(twoAtt * m.fg2Pct * noise(rng, 0.05)));
  const fgm = twoMade + tpm;
  const fta = Math.round(fga * m.ftaPerFga * noise(rng, 0.12));
  const ftm = Math.min(fta, Math.round(fta * m.ftPct * noise(rng, 0.04)));
  const points = 2 * twoMade + 3 * tpm + ftm;

  const perMin = (rate: number, spread = 0.12) => Math.round(minutes * rate * noise(rng, spread));
  const oreb = perMin(m.orebPerMin);
  const dreb = perMin(m.drebPerMin);
  const ast = perMin(m.astPerMin);
  const stl = perMin(m.stlPerMin, 0.18);
  const blk = perMin(m.blkPerMin, 0.2);
  const tov = perMin(m.tovPerMin);
  const pf = perMin(m.pfPerMin, 0.08);

  const stats: SeasonStatTotals = {
    gamesPlayed: gp, minutes, points, fgm, fga, tpm, tpa, ftm, fta, oreb, dreb, ast, stl, blk, tov, pf,
    ba: Math.round(fga * 0.05 * noise(rng, 0.2)),
    blkAtt: Math.round(blk / clamp(0.18 + (player.attributes.defense.block - 50) * 0.002, 0.1, 0.35)),
    clutchPoints: Math.round(points * 0.06 * noise(rng, 0.25)),
  };

  // Milestones: rough per-game odds of hitting double figures, from the per-game averages.
  const ppg = points / gp;
  const rpg = (oreb + dreb) / gp;
  const apg = ast / gp;
  const spg = stl / gp;
  const bpg = blk / gp;
  const p10 = (avg: number, cutoff: number) => clamp((avg - cutoff * 0.45) / (cutoff * 0.9), 0, 1) ** 2;
  const pPts = p10(ppg, 10);
  const pReb = p10(rpg, 10);
  const pAst = p10(apg, 10);
  const doubleDoubles = Math.round(gp * clamp(pPts * pReb + pReb * pAst * 0.5 + pPts * pAst * 0.5, 0, 0.9) * noise(rng, 0.12));
  const tripleDoubles = Math.round(doubleDoubles * clamp(pPts * pReb * pAst, 0, 0.5) * 0.9);
  const milestones: SeasonMilestones = {
    ...emptySeasonMilestones(),
    doubleDoubles,
    tripleDoubles: Math.min(tripleDoubles, doubleDoubles),
    gameHighPoints: Math.round(ppg * 1.9 + 4 + rng.next() * 8),
    gameHighRebounds: Math.round(rpg * 1.9 + 3 + rng.next() * 4),
    gameHighAssists: Math.round(apg * 1.9 + 2 + rng.next() * 3),
    gameHighSteals: Math.max(1, Math.round(spg * 2.4 + 1 + rng.next() * 2)),
    gameHighBlocks: Math.max(0, Math.round(bpg * 2.6 + rng.next() * 2)),
  };
  return { stats, milestones };
}

/**
 * Builds a player's "season zero" history: 0-3 archived seasons ending the year before
 * `currentSeasonLabel`, oldest first (the order `careerHistory` uses). Younger players have
 * improved into their current rating; veterans past their prime have slipped from it; a player with
 * no plausible prior seasons (a true rookie) gets an empty history.
 */
export function generatePriorSeasons(
  player: PlayerSeason,
  currentSeasonLabel: string,
  gamesPerSeason: number,
  teamIds: string[],
  rng: RNG,
): CareerSeasonRecord[] {
  const count = priorSeasonCount(player, currentSeasonLabel);
  if (count === 0) return [];
  const currentOverall = calculateOverall(player);
  const records: CareerSeasonRecord[] = [];

  for (let back = count; back >= 1; back--) {
    const age = player.age - back;
    // Rating drift: players under ~25 climb year over year (so earlier = lower); players over ~30 decline (so earlier = higher).
    const perYearDrift = age < 25 ? -(1 + rng.next() * 2.5) : age > 30 ? 0.6 + rng.next() * 1.4 : (rng.next() - 0.5) * 1.2;
    const overallThen = clamp(Math.round(currentOverall + perYearDrift * back), 25, 99);

    // Most players spent the prior year with their current club; some moved around.
    const teamId = rng.next() < 0.75 || teamIds.length === 0
      ? player.teamId
      : teamIds[rng.nextInt(teamIds.length)];

    const { stats, milestones } = synthesizeSeason(player, overallThen, gamesPerSeason, rng);
    records.push({
      season: previousSeasonLabel(currentSeasonLabel, back),
      teamId,
      age,
      overall: overallThen,
      stats,
      milestones,
    });
  }
  return records;
}
