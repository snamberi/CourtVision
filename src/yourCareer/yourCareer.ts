import { REAL_FRANCHISES } from '../profile/favorites';

/*
 * Your Career: one player from age 13 to his last game. You build him (name, number, nation, position, height, how he
 * plays), then every season asks you to choose: which club, which school, stay or transfer, when to declare for the
 * draft, which contract, how to train, what to do when things go wrong. The seasons in between play themselves.
 *
 * The road: a youth club at 13, high school from 14 to 17, then college (or a pro academy or Europe) for as long as
 * you like, the draft, and the pros until you retire (or your body decides for you).
 *
 * Everything is seeded and pure: the state carries its own random number, so the same choices replay the same career.
 */

export const YC_KEY = 'cv-your-career';
export const YC_RECORDS_KEY = 'cv-your-career-records';
export const START_AGE = 13;
export const LAST_AGE = 41;
export const START_YEAR = 2026;

export type Pos = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export type Attr = 'shooting' | 'dribbling' | 'vision' | 'defense' | 'physical';
export const ATTRS: Attr[] = ['shooting', 'physical', 'defense', 'vision', 'dribbling'];
export const ATTR_LABEL: Record<Attr, string> = { shooting: 'Shooting', dribbling: 'Dribbling', vision: 'Vision', defense: 'Defense', physical: 'Physical' };
export type Ratings = Record<Attr, number>;

export const POSITIONS: Record<Pos, { name: string; blurb: string; weights: Ratings; height: [number, number]; lean: Partial<Ratings> }> = {
  PG: { name: 'Point Guard', blurb: 'Floor general. Passing and handles weigh most in your overall.', weights: { shooting: 0.24, dribbling: 0.26, vision: 0.28, defense: 0.12, physical: 0.10 }, height: [178, 196], lean: { vision: 4, dribbling: 3, physical: -4 } },
  SG: { name: 'Shooting Guard', blurb: 'The scorer on the wing. Shooting is king.', weights: { shooting: 0.36, dribbling: 0.20, vision: 0.12, defense: 0.16, physical: 0.16 }, height: [188, 203], lean: { shooting: 5, dribbling: 1, physical: -2 } },
  SF: { name: 'Small Forward', blurb: 'Does a bit of everything: score, defend, rebound.', weights: { shooting: 0.24, dribbling: 0.16, vision: 0.16, defense: 0.22, physical: 0.22 }, height: [196, 208], lean: { defense: 2, physical: 2 } },
  PF: { name: 'Power Forward', blurb: 'Strength inside, and a jumper if you build one.', weights: { shooting: 0.16, dribbling: 0.08, vision: 0.12, defense: 0.26, physical: 0.38 }, height: [201, 211], lean: { physical: 4, defense: 2, dribbling: -4 } },
  C: { name: 'Center', blurb: 'Anchor the paint: rebounds, blocks, finishes at the rim.', weights: { shooting: 0.08, dribbling: 0.04, vision: 0.12, defense: 0.34, physical: 0.42 }, height: [206, 221], lean: { physical: 6, defense: 4, dribbling: -6, shooting: -4 } },
};

/** The playing-style questions: each answer moves your starting ratings. */
export const QUESTIONS: { id: string; ask: string; a: [string, Partial<Ratings>]; b: [string, Partial<Ratings>] }[] = [
  { id: 'score', ask: 'How do you like to score?', a: ['Outside shooting', { shooting: 8 }], b: ['Attacking the rim', { physical: 5, dribbling: 3 }] },
  { id: 'offense', ask: 'On offense you lean toward…', a: ['Setting up teammates', { vision: 8 }], b: ['Creating my own shot', { dribbling: 6, shooting: 2 }] },
  { id: 'defense', ask: 'On defense…', a: ['Reading passing lanes', { defense: 4, vision: 2 }], b: ['Protecting the rim', { defense: 4, physical: 3 }] },
  { id: 'tempo', ask: 'Your ideal tempo is…', a: ['Push the pace in transition', { physical: 3, dribbling: 3 }], b: ['Slow it down, half-court sets', { vision: 3, shooting: 2 }] },
  { id: 'glass', ask: 'When a shot goes up…', a: ['Crash the offensive glass', { physical: 5 }], b: ['Get back on defense first', { defense: 5 }] },
  { id: 'clutch', ask: 'With the game on the line…', a: ['I want the ball in my hands', { shooting: 4, dribbling: 2 }], b: ['Trust the system, stay disciplined', { vision: 3, defense: 3 }] },
  { id: 'summer', ask: 'Your summer workouts are…', a: ['A thousand shots a day', { shooting: 5 }], b: ['Weights and sprints', { physical: 5 }] },
  { id: 'film', ask: 'Film sessions are…', a: ['Where I find my edge', { vision: 4, defense: 2 }], b: ['Boring: I learn by playing', { dribbling: 4, physical: 1 }] },
];
export type Answers = Record<string, 'a' | 'b'>;

export const BACKGROUNDS = {
  city: { name: 'City courts', blurb: 'Grew up on the blacktop. Tough, loud, already known around town.', rep: 8, ratings: { dribbling: 3, physical: 1 } as Partial<Ratings>, potential: 0 },
  town: { name: 'Small town', blurb: 'Nobody is watching yet. More room to grow, more to prove.', rep: 0, ratings: { defense: 2, vision: 1 } as Partial<Ratings>, potential: 4 },
  family: { name: 'Hoops family', blurb: 'A parent played pro. Great habits, a famous last name to live up to.', rep: 12, ratings: { vision: 2, shooting: 2 } as Partial<Ratings>, potential: -2 },
} as const;
export type Background = keyof typeof BACKGROUNDS;

