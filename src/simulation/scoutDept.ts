import type { League } from './league';
import type { DraftProspect, GMLeagueExtras } from './gm';
import { collegeSeason } from './collegeSeason';

/*
 * Your scouting department: named scouts with a region they know and an eye for one thing. Send a scout to watch a
 * prospect and he files a look every few days of the season; each look narrows your read on that prospect's
 * potential (more when the prospect plays in the scout's region), and a scout's specialty adds what only he
 * notices. Busts and steals come from the reads you never sharpened. AI front offices keep scouting by budget.
 */

export type ScoutRegion = 'College East' | 'College West' | 'Europe' | 'Rest of World';
export const REGIONS: ScoutRegion[] = ['College East', 'College West', 'Europe', 'Rest of World'];
export type ScoutEye = 'upside' | 'skills' | 'character' | 'medical';
export const EYE_LABEL: Record<ScoutEye, string> = {
  upside: 'Projects ceilings', skills: 'Grades skills', character: 'Reads character', medical: 'Checks medicals',
};
export interface Scout { id: string; name: string; region: ScoutRegion; eye: ScoutEye; skill: number }
export interface ScoutAssignment { prospectId: string; since: number }
export interface ScoutDept {
  teamId: string;
  /** The draft class these looks belong to (looks reset with a new class). */
  classLabel: string;
  scouts: Scout[];
  assignments: Record<string, ScoutAssignment | undefined>;
  /** Banked looks per prospect from finished assignments. */
  looks: Record<string, number>;
  /** Which eyes have seen each prospect (for specialty findings). */
  seenBy: Record<string, ScoutEye[]>;
}

const EUROPE = new Set(['Serbia', 'Spain', 'France', 'Greece', 'Lithuania', 'Turkey', 'Slovenia', 'Croatia', 'Germany']);
const FIRST = ['Mike', 'Dana', 'Luis', 'Ray', 'Tomas', 'Kenji', 'Ade', 'Pat', 'Marco', 'Sam', 'Ivo', 'Chris', 'Nate', 'Omar', 'Lena', 'Joe'];
const LAST = ['Brennan', 'Kowalski', 'Ortega', 'Haddad', 'Novak', 'Sato', 'Okafor', 'Duffy', 'Rossi', 'Lindqvist', 'Petrov', 'Hale', 'Carver', 'Mensah', 'Vogel', 'Quinn'];

function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

/** Where a prospect plays this season. */
export function prospectRegion(p: DraftProspect): ScoutRegion {
  const s = collegeSeason(p.trueSeason);
  if (s.level === 'college') return hash(s.team) % 2 === 0 ? 'College East' : 'College West';
  return EUROPE.has(p.trueSeason.nationality ?? '') ? 'Europe' : 'Rest of World';
}

/** Scouts on staff: two on a minimum budget, up to six on the maximum. */
export const scoutCount = (league: League, teamId: string) => 2 + Math.floor((league.teams.find(t => t.teamId === teamId)?.expenseLevels?.scouting ?? 50) / 25);

function makeScouts(teamId: string, count: number): Scout[] {
  const eyes: ScoutEye[] = ['upside', 'skills', 'character', 'medical'];
  const start = hash(`${teamId}|eyes`) % eyes.length; // every staff has a mix of specialties
  return Array.from({ length: count }, (_, i) => {
    const h = hash(`${teamId}|scout|${i}`);
    return {
      id: `${teamId}-s${i}`, name: `${FIRST[h % FIRST.length]} ${LAST[(h >>> 8) % LAST.length]}`,
      region: REGIONS[i % REGIONS.length], eye: eyes[(start + i) % eyes.length], skill: 50 + ((h >>> 12) % 41),
    };
  });
}

/** A played-days clock: regular-season rounds played so far (frozen in the offseason). */
export function scoutingDay(league: League): number {
  const perDay = Math.max(1, Math.floor(league.teams.length / 2));
  return Math.floor(league.schedule.filter(g => g.played).length / perDay);
}

/** The department for the class on the board, created (or resized to the budget) when needed. */
export function scoutDept(league: League, extras: GMLeagueExtras, teamId: string): ScoutDept {
  const classLabel = extras.draftClass[0]?.trueSeason.season ?? '';
  const count = scoutCount(league, teamId);
  const current = extras.scoutDept?.teamId === teamId && extras.scoutDept.classLabel === classLabel ? extras.scoutDept : null;
  const scouts = makeScouts(teamId, count);
  if (!current) return { teamId, classLabel, scouts, assignments: {}, looks: {}, seenBy: {} };
  // A budget cut lets the newest scouts go (their work so far is kept).
  const keep = new Set(scouts.map(s => s.id));
  let dept: ScoutDept = { ...current, scouts };
  for (const id of Object.keys(current.assignments)) if (!keep.has(id)) dept = bank(league, dept, id, extras);
  return dept;
}

