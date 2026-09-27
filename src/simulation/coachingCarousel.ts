import type { League, LeagueTeam, PlayoffFinish } from './league';
import { computeStandings } from './league';
import { autoManageStaff, fireStaff, enrichCoach } from './staffManagement';
import { calculateOverall } from './engine/overall';
import { RNG } from './engine/rng';
import { stableSeed } from './coachingModel';
import { poachAssistants } from './staffPoaching';

/*
 * The coaching carousel: AI owners judge their head coach against what the roster should do, and fire the ones
 * who fall short, in the offseason and (for the worst starts) mid-season. Vacancies are filled from the coaching
 * market, so the league's benches change around you. Your own team's coach is yours to decide.
 */

export type CarouselKind = 'fired' | 'hired' | 'interim';
export interface CarouselEvent { season: string; kind: CarouselKind; teamId: string; coachId: string; detail: string; midseason?: boolean; order: number }
export interface CoachingCarouselState { events: CarouselEvent[] }

const MIDSEASON_MIN_GAMES = 25;
const MIDSEASON_MAX_FIRINGS = 3;

/** Expected win share from where a team's roster ranks: the best roster should win ~70%, the worst ~28%. */
function expectations(league: League): Map<string, number> {
  const strength = (t: LeagueTeam) => t.seasons.map(calculateOverall).sort((a, b) => b - a).slice(0, 8).reduce((n, v) => n + v, 0);
  const ranked = [...league.teams].sort((a, b) => strength(b) - strength(a));
  const n = Math.max(1, ranked.length - 1);
  return new Map(ranked.map((t, i) => [t.teamId, 0.7 - 0.42 * (i / n)]));
}

const FINISH_CREDIT: Partial<Record<PlayoffFinish, number>> = { Champion: 60, Finals: 30, 'Conference Finals': 18, 'Second Round': 8, 'First Round': 3 };

export interface HotSeat { teamId: string; coachId: string; heat: number; reason: string }

/**
 * How hot each AI head coach's seat is (0 = safe, 100 = gone), from this season's record against the roster's
 * expectation, last season's result, and tenure (a coach in his first season gets grace).
 */
/** A head coach who took this job in the given season's carousel (his first season there gets grace). */
export function newHire(league: League, teamId: string, coachId: string, season: string): boolean {
  return (league.coachingCarousel?.events ?? []).some(e => e.kind !== 'fired' && e.teamId === teamId && e.coachId === coachId && e.season === season);
}

export function hotSeats(league: League, userTeamId: string | null, lastSeason?: { teamId: string; wins: number; losses: number; playoffFinish: PlayoffFinish }[], graceSeason = league.season ?? ''): HotSeat[] {
  const expect = expectations(league);
  const standings = new Map(computeStandings(league).map(r => [r.teamId, r]));
  const out: HotSeat[] = [];
  for (const t of league.teams) {
    const coach = t.coachIdentity;
    if (!coach || t.teamId === userTeamId) continue;
    const row = lastSeason?.find(s => s.teamId === t.teamId) ?? standings.get(t.teamId);
    const games = row ? row.wins + row.losses : 0;
    if (games < 10) continue;
    const pct = row!.wins / games;
    const miss = (expect.get(t.teamId) ?? 0.5) - pct;
    let heat = 30 + miss * 220;
    const finish = lastSeason?.find(s => s.teamId === t.teamId)?.playoffFinish;
    if (finish) heat -= FINISH_CREDIT[finish] ?? 0;
    heat -= Math.min(20, coach.championships * 10);
    if (newHire(league, t.teamId, coach.coachId, graceSeason)) heat -= 25; // first season on the job: grace
    const heatClamped = Math.max(0, Math.min(100, Math.round(heat)));
    const reason = miss > 0.12 ? `${row!.wins}-${row!.losses} with a roster built to win more` : miss > 0.04 ? `${row!.wins}-${row!.losses}, short of expectations` : `${row!.wins}-${row!.losses}`;
    out.push({ teamId: t.teamId, coachId: coach.coachId, heat: heatClamped, reason });
  }
  return out.sort((a, b) => b.heat - a.heat);
}