/** Countries to play for: a short code and three flag stripes (drawn as pixels, never emoji). */
export const NATIONS: { id: string; name: string; flag: [string, string, string]; vertical?: boolean }[] = [
  { id: 'USA', name: 'United States', flag: ['#b22234', '#ffffff', '#3c3b6e'] }, { id: 'CAN', name: 'Canada', flag: ['#d52b1e', '#ffffff', '#d52b1e'], vertical: true },
  { id: 'FRA', name: 'France', flag: ['#0055a4', '#ffffff', '#ef4135'], vertical: true }, { id: 'SRB', name: 'Serbia', flag: ['#c6363c', '#0c4076', '#ffffff'] },
  { id: 'LTU', name: 'Lithuania', flag: ['#fdb913', '#006a44', '#c1272d'] }, { id: 'AUS', name: 'Australia', flag: ['#00008b', '#ffffff', '#e4002b'] },
  { id: 'GER', name: 'Germany', flag: ['#000000', '#dd0000', '#ffce00'] }, { id: 'GRE', name: 'Greece', flag: ['#0d5eaf', '#ffffff', '#0d5eaf'] },
  { id: 'ESP', name: 'Spain', flag: ['#aa151b', '#f1bf00', '#aa151b'] }, { id: 'SLO', name: 'Slovenia', flag: ['#ffffff', '#005da4', '#ed1c24'] },
  { id: 'GEO', name: 'Georgia', flag: ['#ffffff', '#ff0000', '#ffffff'] }, { id: 'CRO', name: 'Croatia', flag: ['#ff0000', '#ffffff', '#171796'] },
  { id: 'ITA', name: 'Italy', flag: ['#009246', '#ffffff', '#ce2b37'], vertical: true }, { id: 'TUR', name: 'Turkey', flag: ['#e30a17', '#ffffff', '#e30a17'] },
  { id: 'ARG', name: 'Argentina', flag: ['#74acdf', '#ffffff', '#74acdf'] }, { id: 'BRA', name: 'Brazil', flag: ['#009c3b', '#ffdf00', '#002776'] },
  { id: 'NGA', name: 'Nigeria', flag: ['#008751', '#ffffff', '#008751'], vertical: true }, { id: 'CMR', name: 'Cameroon', flag: ['#007a5e', '#ce1126', '#fcd116'], vertical: true },
  { id: 'SEN', name: 'Senegal', flag: ['#00853f', '#fdef42', '#e31b23'], vertical: true }, { id: 'JPN', name: 'Japan', flag: ['#ffffff', '#bc002d', '#ffffff'] },
  { id: 'CHN', name: 'China', flag: ['#de2910', '#ffde00', '#de2910'] }, { id: 'PHI', name: 'Philippines', flag: ['#0038a8', '#ffffff', '#ce1126'] },
  { id: 'MEX', name: 'Mexico', flag: ['#006847', '#ffffff', '#ce1126'], vertical: true }, { id: 'PUR', name: 'Puerto Rico', flag: ['#ed0000', '#ffffff', '#0050f0'] },
  { id: 'DOM', name: 'Dominican Republic', flag: ['#002d62', '#ffffff', '#ce1126'] }, { id: 'GBR', name: 'Great Britain', flag: ['#012169', '#ffffff', '#c8102e'] },
  { id: 'LAT', name: 'Latvia', flag: ['#9e3039', '#ffffff', '#9e3039'] }, { id: 'MNE', name: 'Montenegro', flag: ['#c40308', '#d4af37', '#c40308'] },
  { id: 'BIH', name: 'Bosnia', flag: ['#002395', '#fecb00', '#002395'] }, { id: 'UKR', name: 'Ukraine', flag: ['#0057b7', '#ffd700', '#ffd700'] },
  { id: 'POL', name: 'Poland', flag: ['#ffffff', '#dc143c', '#dc143c'] }, { id: 'ISR', name: 'Israel', flag: ['#ffffff', '#0038b8', '#ffffff'] },
  { id: 'NZL', name: 'New Zealand', flag: ['#00247d', '#cc142b', '#00247d'] }, { id: 'SSD', name: 'South Sudan', flag: ['#000000', '#da121a', '#078930'] },
  { id: 'BAH', name: 'Bahamas', flag: ['#00abc9', '#fae042', '#00abc9'] }, { id: 'FIN', name: 'Finland', flag: ['#ffffff', '#003580', '#ffffff'] },
];
export const nationOf = (id: string) => NATIONS.find(n => n.id === id) ?? NATIONS[0];

// ---------------------------------------------------------------- state

export type Level = 'youth' | 'highschool' | 'college' | 'academy' | 'europe' | 'gleague' | 'nba';
export const LEVEL_LABEL: Record<Level, string> = { youth: 'Youth', highschool: 'High School', college: 'College', academy: 'Pro Academy', europe: 'Europe', gleague: 'G League', nba: 'NBA' };
/** What an average player at each level rates, how many games a season has, and the most minutes a starter plays. */
const LEVELS: Record<Level, { base: number; games: number; minutes: number; scoring: number }> = {
  youth: { base: 50, games: 30, minutes: 30, scoring: 1.1 }, highschool: { base: 57, games: 28, minutes: 32, scoring: 1.1 },
  college: { base: 66, games: 34, minutes: 34, scoring: 1 }, academy: { base: 66, games: 36, minutes: 32, scoring: 1 },
  europe: { base: 71, games: 34, minutes: 30, scoring: 0.9 }, gleague: { base: 69, games: 48, minutes: 33, scoring: 1 }, nba: { base: 76, games: 82, minutes: 36, scoring: 1 },
};

export interface Club { name: string; abbr: string; level: Level; strength: number; colors: [string, string]; /** A real NBA franchise (REAL_FRANCHISES id). */ team?: string }
export interface SeasonRow {
  age: number; year: number; club: Club; ovr: number; gp: number; mpg: number; ppg: number; apg: number; rpg: number; spg: number; bpg: number;
  record: string; trophies: string[]; note?: string;
}
export interface Choice {
  id: string; title: string; blurb: string;
  /** Short chips: "+3 Shooting", "-5 reputation". */
  chips?: string[];
  /** A gamble: the chance it works and what each side does. */
  odds?: { win: number; winText: string; loseText: string };
}
export interface Decision { id: string; title: string; text: string; options: Choice[] }
export interface Contract { team: string; years: number; salary: number; rookie?: boolean }
export interface DraftResult { year: number; round: number; pick: number; team: string | null }
export interface YcState {
  v: 1; seed: number; rng: number;
  name: string; number: number; nation: string; pos: Pos; heightCm: number; weightKg: number; wingspanCm: number;
  background: Background; archetype: string; potential: number;
  ratings: Ratings; age: number; rep: number; morale: number;
  club: Club | null; contract: Contract | null; role: 'star' | 'starter' | 'bench';
  /** Training focus for the coming season. */
  focus: Attr | null;
  seasons: SeasonRow[]; pending: Decision[]; log: string[];
  draft: DraftResult | null; collegeYears: number; injuredUntil?: number;
  earnings: number; done: boolean; legacy?: number; hallOfFame?: boolean;
  /** Set right after draft night, so the screen can play the announcement once. */
  draftShow?: boolean;
  /** A summer medal, added to the next season's trophies. */
  pendingTrophy?: string;
}

// ---------------------------------------------------------------- randomness carried in the state

