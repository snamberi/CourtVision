import type { League, LeagueTeam, PlayoffFinish, TeamSeasonSummary } from './league';
import { computeConferenceStandings, computeStandings } from './league';
import type { GMLeagueExtras } from './gm';
import { teamPayroll } from './gm';
import type { SeasonAwards } from './awards';
import { computeTeamFinances } from './finances';
import { calculateOverall } from './engine/overall';
import { isUnanimous } from './almanac';
import type { TrophyKey } from './trophies';

/* The front office: every team has an owner who sets seasonal goals, and the GM (you) has a job-security meter
 * the owner reviews each offseason. A bad enough review gets you fired; you then take another team's offer or
 * watch as a spectator. AI GMs face the same heat, so openings appear around the league.
 * Everything lives in `league.frontOffice`, an optional additive field: older saves gain it on load. The owner
 * only reads results — nothing here changes how games are simulated. */

export type OwnerStyle = 'win_now' | 'patient' | 'money';
export interface OwnerProfile { name: string; style: OwnerStyle }

export type GoalKind = 'wins' | 'improve' | 'playoffs' | 'series' | 'finals' | 'title' | 'develop' | 'profit' | 'under_tax';
export interface OwnerGoal {
  id: string; kind: GoalKind; label: string;
  /** Wins for wins/improve, young players for develop; unused otherwise. */
  target: number;
  /** Overall a young player must reach (develop). */
  threshold?: number;
  /** How much the owner cares: 3 = the main goal. */
  weight: number;
}
export interface GoalOutcome extends OwnerGoal { met: boolean; value: string }

export type ReviewOutcome = 'extended' | 'retained' | 'warned' | 'fired';
export interface OwnerReview {
  season: string; teamId: string; teamName: string; wins: number; losses: number; finish: PlayoffFinish;
  goals: GoalOutcome[]; securityBefore: number; securityAfter: number; outcome: ReviewOutcome; note: string;
}
export interface JobOffer { teamId: string; teamName: string; ownerName: string; ownerStyle: OwnerStyle; pitch: string }
export type FrontOfficeEventKind = 'hired' | 'fired' | 'extended' | 'warned' | 'ai_fired' | 'resigned';
export interface FrontOfficeEvent { season: string; kind: FrontOfficeEventKind; teamId: string; teamName: string; headline: string; detail?: string; order: number }
export interface AchievementUnlock { season: string; teamName?: string }

export interface FrontOfficeState {
  version: 1;
  owners: Record<string, OwnerProfile>;
  /** The team you run; null while unemployed or spectating. */
  teamId: string | null;
  status: 'employed' | 'unemployed' | 'spectator';
  security: number;
  /** Completed seasons with the current team. */
  seasonsWithTeam: number;
  /** On the hot seat after last review. */
  warned: boolean;
  goalsSeason?: string;
  goals: OwnerGoal[];
  offers: JobOffer[];
  reviews: OwnerReview[];
  achievements: Record<string, AchievementUnlock>;
  /** Players you drafted, for "draft a future MVP". */
  draftees: string[];
  events: FrontOfficeEvent[];
  /** AI general managers' job security, by team. */
  aiSecurity: Record<string, number>;
  firingEnabled: boolean;
}

export const OWNER_STYLE_LABEL: Record<OwnerStyle, string> = { win_now: 'Win-Now', patient: 'Patient Builder', money: 'Money-First' };
export const OWNER_STYLE_BLURB: Record<OwnerStyle, string> = {
  win_now: 'Wants banners now. Results swing your job security hardest.',
  patient: 'Trusts a plan. Bad seasons hurt less; development goals matter.',
  money: 'Watches the books. Losing money costs you as much as losing games.',
};

const START_SECURITY = 60;
const NEW_JOB_SECURITY = 62;
const MAX_EVENTS = 80;

function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

const OWNER_FIRST = ['Victor', 'Margaret', 'Harlan', 'Celeste', 'Desmond', 'Ingrid', 'Warren', 'Beatrice', 'Leland', 'Rosalind', 'Thaddeus', 'Vivian', 'Conrad', 'Delphine', 'Augustus', 'Priya', 'Marcus', 'Eleanor', 'Rafael', 'Josephine'];
const OWNER_LAST = ['Castellane', 'Whitmore', 'Ashford', 'Delacroix', 'Pembroke', 'Vance', 'Holloway', 'Kingsley', 'Marchetti', 'Okafor', 'Sterling', 'Blackwood', 'Fairbanks', 'Montgomery', 'Nakamura', 'Rourke', 'Galloway', 'Thorne', 'Beaumont', 'Calloway'];
const STYLES: OwnerStyle[] = ['win_now', 'patient', 'money'];

