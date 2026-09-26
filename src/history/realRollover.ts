import type { PlayerSeason } from '../simulation/types';
import type { DraftProspect } from '../simulation/gm';
import type { HistoricalLeagueMeta } from './historicalLeague';
import { NBA_HISTORY_DATASET } from './datasetInfo';
import { buildRealPlayer, type RealPlayerSeed } from './realPlayers';
import { appendHistoryEvent } from '../simulation/playerHistory';

/* Season-rollover hooks for historical leagues: the real draft class for this offseason and players whose real NBA
 * debut comes this season (drafted earlier, e.g. stashed overseas). Pure and synchronous so manual progression and
 * Auto Play (worker) behave the same; the app tops up `futureClasses` from the dataset ahead of time. */

/** Age on October 1 of `startYear` (the season's opening), or `fallback`. */
export function ageOnOpening(birthDate: string | null | undefined, startYear: number, fallback: number): number {
  if (!birthDate) return fallback;
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = startYear - y;
  if (m > 10 || (m === 10 && d > 1)) age -= 1;
  return age;
}

/** Turns stored class seeds into draft prospects (real players; scouting noise as usual). `season` = the draft's season label. */
export function prospectsFromSeeds(seeds: RealPlayerSeed[], season: string, draftYear: number): DraftProspect[] {
  return seeds.map(seed => {
    const age = seed.birthDate ? Math.max(18, ageOnOpening(seed.birthDate, draftYear, 21)) : 21;
    const p = buildRealPlayer(seed, season, null, age, seed.rating.ovr, NBA_HISTORY_DATASET);
    const trueSeason = { ...p, birthDate: seed.birthDate ?? undefined };
    const noise = (((seed.id.length * 7919) % 13) - 6);
    return { playerId: p.playerId, trueSeason, scoutedPotential: Math.max(40, Math.min(99, trueSeason.development.potential + noise)), scoutingAccuracy: 0.7 } as DraftProspect;
  });
}

/**
 * The draft class for the offseason that opens `newSeason` (draft year = newSeason). Real while the dataset has it;
 * a generated (fictional) class afterwards, with a note. Returns the updated meta with that class consumed.
 */
export function historicalDraftClass(meta: HistoricalLeagueMeta, newSeason: string, generate: () => DraftProspect[]): { draftClass: DraftProspect[]; meta: HistoricalLeagueMeta; real: boolean } {
  const year = Number(newSeason);
  const seeds = meta.futureClasses[newSeason];
  const futureClasses = { ...meta.futureClasses };
  delete futureClasses[newSeason];
  for (const key of Object.keys(futureClasses)) if (Number(key) < year) delete futureClasses[key];
  if (seeds?.length) return { draftClass: prospectsFromSeeds(seeds, newSeason, year), meta: { ...meta, futureClasses }, real: true };
  const beyondData = year > meta.lastDataStartYear;
  const note = beyondData
    ? `${year} draft onward: the NBA dataset ends with ${meta.lastDataStartYear}–${String((meta.lastDataStartYear + 1) % 100).padStart(2, '0')}, so draft classes are generated (fictional) players.`
    : `${year} draft: the real class was not loaded in time, so a generated (fictional) class was used.`;
  const notes = meta.notes.includes(note) || (beyondData && meta.notes.some(n => n.includes('draft classes are generated'))) ? meta.notes : [...meta.notes, note];
  return { draftClass: generate(), meta: { ...meta, futureClasses, notes }, real: false };
}

/** Players whose real debut is `newSeason`: they enter as free agents (draft rights are not modelled). */
export function historicalDebuts(meta: HistoricalLeagueMeta, newSeason: string, takenIds: Set<string>): { players: PlayerSeason[]; meta: HistoricalLeagueMeta } {
  const year = Number(newSeason);
  const due = Object.entries(meta.futureDebuts).filter(([k]) => Number(k) <= year).flatMap(([, v]) => v);
  if (!due.length) return { players: [], meta };
  const futureDebuts = Object.fromEntries(Object.entries(meta.futureDebuts).filter(([k]) => Number(k) > year));
  const players = due.filter(seed => !takenIds.has(seed.name)).map(seed => {
    const age = ageOnOpening(seed.birthDate, year, 23);
    const p = buildRealPlayer(seed, newSeason, null, age, seed.rating.ovr, NBA_HISTORY_DATASET);
    const rights = seed.teamAbbr ? `; draft rights originally held by ${seed.teamAbbr}` : '';
    return appendHistoryEvent({ ...p, teamId: null, birthDate: seed.birthDate ?? undefined }, 'created',
      `Arrived for his real NBA debut season (${seed.draft ? `${seed.draft.year} draft pick` : 'undrafted'}${rights}) — free agent`, null);
  });
  return { players, meta: { ...meta, futureDebuts } };
}
