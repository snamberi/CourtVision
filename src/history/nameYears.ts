import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';

/*
 * The NBA history data tells apart real players who share a name with their debut year, e.g. "Patrick Ewing (2011)".
 * Player ids are display names in Court Vision, so that year showed up as part of the name everywhere. Names get
 * a suffix instead: "Jr." when the later player was born a generation after the first, otherwise "II", "III"…
 */

const YEAR_TAG = / \((\d{4})\)$/;
const SUFFIXES = ['II', 'III', 'IV', 'V'];

export interface NamedPerson { displayName: string; birthDate?: string | null; firstSeason?: number | null }

/** Year-free display names for a whole player list (same order), unique across the list. */
export function yearFreeNames(people: NamedPerson[]): string[] {
  const names = people.map(p => p.displayName.replace(YEAR_TAG, ''));
  const taken = new Set(people.filter(p => !YEAR_TAG.test(p.displayName)).map(p => p.displayName));
  const holder = new Map(people.map((p, i) => [p.displayName, i] as const).filter(([n]) => !YEAR_TAG.test(n)));
  // Within each shared name, the earliest debut keeps the plain name if nobody untagged already has it.
  const groups = new Map<string, number[]>();
  people.forEach((p, i) => { if (YEAR_TAG.test(p.displayName)) groups.set(names[i], [...(groups.get(names[i]) ?? []), i]); });
  const debut = (i: number) => people[i].firstSeason ?? Number(YEAR_TAG.exec(people[i].displayName)?.[1] ?? 0);
  const born = (i: number) => Number(people[i].birthDate?.slice(0, 4) ?? NaN);
  for (const [base, members] of groups) {
    members.sort((a, b) => debut(a) - debut(b));
    let first: number | null = holder.get(base) ?? null;
    let next = 0;
    for (const i of members) {
      if (!taken.has(base)) { names[i] = base; taken.add(base); first = i; continue; }
      const generation = first != null && born(i) - born(first) >= 18 && !/ (Jr\.|I{2,3}|IV|V)$/.test(base);
      const options = [...(generation ? ['Jr.'] : []), ...SUFFIXES.slice(next)];
      let name = base;
      for (const suffix of options) { if (!taken.has(`${base} ${suffix}`)) { name = `${base} ${suffix}`; next = Math.max(next, SUFFIXES.indexOf(suffix) + 1); break; } }
      for (let n = 6; taken.has(name); n++) name = `${base} ${n}`; // never in practice
      names[i] = name;
      taken.add(name);
    }
  }
  return names;
}

/**
 * Older historical saves: renames every player whose name still carries a year tag, everywhere the name appears
 * (rosters, contracts, awards, history, news). Leagues without such names come back untouched.
 */
export function stripNameYears(league: League, extras: GMLeagueExtras): { league: League; extras: GMLeagueExtras; renamed: number } {
  const people = new Map<string, NamedPerson>();
  const note = (id: string, birthDate?: string | null) => { if (!people.has(id)) people.set(id, { displayName: id, birthDate }); };
  for (const t of league.teams) for (const s of t.seasons) note(s.playerId, s.birthDate);
  for (const s of extras.freeAgents) note(s.playerId, s.birthDate);
  for (const p of extras.draftClass) note(p.playerId, p.trueSeason?.birthDate);
  for (const r of league.retiredPlayers ?? []) note(r.playerId);
  const tagged = [...people.values()].filter(p => YEAR_TAG.test(p.displayName));
  if (!tagged.length) return { league, extras, renamed: 0 };
  const all = [...people.values()];
  const fresh = yearFreeNames(all);
  const rename = new Map<string, string>();
  all.forEach((p, i) => { if (fresh[i] !== p.displayName) rename.set(p.displayName, fresh[i]); });
  if (!rename.size) return { league, extras, renamed: 0 };
  const pattern = new RegExp([...rename.keys()].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const swap = <T,>(value: T): T => JSON.parse(JSON.stringify(value).replace(pattern, m => rename.get(m) ?? m)) as T;
  return { league: swap(league), extras: swap(extras), renamed: rename.size };
}
