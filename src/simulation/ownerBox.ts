import type { League, LeagueTeam } from './league';
import { computeStandings } from './league';
import type { GMLeagueExtras } from './gm';
import { RNG } from './engine/rng';
import { ARCHETYPE, type RivalArchetype } from './gmRivals';
import { CITIES, homeCities, type City } from './travel';
import { splitTeamName } from '../visuals/pixelFont';
import { computeTeamFinances } from './finances';
import { strengthRank, becomeSpectator, ensureFrontOffice, type OwnerStyle } from './frontOffice';
import { fireStaff, hireStaff, staffOfferAssessment } from './staffManagement';
import { DEFAULT_LEAGUE_RULES, type LeagueRulesSettings } from './leagueRules';
import { MAX_LEVEL, businessOf } from './business';
import type { PlayoffFinish } from './league';

/*
 * The Owner's Box. You own a team instead of running it: an AI general manager you hire does the day-to-day (trades,
 * the draft, free agency, re-signings) in his own style, and you set the goal and the budget, judge his results, hire
 * and fire him and the head coach, build (or move) the arena, and vote with the other owners at the league office.
 *
 * Under the hood the league runs like a spectator league (every team, yours included, is run by the AI GM code); the
 * owner's choices steer that code for your team: the GM's style is the team's front-office personality, the goal
 * pushes it to buy or sell, the budget sets its spending and the team's expense levels.
 */

export { GOALS, BUDGETS, GM_STYLE, ownerSpendFactor, ownerLean, type OwnerGoal, type OwnerBudget } from './ownerDials';
import { GOALS, BUDGETS, GM_STYLE, type OwnerGoal, type OwnerBudget } from './ownerDials';

export interface GmSeason { season: string; wins: number; losses: number; finish: PlayoffFinish; expectedRank: number; actualRank: number; goalMet: boolean }
export interface OwnerGM { id: string; name: string; age: number; archetype: RivalArchetype; hiredSeason: string; years: number; salary: number; record: GmSeason[] }
export interface ArenaState { name: string; sponsor?: { name: string; annual: number; years: number }; suites: number; builtSeason?: string }
export type OwnerLogKind = 'bought' | 'gm_hired' | 'gm_fired' | 'coach_hired' | 'coach_fired' | 'arena' | 'naming' | 'moved' | 'vote' | 'colors' | 'goal';
export interface OwnerLogEntry { season: string; kind: OwnerLogKind; text: string }
export interface OwnerSeason { season: string; wins: number; losses: number; finish: PlayoffFinish; profit: number; goal: OwnerGoal; goalMet: boolean }

export interface OwnerState {
  version: 1;
  teamId: string;
  since: string;
  /** Your money, in dollars: the purchase leaves some, every season's profit adds (or takes). */
  cash: number;
  /** How the city feels about you (0-100): winning, a new arena and staying put help; a move or a sell-off hurt. */
  fans: number;
  goal: OwnerGoal;
  budget: OwnerBudget;
  gm: OwnerGM | null;
  /** How many GMs you have hired (seeds the next candidates). */
  hires: number;
  arena: ArenaState;
  seasons: OwnerSeason[];
  log: OwnerLogEntry[];
}

// ---------------------------------------------------------------- the league office (every owner votes)

export type ProposalId = 'fourPoint' | 'noFourPoint' | 'longClock' | 'shortClock' | 'noPlayIn' | 'playIn' | 'handCheck' | 'deepThree' | 'freedom' | 'shortSeason' | 'fullSeason';
export interface ProposalDef { id: ProposalId; title: string; blurb: string; support: number; styles: Partial<Record<OwnerStyle, number>> }
export const PROPOSALS: Record<ProposalId, ProposalDef> = {
  fourPoint: { id: 'fourPoint', title: 'Add a four-point line', blurb: 'The deepest threes (30 feet and out) count for four. More comebacks, fewer safe leads.', support: 0.45, styles: { money: 0.15, patient: -0.1 } },
  noFourPoint: { id: 'noFourPoint', title: 'Scrap the four-point line', blurb: 'Back to threes as the longest shot.', support: 0.55, styles: { patient: 0.1 } },
  longClock: { id: 'longClock', title: 'A 30-second shot clock', blurb: 'Slower games, fewer possessions, more half-court sets.', support: 0.4, styles: { patient: 0.15, money: -0.15 } },
  shortClock: { id: 'shortClock', title: 'A 20-second shot clock', blurb: 'Faster games, more possessions, more points.', support: 0.45, styles: { money: 0.15, patient: -0.1 } },
  noPlayIn: { id: 'noPlayIn', title: 'Scrap the play-in tournament', blurb: 'The top eight in each conference go straight to the playoffs.', support: 0.42, styles: { win_now: 0.1, money: -0.2 } },
  playIn: { id: 'playIn', title: 'Bring back the play-in', blurb: 'Seeds 7 to 10 fight for the last two playoff spots.', support: 0.6, styles: { money: 0.2 } },
  handCheck: { id: 'handCheck', title: 'Bring back hand-checking', blurb: 'Defenders can use their hands again: perimeter defense counts for more.', support: 0.38, styles: { patient: 0.1, money: -0.1 } },
  deepThree: { id: 'deepThree', title: 'Move the three-point line back', blurb: 'Threes get harder, and teams take fewer of them.', support: 0.42, styles: { patient: 0.1 } },
  freedom: { id: 'freedom', title: 'Freedom of movement', blurb: 'Stricter whistles on contact: more free throws, easier drives.', support: 0.5, styles: { money: 0.1, win_now: -0.05 } },
  shortSeason: { id: 'shortSeason', title: 'A 72-game season', blurb: 'Ten fewer games: fresher players, less gate money.', support: 0.4, styles: { money: -0.25, patient: 0.1 } },
  fullSeason: { id: 'fullSeason', title: 'Back to 82 games', blurb: 'The full season, and the gate money that comes with it.', support: 0.6, styles: { money: 0.2 } },
};