const DAYS_PER_LOOK = 6;
function looksFrom(league: League, scout: Scout, a: ScoutAssignment, prospect: DraftProspect | undefined): number {
  if (!prospect) return 0;
  const days = Math.max(0, scoutingDay(league) - a.since);
  const home = prospectRegion(prospect) === scout.region ? 1.5 : 1;
  return days / DAYS_PER_LOOK * (scout.skill / 70) * home;
}

function bank(league: League, dept: ScoutDept, scoutId: string, extras?: GMLeagueExtras): ScoutDept {
  const a = dept.assignments[scoutId];
  const scout = dept.scouts.find(s => s.id === scoutId) ?? makeScouts(dept.teamId, 8).find(s => s.id === scoutId);
  const assignments = { ...dept.assignments, [scoutId]: undefined };
  if (!a || !scout) return { ...dept, assignments };
  const prospect = extras?.draftClass.find(p => p.playerId === a.prospectId);
  const add = prospect ? looksFrom(league, scout, a, prospect) : 0;
  return { ...dept, assignments, looks: { ...dept.looks, [a.prospectId]: (dept.looks[a.prospectId] ?? 0) + add } };
}

/** Sends a scout to watch a prospect (or brings him home with `prospectId` null). Looks so far are kept. */
export function assignScout(league: League, extras: GMLeagueExtras, teamId: string, scoutId: string, prospectId: string | null): GMLeagueExtras {
  let dept = bank(league, scoutDept(league, extras, teamId), scoutId, extras);
  const scout = dept.scouts.find(s => s.id === scoutId);
  if (!scout) return extras;
  if (prospectId && extras.draftClass.some(p => p.playerId === prospectId)) {
    const seen = dept.seenBy[prospectId] ?? [];
    dept = { ...dept, assignments: { ...dept.assignments, [scoutId]: { prospectId, since: scoutingDay(league) } }, seenBy: { ...dept.seenBy, [prospectId]: seen.includes(scout.eye) ? seen : [...seen, scout.eye] } };
  }
  return { ...extras, scoutDept: dept };
}

/** Every look your scouts have filed on a prospect, including those still out watching him. */
export function looksOn(league: League, extras: GMLeagueExtras, teamId: string | null, prospectId: string): number {
  const dept = teamId && extras.scoutDept?.teamId === teamId ? extras.scoutDept : null;
  if (!dept || dept.classLabel !== (extras.draftClass[0]?.trueSeason.season ?? '')) return 0;
  const prospect = extras.draftClass.find(p => p.playerId === prospectId);
  let n = dept.looks[prospectId] ?? 0;
  for (const s of dept.scouts) { const a = dept.assignments[s.id]; if (a?.prospectId === prospectId) n += looksFrom(league, s, a, prospect); }
  return n;
}

/** Whether a scout with this eye has watched the prospect. */
export function eyeOn(extras: GMLeagueExtras, teamId: string | null, prospectId: string, eye: ScoutEye): boolean {
  const dept = teamId && extras.scoutDept?.teamId === teamId ? extras.scoutDept : null;
  return !!dept && dept.classLabel === (extras.draftClass[0]?.trueSeason.season ?? '') && !!dept.seenBy[prospectId]?.includes(eye);
}

/** How much a prospect's fog shrinks from your looks: none at 0 looks, about a third left after 6. */
export const lookFactor = (looks: number) => 1 / (1 + looks * 0.33);

/** Specialty findings for a prospect once a scout with that eye has watched him long enough. */
export function specialtyNotes(league: League, extras: GMLeagueExtras, teamId: string | null, p: DraftProspect): string[] {
  const dept = teamId && extras.scoutDept?.teamId === teamId ? extras.scoutDept : null;
  if (!dept || looksOn(league, extras, teamId, p.playerId) < 2) return [];
  const eyes = dept.seenBy[p.playerId] ?? [];
  const s = p.trueSeason, out: string[] = [];
  if (eyes.includes('character')) out.push(s.development.workEthic >= 70 ? 'Character: first in the gym, last out' : s.development.workEthic <= 40 ? 'Character: coasts when the coaches aren\'t looking' : 'Character: solid, coachable');
  if (eyes.includes('medical')) out.push(s.attributes.physical.durability < 50 || s.development.injuryRisk >= 60 ? 'Medical: red flags in the file' : 'Medical: clean bill of health');
  return out;
}

/** Scout notes read like a scout talks. */
export function scoutVerdict(mid: number): string {
  if (mid >= 85) return 'Franchise talent. Don\'t overthink it.';
  if (mid >= 78) return 'Future All-Star if it clicks.';
  if (mid >= 72) return 'Starter in this league.';
  if (mid >= 66) return 'Rotation player, maybe more.';
  if (mid >= 60) return 'End of the bench, a project.';
  return 'Not an NBA player.';
}
