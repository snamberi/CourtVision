import type { League } from './league';
import type { GMLeagueExtras } from './gm';
import type { PlayerSeason } from './types';

/*
 * Player family ties: brothers, fathers and sons, cousins. Three sources:
 *  - real NBA families, matched by name (the Currys, the Antetokounmpos, LeBron and Bronny…);
 *  - explicit links made when a draft class is created (a retired star's son entering the league; see `withLegacySons`);
 *  - generated leagues: two active players with the same surname a few years apart are brothers, and a retired player
 *    with the same surname a generation older is the father (decided once per pair, so it never changes).
 * Everything is derived from names, ages and the saved `family` links; nothing is simulated.
 */

export type Relation = 'father' | 'son' | 'brother' | 'twin' | 'cousin' | 'uncle' | 'nephew';
export interface FamilyLink { playerId: string; relation: Relation }
export interface FamilyTie extends FamilyLink { where: string; active: boolean }

const bare = (id: string) => id.replace(/ '\d+$/, '').replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, '').trim();
const surname = (id: string) => { const parts = bare(id).split(/\s+/); return parts[parts.length - 1] ?? ''; };
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 100; };
const INVERSE: Record<Relation, Relation> = { father: 'son', son: 'father', brother: 'brother', twin: 'twin', cousin: 'cousin', uncle: 'nephew', nephew: 'uncle' };

/** Real NBA families: [a, relation of b to a, b]. Names as the NBA history data spells them (without the year tag). */
const REAL: [string, Relation, string][] = [
  ['Stephen Curry', 'brother', 'Seth Curry'], ['Stephen Curry', 'father', 'Dell Curry'], ['Seth Curry', 'father', 'Dell Curry'],
  ['Giannis Antetokounmpo', 'brother', 'Thanasis Antetokounmpo'], ['Giannis Antetokounmpo', 'brother', 'Kostas Antetokounmpo'], ['Thanasis Antetokounmpo', 'brother', 'Kostas Antetokounmpo'],
  ['LeBron James', 'son', 'Bronny James'], ['Kobe Bryant', 'father', 'Joe Bryant'], ['Klay Thompson', 'father', 'Mychal Thompson'],
  ['Tim Hardaway Jr.', 'father', 'Tim Hardaway'], ['Gary Payton II', 'father', 'Gary Payton'], ['Glenn Robinson III', 'father', 'Glenn Robinson'],
  ['Jrue Holiday', 'brother', 'Justin Holiday'], ['Jrue Holiday', 'brother', 'Aaron Holiday'], ['Justin Holiday', 'brother', 'Aaron Holiday'],
  ['Brook Lopez', 'twin', 'Robin Lopez'], ['Marcus Morris', 'twin', 'Markieff Morris'], ['Lonzo Ball', 'brother', 'LaMelo Ball'], ['Lonzo Ball', 'brother', 'LiAngelo Ball'],
  ['Pau Gasol', 'brother', 'Marc Gasol'], ['Mason Plumlee', 'brother', 'Miles Plumlee'], ['Mason Plumlee', 'brother', 'Marshall Plumlee'],
  ['Tyler Zeller', 'brother', 'Cody Zeller'], ['Luke Zeller', 'brother', 'Cody Zeller'], ['Caleb Martin', 'twin', 'Cody Martin'],
  ['Domantas Sabonis', 'father', 'Arvydas Sabonis'], ['Andrew Wiggins', 'father', 'Mitchell Wiggins'], ['Kevin Love', 'uncle', 'Mike Love'],
  ['Al Horford', 'father', 'Tito Horford'], ['Larry Nance Jr.', 'father', 'Larry Nance'], ['Scottie Pippen Jr.', 'father', 'Scottie Pippen'],
  ['Kenyon Martin Jr.', 'father', 'Kenyon Martin'], ['Jalen Brunson', 'father', 'Rick Brunson'], ['Devin Booker', 'father', 'Melvin Booker'],
  ['Austin Rivers', 'father', 'Doc Rivers'], ['Mike Dunleavy', 'father', 'Mike Dunleavy Sr.'], ['Dolph Schayes', 'son', 'Danny Schayes'],
  ['Rick Barry', 'son', 'Brent Barry'], ['Rick Barry', 'son', 'Jon Barry'], ['Brent Barry', 'brother', 'Jon Barry'],
  ['Bill Walton', 'son', 'Luke Walton'], ['Dominique Wilkins', 'brother', 'Gerald Wilkins'], ['Damien Wilkins', 'father', 'Gerald Wilkins'],
  ['Horace Grant', 'twin', 'Harvey Grant'], ['Jerami Grant', 'father', 'Harvey Grant'], ['Jerian Grant', 'father', 'Harvey Grant'], ['Jerami Grant', 'brother', 'Jerian Grant'],
  ['Kyle Anderson', 'cousin', 'Kyle Anderson'], ['Jaren Jackson Jr.', 'father', 'Jaren Jackson'], ['Gary Trent Jr.', 'father', 'Gary Trent'],
  ['Wendell Carter Jr.', 'father', 'Wendell Carter'], ['Michael Porter Jr.', 'brother', 'Jontay Porter'], ['Tobias Harris', 'brother', 'Tyler Harris'],
  ['Isaiah Stewart', 'cousin', 'Isaiah Stewart'], ['Joakim Noah', 'father', 'Yannick Noah'], ['Kevin Porter Jr.', 'father', 'Kevin Porter'],
  ['Jabari Parker', 'father', 'Sonny Parker'], ['Dennis Schroder', 'cousin', 'Dennis Schroder'], ['Tyus Jones', 'brother', 'Tre Jones'],
  ['Jalen Williams', 'brother', 'Cody Williams'], ['Franz Wagner', 'brother', 'Moritz Wagner'], ['Amen Thompson', 'twin', 'Ausar Thompson'],
  ['Keegan Murray', 'twin', 'Kris Murray'], ['Jaylen Brown', 'cousin', 'Jaylen Brown'], ['Patrick Ewing Jr.', 'father', 'Patrick Ewing'],
];