/** A deterministic owner for a team. `taken` keeps names unique within a league (400 combinations). */
export function makeOwner(teamId: string, taken: Set<string> = new Set()): OwnerProfile {
  const h = hash(`owner:${teamId}`);
  let first = h % OWNER_FIRST.length, last = (h >>> 8) % OWNER_LAST.length;
  for (let i = 0; i < OWNER_FIRST.length * OWNER_LAST.length && taken.has(`${OWNER_FIRST[first]} ${OWNER_LAST[last]}`); i++) {
    last = (last + 1) % OWNER_LAST.length;
    if (i % OWNER_LAST.length === OWNER_LAST.length - 1) first = (first + 1) % OWNER_FIRST.length;
  }
  return { name: `${OWNER_FIRST[first]} ${OWNER_LAST[last]}`, style: STYLES[(h >>> 16) % STYLES.length] };
}

const teamName = (league: League, id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;

/** Rotation strength: the average Overall of a team's best eight players. */
export function rotationStrength(team: LeagueTeam): number {
  const top = team.seasons.map(calculateOverall).sort((a, b) => b - a).slice(0, 8);
  return top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0;
}
/** 1 = the strongest roster in the league. */
export function strengthRank(league: League, teamId: string): number {
  const sorted = league.teams.map(t => ({ id: t.teamId, s: rotationStrength(t) })).sort((a, b) => b.s - a.s);
  return sorted.findIndex(t => t.id === teamId) + 1;
}
function gamesPerTeam(league: League): number {
  const scheduled = league.teams[0] ? league.schedule.filter(g => g.homeTeamId === league.teams[0].teamId || g.awayTeamId === league.teams[0].teamId).length : 0;
  return scheduled || league.settings.gamesPerSeason || 82;
}

/** Creates the front office for a league that has none, or repairs a partial one. Idempotent. */
export function ensureFrontOffice(league: League, userTeamId: string | null): League {
  const existing = league.frontOffice;
  const owners = { ...(existing?.owners ?? {}) };
  let changed = !existing;
  const taken = new Set(Object.values(owners).map(o => o.name));
  for (const t of league.teams) if (!owners[t.teamId]) { owners[t.teamId] = makeOwner(t.teamId, taken); taken.add(owners[t.teamId].name); changed = true; }
  let state: FrontOfficeState = existing ? { ...existing, owners } : {
    version: 1, owners, teamId: userTeamId, status: userTeamId ? 'employed' : 'spectator', security: START_SECURITY, seasonsWithTeam: 0,
    warned: false, goals: [], offers: [], reviews: [], achievements: {}, draftees: [], events: [], aiSecurity: {}, firingEnabled: true,
  };
  // The controlled team changed outside the front office (an older save, or a team switch in settings): follow it.
  if (existing && state.status === 'employed' && userTeamId && state.teamId !== userTeamId) {
    state = { ...state, teamId: userTeamId, security: NEW_JOB_SECURITY, seasonsWithTeam: 0, warned: false, goals: [], goalsSeason: undefined };
    changed = true;
  }
  const withState = changed ? { ...league, frontOffice: state } : league;
  return ensureSeasonGoals(withState);
}

/** Goals are set for the season being played. During the offseason the last review stands until the new season starts. */
export function ensureSeasonGoals(league: League, extras?: GMLeagueExtras): League {
  const fo = league.frontOffice;
  if (!fo || fo.status !== 'employed' || !fo.teamId || !league.season) return league;
  const phase = league.seasonPhase ?? 'regular_season';
  if (phase !== 'regular_season' && phase !== 'playoffs' && phase !== 'awards_recap') return league;
  if (fo.goalsSeason === league.season && fo.goals.length) return league;
  return { ...league, frontOffice: { ...fo, goalsSeason: league.season, goals: generateGoals(league, fo.teamId, extras) } };
}

function lastSeasonRow(league: League, teamId: string): TeamSeasonSummary | undefined {
  return league.franchiseHistory?.at(-1)?.teamSeasons?.find(r => r.teamId === teamId);
}
function youngCount(team: LeagueTeam | undefined, threshold: number): number {
  return team ? team.seasons.filter(p => p.age <= 24 && calculateOverall(p) >= threshold).length : 0;
}

/** Two or three goals from the roster's strength and the owner's personality. Deterministic per season. */
export function generateGoals(league: League, teamId: string, extras?: GMLeagueExtras): OwnerGoal[] {
  const n = Math.max(1, league.teams.length);
  const rank = strengthRank(league, teamId);
  const owner = league.frontOffice?.owners[teamId] ?? makeOwner(teamId);
  const games = gamesPerTeam(league);
  const winsAt = (pct: number) => Math.round(games * pct);
  const tier = rank <= Math.ceil(n * 0.17) ? 'contender' : rank <= Math.ceil(n * 0.45) ? 'playoff' : rank <= Math.ceil(n * 0.7) ? 'fringe' : 'rebuild';
  const last = lastSeasonRow(league, teamId);
  const goals: OwnerGoal[] = [];
  const add = (g: Omit<OwnerGoal, 'id'>) => goals.push({ ...g, id: `${league.season}:${g.kind}` });
  if (tier === 'contender') {
    add(owner.style === 'win_now' ? { kind: 'title', label: 'Win the championship', target: 0, weight: 3 } : { kind: 'finals', label: 'Reach the Finals', target: 0, weight: 3 });
    add({ kind: 'wins', label: `Win ${winsAt(0.63)} games`, target: winsAt(0.63), weight: 2 });
  } else if (tier === 'playoff') {
    add(owner.style === 'win_now' ? { kind: 'series', label: 'Win a playoff series', target: 0, weight: 3 } : { kind: 'playoffs', label: 'Make the playoffs', target: 0, weight: 3 });
    add({ kind: 'wins', label: `Win ${winsAt(0.54)} games`, target: winsAt(0.54), weight: 2 });
  } else if (tier === 'fringe') {
    add({ kind: 'playoffs', label: 'Make the playoffs', target: 0, weight: 3 });
    if (last) add({ kind: 'improve', label: `Beat last season's ${last.wins} wins by 5`, target: last.wins + 5, weight: 2 });
    else add({ kind: 'wins', label: `Win ${winsAt(0.46)} games`, target: winsAt(0.46), weight: 2 });
  } else {
    const team = league.teams.find(t => t.teamId === teamId);
    const threshold = 68;
    const target = Math.min(3, youngCount(team, threshold) + 1);
    add({ kind: 'develop', label: `Have ${target} player${target === 1 ? '' : 's'} aged 24 or under at ${threshold}+ Overall`, target, threshold, weight: owner.style === 'patient' ? 3 : 2 });
    if (last) add({ kind: 'improve', label: `Beat last season's ${last.wins} wins by 5`, target: last.wins + 5, weight: 2 });
    else add({ kind: 'wins', label: `Win ${winsAt(0.33)} games`, target: winsAt(0.33), weight: 2 });
  }
  if (owner.style === 'money') {
    const team = league.teams.find(t => t.teamId === teamId);
    const overTax = extras && team ? teamPayroll(extras.contracts, team) > extras.capSettings.luxuryTaxLine : false;
    add(overTax ? { kind: 'under_tax', label: 'Get under the luxury tax', target: 0, weight: 2 } : { kind: 'profit', label: 'Turn a profit', target: 0, weight: 2 });
  } else if (owner.style === 'patient' && !goals.some(g => g.kind === 'develop')) {
    const team = league.teams.find(t => t.teamId === teamId);
    const target = Math.min(3, youngCount(team, 65) + 1);
    add({ kind: 'develop', label: `Have ${target} player${target === 1 ? '' : 's'} aged 24 or under at 65+ Overall`, target, threshold: 65, weight: 1 });
  }
  return goals.slice(0, 3);
}

// ---- Live progress ----

export type GoalStatus = 'met' | 'on_track' | 'at_risk' | 'off_track' | 'missed';
export interface GoalProgress { status: GoalStatus; text: string; /** 0–1 for a progress bar. */ ratio: number }

const FINISH_ORDER: PlayoffFinish[] = ['Missed Playoffs', 'Play-In', 'First Round', 'Playoffs', 'Second Round', 'Conference Finals', 'Finals', 'Champion'];
const finishAtLeast = (f: PlayoffFinish, min: PlayoffFinish) => FINISH_ORDER.indexOf(f) >= FINISH_ORDER.indexOf(min);
const GOAL_FINISH: Partial<Record<GoalKind, PlayoffFinish>> = { playoffs: 'First Round', series: 'Second Round', finals: 'Finals', title: 'Champion' };

/** Where the team stands in its conference (or the league), 1-based. */
function seedOf(league: League, teamId: string): { seed: number; size: number } {
  const team = league.teams.find(t => t.teamId === teamId);
  const conf = computeConferenceStandings(league);
  const rows = team?.conferenceId === 'east' ? conf.east : team?.conferenceId === 'west' ? conf.west : computeStandings(league);
  const list = rows.length ? rows : computeStandings(league);
  return { seed: list.findIndex(r => r.teamId === teamId) + 1, size: list.length };
}

/** How far the team has gone in the current bracket, when there is one. */
function bracketFinish(league: League, teamId: string): { finish: PlayoffFinish; alive: boolean } | null {
  const b = league.playoffBracket;
  if (!b) return null;
  let reached = -1; let alive = false;
  b.rounds.forEach((round, r) => round.forEach(s => {
    if (s.teamAId !== teamId && s.teamBId !== teamId) return;
    reached = Math.max(reached, r);
    if (!s.winnerTeamId) alive = true;
    else if (s.winnerTeamId === teamId && r === b.rounds.length - 1) reached = b.rounds.length;
  }));
  if (reached < 0) {
    // Still fighting in the play-in: a pending game, or a win that hasn't been placed into the first round yet.
    const inPlayIn = (b.playIn ?? []).filter(g => g.teamAId === teamId || g.teamBId === teamId);
    const final = (b.playIn ?? []).find(g => g.kind === 'final' && g.conference === inPlayIn[0]?.conference);
    const intoFinal = inPlayIn.some(g => (g.kind === '7v8' && g.loserTeamId === teamId) || (g.kind === '9v10' && g.winnerTeamId === teamId));
    const stillAlive = inPlayIn.some(g => !g.winnerTeamId) || (intoFinal && !final?.winnerTeamId);
    return { finish: inPlayIn.length ? 'Play-In' : 'Missed Playoffs', alive: stillAlive };
  }
  const labels: PlayoffFinish[] = ['First Round', 'Second Round', 'Conference Finals', 'Finals', 'Champion'];
  const fromEnd = b.rounds.length - reached; // 0 = champion
  const finish = fromEnd <= 0 ? 'Champion' : labels[Math.max(0, labels.length - 1 - fromEnd)];
  return { finish, alive };
}

export function goalProgress(league: League, extras: GMLeagueExtras, teamId: string, goal: OwnerGoal): GoalProgress {
  const standing = computeStandings(league).find(r => r.teamId === teamId);
  const wins = standing?.wins ?? 0, played = (standing?.wins ?? 0) + (standing?.losses ?? 0);
  const games = gamesPerTeam(league);
  const team = league.teams.find(t => t.teamId === teamId);
  switch (goal.kind) {
    case 'wins': case 'improve': {
      const pace = played ? Math.round(wins / played * games) : 0;
      const remaining = games - played;
      const status: GoalStatus = wins >= goal.target ? 'met' : wins + remaining < goal.target ? 'missed' : !played ? 'on_track' : pace >= goal.target ? 'on_track' : pace >= goal.target - 4 ? 'at_risk' : 'off_track';
      return { status, ratio: Math.min(1, wins / Math.max(1, goal.target)), text: `${wins} wins${played && played < games ? ` · on pace for ${pace}` : ''}` };
    }
    case 'develop': {
      const count = youngCount(team, goal.threshold ?? 68);
      return { status: count >= goal.target ? 'met' : 'at_risk', ratio: Math.min(1, count / Math.max(1, goal.target)), text: `${count} of ${goal.target} so far` };
    }
    case 'profit': case 'under_tax': {
      if (!team) return { status: 'at_risk', ratio: 0, text: '' };
      const fin = computeTeamFinances(team, extras.contracts, extras.capSettings, league.rulesSettings, played ? wins / played : 0.5);
      if (goal.kind === 'profit') return { status: fin.operatingIncome >= 0 ? 'on_track' : 'off_track', ratio: fin.operatingIncome >= 0 ? 1 : 0.3, text: `Projected ${fin.operatingIncome >= 0 ? 'profit' : 'loss'}: $${(Math.abs(fin.operatingIncome) / 1e6).toFixed(1)}M` };
      const over = fin.payroll - extras.capSettings.luxuryTaxLine;
      return { status: over <= 0 ? 'on_track' : 'off_track', ratio: over <= 0 ? 1 : 0.3, text: over <= 0 ? `$${(-over / 1e6).toFixed(1)}M under the tax` : `$${(over / 1e6).toFixed(1)}M over the tax` };
    }
    default: {
      const need = GOAL_FINISH[goal.kind]!;
      const br = bracketFinish(league, teamId);
      if (br) {
        if (finishAtLeast(br.finish, need)) return { status: 'met', ratio: 1, text: br.finish === 'Champion' ? 'Champions!' : `Reached: ${br.finish}` };
        return br.alive ? { status: 'at_risk', ratio: 0.6, text: `Alive: ${br.finish}` } : { status: 'missed', ratio: 0, text: br.finish === 'Missed Playoffs' ? 'Missed the playoffs' : `Out in the ${br.finish}` };
      }
      const { seed, size } = seedOf(league, teamId);
      const cut = size >= 10 ? 6 : Math.min(8, Math.ceil(size / 2));
      const status: GoalStatus = !played ? 'on_track' : seed <= Math.max(1, cut - (goal.kind === 'playoffs' ? 0 : goal.kind === 'series' ? 3 : 5)) ? 'on_track' : seed <= cut + 4 ? 'at_risk' : 'off_track';
      return { status, ratio: played ? clamp((size - seed + 1) / size, 0, 1) : 0, text: played ? `Seed ${seed} of ${size}` : 'Season not started' };
    }
  }
}

/** The meter the dashboard shows mid-season: last review's security nudged by how the goals are trending. */
export function projectedSecurity(league: League, extras: GMLeagueExtras): number {
  const fo = league.frontOffice;
  if (!fo?.teamId || !fo.goals.length) return fo?.security ?? START_SECURITY;
  const row = computeStandings(league).find(r => r.teamId === fo.teamId);
  if (!row || row.wins + row.losses === 0) return fo.security; // nothing to judge yet
  const score = fo.goals.reduce((s, g) => {
    const st = goalProgress(league, extras, fo.teamId!, g).status;
    return s + g.weight * (st === 'met' ? 1 : st === 'on_track' ? 0.6 : st === 'at_risk' ? -0.2 : -1);
  }, 0) / fo.goals.reduce((s, g) => s + g.weight, 0);
  return Math.round(clamp(fo.security + score * 14));
}

export function securityLabel(security: number): { label: string; tone: 'good' | 'ok' | 'warn' | 'danger' } {
  if (security >= 75) return { label: 'Untouchable', tone: 'good' };
  if (security >= 55) return { label: 'Secure', tone: 'ok' };
  if (security >= 40) return { label: 'Hot seat', tone: 'warn' };
  return { label: 'On the brink', tone: 'danger' };
}

// ---- The offseason review ----

export interface ReviewContext {
  /** The league as the season ended (before aging and retirements). */
  league: League;
  extras: GMLeagueExtras;
  teamSeasons: TeamSeasonSummary[];
  awards: SeasonAwards;
  season: string;
  /** The label of the season that starts next. */
  nextSeason: string;
  championTeamId: string | null;
  fmvpId?: string | null;
}

const FINISH_BONUS: Record<PlayoffFinish, number> = { Champion: 20, Finals: 10, 'Conference Finals': 6, 'Second Round': 3, 'First Round': 1, Playoffs: 1, 'Play-In': -3, 'Missed Playoffs': -6 };

function goalMet(goal: OwnerGoal, row: TeamSeasonSummary, ctx: ReviewContext, teamId: string): GoalOutcome {
  const team = ctx.league.teams.find(t => t.teamId === teamId);
  switch (goal.kind) {
    case 'wins': case 'improve': return { ...goal, met: row.wins >= goal.target, value: `${row.wins} wins` };
    case 'develop': { const c = youngCount(team, goal.threshold ?? 68); return { ...goal, met: c >= goal.target, value: `${c} of ${goal.target}` }; }
    case 'profit': case 'under_tax': {
      if (!team) return { ...goal, met: false, value: '—' };
      const fin = computeTeamFinances(team, ctx.extras.contracts, ctx.extras.capSettings, ctx.league.rulesSettings, row.wins / Math.max(1, row.wins + row.losses));
      if (goal.kind === 'profit') return { ...goal, met: fin.operatingIncome >= 0, value: `${fin.operatingIncome >= 0 ? '+' : '−'}$${(Math.abs(fin.operatingIncome) / 1e6).toFixed(1)}M` };
      return { ...goal, met: fin.payroll <= ctx.extras.capSettings.luxuryTaxLine, value: `Payroll $${(fin.payroll / 1e6).toFixed(1)}M` };
    }
    default: return { ...goal, met: finishAtLeast(row.playoffFinish, GOAL_FINISH[goal.kind]!), value: row.playoffFinish };
  }
}

export interface ReviewResult { state: FrontOfficeState; review: OwnerReview | null; newAchievements: string[] }

/** Runs at the end of each season (inside the offseason transition). Pure: returns the next front-office state. */
export function reviewSeason(ctx: ReviewContext): ReviewResult | null {
  const base = ctx.league.frontOffice;
  if (!base) return null;
  let state: FrontOfficeState = reopenJobMarket({ ...base, events: [...base.events] });
  const sandbox = ctx.league.settings.sandboxMode === true;
  const addEvent = (e: Omit<FrontOfficeEvent, 'order' | 'season'>) => state.events.push({ ...e, season: ctx.season, order: state.events.length });

  // AI general managers: a season well below what the roster should do costs them; two in a row can end it.
  const byWins = [...ctx.teamSeasons].sort((a, b) => b.wins - a.wins).map(r => r.teamId);
  const aiSecurity = { ...state.aiSecurity };
  const openings: string[] = [];
  for (const row of ctx.teamSeasons) {
    if (row.teamId === state.teamId) continue;
    const expected = strengthRank(ctx.league, row.teamId);
    const actual = byWins.indexOf(row.teamId) + 1;
    const before = aiSecurity[row.teamId] ?? START_SECURITY;
    const after = clamp(before + (expected - actual) * 1.5 + FINISH_BONUS[row.playoffFinish] + (START_SECURITY - before) * 0.1);
    aiSecurity[row.teamId] = Math.round(after);
    if (after < 28 && row.playoffFinish !== 'Champion' && openings.length < 3) {
      openings.push(row.teamId);
      aiSecurity[row.teamId] = START_SECURITY;
      addEvent({ kind: 'ai_fired', teamId: row.teamId, teamName: row.teamName, headline: `${row.teamName} part ways with their general manager.`,
        detail: `After a ${row.wins}–${row.losses} season, ownership decided it was time for a new voice in the front office.` });
    }
  }
  state.aiSecurity = aiSecurity;

  let review: OwnerReview | null = null;
  const unlocked: string[] = [];
  const row = state.teamId ? ctx.teamSeasons.find(r => r.teamId === state.teamId) : undefined;
  if (state.status === 'employed' && state.teamId && row) {
    const owner = state.owners[state.teamId] ?? makeOwner(state.teamId);
    const goals = (state.goalsSeason === ctx.season && state.goals.length ? state.goals : generateGoals(ctx.league, state.teamId, ctx.extras)).map(g => goalMet(g, row, ctx, state.teamId!));
    const totalWeight = goals.reduce((s, g) => s + g.weight, 0) || 1;
    const goalScore = goals.reduce((s, g) => s + (g.met ? g.weight : -g.weight), 0) / totalWeight;
    let results = FINISH_BONUS[row.playoffFinish];
    const team = ctx.league.teams.find(t => t.teamId === state.teamId);
    const fin = team ? computeTeamFinances(team, ctx.extras.contracts, ctx.extras.capSettings, ctx.league.rulesSettings, row.wins / Math.max(1, row.wins + row.losses)) : null;
    let money = fin ? ({ Thriving: 3, Stable: 0, Strained: -3, Crisis: -8 } as const)[fin.financialHealth] : 0;
    if (owner.style === 'win_now') results *= 1.3;
    if (owner.style === 'money') money *= 2;
    let delta = goalScore * 18 + results + money;
    if (delta < 0 && owner.style === 'patient') delta *= 0.7;
    if (delta < 0 && state.seasonsWithTeam === 0) delta *= 0.5; // a new GM gets a honeymoon
    const before = state.security;
    const after = Math.round(clamp(before + delta + (55 - before) * 0.08));
    const canFire = state.firingEnabled && !sandbox && state.seasonsWithTeam >= 1 && row.playoffFinish !== 'Champion';
    const outcome: ReviewOutcome = canFire && (after < 25 || (state.warned && after < 40)) ? 'fired'
      : after < 45 ? 'warned' : after >= 75 ? 'extended' : 'retained';
    const met = goals.filter(g => g.met).length;
    const note = outcome === 'fired' ? `${owner.name} has seen enough. "We need new direction in the front office."`
      : outcome === 'warned' ? `${owner.name} is losing patience. "Next season has to be different."`
      : outcome === 'extended' ? `${owner.name} is thrilled and extends your contract. "This is the GM we wanted."`
      : `${owner.name} is satisfied. ${met} of ${goals.length} goals met.`;
    review = { season: ctx.season, teamId: state.teamId, teamName: row.teamName, wins: row.wins, losses: row.losses, finish: row.playoffFinish, goals, securityBefore: before, securityAfter: after, outcome, note };
    state = { ...state, security: after, seasonsWithTeam: state.seasonsWithTeam + 1, warned: outcome === 'warned', reviews: [...state.reviews, review], goals: [], goalsSeason: undefined };
    const draftees = (ctx.extras.draftPicksMade ?? []).filter(p => p.teamId === review!.teamId).map(p => p.playerId);
    state.draftees = [...new Set([...state.draftees, ...draftees])];
    unlocked.push(...seasonAchievements(state, ctx, review, fin?.financialHealth ?? null));
    if (outcome === 'fired') {
      addEvent({ kind: 'fired', teamId: review.teamId, teamName: review.teamName, headline: `${review.teamName} fire their general manager — you.`, detail: note });
      state = { ...state, status: 'unemployed', teamId: null, warned: false };
      unlocked.push('pink_slip');
    } else if (outcome === 'extended') addEvent({ kind: 'extended', teamId: review.teamId, teamName: review.teamName, headline: `${review.teamName} extend their general manager.`, detail: note });
    else if (outcome === 'warned') addEvent({ kind: 'warned', teamId: review.teamId, teamName: review.teamName, headline: `Hot seat: ${review.teamName}'s GM is under pressure.`, detail: note });
  }

  // Unemployed GMs (fired now or earlier) get offers from teams with openings; the worst teams fill any gap.
  if (state.status === 'unemployed') {
    const firedFrom = review?.outcome === 'fired' ? review.teamId : null;
    const worst = [...ctx.teamSeasons].sort((a, b) => a.wins - b.wins).map(r => r.teamId);
    const pool = [...new Set([...openings, ...worst])].filter(id => id !== firedFrom).slice(0, 3);
    state.offers = pool.map(id => {
      const owner = state.owners[id] ?? makeOwner(id);
      const r = ctx.teamSeasons.find(t => t.teamId === id);
      return { teamId: id, teamName: teamName(ctx.league, id), ownerName: owner.name, ownerStyle: owner.style,
        pitch: openings.includes(id) ? `Just let their GM go after ${r ? `a ${r.wins}–${r.losses} season` : 'a tough season'}.` : `Looking for a fresh start${r ? ` after going ${r.wins}–${r.losses}` : ''}.` };
    });
  }

  for (const id of unlocked) if (!state.achievements[id]) state.achievements = { ...state.achievements, [id]: { season: ctx.season, teamName: review?.teamName } };
  const newAchievements = unlocked.filter(id => !base.achievements[id]);
  state.events = state.events.slice(-MAX_EVENTS);
  return { state, review, newAchievements: [...new Set(newAchievements)] };
}

/** Take a job offer: new team, fresh security and a honeymoon season. */
export function acceptJobOffer(league: League, teamId: string): League {
  const fo = league.frontOffice;
  if (!fo) return league;
  const name = teamName(league, teamId);
  const firstJob = !fo.reviews.length;
  const changedTeams = fo.reviews.some(r => r.teamId !== teamId);
  const events = [...fo.events, { season: league.season ?? '', kind: 'hired' as const, teamId, teamName: name, headline: `${name} hire a new general manager — you.`,
    detail: `${fo.owners[teamId]?.name ?? 'Ownership'} hands you the keys.`, order: fo.events.length }].slice(-MAX_EVENTS);
  const achievements = { ...fo.achievements };
  if (!firstJob && changedTeams && !achievements.second_chance) achievements.second_chance = { season: league.season ?? '', teamName: name };
  // Mid-season (Auto Play opens the next schedule before you choose), the new owner's goals are set right away.
  return ensureSeasonGoals({ ...league, coachingUserTeamId: teamId, frontOffice: { ...fo, status: 'employed', teamId, security: NEW_JOB_SECURITY, seasonsWithTeam: 0, warned: false, offers: [], goals: [], goalsSeason: undefined, events, achievements } });
}

/** Decline every offer and keep watching the league. Offers return next offseason. */
export function becomeSpectator(league: League): League {
  const fo = league.frontOffice;
  if (!fo) return league;
  return { ...league, coachingUserTeamId: null, frontOffice: { ...fo, status: 'spectator', teamId: null, offers: [] } };
}

/** A spectator who once had a job can re-enter the market when offers arrive; a pure spectator league is left alone. */
export function reopenJobMarket(state: FrontOfficeState): FrontOfficeState {
  return state.status === 'spectator' && state.reviews.length > 0 ? { ...state, status: 'unemployed' } : state;
}

// ---- Achievements ----

export interface AchievementDef { id: string; name: string; description: string; icon: TrophyKey; secret?: boolean }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_season', name: 'Welcome to the Office', description: 'Complete your first season as general manager.', icon: 'eoy' },
  { id: 'playoffs', name: 'Postseason Bound', description: 'Make the playoffs.', icon: 'allStar' },
  { id: 'series_win', name: 'Moving On', description: 'Win a playoff series.', icon: 'allLeague3' },
  { id: 'finals', name: 'Conference Kings', description: 'Reach the Finals.', icon: 'allLeague2' },
  { id: 'title', name: 'Banner Raised', description: 'Win a championship.', icon: 'champion' },
  { id: 'title_first_season', name: 'Instant Impact', description: 'Win a title in your first season with a team.', icon: 'fmvp' },
  { id: 'back_to_back', name: 'Back-to-Back', description: 'Win two championships in a row.', icon: 'champion' },
  { id: 'three_peat', name: 'Three-Peat', description: 'Win three championships in a row.', icon: 'champion' },
  { id: 'dynasty', name: 'Dynasty', description: 'Win five championships as GM.', icon: 'champion' },
  { id: 'perfect_postseason', name: 'Perfect Postseason', description: 'Win the title without losing a playoff game.', icon: 'fmvp' },
  { id: 'wins_50', name: 'Fifty-Win Club', description: 'Win 61% of your games (50 in 82).', icon: 'allLeague1' },
  { id: 'wins_60', name: 'Juggernaut', description: 'Win 73% of your games (60 in 82).', icon: 'allLeague1' },
  { id: 'wins_70', name: 'Seventy', description: 'Win 85% of your games (70 in 82).', icon: 'mvp' },
  { id: 'turnaround', name: 'Turnaround Artist', description: 'Improve by 20 or more wins in one season.', icon: 'mip' },
  { id: 'lottery_to_title', name: 'Worst to First', description: 'Win a title within three seasons of a lottery finish with the same team.', icon: 'mip' },
  { id: 'all_goals', name: "Owner's Favorite", description: "Meet every one of the owner's goals in a season.", icon: 'eoy' },
  { id: 'extended', name: 'Contract Extension', description: 'Earn an extension from your owner.', icon: 'eoy' },
  { id: 'hot_seat_survivor', name: 'Hot Seat Survivor', description: 'Get a warning, then earn an extension the next season.', icon: 'cpoy' },
  { id: 'pink_slip', name: 'Pink Slip', description: 'Get fired. It happens to the best.', icon: 'ironMan', secret: true },
  { id: 'second_chance', name: 'Second Chance', description: 'Take a job with a new team after leaving your first.', icon: 'teammate' },
  { id: 'loyal', name: 'Franchise Fixture', description: 'Complete five seasons with the same team.', icon: 'teammate' },
  { id: 'decade', name: 'Decade in the Chair', description: 'Complete ten seasons as a general manager.', icon: 'ironMan' },
  { id: 'eoy', name: 'Executive of the Year', description: 'Win Executive of the Year.', icon: 'eoy' },
  { id: 'mvp', name: 'MVP Factory', description: 'Have the league MVP on your roster.', icon: 'mvp' },
  { id: 'unanimous_mvp', name: 'Unanimous', description: 'Have a unanimous MVP on your roster.', icon: 'mvp' },
  { id: 'fmvp', name: 'Finals Hero', description: 'Have the Finals MVP on your roster.', icon: 'fmvp' },
  { id: 'dpoy', name: 'Lockdown', description: 'Have the Defensive Player of the Year on your roster.', icon: 'dpoy' },
  { id: 'roy', name: 'Future Is Now', description: 'Have the Rookie of the Year on your roster.', icon: 'roy' },
  { id: 'coy', name: 'Hire of the Year', description: 'Your head coach wins Coach of the Year.', icon: 'coy' },
  { id: 'all_stars_3', name: 'Star Power', description: 'Have three or more All-Stars in one season.', icon: 'allStar' },
  { id: 'all_league_1', name: 'First Team', description: 'Have an All-League 1st Team player.', icon: 'allLeague1' },
  { id: 'scoring_champ', name: 'Bucket Getter', description: 'Have the scoring champion on your roster.', icon: 'scoringChamp' },
  { id: 'drafted_mvp', name: 'Scout of the Century', description: 'A player you drafted wins MVP, for any team.', icon: 'roy' },
  { id: 'homegrown_star', name: 'Homegrown Star', description: 'A player you drafted reaches 80 Overall.', icon: 'mip' },
  { id: 'youth_movement', name: 'Youth Movement', description: 'Have three players aged 23 or under at 70+ Overall.', icon: 'allRookie1' },
  { id: 'money_maker', name: 'Money Maker', description: 'Finish a season with thriving finances.', icon: 'eoy' },
  { id: 'thrifty_title', name: 'Moneyball', description: 'Win the title with a payroll under the luxury tax.', icon: 'champion' },
];
export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