function next(s: YcState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (s: YcState, lo: number, hi: number) => lo + next(s) * (hi - lo);
const pickOf = <T>(s: YcState, list: readonly T[]) => list[Math.floor(next(s) * list.length)];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------- creation

export interface Identity { name: string; number: number; nation: string; pos: Pos; heightCm: number; background: Background; answers: Answers }

/** Every rating before the position, background and answers move it: a 13-year-old lands around 50 overall. */
const START_RATING = 46;

/** Starting ratings: START_RATING everywhere, then the position, the background and the answers. */
export function startingRatings(id: Pick<Identity, 'pos' | 'background' | 'answers'>): { ratings: Ratings; deltas: Ratings } {
  const deltas: Ratings = { shooting: 0, dribbling: 0, vision: 0, defense: 0, physical: 0 };
  const add = (r: Partial<Ratings>) => { for (const k of ATTRS) deltas[k] += r[k] ?? 0; };
  add(POSITIONS[id.pos].lean);
  add(BACKGROUNDS[id.background].ratings);
  for (const q of QUESTIONS) { const pick = id.answers[q.id]; if (pick) add((pick === 'a' ? q.a : q.b)[1]); }
  // The style questions trade off: whatever you leaned away from slips a little.
  const spent = Object.values(deltas).reduce((n, v) => n + v, 0);
  const tax = Math.round(Math.max(0, spent - 24) / 5);
  const low = [...ATTRS].sort((a, b) => deltas[a] - deltas[b]);
  for (let i = 0; i < tax; i++) deltas[low[i % 2]] -= 3;
  const ratings = Object.fromEntries(ATTRS.map(k => [k, clamp(START_RATING + deltas[k], 30, 75)])) as Ratings;
  return { ratings, deltas };
}

const ARCHETYPES: [Attr, Attr, string, string][] = [
  ['shooting', 'dribbling', 'Shot Creator', 'Gets his own shot from anywhere on the floor.'],
  ['shooting', 'defense', 'Closer', 'Wants the last shot and the last stop.'],
  ['shooting', 'vision', 'Sharpshooter', 'Spaces the floor and finds the open man when they close out.'],
  ['shooting', 'physical', 'Three-Level Scorer', 'Rim, mid-range, three: pick one.'],
  ['dribbling', 'vision', 'Floor General', 'Runs the show. Everybody eats.'],
  ['dribbling', 'physical', 'Slasher', 'Lives at the rim and the free-throw line.'],
  ['dribbling', 'defense', 'Pest', 'Picks up full court and never lets go.'],
  ['vision', 'defense', 'Two-Way Playmaker', 'Reads both ends a step ahead.'],
  ['vision', 'physical', 'Point Forward', 'Grabs the board and pushes it himself.'],
  ['defense', 'physical', 'Rim Protector', 'Nothing easy in the paint.'],
];
export function archetypeOf(r: Ratings): { name: string; blurb: string } {
  const [a, b] = [...ATTRS].sort((x, y) => r[y] - r[x]);
  const hit = ARCHETYPES.find(([x, y]) => (x === a && y === b) || (x === b && y === a)) ?? ARCHETYPES[0];
  return { name: hit[2], blurb: hit[3] };
}

export function overall(r: Ratings, pos: Pos): number {
  const w = POSITIONS[pos].weights;
  return Math.round(ATTRS.reduce((n, k) => n + r[k] * w[k], 0));
}

export function newCareer(id: Identity, seed = Math.floor(Math.random() * 2 ** 31)): YcState {
  const { ratings } = startingRatings(id);
  const [lo, hi] = POSITIONS[id.pos].height;
  const heightCm = clamp(Math.round(id.heightCm), lo, hi);
  const s: YcState = {
    v: 1, seed, rng: seed, name: id.name.trim().slice(0, 18) || 'Rookie', number: clamp(Math.round(id.number), 0, 99), nation: nationOf(id.nation).id, pos: id.pos,
    // At 13 you are still growing: the height you picked is where you end up.
    heightCm, weightKg: Math.round(heightCm * 0.47 - 6 + ratingBias(ratings.physical)), wingspanCm: 0,
    background: id.background, archetype: archetypeOf(ratings).name, potential: 0, ratings, age: START_AGE, rep: 5 + BACKGROUNDS[id.background].rep, morale: 70,
    club: null, contract: null, role: 'starter', focus: null, seasons: [], pending: [], log: [], draft: null, collegeYears: 0, earnings: 0, done: false,
  };
  s.wingspanCm = heightCm + Math.round(between(s, -2, 9));
  s.potential = Math.round(between(s, 72, 94) + BACKGROUNDS[id.background].potential);
  s.pending = [youthClubDecision(s)];
  return s;
}
const ratingBias = (physical: number) => Math.round((physical - 50) / 4);

// ---------------------------------------------------------------- clubs

const HS_NAMES = ['Ridgecrest Prep', 'Lincoln High', 'St. Benedict\'s', 'Westview Academy', 'Harbor Christian', 'Montrose High', 'Eastside Tech', 'Oak Valley Prep', 'Central Catholic', 'Mill Creek High'];
const COLLEGES: { name: string; abbr: string; tier: 'blue' | 'power' | 'mid' }[] = [
  { name: 'State University', abbr: 'STU', tier: 'blue' }, { name: 'Bluegrass U', abbr: 'BGU', tier: 'blue' }, { name: 'Tobacco Road', abbr: 'TRD', tier: 'blue' },
  { name: 'Coastal Tech', abbr: 'CTU', tier: 'power' }, { name: 'Lakeshore', abbr: 'LKS', tier: 'power' }, { name: 'Desert State', abbr: 'DSU', tier: 'power' }, { name: 'Big Sky U', abbr: 'BSU', tier: 'power' },
  { name: 'Riverside', abbr: 'RVS', tier: 'mid' }, { name: 'Gonzaga Bay', abbr: 'GZB', tier: 'mid' }, { name: 'Northern Plains', abbr: 'NPU', tier: 'mid' }, { name: 'Valley College', abbr: 'VLC', tier: 'mid' },
];
const EURO = [{ name: 'Belgrade', abbr: 'BEL' }, { name: 'Madrid', abbr: 'MAD' }, { name: 'Athens', abbr: 'ATH' }, { name: 'Istanbul', abbr: 'IST' }, { name: 'Kaunas', abbr: 'KAU' }, { name: 'Barcelona', abbr: 'BAR' }, { name: 'Tel Aviv', abbr: 'TLV' }, { name: 'Tbilisi', abbr: 'TBS' }];
const COLORS: [string, string][] = [['#1d428a', '#ffc72c'], ['#ce1141', '#000000'], ['#007a33', '#ffffff'], ['#5a2d81', '#f9a01b'], ['#0e2240', '#fec524'], ['#98002e', '#f9a01b'], ['#00471b', '#eee1c6'], ['#002b5c', '#e31837'], ['#c8102e', '#bec0c2'], ['#e56020', '#1d1160']];
const colorsFor = (name: string): [string, string] => COLORS[[...name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];
const club = (name: string, abbr: string, level: Level, strength: number, team?: string): Club => ({ name, abbr, level, strength: Math.round(strength), colors: colorsFor(name), ...(team ? { team } : {}) });
export const nbaClub = (team: string, strength: number): Club => {
  const f = REAL_FRANCHISES.find(t => t.id === team) ?? REAL_FRANCHISES[0];
  return { ...club(f.city, f.id, 'nba', strength, f.id) };
};

// ---------------------------------------------------------------- the decisions

const ovrOf = (s: YcState) => overall(s.ratings, s.pos);
const chip = (n: number, what: string) => `${n > 0 ? '+' : ''}${n} ${what}`;

function youthClubDecision(s: YcState): Decision {
  return { id: 'youth-club', title: 'Your first team', text: `Age 13. ${s.name} can really play. Where does he start?`, options: [
    { id: 'rec', title: 'The local rec league', blurb: 'Every minute is yours. Nobody important is watching.', chips: ['Starter minutes', chip(2, 'Vision')] },
    { id: 'aau', title: 'A city travel club', blurb: 'Weekend tournaments in three states. Real competition.', chips: [chip(4, 'reputation')] },
    { id: 'elite', title: 'Try out for the elite circuit', blurb: 'The top travel program in the country. Cut day is brutal.', odds: { win: tryoutOdds(s, 48), winText: 'You make the team · +10 reputation', loseText: 'Cut · you play rec ball · -2 reputation' } },
  ] };
}
const tryoutOdds = (s: YcState, bar: number) => Math.round(clamp(0.35 + (ovrOf(s) - bar) * 0.05 + s.rep * 0.004, 0.08, 0.92) * 100) / 100;

function highSchoolDecision(s: YcState): Decision {
  const local = HS_NAMES[(s.seed >>> 3) % HS_NAMES.length];
  return { id: 'high-school', title: 'Pick a high school', text: 'Four years that decide which doors open. Coaches have been calling.', options: [
    { id: 'local', title: local, blurb: 'Your neighborhood school. Starter from day one, the whole town in the stands.', chips: ['Starter as a freshman', chip(3, 'morale')] },
    { id: 'prep', title: 'Ridgecrest Prep (national power)', blurb: 'Six future pros on the roster, national TV, college coaches at every practice.', chips: ['Bench at first', chip(8, 'reputation')] },
    { id: 'academy', title: 'Sports academy (boarding)', blurb: 'Two practices a day and a skills coach. Lonely, but you get better fast.', chips: ['+training', chip(-6, 'morale')] },
    ...(s.nation !== 'USA' ? [{ id: 'home', title: `Stay home in ${nationOf(s.nation).name}`, blurb: 'Junior team of a pro club. Play against men by sixteen.', chips: ['Pro youth team', chip(3, 'Defense')] }] : []),
  ] };
}

function trainingDecision(s: YcState): Decision {
  const weakest = [...ATTRS].sort((a, b) => s.ratings[a] - s.ratings[b]);
  const best = [...ATTRS].sort((a, b) => s.ratings[b] - s.ratings[a])[0];
  const options: Choice[] = [
    { id: `focus-${best}`, title: `Sharpen your ${ATTR_LABEL[best].toLowerCase()}`, blurb: 'Lean into what makes you special.', chips: [`${ATTR_LABEL[best]} grows fastest`] },
    { id: `focus-${weakest[0]}`, title: `Fix your ${ATTR_LABEL[weakest[0]].toLowerCase()}`, blurb: 'Close the hole defenses keep finding.', chips: [`${ATTR_LABEL[weakest[0]]} grows fastest`] },
    { id: `focus-${weakest[1]}`, title: `Work on your ${ATTR_LABEL[weakest[1]].toLowerCase()}`, blurb: 'Round out your game.', chips: [`${ATTR_LABEL[weakest[1]]} grows fastest`] },
  ];
  if (s.age >= 15) options.push({ id: 'focus-rest', title: 'Rest and recover', blurb: 'Let the body heal. Fewer gains, fewer injuries.', chips: ['Injury risk down', chip(4, 'morale')] });
  if (s.age >= 17 && s.earnings >= 1) options.push({ id: 'focus-trainer', title: 'Hire a private trainer ($250K)', blurb: 'A full-time coach all summer: every rating grows.', chips: ['All ratings +1', '-$0.25M'] });
  return { id: 'training', title: s.age < 18 ? 'Summer workouts' : 'Offseason training', text: 'Where does the work go this summer?', options };
}

function recruitingDecision(s: YcState): Decision {
  const ovr = ovrOf(s), stars = clamp(Math.round((ovr - 48) / 4 + s.rep / 25), 1, 5);
  const tiers = stars >= 5 ? ['blue', 'blue', 'power'] : stars >= 4 ? ['blue', 'power', 'mid'] : stars >= 3 ? ['power', 'mid', 'mid'] : ['mid', 'mid', 'mid'];
  const offers = tiers.map((t, i) => COLLEGES.filter(c => c.tier === t)[(s.seed + i * 7) % COLLEGES.filter(c => c.tier === t).length]);
  const unique = [...new Map(offers.map(o => [o.name, o])).values()];
  return { id: 'recruiting', title: `Signing day · ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} recruit`, text: `${unique.length} schools offered. Or skip college altogether.`, options: [
    ...unique.map(c => ({ id: `college-${c.abbr}`, title: c.name, blurb: c.tier === 'blue' ? 'A blue blood: national TV, deep runs, crowded rotation.' : c.tier === 'power' ? 'A power-conference program that wants you to start.' : 'A mid-major that hands you the keys on day one.', chips: [c.tier === 'blue' ? 'Contender' : c.tier === 'power' ? 'Starter' : 'Go-to scorer', c.tier === 'blue' ? chip(8, 'reputation') : c.tier === 'mid' ? '+minutes' : chip(3, 'reputation')] })),
    { id: 'academy', title: 'Pro academy (one year, paid)', blurb: 'Get paid at 18 in the NBA\'s development program. Every scout watches.', chips: ['$0.5M', 'Draft-eligible next year'] },
    { id: 'europe', title: 'Turn pro in Europe', blurb: 'Grown men, tough coaching, real money. NBA scouts fly over.', chips: ['$0.8M a year', chip(2, 'Defense')] },
  ].slice(0, 5) };
}

/** Where you'd go if you declared now. */
export function draftProjection(s: YcState): { label: string; pick: number } {
  // Overall first, then the buzz, then youth (teams pay for upside).
  const score = ovrOf(s) + s.rep * 0.05 + (20 - Math.min(s.age, 24)) * 1.5 + (s.potential - 80) * 0.15;
  const pick = clamp(Math.round(62 - (score - 58) * 2.8), 1, 70);
  return { pick, label: pick <= 3 ? 'Top 3 pick' : pick <= 14 ? 'Lottery pick' : pick <= 30 ? 'First round' : pick <= 60 ? 'Second round' : 'Likely undrafted' };
}

function collegeDecision(s: YcState): Decision {
  const proj = draftProjection(s);
  const must = s.collegeYears >= 4 || s.club?.level === 'academy';
  const options: Choice[] = [
    { id: 'declare', title: 'Declare for the draft', blurb: `Scouts have you as a ${proj.label.toLowerCase()} (around pick ${Math.min(60, proj.pick)}).`, chips: [proj.label] },
  ];
  if (!must) {
    options.push({ id: 'return', title: 'Come back for another year', blurb: 'Another season to grow, lead, and climb the boards.', chips: ['+1 year to develop', chip(2, 'reputation')] });
    if (s.club?.level === 'college') options.push({ id: 'transfer', title: 'Enter the transfer portal', blurb: 'A bigger stage or a bigger role, somewhere new.', chips: ['New school', chip(-3, 'morale')] });
    if (s.club?.level === 'college' && s.collegeYears >= 1) options.push({ id: 'testwaters', title: 'Test the waters, keep your eligibility', blurb: 'Work out for NBA teams and hear what they really think. You come back.', chips: [chip(3, 'reputation'), 'Honest feedback'] });
  }
  return { id: 'college-end', title: s.club?.level === 'europe' ? 'The NBA is calling' : must ? 'Time to go pro' : `End of year ${s.collegeYears}`, text: must ? 'You are out of eligibility: the draft is next.' : 'The season is over. What now?', options };
}

/** A pro salary in $M a year for an overall (a max deal near 50). */
const salaryBase = (ovr: number) => clamp(((ovr - 60) / 30) ** 2.4 * 48, 1.2, 55);
/** The three kinds of free-agent offer: how good the team is, how long, and how much of your price they pay. */
const OFFERS = {
  contender: { strength: [78, 92], years: 4, pay: 0.8, label: ' (contender)', blurb: 'A real shot at the ring. You might come off the bench.', chip: 'Title odds up' },
  money: { strength: [30, 50], years: 3, pay: 1.15, label: ' (max money)', blurb: 'The biggest offer on the table. A rebuilding team.', chip: '3 years' },
  role: { strength: [45, 65], years: 4, pay: 1, label: ' (bigger role)', blurb: 'They want you to be the guy.', chip: 'Starter' },
} as const;

function freeAgencyDecision(s: YcState): Decision {
  const ovr = ovrOf(s), salaryFor = (k: number) => round1(salaryBase(ovr) * k);
  const teams = shuffled(s, REAL_FRANCHISES.map(t => t.id).filter(t => t !== s.club?.abbr)).slice(0, 3);
  const options: Choice[] = [];
  if (s.club?.level === 'nba') options.push({ id: `re-sign`, title: `Re-sign with ${s.club.name}`, blurb: 'Stay where they know you. Loyalty bonus with the fans.', chips: [`$${salaryFor(0.95)}M a year`, '4 years', chip(4, 'morale')] });
  (['contender', 'money', 'role'] as const).forEach((kind, i) => {
    const f = REAL_FRANCHISES.find(x => x.id === teams[i])!, o = OFFERS[kind];
    options.push({ id: `sign-${f.id}-${kind}`, title: `${f.city}${o.label}`, blurb: o.blurb, chips: [`$${salaryFor(o.pay)}M a year`, o.chip] });
  });
  if (s.age >= 33) options.push({ id: 'retire', title: 'Retire', blurb: 'Walk away on your own terms.', chips: ['Career ends'] });
  return { id: 'free-agency', title: 'Free agency', text: s.club?.level === 'nba' ? 'Your contract is up. The phone is ringing.' : 'Teams want to sign you.', options: options.slice(0, 5) };
}
function shuffled<T>(s: YcState, list: T[]): T[] { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Something happens: one random story beat between seasons. */
function eventDecision(s: YcState): Decision | null {
  const last = s.seasons.at(-1);
  const pro = s.club?.level === 'nba' || s.club?.level === 'europe' || s.club?.level === 'gleague';
  const pool: (() => Decision | null)[] = [
    () => last && last.ppg < 10 && pro && s.age >= 24 ? { id: 'on-the-outs', title: 'On the outs', text: 'The fanbase has turned on you after a rough stretch. Local radio is calling for a change.', options: [
      { id: 'fight', title: 'Fight for your spot', blurb: 'Show up early, stay late, win them back.', odds: { win: 0.4, winText: 'You win them back · +4 reputation', loseText: 'Cut loose anyway · -8 reputation' } },
      { id: 'ask-trade', title: 'Ask for a move', blurb: 'A fresh start somewhere else.', chips: ['Traded', chip(-3, 'reputation')] },
      { id: 'accept-bench', title: 'Accept a bench role', blurb: 'Swallow your pride and play your part.', chips: ['Bench', chip(5, 'morale')] },
    ] } : null,
    () => pro && s.rep >= 40 ? { id: 'endorsement', title: 'A shoe deal', text: 'A sneaker brand wants you as the face of a new line.', options: [
      { id: 'sign-shoe', title: 'Sign it', blurb: 'Money and fame. A summer of photo shoots.', chips: ['+$4M', chip(6, 'reputation'), 'Less training'] },
      { id: 'decline-shoe', title: 'Not now', blurb: 'Stay in the gym. The deal will come back bigger.', chips: ['Full summer of work'] },
    ] } : null,
    () => s.age >= 19 && s.nation !== 'USA' || (s.nation === 'USA' && ovrOf(s) >= 82) ? { id: 'national-team', title: 'National team call-up', text: `${nationOf(s.nation).name} wants you for the summer tournament.`, options: [
      { id: 'play-national', title: 'Represent your country', blurb: 'A medal is on the line. So is your summer.', odds: { win: clamp(0.25 + (ovrOf(s) - 75) * 0.02, 0.1, 0.7), winText: 'You bring home a medal · +8 reputation', loseText: 'Knocked out · +2 reputation' } },
      { id: 'skip-national', title: 'Rest instead', blurb: 'Your body needs the summer.', chips: ['Fresh legs', chip(-2, 'reputation')] },
    ] } : null,
    () => s.age >= 20 && next(s) < 0.5 ? { id: 'injury', title: 'Knee trouble', text: 'The doctors found a problem in your knee.', options: [
      { id: 'surgery', title: 'Have the surgery', blurb: 'Miss the start of next season, come back whole.', chips: ['Miss ~25 games', 'No lasting damage'] },
      { id: 'play-through', title: 'Play through it', blurb: 'Painkillers and tape. It might hold.', odds: { win: 0.55, winText: 'It holds · full season', loseText: 'It gets worse · -4 Physical' } },
    ] } : null,
    () => s.age <= 17 ? { id: 'mixtape', title: 'Your mixtape blew up', text: 'A highlight video hit two million views overnight.', options: [
      { id: 'lean-in', title: 'Start a channel', blurb: 'Build your brand early.', chips: [chip(8, 'reputation'), chip(-2, 'Vision')] },
      { id: 'stay-quiet', title: 'Stay quiet, keep working', blurb: 'Let the game talk.', chips: [chip(2, 'reputation'), '+training'] },
    ] } : null,
    () => s.age >= 28 && pro ? { id: 'mentor', title: 'A rookie looks up to you', text: 'The team\'s top pick asks you to take him under your wing.', options: [
      { id: 'mentor-yes', title: 'Mentor him', blurb: 'Teach him everything you know.', chips: [chip(4, 'Vision'), chip(4, 'morale')] },
      { id: 'mentor-no', title: 'Focus on your own game', blurb: 'He\'s after your minutes, after all.', chips: [chip(2, 'Shooting')] },
    ] } : null,
  ];
  const options = shuffled(s, pool).map(f => f()).filter((d): d is Decision => !!d);
  return next(s) < 0.6 ? options[0] ?? null : null;
}

// ---------------------------------------------------------------- applying a choice

export interface ChoiceResult { state: YcState; message: string }

interface Ctx { s: YcState; c: Choice; bump: (k: Attr, n: number) => void; gamble: () => boolean; say: (m: string) => void }
const collegeClub = (col: (typeof COLLEGES)[number]) => club(col.name, col.abbr, 'college', col.tier === 'blue' ? 85 : col.tier === 'power' ? 66 : 50);
const gLeagueClub = (s: YcState, strength: number) => club(`${pickOf(s, REAL_FRANCHISES).city} G League`, 'GLG', 'gleague', strength);

/** What each decision does with the option you picked. */
const HANDLERS: Record<string, (x: Ctx) => void> = {
  'youth-club': ({ s, c, bump, gamble }) => {
    if (c.id === 'rec') { s.club = club('Rec League', 'REC', 'youth', 40); bump('vision', 2); }
    else if (c.id === 'aau') { s.club = club('City Travel Club', 'CTC', 'youth', 55); s.rep += 4; }
    else if (gamble()) { s.club = club('Elite Circuit Select', 'ELT', 'youth', 72); s.rep += 10; }
    else { s.club = club('Rec League', 'REC', 'youth', 40); s.rep = Math.max(0, s.rep - 2); }
  },
  'high-school': ({ s, c, bump }) => {
    if (c.id === 'local') { s.club = club(c.title, abbrOf(c.title), 'highschool', 50); s.role = 'starter'; s.morale += 3; }
    else if (c.id === 'prep') { s.club = club('Ridgecrest Prep', 'RCP', 'highschool', 82); s.role = 'bench'; s.rep += 8; }
    else if (c.id === 'academy') { s.club = club('Sports Academy', 'ACA', 'highschool', 62); s.morale -= 6; s.potential += 2; }
    else { s.club = club(`${nationOf(s.nation).name} Juniors`, s.nation, 'highschool', 66); bump('defense', 3); }
  },
  recruiting: ({ s, c, bump }) => {
    if (c.id === 'academy') { s.club = club('Pro Academy', 'ACD', 'academy', 60); s.earnings += 0.5; return; }
    if (c.id === 'europe') { const e = pickOf(s, EURO); s.club = club(e.name, e.abbr, 'europe', between(s, 55, 80)); s.earnings += 0.8; bump('defense', 2); return; }
    const col = COLLEGES.find(x => `college-${x.abbr}` === c.id)!;
    s.club = collegeClub(col);
    s.role = col.tier === 'blue' && ovrOf(s) < 66 ? 'bench' : col.tier === 'mid' ? 'star' : 'starter';
    s.rep += col.tier === 'blue' ? 8 : col.tier === 'power' ? 3 : 0;
  },
  'college-end': ({ s, c, say }) => {
    if (c.id === 'declare') { runDraft(s); say(s.draft?.team ? `Drafted ${ordinal(s.draft.pick)} overall` : 'Undrafted'); }
    else if (c.id === 'transfer') { const col = pickOf(s, COLLEGES.filter(x => x.name !== s.club?.name)); s.club = collegeClub(col); s.morale -= 3; say(`Transferred to ${col.name}`); }
    else if (c.id === 'testwaters') { s.rep += 3; say(`Teams told you: ${draftProjection(s).label.toLowerCase()} right now.`); }
    else s.rep += 2;
  },
  undrafted: ({ s, c, gamble }) => {
    if (c.id === 'gleague') { s.club = gLeagueClub(s, between(s, 40, 70)); s.contract = { team: 'GLG', years: 1, salary: 0.1 }; }
    else if (c.id === 'europe') { const e = pickOf(s, EURO); s.club = club(e.name, e.abbr, 'europe', between(s, 50, 80)); s.contract = { team: e.abbr, years: 2, salary: 1.2 }; }
    else if (gamble()) { const t = pickOf(s, REAL_FRANCHISES).id; s.club = nbaClub(t, teamStrength(s, t)); s.contract = { team: t, years: 2, salary: 1.1 }; s.role = 'bench'; }
    else { s.club = gLeagueClub(s, 50); s.contract = { team: 'GLG', years: 1, salary: 0.1 }; }
  },
  'free-agency': ({ s, c, say }) => {
    if (c.id === 'retire') { retire(s); say('You retired.'); return; }
    const ovr = ovrOf(s), base = salaryBase(ovr);
    if (c.id === 're-sign' && s.club) { s.contract = { team: s.club.abbr, years: 4, salary: round1(base * 0.95) }; s.morale += 4; return; }
    const [, team, kind] = c.id.split('-') as [string, string, 'contender' | 'money' | 'role'];
    const offer = OFFERS[kind];
    s.club = nbaClub(team, between(s, offer.strength[0], offer.strength[1]));
    s.contract = { team, years: offer.years, salary: round1(base * offer.pay) };
    s.role = kind === 'role' ? 'star' : kind === 'contender' && ovr < 84 ? 'bench' : 'starter';
  },
  training: ({ s, c, bump }) => {
    if (c.id === 'focus-rest') { s.focus = null; s.morale += 4; s.injuredUntil = undefined; }
    else if (c.id === 'focus-trainer') { s.focus = null; for (const k of ATTRS) bump(k, 1); s.earnings -= 0.25; }
    else s.focus = c.id.slice(6) as Attr;
  },
  'on-the-outs': ({ s, c, gamble, say }) => {
    if (c.id === 'fight') { if (gamble()) s.rep += 4; else { s.rep = Math.max(0, s.rep - 8); moveTeam(s); } }
    else if (c.id === 'ask-trade') { s.rep = Math.max(0, s.rep - 3); moveTeam(s); say(`Traded to ${s.club?.name}`); }
    else { s.role = 'bench'; s.morale += 5; }
  },
  endorsement: ({ s, c }) => { if (c.id === 'sign-shoe') { s.earnings += 4; s.rep += 6; s.focus = null; } },
  'national-team': ({ s, c, gamble }) => {
    if (c.id !== 'play-national') { s.rep = Math.max(0, s.rep - 2); return; }
    if (gamble()) { s.rep += 8; s.pendingTrophy = `Medal with ${nationOf(s.nation).name}`; } else s.rep += 2;
  },
  injury: ({ s, c, bump, gamble }) => { if (c.id === 'surgery') s.injuredUntil = s.age; else if (!gamble()) bump('physical', -4); },
  mixtape: ({ s, c, bump }) => { if (c.id === 'lean-in') { s.rep += 8; bump('vision', -2); } else s.rep += 2; },
  mentor: ({ s, c, bump }) => { if (c.id === 'mentor-yes') { bump('vision', 4); s.morale += 4; } else bump('shooting', 2); },
  'retire-offer': ({ s, c, say }) => { if (c.id === 'retire') { retire(s); say('You retired.'); } },
};

/** Applies the option picked on the first waiting decision. */
export function choose(prev: YcState, choiceId: string): ChoiceResult {
  const s: YcState = structuredClone(prev);
  const d = s.pending.shift();
  if (!d) return { state: prev, message: '' };
  const c = d.options.find(o => o.id === choiceId) ?? d.options[0];
  let message = c.title;
  const ctx: Ctx = {
    s, c, say: m => { message = m; },
    bump: (k, n) => { s.ratings[k] = clamp(s.ratings[k] + n, 25, 99); },
    gamble: () => { const won = next(s) < (c.odds?.win ?? 0.5); message = won ? c.odds!.winText : c.odds!.loseText; return won; },
  };
  HANDLERS[d.id]?.(ctx);
  s.morale = clamp(s.morale, 0, 100); s.rep = clamp(s.rep, 0, 100);
  s.archetype = archetypeOf(s.ratings).name;
  s.log = [message, ...s.log].slice(0, 30);
  return { state: s, message };
}
// Initials for a club badge: "Lincoln High" -> "LHX" style 3 letters ("St. Benedict's" -> "SBX").
const abbrOf = (name: string) => name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase().padEnd(3, 'X');
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
function teamStrength(s: YcState, team: string) { return Math.round(between(s, 30, 90) + (team.charCodeAt(0) % 3)); }
function moveTeam(s: YcState) {
  const t = pickOf(s, REAL_FRANCHISES.filter(x => x.id !== s.club?.abbr)).id;
  s.club = nbaClub(t, teamStrength(s, t));
  if (s.contract) s.contract = { ...s.contract, team: t };
}

// ---------------------------------------------------------------- the draft

function runDraft(s: YcState): void {
  const proj = draftProjection(s);
  const pick = clamp(Math.round(proj.pick + between(s, -6, 6)), 1, 75);
  const year = START_YEAR + (s.age - START_AGE);
  if (pick > 60) {
    s.draft = { year, round: 0, pick: 0, team: null };
    s.pending.unshift({ id: 'undrafted', title: 'Undrafted', text: 'Sixty names were called. Yours was not. Now what?', options: [
      { id: 'summer', title: 'Summer League tryout', blurb: 'One week in Las Vegas to earn a contract.', odds: { win: tryoutOdds(s, 70), winText: 'You earn an NBA contract', loseText: 'No contract · G League it is' } },
      { id: 'gleague', title: 'Sign with a G League team', blurb: 'Minutes, film and a call-up if you play well.', chips: ['G League'] },
      { id: 'europe', title: 'Go overseas', blurb: 'Real money and a real role in Europe.', chips: ['$1.2M a year', 'Starter'] },
    ] });
  } else {
    // Worse teams pick first: the earlier the pick, the weaker the team you join.
    const team = shuffled(s, REAL_FRANCHISES.map(t => t.id))[pick % 30];
    s.draft = { year, round: pick <= 30 ? 1 : 2, pick, team };
    s.club = nbaClub(team, clamp(25 + pick * 1.1 + between(s, -10, 10), 20, 85));
    const salary = pick <= 30 ? round1(clamp(12 - pick * 0.35, 2.2, 12)) : 1.2;
    s.contract = { team, years: pick <= 30 ? 4 : 2, salary, rookie: true };
    s.role = pick <= 5 ? 'starter' : 'bench';
    s.rep += pick <= 3 ? 12 : pick <= 14 ? 7 : pick <= 30 ? 4 : 1;
    s.draftShow = true;
  }
}

// ---------------------------------------------------------------- playing a season

interface AwardCtx { s: YcState; ovr: number; rel: number; ppg: number; gp: number; winPct: number; champ: boolean; r: Ratings; trophies: string[] }
const proAwards = (name: string) => ({ s, rel, champ, trophies }: AwardCtx) => { if (champ) trophies.push(name); if (rel >= 10 && next(s) < 0.5) trophies.push('League MVP'); };
const collegeAwards = ({ s, rel, ppg, champ, winPct, trophies }: AwardCtx) => {
  if (champ && s.club?.level === 'college' && winPct > 0.75 && next(s) < 0.45) trophies.push('National champion');
  else if (champ) trophies.push('Conference champion');
  if (rel >= 12) trophies.push('All-American');
  if (rel >= 17 && ppg >= 18) trophies.push('Player of the Year');
};
/** The trophies a season can bring at each level. */
const AWARDS: Record<Level, (x: AwardCtx) => void> = {
  youth: ({ champ, ppg, trophies }) => { if (champ) trophies.push('Youth national title'); if (ppg >= 22) trophies.push('Tournament MVP'); },
  highschool: ({ s, rel, champ, trophies }) => {
    if (champ) trophies.push('State champion');
    if (rel >= 8) trophies.push('All-State');
    if (s.age === 17 && rel >= 14) trophies.push('National All-American');
  },
  college: collegeAwards, academy: collegeAwards,
  europe: proAwards('League champion'), gleague: proAwards('G League champion'),
  nba: ({ s, ovr, ppg, gp, winPct, r, trophies }) => {
    const firstNba = !s.seasons.some(x => x.club.level === 'nba');
    if (firstNba && ppg >= 13 && next(s) < 0.6 + (ppg - 13) * 0.06) trophies.push('Rookie of the Year');
    if (ovr >= 82 && gp >= 50) trophies.push('All-Star');
    if (ovr >= 86 && gp >= 60) trophies.push('All-NBA');
    if (ovr >= 89 && gp >= 65 && winPct >= 0.6 && next(s) < 0.35 + (ovr - 89) * 0.1) trophies.push('MVP');
    if (r.defense >= 88 && gp >= 60 && next(s) < 0.45) trophies.push('Defensive Player of the Year');
    if (s.role === 'bench' && ppg >= 14) trophies.push('Sixth Man of the Year');
    if (winPct >= 0.66 && next(s) < (winPct - 0.55) * 1.4) { trophies.push('Champion'); if (s.role !== 'bench' && ovr >= 84 && next(s) < 0.45) trophies.push('Finals MVP'); }
  },
};

const GROWTH: [number, number][] = [[14, 3.4], [16, 3.4], [18, 3], [20, 2.6], [22, 2.2], [24, 1.5], [26, 0.8], [28, 0.2], [30, -0.8], [32, -1.8], [34, -3], [36, -4], [99, -5]];
const growthAt = (age: number) => GROWTH.find(([a]) => age <= a)![1];

/** Plays the coming season: growth, minutes, stats, the team's record, awards. Then the next choices. */
export function playSeason(prev: YcState): YcState {
  const s: YcState = structuredClone(prev);
  if (s.done || s.pending.length || !s.club) return prev;
  const lvl = LEVELS[s.club.level];
  // Growth: age, potential, minutes and the summer's focus.
  const room = (s.potential - ovrOf(s)) / 20;
  // Growth slows as you near your ceiling (potential); past it, almost nothing.
  const g = growthAt(s.age) * (growthAt(s.age) > 0 ? clamp(0.45 + room * 0.5, 0.1, 1.2) : 1) * (0.85 + s.morale / 400);
  for (const k of ATTRS) {
    const focused = s.focus === k ? 1.9 : s.focus ? 0.8 : 1;
    s.ratings[k] = clamp(s.ratings[k] + g * focused * between(s, 0.6, 1.25), 25, 99);
  }
  s.ratings = Object.fromEntries(ATTRS.map(k => [k, Math.round(s.ratings[k] * 10) / 10])) as Ratings;
  const ovr = ovrOf(s);
  // Role and minutes.
  const rel = ovr - lvl.base;
  const roleBoost = s.role === 'star' ? 4 : s.role === 'bench' ? -6 : 0;
  const mpg = clamp(Math.round((lvl.minutes * 0.6 + rel * 1.2 + roleBoost) * 10) / 10, 8, lvl.minutes);
  if (rel > 6 && s.role === 'bench') s.role = 'starter';
  if (rel > 12) s.role = 'star';
  // Games: injuries and surgery.
  const hurt = s.injuredUntil === s.age ? 0.3 : 0;
  const gp = Math.max(4, Math.round(lvl.games * clamp(1 - hurt - Math.max(0, between(s, -0.25, 0.22)) - (s.age > 31 ? (s.age - 31) * 0.025 : 0), 0.2, 1)));
  const m = mpg / 36, r = s.ratings, noise = () => between(s, 0.9, 1.1), bigs = s.pos === 'C' || s.pos === 'PF';
  const ppg = round1(clamp(m * (9 + Math.max(-6, rel) * 0.55 + (r.shooting + r.dribbling - 100) * 0.1) * lvl.scoring * (s.role === 'star' ? 1.1 : 1) * noise(), 0.8, s.club.level === 'nba' ? 36 : 32));
  const apg = round1(clamp(m * (0.8 + (r.vision - 40) * 0.13 + (s.pos === 'PG' ? 2.2 : 0)) * noise(), 0.2, 13));
  const rpg = round1(clamp(m * (2.4 + (r.physical - 40) * 0.11 + (bigs ? 3.6 : s.pos === 'SF' ? 1.2 : 0)) * noise(), 0.6, 15.5));
  const spg = round1(clamp(m * (0.5 + (r.defense - 40) * 0.025 + (s.pos === 'PG' || s.pos === 'SG' ? 0.3 : 0)) * noise(), 0.1, 2.8));
  const bpg = round1(clamp(m * (bigs ? 0.4 + (r.defense + r.physical - 90) * 0.03 : 0.1 + (r.defense - 50) * 0.008) * noise(), 0, 3.8));
  // The team.
  const winPct = clamp(0.5 + (s.club.strength - 55) / 150 + rel / 80 + (s.role === 'star' ? 0.03 : 0) + between(s, -0.08, 0.08), 0.15, 0.84);
  const games = lvl.games, wins = Math.round(games * winPct);
  const trophies: string[] = [];
  const champ = winPct > 0.62 && next(s) < (winPct - 0.5) * 1.6;
  const year = START_YEAR + (s.age - START_AGE);
  const award: AwardCtx = { s, ovr, rel, ppg, gp, winPct, champ, r, trophies };
  AWARDS[s.club.level](award);
  if (s.pendingTrophy) { trophies.push(s.pendingTrophy); s.pendingTrophy = undefined; }
  s.seasons.push({ age: s.age, year, club: s.club, ovr, gp, mpg, ppg, apg, rpg, spg, bpg, record: `${wins}-${games - wins}`, trophies });
  s.rep = clamp(s.rep + Math.round((ppg - 10) * 0.35 + trophies.length * 3 + (rel > 0 ? 1 : -1)), 0, 100);
  s.morale = clamp(s.morale + (winPct > 0.55 ? 4 : -3) + (mpg >= 28 ? 2 : -2), 10, 100);
  // Pro teams rise and fall: drift toward the middle with some luck.
  if (s.club.level === 'nba') s.club = { ...s.club, strength: Math.round(clamp(s.club.strength + (55 - s.club.strength) * 0.15 + between(s, -9, 9), 20, 92)) };
  if (s.contract) { s.earnings = round1(s.earnings + s.contract.salary); s.contract = { ...s.contract, years: s.contract.years - 1 }; }
  if (s.club.level === 'college') s.collegeYears += 1;
  s.focus = null;
  s.age += 1;
  s.pending = nextDecisions(s);
  return s;
}

/** The choices waiting before the next season. */
export function nextDecisions(s: YcState): Decision[] {
  if (s.done) return [];
  const out: Decision[] = [];
  const level = s.club?.level;
  if (s.age >= LAST_AGE || (s.age >= 35 && ovrOf(s) < 66)) { retire(s); return []; }
  if (s.age === 14 && level === 'youth') out.push(highSchoolDecision(s));
  else if (s.age === 18 && level === 'highschool') out.push(recruitingDecision(s));
  else if ((level === 'college' || level === 'academy' || (level === 'europe' && !s.draft)) && s.age >= 19) out.push(collegeDecision(s));
  else if (s.contract && s.contract.years <= 0 && (level === 'nba' || level === 'gleague' || level === 'europe')) out.push(freeAgencyDecision(s));
  const ev = s.age >= 14 ? eventDecision(s) : null;
  if (ev) out.push(ev);
  if (s.age >= 34 && !out.some(d => d.id === 'free-agency') && !out.some(d => d.options.some(o => o.id === 'retire'))) out.push({ id: 'retire-offer', title: 'Thinking about it', text: `${s.age} years old. Your body is talking to you.`, options: [
    { id: 'retire', title: 'Retire now', blurb: 'Go out while people still remember you at your best.', chips: ['Career ends'] },
    { id: 'one-more', title: 'One more year', blurb: 'Nobody tells you when it\'s over.', chips: [chip(2, 'morale')] },
  ] });
  out.push(trainingDecision(s));
  return out.slice(0, 3);
}

// ---------------------------------------------------------------- the end

export function legacyScore(s: Pick<YcState, 'seasons'>): number {
  const pro = s.seasons.filter(x => x.club.level === 'nba');
  const award: Record<string, number> = { MVP: 14, 'Finals MVP': 9, Champion: 7, 'All-NBA': 5, 'All-Star': 3, 'Defensive Player of the Year': 5, 'Rookie of the Year': 3, 'Sixth Man of the Year': 2 };
  return Math.round(pro.reduce((n, x) => n + Math.max(0, x.ovr - 70) * 0.7 + x.ppg * 0.25 + x.trophies.reduce((t, a) => t + (award[a] ?? 1), 0), 0));
}
function retire(s: YcState) {
  s.done = true; s.pending = []; s.legacy = legacyScore(s); s.hallOfFame = s.legacy >= 160;
  s.log = [`${s.name} retired at ${s.age}.`, ...s.log].slice(0, 30);
}

/** Career totals: games, and points, assists and rebounds per game. */
export function careerTotals(s: Pick<YcState, 'seasons'>, level?: Level) {
  const rows = s.seasons.filter(x => !level || x.club.level === level);
  const gp = rows.reduce((n, x) => n + x.gp, 0);
  const per = (k: 'ppg' | 'apg' | 'rpg') => (gp ? round1(rows.reduce((n, x) => n + x[k] * x.gp, 0) / gp) : 0);
  return { gp, ppg: per('ppg'), apg: per('apg'), rpg: per('rpg'), trophies: rows.flatMap(x => x.trophies) };
}

// ---------------------------------------------------------------- storage

export function loadCareer(): YcState | null {
  try { const s = JSON.parse(localStorage.getItem(YC_KEY) ?? 'null') as YcState | null; return s && s.v === 1 && Array.isArray(s.seasons) ? s : null; } catch { return null; }
}
export function saveCareer(s: YcState | null): void {
  try { if (s) localStorage.setItem(YC_KEY, JSON.stringify(s)); else localStorage.removeItem(YC_KEY); } catch { /* storage blocked */ }
}
export interface YcRecord { name: string; pos: Pos; nation: string; seasons: number; legacy: number; hallOfFame: boolean; trophies: number; ppg: number; at: number }
export function loadRecords(): YcRecord[] {
  try { const v = JSON.parse(localStorage.getItem(YC_RECORDS_KEY) ?? '[]') as unknown; return Array.isArray(v) ? v as YcRecord[] : []; } catch { return []; }
}
export function recordCareer(s: YcState): YcRecord {
  const t = careerTotals(s, 'nba');
  const rec: YcRecord = { name: s.name, pos: s.pos, nation: s.nation, seasons: s.seasons.length, legacy: s.legacy ?? legacyScore(s), hallOfFame: !!s.hallOfFame, trophies: s.seasons.reduce((n, x) => n + x.trophies.length, 0), ppg: t.ppg, at: Date.now() };
  try { localStorage.setItem(YC_RECORDS_KEY, JSON.stringify([rec, ...loadRecords()].sort((a, b) => b.legacy - a.legacy).slice(0, 10))); } catch { /* storage blocked */ }
  return rec;
}