/** Every real family link that mentions this player (either side). */
function realLinks(id: string): FamilyLink[] {
  const me = bare(id);
  const out: FamilyLink[] = [];
  for (const [a, rel, b] of REAL) {
    if (a === b) continue;
    if (a === me) out.push({ playerId: b, relation: rel });
    else if (b === me) out.push({ playerId: a, relation: INVERSE[rel] });
  }
  return out;
}

/** The family ties worth showing in a player's bio, with where each relative is now. */
export function familyTies(league: League, extras: GMLeagueExtras | undefined, season: PlayerSeason): FamilyTie[] {
  const active = [...league.teams.flatMap(t => t.seasons.map(s => ({ s, where: t.name }))), ...(extras?.freeAgents ?? []).map(s => ({ s, where: 'Free agent' })), ...(extras?.draftClass ?? []).map(p => ({ s: p.trueSeason, where: 'Draft prospect' }))];
  const byBare = new Map(active.map(a => [bare(a.s.playerId), a]));
  const retired = new Map((league.retiredPlayers ?? []).map(r => [bare(r.playerId), r]));
  const out = new Map<string, FamilyTie>();
  const add = (playerId: string, relation: Relation) => {
    const key = bare(playerId);
    if (key === bare(season.playerId) || out.has(key)) return;
    const a = byBare.get(key), r = retired.get(key);
    if (!a && !r) return; // only relatives who exist in this league
    out.set(key, { playerId: a?.s.playerId ?? r!.playerId, relation, where: a ? a.where : `Retired ${r!.finalSeason} (${r!.finalTeamName})`, active: !!a });
  };
  for (const l of season.family ?? []) add(l.playerId, l.relation);
  // Links other players carry that point at this one.
  for (const a of active) for (const l of a.s.family ?? []) if (bare(l.playerId) === bare(season.playerId)) add(a.s.playerId, INVERSE[l.relation]);
  for (const r of league.retiredPlayers ?? []) for (const l of r.finalSeasonData?.family ?? []) if (bare(l.playerId) === bare(season.playerId)) add(r.playerId, INVERSE[l.relation]);
  for (const l of realLinks(season.playerId)) add(l.playerId, l.relation);
  // Generated leagues: same surname, a few years apart = brothers; a generation older and retired = father.
  if (!league.historical) {
    const sn = surname(season.playerId);
    if (sn.length > 2) {
      for (const a of active) {
        if (a.s.playerId === season.playerId || surname(a.s.playerId) !== sn) continue;
        const gap = Math.abs(a.s.age - season.age);
        const pair = [bare(a.s.playerId), bare(season.playerId)].sort().join('|');
        if (gap <= 6 && hash(pair) < 55) add(a.s.playerId, gap === 0 && hash(`${pair}#t`) < 40 ? 'twin' : 'brother');
      }
      for (const r of league.retiredPlayers ?? []) {
        if (surname(r.playerId) !== sn) continue;
        const retiredYear = Number(String(r.finalSeason).slice(0, 4)), nowYear = Number(String(league.season ?? '').slice(0, 4));
        const ageNowOfHim = r.finalAge + (Number.isFinite(nowYear - retiredYear) ? nowYear - retiredYear : 0);
        const pair = [bare(r.playerId), bare(season.playerId)].sort().join('|');
        if (ageNowOfHim - season.age >= 20 && ageNowOfHim - season.age <= 38 && hash(pair) < 60) add(r.playerId, 'father');
      }
    }
  }
  return [...out.values()];
}