function record(league: League, events: CarouselEvent[]): League {
  if (!events.length) return league;
  const prior = league.coachingCarousel?.events ?? [];
  // Keep a few seasons of history.
  const seasons = [...new Set([...prior, ...events].map(e => e.season))].slice(-4);
  return { ...league, coachingCarousel: { events: [...prior, ...events].filter(e => seasons.includes(e.season)) } };
}

/**
 * No AI team goes without a head coach: when nobody on the market took the job (budget, fit), the team promotes
 * its best assistant, or failing that appoints the best coach on the market.
 */
export function ensureHeadCoaches(league: League, userTeamId: string | null, season: string): League {
  let market = [...(league.staffMarket ?? [])];
  let changed = false;
  const teams = league.teams.map(t => {
    if (t.coachIdentity || t.teamId === userTeamId || t.coachingControl?.staffAuto === false) return t;
    const assistants = (['offense', 'defense', 'development'] as const).map(r => ({ role: r, coach: t.staff?.[r] })).filter(a => a.coach)
      .sort((a, b) => b.coach!.rating - a.coach!.rating);
    const pick = assistants[0];
    const source = pick?.coach ?? [...market].sort((a, b) => b.rating - a.rating)[0];
    if (!source) return t;
    changed = true;
    const staff = { ...t.staff };
    if (pick) delete staff[pick.role]; else market = market.filter(c => c.coachId !== source.coachId);
    const base = enrichCoach(source, 'head');
    const head = { ...base, hiredSeason: season, contract: { annualSalary: Math.round(source.contract.annualSalary * (pick ? 1.25 : 1)), yearsRemaining: 2 },
      profile: { ...base.profile!, history: [...base.profile!.history.map(h => h.to ? h : { ...h, to: season }), { teamId: t.teamId, role: 'head' as const, from: season }] } };
    return { ...t, staff, coachIdentity: head };
  });
  return changed ? { ...league, teams, staffMarket: market } : league;
}

/** Fills head-coach vacancies from the market and logs who went where. */
function fillVacancies(league: League, season: string, order: number, midseason: boolean, userTeamId: string | null = null, justFired: string[] = []): { league: League; events: CarouselEvent[] } {
  const before = new Map(league.teams.map(t => [t.teamId, t.coachIdentity?.coachId]));
  // Coaches fired in this round sit out the searches (nobody rehires the man they just let go); they return to the market after.
  const held = (league.staffMarket ?? []).filter(c => justFired.includes(c.coachId));
  const searching = { ...league, staffMarket: (league.staffMarket ?? []).filter(c => !justFired.includes(c.coachId)) };
  const hired = ensureHeadCoaches(autoManageStaff(searching), userTeamId, season);
  const filled = { ...hired, staffMarket: [...(hired.staffMarket ?? []), ...held] };
  const events: CarouselEvent[] = [];
  for (const t of filled.teams) {
    const coach = t.coachIdentity;
    if (!coach || before.get(t.teamId) === coach.coachId) continue;
    const p = enrichCoach(coach, 'head').profile!;
    const past = p.history.filter(h => h.role === 'head' && h.teamId !== t.teamId).length;
    events.push({ season, kind: midseason ? 'interim' : 'hired', teamId: t.teamId, coachId: coach.coachId, midseason,
      detail: `${p.offense} offense, ${p.defense} defense${coach.championships ? `, ${coach.championships} title${coach.championships === 1 ? '' : 's'}` : ''}${past ? `, ${past} previous head job${past === 1 ? '' : 's'}` : ', first head-coaching job'}. ${coach.contract.yearsRemaining}-year deal.`,
      order: order + events.length });
  }
  return { league: filled, events };
}

/**
 * Offseason: AI owners review their head coaches after the season (call once the new season's history record
 * exists). Firings are rolled per team from the hot seat; champions and first-year coaches are safe.
 */