export interface ExpansionBid { id: string; city: string; nickname: string; fee: number }
export interface VoteResult { season: string; id: string; title: string; yes: number; no: number; passed: boolean; yours?: boolean }
export type LeagueEventKind = 'rule' | 'expansion' | 'relocation' | 'protest' | 'rival';
export interface LeagueOfficeEvent { season: string; kind: LeagueEventKind; teamId?: string; text: string }
export interface LeagueOffice {
  season: string;
  proposals: ProposalId[];
  bids: ExpansionBid[];
  votes: VoteResult[];
  events: LeagueOfficeEvent[];
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const M = 1_000_000;
const FIRST = ['Theo', 'Nadia', 'Marcus', 'Priya', 'Graham', 'Lena', 'Omar', 'Rosa', 'Declan', 'Imani', 'Wes', 'Carla', 'Julian', 'Tess', 'Andre', 'Maya'];
const LAST = ['Ashford', 'Okafor', 'Lindqvist', 'Barrera', 'Whitfield', 'Nakamura', 'Coleman', 'Sterling', 'Haddad', 'Morrow', 'Quinlan', 'Delacroix', 'Beckett', 'Ferro', 'Ingram', 'Vasquez'];
const NICKNAMES = ['Comets', 'Stallions', 'Pilots', 'Monarchs', 'Rapids', 'Outlaws', 'Foxes', 'Titans', 'Voyagers', 'Hawks', 'Current', 'Rockets', 'Summit', 'Wolves', 'Anchors', 'Blaze'];
const SPONSORS = ['Apex Bank', 'Northline Energy', 'Crest Mobile', 'Harbor Insurance', 'Pinnacle Air', 'Vantage Motors', 'Bluewave Tech', 'Summit Foods'];

/** How big each city's market is (0-100); cities not listed are mid-sized. */
const METRO: Record<string, number> = {
  'New York': 98, Brooklyn: 92, 'Los Angeles': 96, LA: 94, Chicago: 88, Dallas: 80, Houston: 80, Philadelphia: 78, Washington: 76, Toronto: 80, Miami: 74,
  Atlanta: 74, Boston: 78, 'San Francisco': 82, 'Golden State': 82, Phoenix: 68, Seattle: 74, Detroit: 64, Minnesota: 60, Denver: 64, 'San Diego': 66, Tampa: 58,
  'St. Louis': 52, Baltimore: 56, Orlando: 56, Charlotte: 54, Portland: 54, Sacramento: 50, 'Las Vegas': 60, Austin: 58, Nashville: 52, Pittsburgh: 50,
  Cleveland: 48, Indiana: 46, Indianapolis: 46, Columbus: 48, 'Kansas City': 48, Cincinnati: 46, 'San Antonio': 48, Milwaukee: 42, 'Salt Lake City': 42, Utah: 42,
  Montreal: 62, Vancouver: 60, Louisville: 40, Memphis: 38, 'Oklahoma City': 38, 'New Orleans': 38, Omaha: 34, Albuquerque: 32, Boise: 30, Birmingham: 32,
  Raleigh: 44, Anaheim: 60, Hartford: 36, Spokane: 28, 'El Paso': 32, Tulsa: 32, Richmond: 38, Buffalo: 36,
};
export const cityMarket = (city: string) => METRO[city] ?? 45;

export const ownerOf = (league: League) => league.owner ?? null;
export const ownerTeam = (league: League) => league.owner ? league.teams.find(t => t.teamId === league.owner!.teamId) ?? null : null;

// ---------------------------------------------------------------- buying a team

/** You buy the team: the league becomes a spectator league for the GM code, and you get the Owner's Box. */
export function startOwnership(league: League, extras: GMLeagueExtras, teamId: string): { league: League; extras: GMLeagueExtras } {
  const team = league.teams.find(t => t.teamId === teamId);
  if (!team) return { league, extras };
  const season = league.season ?? '';
  const owner: OwnerState = {
    version: 1, teamId, since: season, cash: Math.round((120 + (team.marketSize ?? 50) * 2.5) * M), fans: 55, goal: 'playoffs', budget: 'standard', gm: null, hires: 0,
    arena: { name: `${splitTeamName(team.name).city || team.name} Arena`, suites: 0 }, seasons: [],
    log: [{ season, kind: 'bought', text: `Bought the ${team.name}.` }],
  };
  // The GM job is not yours: the league treats every team as AI-run (the owner steers yours).
  const spectator = becomeSpectator(ensureFrontOffice(league, null));
  const withOwner = { ...spectator, owner, leagueOffice: league.leagueOffice ?? newOffice(league) };
  return applyOwnerDials(withOwner, extras);
}

function newOffice(league: League): LeagueOffice {
  return { season: league.season ?? '', proposals: pickProposals(league, league.season ?? ''), bids: [], votes: [], events: [] };
}

/** The GM's style, the goal and the budget written into what the AI GM code reads for your team. */
export function applyOwnerDials(league: League, extras: GMLeagueExtras): { league: League; extras: GMLeagueExtras } {
  const o = league.owner;
  if (!o) return { league, extras };
  const b = BUDGETS[o.budget].expense;
  const teams = league.teams.map(t => t.teamId === o.teamId ? { ...t, expenseLevels: { scouting: b, coaching: b, health: b, facilities: b } } : t);
  const personality = o.gm ? GM_STYLE[o.gm.archetype].personality : 'balanced';
  return { league: { ...league, teams }, extras: { ...extras, teamPersonalities: { ...extras.teamPersonalities, [o.teamId]: o.goal === 'profit' ? 'conservative' : personality } } };
}

// ---------------------------------------------------------------- the GM

/** Three GMs to interview, one of each style (new ones after every hire). */
export function gmCandidates(league: League): OwnerGM[] {
  const o = league.owner;
  if (!o) return [];
  const rng = new RNG(hash(`${o.teamId}|${league.season}|${o.hires}`));
  const archetypes: RivalArchetype[] = ['shark', 'collector', 'oldschool'];
  return archetypes.map((archetype, i) => {
    const name = `${FIRST[rng.nextInt(FIRST.length)]} ${LAST[rng.nextInt(LAST.length)]}`;
    return { id: `gm-${o.hires}-${i}`, name, age: 34 + rng.nextInt(30), archetype, hiredSeason: league.season ?? '', years: 3, salary: Math.round((2 + rng.next() * 4) * M), record: [] };
  });
}

export function hireGm(league: League, extras: GMLeagueExtras, gm: OwnerGM): { league: League; extras: GMLeagueExtras } {
  const o = league.owner;
  if (!o) return { league, extras };
  const hired = { ...gm, hiredSeason: league.season ?? '', record: [] };
  const next = { ...o, gm: hired, hires: o.hires + 1, log: addLog(o, league, 'gm_hired', `Hired ${gm.name} as general manager (${ARCHETYPE[gm.archetype].label}), ${gm.years} years at $${(gm.salary / M).toFixed(1)}M.`) };
  return applyOwnerDials({ ...league, owner: next }, extras);
}

/** Another three years for the GM you have (a raise of 10%). */
export function extendGm(league: League): League {
  const o = league.owner;
  if (!o?.gm) return league;
  const gm = { ...o.gm, years: Math.max(0, o.gm.years) + 3, salary: Math.round(o.gm.salary * 1.1) };
  return { ...league, owner: { ...o, gm, log: addLog(o, league, 'gm_hired', `Extended ${gm.name}: three more years at $${(gm.salary / M).toFixed(1)}M.`) } };
}

/** Firing him pays out the rest of his contract; the team runs on an interim GM until you hire again. */
export function fireGm(league: League, extras: GMLeagueExtras): { league: League; extras: GMLeagueExtras } {
  const o = league.owner;
  if (!o?.gm) return { league, extras };
  const payout = o.gm.salary * Math.max(0, o.gm.years);
  const next = { ...o, gm: null, cash: o.cash - payout, log: addLog(o, league, 'gm_fired', `Fired general manager ${o.gm.name}${payout ? ` ($${(payout / M).toFixed(1)}M paid out)` : ''}.`) };
  return applyOwnerDials({ ...league, owner: next }, extras);
}

/** A season's report card for the GM: record against the roster's expectation, and the goal. */
export function gmGrade(r: GmSeason): { grade: 'A' | 'B' | 'C' | 'D' | 'F'; note: string } {
  const beat = r.expectedRank - r.actualRank;
  const score = beat + (r.goalMet ? 5 : -3) + (r.finish === 'Champion' ? 8 : r.finish === 'Finals' ? 4 : 0);
  const grade = score >= 8 ? 'A' : score >= 3 ? 'B' : score >= -2 ? 'C' : score >= -7 ? 'D' : 'F';
  return { grade, note: beat > 2 ? 'Got more out of the roster than expected.' : beat < -2 ? 'The roster underachieved.' : 'About what the roster should do.' };
}

// ---------------------------------------------------------------- the head coach

export function headCoachCandidates(league: League) {
  const o = league.owner;
  const team = ownerTeam(league);
  if (!o || !team) return [];
  return [...(league.staffMarket ?? [])].sort((a, b) => b.rating - a.rating).slice(0, 6)
    .map(c => ({ coach: c, offer: staffOfferAssessment(team, c, 'head', Math.round(c.contract.annualSalary * 1.1), 3, league) }));
}

export function hireHeadCoach(league: League, coachId: string): { league: League; message: string } {
  const o = league.owner, team = ownerTeam(league);
  const c = league.staffMarket?.find(x => x.coachId === coachId);
  if (!o || !team || !c) return { league, message: 'That coach is no longer available.' };
  const demand = staffOfferAssessment(team, c, 'head', c.contract.annualSalary, 3, league).demand;
  const r = hireStaff(league, o.teamId, coachId, 'head', Math.round(demand * 1.1), 3, o.teamId);
  if (r.league === league) return r;
  return { league: { ...r.league, owner: { ...o, log: addLog(o, league, 'coach_hired', `Hired ${coachId} as head coach.`) } }, message: r.message };
}

export function fireHeadCoach(league: League): { league: League; message: string } {
  const o = league.owner, team = ownerTeam(league);
  if (!o || !team?.coachIdentity) return { league, message: 'There is no head coach to fire.' };
  const name = team.coachIdentity.coachId;
  const r = fireStaff(league, o.teamId, 'head', o.teamId);
  if (r.league === league) return r;
  return { league: { ...r.league, owner: { ...o, log: addLog(o, league, 'coach_fired', `Fired head coach ${name}.`) } }, message: r.message };
}

// ---------------------------------------------------------------- goal, budget, colours

export function setGoal(league: League, extras: GMLeagueExtras, goal: OwnerGoal) {
  const o = league.owner;
  if (!o || o.goal === goal) return { league, extras };
  return applyOwnerDials({ ...league, owner: { ...o, goal, log: addLog(o, league, 'goal', `Set the goal: ${GOALS[goal].label.toLowerCase()}.`) } }, extras);
}
export function setBudget(league: League, extras: GMLeagueExtras, budget: OwnerBudget) {
  const o = league.owner;
  if (!o || o.budget === budget) return { league, extras };
  return applyOwnerDials({ ...league, owner: { ...o, budget } }, extras);
}
export function setTeamColors(league: League, primary: string, secondary: string): League {
  const o = league.owner;
  if (!o) return league;
  return { ...league, teams: league.teams.map(t => t.teamId === o.teamId ? { ...t, identity: { ...(t.identity ?? {} as NonNullable<LeagueTeam['identity']>), primary, secondary, courtPaint: primary, courtApron: secondary } } : t),
    owner: { ...o, log: addLog(o, league, 'colors', 'New team colours.') } };
}

// ---------------------------------------------------------------- the arena

export const ARENA_BASE_COST = 450 * M;
export const SUITE_COST = 35 * M;
export const SUITE_INCOME = 9 * M;
export const arenaCost = (suites: number) => ARENA_BASE_COST + suites * SUITE_COST;

/** A new arena: every upgrade at the top level, your name on it, and 0-4 levels of luxury suites. */
export function buildArena(league: League, name: string, suites: number): { league: League; message: string } {
  const o = league.owner;
  const cost = arenaCost(suites);
  if (!o) return { league, message: 'You need to own a team first.' };
  if (o.cash < cost) return { league, message: `You need $${(cost / M).toFixed(0)}M; you have $${(o.cash / M).toFixed(0)}M.` };
  const season = league.season ?? '';
  const teams = league.teams.map(t => t.teamId !== o.teamId ? t : {
    ...t, business: { ...businessOf(t), arena: { seats: MAX_LEVEL, scoreboard: MAX_LEVEL, practice: MAX_LEVEL, lights: MAX_LEVEL, crowd: MAX_LEVEL, mascot: MAX_LEVEL } },
  });
  const clean = name.trim().slice(0, 40) || o.arena.name;
  const owner: OwnerState = { ...o, cash: o.cash - cost, fans: clamp(o.fans + 10), arena: { ...o.arena, name: clean, suites: clamp(suites, 0, 4), builtSeason: season },
    log: addLog(o, league, 'arena', `Opened ${clean}${suites ? ` with ${suites} level${suites === 1 ? '' : 's'} of luxury suites` : ''} ($${(cost / M).toFixed(0)}M).`) };
  return { league: { ...league, teams, owner }, message: `${clean} is open.` };
}

/** Naming-rights offers from local companies (bigger markets pay more). */
export function namingOffers(league: League): { name: string; annual: number; years: number }[] {
  const o = league.owner, team = ownerTeam(league);
  if (!o || !team) return [];
  const rng = new RNG(hash(`${o.teamId}|${league.season}|naming`));
  const base = (4 + (team.marketSize ?? 50) / 8) * (o.arena.builtSeason ? 1.5 : 1);
  return [0, 1, 2].map(i => ({ name: SPONSORS[(rng.nextInt(SPONSORS.length) + i * 3) % SPONSORS.length], annual: Math.round((base + rng.next() * 4 + i) * M), years: 3 + i * 2 }));
}
export function signNaming(league: League, offer: { name: string; annual: number; years: number }): League {
  const o = league.owner;
  if (!o) return league;
  const arena = { ...o.arena, sponsor: offer, name: `${offer.name} ${o.arena.name.replace(/^.*?(Arena|Center|Centre|Garden|Dome|Fieldhouse|Forum)$/i, '$1')}`.replace(/\s+/g, ' ').trim() };
  return { ...league, owner: { ...o, arena, log: addLog(o, league, 'naming', `Sold the naming rights: ${arena.name} ($${(offer.annual / M).toFixed(1)}M a year for ${offer.years} years).`) } };
}

// ---------------------------------------------------------------- moving the team

export const RELOCATION_FEE = 150 * M;
/** Cities without a team (from the map). */
export function openCities(league: League): City[] {
  const taken = new Set([...homeCities(league.teams).values()].map(c => `${c.lat},${c.lon}`));
  const seen = new Set<string>();
  return CITIES.filter(c => { const k = `${c.lat},${c.lon}`; if (taken.has(k) || seen.has(k)) return false; seen.add(k); return true; });
}
const phaseIsOff = (league: League) => !['regular_season', 'playoffs', 'all_star'].includes(league.seasonPhase ?? 'regular_season');

/** Renames a team for its new city ("Chicago Comets" becomes "Seattle Comets"; a city-only name becomes the city). */
function moveTeam(league: League, teamId: string, city: string, nickname?: string): League {
  const teams = league.teams.map(t => {
    if (t.teamId !== teamId) return t;
    const parts = splitTeamName(t.name);
    const nick = nickname?.trim() || (parts.city ? parts.nickname : '');
    return { ...t, name: nick ? `${city} ${nick}` : city, marketSize: cityMarket(city), identity: t.identity ? { ...t.identity, abbreviation: city.slice(0, 3).toUpperCase() } : t.identity };
  });
  return { ...league, teams };
}

/** Moving your team: the other owners must approve (two thirds), the fee is paid, and your old city is not happy. */
export function relocate(league: League, city: string, nickname?: string): { league: League; message: string; passed: boolean } {
  const o = league.owner, team = ownerTeam(league);
  if (!o || !team) return { league, message: 'You need to own a team first.', passed: false };
  if (!phaseIsOff(league)) return { league, message: 'Teams can only move in the offseason.', passed: false };
  if (!openCities(league).some(c => c.name === city)) return { league, message: `${city} already has a team.`, passed: false };
  if (o.cash < RELOCATION_FEE) return { league, message: `The relocation fee is $${RELOCATION_FEE / M}M.`, passed: false };
  const oldName = team.name, oldCity = splitTeamName(team.name).city || team.name;
  const tally = ownerVotes(league, `move|${city}`, 0.55 + (cityMarket(city) - (team.marketSize ?? 50)) / 200, true);
  const season = league.season ?? '';
  const vote: VoteResult = { season, id: `move-${city}`, title: `Let the ${oldName} move to ${city}`, yes: tally.yes, no: tally.no, passed: tally.passed, yours: true };
  const office = league.leagueOffice ?? newOffice(league);
  if (!tally.passed) return { league: { ...league, leagueOffice: { ...office, votes: [...office.votes, vote] } }, message: `The owners voted it down, ${tally.yes}-${tally.no}. You stay in ${oldCity}.`, passed: false };
  const moved = moveTeam(league, o.teamId, city, nickname);
  const newName = moved.teams.find(t => t.teamId === o.teamId)!.name;
  const events: LeagueOfficeEvent[] = [
    { season, kind: 'relocation', teamId: o.teamId, text: `The ${oldName} move to ${city} and become the ${newName}.` },
    { season, kind: 'protest', teamId: o.teamId, text: `Fans in ${oldCity} protest outside the arena: "${oldCity} deserved better."` },
  ];
  const owner: OwnerState = { ...o, cash: o.cash - RELOCATION_FEE, fans: clamp(o.fans - 25), arena: { name: `${city} Arena`, suites: 0 },
    log: addLog(o, league, 'moved', `Moved the team from ${oldCity} to ${city} (${tally.yes}-${tally.no} vote, $${RELOCATION_FEE / M}M fee).`) };
  return { league: { ...moved, owner, leagueOffice: { ...office, votes: [...office.votes, vote], events: [...office.events, ...events] } }, message: `Welcome to ${city}: the ${newName}.`, passed: true };
}

// ---------------------------------------------------------------- votes

/**
 * How the other owners vote: each leans on the proposal's base support, his style (win-now, patient, money-first) and
 * a little of his own mind (fixed per owner and question). Two thirds of all owners must say yes.
 */
export function ownerVotes(league: League, key: string, support: number, yourVote: boolean | null, styles: Partial<Record<OwnerStyle, number>> = {}): { yes: number; no: number; passed: boolean } {
  let yes = 0, no = 0;
  for (const t of league.teams) {
    if (league.owner && t.teamId === league.owner.teamId) { if (yourVote === true) yes++; else if (yourVote === false) no++; continue; }
    const style = league.frontOffice?.owners[t.teamId]?.style;
    const p = support + (style ? styles[style] ?? 0 : 0) + ((hash(`${key}|${t.teamId}`) % 1000) / 1000 - 0.5) * 0.5;
    if (p >= 0.5) yes++; else no++;
  }
  return { yes, no, passed: yes * 3 >= (yes + no) * 2 };
}

/** Three proposals on this offseason's agenda (only ones that would change something). */
export function pickProposals(league: League, season: string): ProposalId[] {
  const r = { ...DEFAULT_LEAGUE_RULES, ...league.rulesSettings };
  const games = league.settings?.gamesPerSeason ?? r.gamesPerSeason ?? 82;
  const open: ProposalId[] = [
    r.fourPointLine ? 'noFourPoint' : 'fourPoint',
    r.possessionsPerGame < 100 ? 'shortClock' : r.possessionsPerGame > 100 ? 'longClock' : hash(season) % 2 ? 'longClock' : 'shortClock',
    r.playInEnabled === false ? 'playIn' : 'noPlayIn',
    ...(r.perimeterDefenseImpact <= 50 ? ['handCheck' as const] : []),
    ...(r.threePointDifficulty <= 50 ? ['deepThree' as const] : []),
    ...(r.freeThrowFrequency <= 50 ? ['freedom' as const] : []),
    games >= 82 ? 'shortSeason' : 'fullSeason',
  ];
  return open.sort((a, b) => hash(`${season}|${a}`) - hash(`${season}|${b}`)).slice(0, 3);
}

/** What a passed proposal changes (the engine reads these dials). */
export function applyProposal(league: League, id: ProposalId): League {
  const r: LeagueRulesSettings = { ...DEFAULT_LEAGUE_RULES, ...league.rulesSettings };
  let settings = league.settings;
  switch (id) {
    case 'fourPoint': r.fourPointLine = true; break;
    case 'noFourPoint': r.fourPointLine = false; break;
    case 'longClock': r.possessionsPerGame = Math.max(80, r.possessionsPerGame - 8); settings = { ...settings, era: { ...settings.era, shotClockSeconds: Math.min(35, settings.era.shotClockSeconds + 6) } }; break;
    case 'shortClock': r.possessionsPerGame = Math.min(120, r.possessionsPerGame + 8); settings = { ...settings, era: { ...settings.era, shotClockSeconds: Math.max(14, settings.era.shotClockSeconds - 4) } }; break;
    case 'noPlayIn': r.playInEnabled = false; break;
    case 'playIn': r.playInEnabled = true; break;
    case 'handCheck': r.perimeterDefenseImpact = Math.min(100, r.perimeterDefenseImpact + 12); settings = { ...settings, era: { ...settings.era, handChecking: true } }; break;
    case 'deepThree': r.threePointDifficulty = Math.min(100, r.threePointDifficulty + 8); r.threePointFrequency = Math.max(0, r.threePointFrequency - 6); break;
    case 'freedom': r.freeThrowFrequency = Math.min(100, r.freeThrowFrequency + 10); break;
    case 'shortSeason': r.gamesPerSeason = 72; settings = { ...settings, gamesPerSeason: 72 }; break;
    case 'fullSeason': r.gamesPerSeason = 82; settings = { ...settings, gamesPerSeason: 82 }; break;
  }
  return { ...league, rulesSettings: r, settings };
}

/** Your vote on a proposal: the owners vote with you, and a passed rule takes effect right away (it is the offseason). */
export function castVote(league: League, id: ProposalId, yes: boolean): { league: League; result: VoteResult } {
  const office = league.leagueOffice ?? newOffice(league);
  const p = PROPOSALS[id];
  const season = league.season ?? '';
  const tally = ownerVotes(league, `${season}|${id}`, p.support, yes, p.styles);
  const result: VoteResult = { season, id, title: p.title, yes: tally.yes, no: tally.no, passed: tally.passed, yours: yes };
  const events = tally.passed ? [...office.events, { season, kind: 'rule' as const, text: `New rule: ${p.title.toLowerCase()} (${tally.yes}-${tally.no}).` }] : office.events;
  const next = { ...league, leagueOffice: { ...office, proposals: office.proposals.filter(x => x !== id), votes: [...office.votes, result], events } };
  const withOwner = next.owner ? { ...next, owner: { ...next.owner, log: addLog(next.owner, league, 'vote', `Voted ${yes ? 'yes' : 'no'} on "${p.title}": ${tally.passed ? 'passed' : 'failed'} ${tally.yes}-${tally.no}.`) } } : next;
  return { league: tally.passed ? applyProposal(withOwner, id) : withOwner, result };
}

/** A city's bid for an expansion team: the fee is split among the current owners if it passes. */
export function voteOnBid(league: League, bidId: string, yes: boolean): { league: League; result: VoteResult; bid: ExpansionBid | null } {
  const office = league.leagueOffice ?? newOffice(league);
  const bid = office.bids.find(b => b.id === bidId) ?? null;
  const season = league.season ?? '';
  if (!bid) return { league, result: { season, id: bidId, title: 'Expansion', yes: 0, no: 0, passed: false }, bid: null };
  // Owners like the fee; a crowded league makes them warier.
  const tally = ownerVotes(league, `${season}|${bid.id}`, 0.62 - Math.max(0, league.teams.length - 30) * 0.05 + cityMarket(bid.city) / 400, yes, { money: 0.15, patient: -0.05 });
  const result: VoteResult = { season, id: bid.id, title: `Expansion: the ${bid.city} ${bid.nickname}`, yes: tally.yes, no: tally.no, passed: tally.passed, yours: yes };
  const share = Math.round(bid.fee / Math.max(1, league.teams.length));
  const owner = league.owner ? { ...league.owner, cash: league.owner.cash + (tally.passed ? share : 0), log: addLog(league.owner, league, 'vote', `Voted ${yes ? 'yes' : 'no'} on expansion to ${bid.city}: ${tally.passed ? `approved (your share of the fee: $${(share / M).toFixed(0)}M)` : 'rejected'}.`) } : undefined;
  const events = tally.passed ? [...office.events, { season, kind: 'expansion' as const, text: `${bid.city} is awarded an expansion team: the ${bid.city} ${bid.nickname} (${tally.yes}-${tally.no}).` }] : office.events;
  return { league: { ...league, ...(owner ? { owner } : {}), leagueOffice: { ...office, bids: office.bids.filter(b => b.id !== bid.id), votes: [...office.votes, result], events } }, result, bid: tally.passed ? bid : null };
}

// ---------------------------------------------------------------- the season ends

/**
 * Called in the offseason transition. Your season is booked (profit, the GM's report card, the goal), the league
 * office sets a new agenda, a city may bid for a team, and a struggling small-market AI team may pack up and move.
 */
export function ownerSeasonEnd(league: League, extras: GMLeagueExtras, teamSeasons: { teamId: string; teamName: string; wins: number; losses: number; playoffFinish: PlayoffFinish }[], previousSeason: string): League {
  let next = league;
  const o = league.owner;
  const office0 = league.leagueOffice;
  if (!o && !office0) return league;
  const byWins = [...teamSeasons].sort((a, b) => b.wins - a.wins).map(r => r.teamId);
  if (o) {
    const row = teamSeasons.find(r => r.teamId === o.teamId);
    const team = league.teams.find(t => t.teamId === o.teamId);
    if (row && team) {
      const pct = row.wins / Math.max(1, row.wins + row.losses);
      const fin = computeTeamFinances(team, extras.contracts, extras.capSettings, league.rulesSettings, pct);
      const extra = o.arena.suites * SUITE_INCOME + (o.arena.sponsor?.annual ?? 0) + (o.gm ? -o.gm.salary : 0);
      const profit = Math.round(fin.operatingIncome * (0.8 + o.fans / 250) + extra);
      const made = row.playoffFinish !== 'Missed Playoffs';
      const goalMet = o.goal === 'title' ? row.playoffFinish === 'Champion' : o.goal === 'playoffs' ? made : o.goal === 'profit' ? profit > 0 : row.wins >= 20 || pct >= 0.3;
      const season: OwnerSeason = { season: previousSeason, wins: row.wins, losses: row.losses, finish: row.playoffFinish, profit, goal: o.goal, goalMet };
      const gmSeason: GmSeason = { season: previousSeason, wins: row.wins, losses: row.losses, finish: row.playoffFinish, expectedRank: strengthRank(league, o.teamId), actualRank: byWins.indexOf(o.teamId) + 1, goalMet };
      const gm = o.gm ? { ...o.gm, years: o.gm.years - 1, record: [...o.gm.record, gmSeason] } : null;
      const fans = clamp(o.fans + (pct - 0.5) * 30 + (row.playoffFinish === 'Champion' ? 15 : made ? 4 : -3) + (o.budget === 'lavish' ? 2 : o.budget === 'frugal' ? -2 : 0));
      const sponsor = o.arena.sponsor && o.arena.sponsor.years > 1 ? { ...o.arena.sponsor, years: o.arena.sponsor.years - 1 } : undefined;
      const log = gm && gm.years <= 0 ? addLog(o, league, 'gm_fired', `${gm.name}'s contract ran out: extend him or hire someone new.`) : o.log;
      next = { ...next, owner: { ...o, cash: o.cash + profit, fans, gm, seasons: [...o.seasons, season], arena: { ...o.arena, sponsor }, log } };
    }
  }
  // The league office: a fresh agenda, maybe an expansion bid, maybe a move.
  const office: LeagueOffice = office0 ?? newOffice(league);
  const season = league.season ?? '';
  const rng = new RNG(hash(`${season}|office`));
  const cities = openCities(next);
  const bids = cities.length && league.teams.length < 36 && rng.chance(0.4)
    ? [{ id: `bid-${season}`, city: cities.sort((a, b) => cityMarket(b.name) - cityMarket(a.name))[rng.nextInt(Math.min(6, cities.length))].name, nickname: NICKNAMES[rng.nextInt(NICKNAMES.length)], fee: Math.round((1.5 + rng.next() * 1.5) * 1000) * M }]
    : [];
  const events = [...office.events];
  // A small-market AI team that can't fill its building may leave town.
  if (cities.length && rng.chance(0.2)) {
    const candidates = teamSeasons.filter(r => r.teamId !== o?.teamId && r.wins / Math.max(1, r.wins + r.losses) < 0.4)
      .map(r => ({ r, team: next.teams.find(t => t.teamId === r.teamId)! })).filter(x => x.team && (x.team.marketSize ?? 50) < 45);
    const pick = candidates[rng.nextInt(Math.max(1, candidates.length))];
    if (pick) {
      const city = cities.sort((a, b) => cityMarket(b.name) - cityMarket(a.name))[rng.nextInt(Math.min(5, cities.length))];
      const oldName = pick.team.name, oldCity = splitTeamName(oldName).city || oldName;
      next = moveTeam(next, pick.team.teamId, city.name);
      const newName = next.teams.find(t => t.teamId === pick.team.teamId)!.name;
      events.push({ season, kind: 'relocation', teamId: pick.team.teamId, text: `The ${oldName} leave ${oldCity} for ${city.name}: they are now the ${newName}.` });
      events.push({ season, kind: 'protest', teamId: pick.team.teamId, text: `Thousands march in ${oldCity}: "Keep our team!" The owners approved the move anyway.` });
      const rival = o && Object.keys(league.rivalries ?? {}).some(k => k.split('|').includes(o.teamId) && k.split('|').includes(pick.team.teamId));
      if (rival) events.push({ season, kind: 'rival', teamId: pick.team.teamId, text: `An old rival returns under a new name: your rivalry with the ${oldName} carries on against the ${newName}.` });
    }
  }
  return { ...next, leagueOffice: { season, proposals: pickProposals(next, season), bids, votes: office.votes.slice(-40), events: events.slice(-60) } };
}

/** Expansion after an approved bid: the new team drafts from the others and joins the smaller conference. */
export async function expandLeague(league: League, extras: GMLeagueExtras, bid: ExpansionBid, seed: number): Promise<{ league: League; extras: GMLeagueExtras }> {
  const { runExpansionDraft } = await import('./expansionDraft');
  const name = `${bid.city} ${bid.nickname}`;
  const r = runExpansionDraft(league, extras, name, 13, 8, seed);
  const newId = r.league.teams[r.league.teams.length - 1].teamId;
  const east = r.league.teams.filter(t => t.conferenceId === 'east').length, west = r.league.teams.filter(t => t.conferenceId === 'west').length;
  const conferenceId = east <= west ? 'east' as const : 'west' as const;
  const division = r.league.teams.find(t => t.conferenceId === conferenceId && t.divisionId)?.divisionId;
  const teams = r.league.teams.map(t => t.teamId === newId ? { ...t, conferenceId, ...(division ? { divisionId: division } : {}), marketSize: cityMarket(bid.city) } : t);
  return { league: ensureFrontOffice({ ...r.league, teams }, league.frontOffice?.teamId ?? null), extras: r.extras };
}

// ---------------------------------------------------------------- legacy

export interface OwnerLegacy { score: number; titles: number; finals: number; playoffs: number; winning: number; profit: number; seasons: number }
/** Titles count most, then deep runs, playoff trips, winning seasons, money made and the arena you built. */
export function ownerLegacy(o: OwnerState): OwnerLegacy {
  const titles = o.seasons.filter(s => s.finish === 'Champion').length;
  const finals = o.seasons.filter(s => s.finish === 'Finals').length;
  const playoffs = o.seasons.filter(s => s.finish !== 'Missed Playoffs').length;
  const winning = o.seasons.filter(s => s.wins > s.losses).length;
  const profit = o.seasons.reduce((n, s) => n + s.profit, 0);
  const score = Math.max(0, Math.round(titles * 30 + finals * 12 + playoffs * 4 + winning * 2 + Math.max(-20, profit / (25 * M)) + (o.arena.builtSeason ? 10 : 0) + o.seasons.length));
  return { score, titles, finals, playoffs, winning, profit, seasons: o.seasons.length };
}
export const OWNER_HOF = 60;

export interface OwnerRecord { key: string; teamName: string; since: string; seasons: number; titles: number; legacy: number; updated: string }
const RECORDS_KEY = 'cv-owner-records';
export function loadOwnerRecords(): OwnerRecord[] {
  try { return JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '[]') as OwnerRecord[]; } catch { return []; }
}
/** Keeps your best legacy per ownership (league save + team), for the Owner Hall of Fame and the Trophy Road. */
export function recordOwnerLegacy(saveKey: string, league: League): OwnerRecord[] {
  const o = league.owner, team = ownerTeam(league);
  const all = loadOwnerRecords();
  if (!o || !team || !o.seasons.length) return all;
  const l = ownerLegacy(o);
  const key = `${saveKey}|${o.teamId}|${o.since}`;
  const rec: OwnerRecord = { key, teamName: team.name, since: o.since, seasons: l.seasons, titles: l.titles, legacy: l.score, updated: league.season ?? '' };
  const prev = all.find(r => r.key === key);
  if (prev && prev.legacy === rec.legacy && prev.seasons === rec.seasons && prev.teamName === rec.teamName) return all;
  const next = [...all.filter(r => r.key !== key), rec].sort((a, b) => b.legacy - a.legacy).slice(0, 50);
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return next;
}
/** Your best owner legacy anywhere (for cosmetics and the Trophy Road). */
export const bestOwnerLegacy = (records = loadOwnerRecords()) => records.reduce((m, r) => Math.max(m, r.legacy), 0);

function addLog(o: OwnerState, league: League, kind: OwnerLogKind, text: string): OwnerLogEntry[] {
  return [...o.log, { season: league.season ?? '', kind, text }].slice(-80);
}

/** The standings row for your team (for the header). */
export const ownerStanding = (league: League) => league.owner ? computeStandings(league).find(r => r.teamId === league.owner!.teamId) ?? null : null;