export const relationLabel = (r: Relation) => ({ father: 'Son of', son: 'Father of', brother: 'Brother of', twin: 'Twin of', cousin: 'Cousin of', uncle: 'Nephew of', nephew: 'Uncle of' } as const)[r];

/**
 * A new draft class: now and then a retired star's son (same surname, "Jr." if they share a first name) enters the
 * draft. Renames at most `max` fresh prospects and links them, so the bio and the news can tell the story.
 */
export function withLegacySons<T extends { playerId: string; trueSeason: PlayerSeason }>(prospects: T[], league: League, seed: number, max = 2): T[] {
  // Real draft classes carry real names; generated classes in a dynasty get more legacy sons.
  const dynasty = !!league.dynasty;
  if (league.historical && !dynasty) return prospects;
  if (dynasty) max = Math.max(max, 3);
  const stars = (league.retiredPlayers ?? []).filter(r => r.finalOverall >= 74 || (r.finalSeasonData?.careerHistory?.length ?? 0) >= 12)
    .filter(r => r.finalAge >= 30);
  if (!stars.length) return prospects;
  const taken = new Set([...league.teams.flatMap(t => t.seasons.map(s => s.playerId)), ...prospects.map(p => p.playerId), ...(league.retiredPlayers ?? []).map(r => r.playerId)]);
  let made = 0;
  return prospects.map((p, i) => {
    if (made >= max || hash(`${seed}|${p.playerId}|${i}`) >= (dynasty ? 14 : 7)) return p;
    const dad = stars[hash(`${seed}|dad|${i}`) % stars.length];
    const first = p.playerId.split(' ')[0];
    const dadFirst = dad.playerId.split(' ')[0];
    let name = `${first} ${surname(dad.playerId)}`;
    if (first === dadFirst) name = `${name} Jr.`;
    if (taken.has(name)) return p;
    taken.add(name); made++;
    const family = [...(p.trueSeason.family ?? []), { playerId: dad.playerId, relation: 'father' as const }];
    return { ...p, playerId: name, trueSeason: { ...p.trueSeason, playerId: name, family } };
  });
}
