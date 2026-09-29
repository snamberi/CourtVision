/*
 * What a head coach wears and looks like on the sideline, worked out from who they are (their name/id and age), so
 * the same coach always shows up the same way: an old-school coach in a three-piece suit, a young one in a team
 * quarter-zip, a players' coach in a tracksuit… The tie, zip or stripes pick up the team colours.
 */

export type Outfit = 'suit' | 'quarterzip' | 'tracksuit' | 'turtleneck' | 'vest';
export interface CoachLook { outfit: Outfit; skin: string; hair: string; bald: boolean; glasses: boolean; beard: boolean; suit: string; name: string }

const SKIN = ['#f1c49a', '#d6aa7b', '#a8734f', '#7a5038', '#c8906a', '#e6b88f'];
const HAIR = ['#1b1410', '#3b2a1c', '#6b4a2b', '#b9b3a8', '#d8d4cc', '#101010'];
const SUITS = ['#1c2433', '#2a2f3a', '#3a2f28', '#15181f', '#2e3b52', '#4a4a4a'];
export const OUTFIT_LABEL: Record<Outfit, string> = { suit: 'Sharp suit', quarterzip: 'Team quarter-zip', tracksuit: 'Tracksuit', turtleneck: 'Turtleneck & blazer', vest: 'Sweater vest' };

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export function coachLook(coachId: string, age = 50): CoachLook {
  const h = hash(coachId);
  const pick = <T>(list: T[], salt: number) => list[(h >>> salt) % list.length];
  // Older coaches dress up; younger ones lean casual.
  const outfits: Outfit[] = age >= 58 ? ['suit', 'suit', 'vest', 'turtleneck'] : age >= 45 ? ['suit', 'quarterzip', 'turtleneck', 'vest', 'suit'] : ['quarterzip', 'tracksuit', 'suit', 'quarterzip'];
  const grey = age >= 55;
  return {
    outfit: pick(outfits, 3), skin: pick(SKIN, 7), hair: grey ? pick(['#b9b3a8', '#d8d4cc', '#8a8a8a'], 11) : pick(HAIR, 11),
    bald: age >= 50 && (h >>> 15) % 4 === 0, glasses: (h >>> 17) % 3 === 0, beard: (h >>> 19) % 4 === 0, suit: pick(SUITS, 21), name: coachId,
  };
}

/** Referees: a crew of three per game, with names and numbers (the same crew for the same game). */
const REF_FIRST = ['Scott', 'Tony', 'Marc', 'James', 'Zach', 'Kane', 'Ed', 'Sean', 'Josh', 'Natalie', 'Ben', 'Eric', 'Lauren', 'Pat', 'Curtis', 'Derrick', 'Monty', 'Bill', 'Tre', 'Karl'];
const REF_LAST = ['Foster', 'Brothers', 'Davis', 'Capers', 'Zarba', 'Fitzgerald', 'Malloy', 'Corbin', 'Tiven', 'Sago', 'Taylor', 'Lewis', 'Holtkamp', 'Fraher', 'Blair', 'Stafford', 'McCutchen', 'Kennedy', 'Maddox', 'Lane'];
export interface RefCrewMember { name: string; number: number; role: 'Crew chief' | 'Referee' | 'Umpire' }
export function refCrew(seed: number | string): RefCrewMember[] {
  const h = hash(String(seed));
  const used = new Set<number>(), last = new Set<string>();
  return (['Crew chief', 'Referee', 'Umpire'] as const).map((role, i) => {
    let n = (h >>> (i * 5)) % 80 + 5;
    while (used.has(n)) n++;
    used.add(n);
    let k = (h >>> (i * 4 + 2)) + i * 7;
    while (last.has(REF_LAST[k % REF_LAST.length])) k++;
    last.add(REF_LAST[k % REF_LAST.length]);
    return { role, number: n, name: `${REF_FIRST[(h >>> (i * 3 + 1)) % REF_FIRST.length]} ${REF_LAST[k % REF_LAST.length]}` };
  });
}