function seasonAchievements(state: FrontOfficeState, ctx: ReviewContext, review: OwnerReview, health: string | null): string[] {
  const out: string[] = [];
  const teamId = review.teamId;
  const games = review.wins + review.losses || 1;
  const pct = review.wins / games;
  const reviews = state.reviews; // includes this one, last
  const mine = (id: string | null | undefined) => !!id && ctx.league.teams.find(t => t.teamId === teamId)?.seasons.some(p => p.playerId === id);
  const row = ctx.teamSeasons.find(r => r.teamId === teamId)!;
  const champ = review.finish === 'Champion';
  out.push('first_season');
  if (finishAtLeast(review.finish, 'First Round')) out.push('playoffs');
  if (finishAtLeast(review.finish, 'Second Round')) out.push('series_win');
  if (finishAtLeast(review.finish, 'Finals')) out.push('finals');
  if (champ) {
    out.push('title');
    if (state.seasonsWithTeam === 1) out.push('title_first_season');
    if (row.playoffLosses === 0) out.push('perfect_postseason');
    const streak = [...reviews].reverse().findIndex(r => r.finish !== 'Champion');
    const run = streak < 0 ? reviews.length : streak;
    if (run >= 2) out.push('back_to_back');
    if (run >= 3) out.push('three_peat');
    const lottery = reviews.slice(-4, -1).some(r => r.teamId === teamId && !finishAtLeast(r.finish, 'First Round'));
    if (lottery) out.push('lottery_to_title');
    const team = ctx.league.teams.find(t => t.teamId === teamId);
    if (team && teamPayroll(ctx.extras.contracts, team) <= ctx.extras.capSettings.luxuryTaxLine) out.push('thrifty_title');
  }
  if (reviews.filter(r => r.finish === 'Champion').length >= 5) out.push('dynasty');
  if (pct >= 0.61) out.push('wins_50');
  if (pct >= 0.73) out.push('wins_60');
  if (pct >= 0.85) out.push('wins_70');
  const prev = reviews.at(-2);
  if (prev && prev.teamId === teamId && review.wins - prev.wins >= 20 * games / 82) out.push('turnaround');
  if (review.goals.length && review.goals.every(g => g.met)) out.push('all_goals');
  if (review.outcome === 'extended') { out.push('extended'); if (prev?.outcome === 'warned' && prev.teamId === teamId) out.push('hot_seat_survivor'); }
  if (state.seasonsWithTeam >= 5) out.push('loyal');
  if (reviews.length >= 10) out.push('decade');
  const a = ctx.awards;
  if (a.eoy?.teamId === teamId) out.push('eoy');
  if (mine(a.mvp?.playerId)) { out.push('mvp'); if (isUnanimous(a, 'mvp', ctx.season, a.mvp?.playerId)) out.push('unanimous_mvp'); }
  if (mine(ctx.fmvpId)) out.push('fmvp');
  if (mine(a.dpoy?.playerId)) out.push('dpoy');
  if (mine(a.roy?.playerId)) out.push('roy');
  if (a.coy?.teamId === teamId) out.push('coy');
  if (a.allStars.filter(w => mine(w.playerId)).length >= 3) out.push('all_stars_3');
  if (a.allNBA[0]?.some(w => mine(w.playerId))) out.push('all_league_1');
  if (mine(a.scoringChamp?.playerId)) out.push('scoring_champ');
  if (a.mvp && state.draftees.includes(a.mvp.playerId)) out.push('drafted_mvp');
  const everyone = [...ctx.league.teams.flatMap(t => t.seasons), ...ctx.extras.freeAgents];
  if (everyone.some(p => state.draftees.includes(p.playerId) && calculateOverall(p) >= 80)) out.push('homegrown_star');
  const team = ctx.league.teams.find(t => t.teamId === teamId);
  if (team && team.seasons.filter(p => p.age <= 23 && calculateOverall(p) >= 70).length >= 3) out.push('youth_movement');
  if (health === 'Thriving') out.push('money_maker');
  return out;
}
