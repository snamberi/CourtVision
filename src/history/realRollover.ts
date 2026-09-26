import type { PlayerSeason } from '../simulation/types';
import type { DraftProspect, GMLeagueExtras } from '../simulation/gm';
import { computeAskingSalary } from '../simulation/gm';
import type { League } from '../simulation/league';
import { calculateOverall } from '../simulation/engine/overall';
import { assignRosterNumbers } from './jerseyNumbers';
import { enforceSticky } from '../simulation/sticky';
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

/**
 * Historical rosters: at the start of a season the data covers, every AI team takes the floor with its real roster.
 * Real players move to the team they actually played for (from other AI teams or free agency; never off your team),
 * AI players who weren't on that team really are released, and numbers follow the real ones where known.
 */
export function applyHistoricalRosters(league: League, extras: GMLeagueExtras, userTeamId: string | null): { league: League; extras: GMLeagueExtras; moved: number } {
  const meta = league.historical;
  const plan = meta?.forceRosters ? meta.realRosters?.[league.season ?? ''] : undefined;
  const endYear = Number(league.season) + 1;
  if (!plan) {
    // Any historical league: real numbers where known, stable ones otherwise, no clashes (also fixes older saves).
    // Your own team keeps whatever numbers you gave it.
    if (!meta) return { league, extras, moved: 0 };
    return { league: { ...league, teams: league.teams.map(t => t.teamId === userTeamId ? t : ({ ...t, seasons: assignRosterNumbers(t.seasons, t.teamId, endYear) })) }, extras, moved: 0 };
  }
  const target = new Map<string, string>();
  for (const [teamId, row] of Object.entries(plan)) if (teamId !== userTeamId && league.teams.some(t => t.teamId === teamId)) for (const id of row.ids) target.set(id, teamId);
  const pool = new Map<string, PlayerSeason>(); // real id → player, from AI teams and free agency
  for (const t of league.teams) if (t.teamId !== userTeamId) for (const p of t.seasons) if (p.real && !p.importedFrom && !p.stick) pool.set(p.real.id, p);
  for (const p of extras.freeAgents) if (p.real && !p.importedFrom && !p.stick) pool.set(p.real.id, p);

  const contracts = { ...extras.contracts };
  const released: PlayerSeason[] = [];
  const placed = new Set<string>();
  let moved = 0;
  const teams = league.teams.map(t => {
    if (t.teamId === userTeamId || !plan[t.teamId]) return t;
    const kept: PlayerSeason[] = [];
    for (const p of t.seasons) {
      // Imported (sandbox) and stuck players are outside the real rosters: they stay where they are.
      if (p.importedFrom || p.stick) { kept.push(p); placed.add(p.playerId); continue; }
      const goes = p.real ? target.get(p.real.id) : undefined;
      if (goes === t.teamId) { kept.push(p); placed.add(p.playerId); }
      else if (!goes) { delete contracts[p.playerId]; released.push(appendHistoryEvent({ ...p, teamId: null }, 'waived', `Released by ${t.name} (not on the real ${endYear - 1}-${String(endYear).slice(2)} roster)`, t.teamId)); }
    }
    for (const id of plan[t.teamId].ids) {
      const p = pool.get(id);
      if (!p || placed.has(p.playerId) || kept.some(k => k.playerId === p.playerId)) continue;
      const from = p.teamId;
      const signedFromFA = !from;
      contracts[p.playerId] = signedFromFA || !contracts[p.playerId]
        ? { playerId: p.playerId, teamId: t.teamId, annualSalary: computeAskingSalary(calculateOverall(p), extras.capSettings), yearsRemaining: 1 + (p.playerId.length % 3), playerOption: false, teamOption: false }
        : { ...contracts[p.playerId], teamId: t.teamId };
      kept.push(appendHistoryEvent({ ...p, teamId: t.teamId }, signedFromFA ? 'signed' : 'moved', signedFromFA ? `Signed with ${t.name} (historical roster)` : `Joined ${t.name} (historical roster)`, t.teamId));
      placed.add(p.playerId);
      moved++;
    }
    return { ...t, seasons: assignRosterNumbers(kept, plan[t.teamId].abbr, endYear) };
  });
  const onTeams = new Set(teams.flatMap(t => t.seasons.map(p => p.playerId)));
  const freeAgents = [...extras.freeAgents.filter(p => !onTeams.has(p.playerId)), ...released.filter(p => !onTeams.has(p.playerId))];
  // Players stuck with someone (Sandbox) follow him to his real team, even with Historical rosters on.
  const settled = enforceSticky({ ...league, teams }, { ...extras, contracts, freeAgents });
  return { league: settled.league, extras: settled.extras, moved: moved + settled.moved.length };
}

/** True when AI teams should leave rosters alone during the season (they follow the real ones). */
export const rostersLocked = (league: Pick<League, 'historical'>) => !!league.historical?.forceRosters;

/**
 * Historical rosters, after the trade deadline: AI players who really changed teams mid-season move to the team
 * they finished that season with. Your players, stuck and imported players stay put. Applied once per season.
 */
export function applyHistoricalDeadline(league: League, extras: GMLeagueExtras, userTeamId: string | null): { league: League; extras: GMLeagueExtras; moved: string[] } {
  const meta = league.historical;
  const season = league.season ?? '';
  const moves = meta?.forceRosters ? meta.realMoves?.[season] : undefined;
  if (!meta || !moves?.length || meta.movesApplied?.includes(season)) return { league, extras, moved: [] };
  let teams = league.teams;
  const contracts = { ...extras.contracts };
  let freeAgents = extras.freeAgents;
  const moved: string[] = [];
  for (const m of moves) {
    if (m.to === userTeamId || !teams.some(t => t.teamId === m.to)) continue;
    const from = teams.find(t => t.seasons.some(p => p.real?.id === m.id && !p.importedFrom));
    const fa = freeAgents.find(p => p.real?.id === m.id && !p.importedFrom);
    const player = from?.seasons.find(p => p.real?.id === m.id) ?? fa;
    if (!player || player.stick || from?.teamId === m.to || from?.teamId === userTeamId) continue;
    const toName = teams.find(t => t.teamId === m.to)!.name;
    const arriving = appendHistoryEvent({ ...player, teamId: m.to }, from ? 'traded' : 'signed', from ? `Traded from ${from.name} to ${toName} (real mid-season move)` : `Signed with ${toName} (real mid-season move)`, m.to);
    teams = teams.map(t => t.teamId === from?.teamId ? { ...t, seasons: t.seasons.filter(p => p.playerId !== player.playerId) } : t.teamId === m.to ? { ...t, seasons: [...t.seasons, arriving] } : t);
    if (fa) freeAgents = freeAgents.filter(p => p.playerId !== player.playerId);
    contracts[player.playerId] = contracts[player.playerId] ? { ...contracts[player.playerId], teamId: m.to }
      : { playerId: player.playerId, teamId: m.to, annualSalary: computeAskingSalary(calculateOverall(player), extras.capSettings), yearsRemaining: 1, playerOption: false, teamOption: false };
    moved.push(player.playerId);
  }
  const historical = { ...meta, movesApplied: [...(meta.movesApplied ?? []), season] };
  const settled = enforceSticky({ ...league, teams, historical }, { ...extras, contracts, freeAgents });
  return { league: settled.league, extras: settled.extras, moved };
}