export function offseasonCarousel(league: League, previousSeason: string, userTeamId: string | null, previousHeads?: Map<string, string | undefined>): League {
  const last = league.franchiseHistory?.find(r => r.season === previousSeason)?.teamSeasons;
  if (!last?.length) return league;
  const rng = new RNG(stableSeed(`${previousSeason}:carousel`));
  const seats = hotSeats(league, userTeamId, last, previousSeason);
  let next = league;
  const events: CarouselEvent[] = [];
  for (const seat of seats) {
    const team = next.teams.find(t => t.teamId === seat.teamId);
    const coach = team?.coachIdentity;
    if (!team || !coach || coach.coachId !== seat.coachId) continue;
    const champion = last.find(s => s.teamId === team.teamId)?.playoffFinish === 'Champion';
    const chance = champion || newHire(league, team.teamId, coach.coachId, previousSeason) ? 0 : Math.max(0, (seat.heat - 45) / 45);
    if (!rng.chance(chance)) continue;
    const fired = fireStaff(next, team.teamId, 'head', team.teamId);
    if (fired.league === next) continue;
    next = fired.league;
    events.push({ season: league.season ?? '', kind: 'fired', teamId: team.teamId, coachId: coach.coachId, detail: seat.reason, order: events.length });
  }
  // Before the market: teams without a head coach go after the league's best assistants.
  const poached = poachAssistants(next, userTeamId, league.season ?? '');
  next = poached.league;
  for (const m of poached.moves) events.push({ season: league.season ?? '', kind: 'hired', teamId: m.teamId, coachId: m.coachId, detail: m.detail, order: events.length });
  const filled = fillVacancies(next, league.season ?? '', events.length, false, userTeamId, events.filter(e => e.kind === 'fired').map(e => e.coachId));
  // Benches that changed earlier in the offseason (a contract ran out and the team hired from the market).
  const logged = new Set([...events, ...filled.events].map(e => e.teamId));
  const extra: CarouselEvent[] = [];
  for (const t of filled.league.teams) {
    const before = previousHeads?.get(t.teamId), now = t.coachIdentity?.coachId;
    if (!previousHeads || logged.has(t.teamId) || t.teamId === userTeamId || !now || before === now) continue;
    extra.push({ season: league.season ?? '', kind: 'hired', teamId: t.teamId, coachId: now, order: events.length + filled.events.length + extra.length,
      detail: before ? `Replaces ${before}, whose contract ran out.` : 'Fills an open bench.' });
  }
  return record(filled.league, [...events, ...filled.events, ...extra]);
}

/**
 * Mid-season: after 25 games, an AI team far below its roster's expectation may fire its coach; the best
 * candidate on the market takes over as interim. At most three mid-season firings a season.
 */
export function midseasonCarousel(league: League, userTeamId: string | null, seed: number): League {
  if ((league.seasonPhase ?? 'regular_season') !== 'regular_season') return league;
  const season = league.season ?? '';
  const already = (league.coachingCarousel?.events ?? []).filter(e => e.season === season && e.midseason && e.kind === 'fired');
  if (already.length >= MIDSEASON_MAX_FIRINGS) return league;
  const standings = new Map(computeStandings(league).map(r => [r.teamId, r]));
  const rng = new RNG(seed);
  for (const seat of hotSeats(league, userTeamId)) {
    const row = standings.get(seat.teamId);
    if (!row || row.wins + row.losses < MIDSEASON_MIN_GAMES || seat.heat < 80) continue;
    if (already.some(e => e.teamId === seat.teamId)) continue;
    if (newHire(league, seat.teamId, seat.coachId, season)) continue;
    if (!rng.chance(0.25)) continue;
    const fired = fireStaff(league, seat.teamId, 'head', seat.teamId);
    if (fired.league === league) continue;
    const order = 1000 + (league.coachingCarousel?.events.length ?? 0);
    const firedEvent: CarouselEvent = { season, kind: 'fired', teamId: seat.teamId, coachId: seat.coachId, detail: seat.reason, midseason: true, order };
    const filled = fillVacancies(fired.league, season, order + 1, true, userTeamId, [seat.coachId]);
    return record(filled.league, [firedEvent, ...filled.events]);
  }
  return league;
}

/** Carousel moves as news. */
export function carouselNews(league: League): { id: string; season: string; teamId: string; headline: string; detail: string; order: number }[] {
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  return (league.coachingCarousel?.events ?? []).map(e => ({
    id: `carousel:${e.kind}:${e.teamId}:${e.coachId}`, season: e.season, teamId: e.teamId, order: e.order,
    headline: e.kind === 'fired' ? `${name(e.teamId)} fire head coach ${e.coachId}${e.midseason ? ' mid-season' : ''}.`
      : e.kind === 'interim' ? `${e.coachId} takes over ${name(e.teamId)} as interim head coach.`
      : `${name(e.teamId)} hire ${e.coachId} as head coach.`,
    detail: e.detail,
  }));
}
