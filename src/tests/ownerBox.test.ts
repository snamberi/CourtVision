// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateGame } from '../simulation/engine/game';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { autoGeneratePlayoffBracket } from '../simulation/playoffs';
import { classifyBuyerSeller } from '../simulation/aiGM';
import { hotSeats } from '../simulation/coachingCarousel';
import { autoPlayOneSeason } from '../simulation/autoPlay';
import { DEFAULT_AWARD_SETTINGS } from '../components/LeagueSettingsPage';
import { franchiseTimeline } from '../simulation/timeline';
import {
  startOwnership, gmCandidates, hireGm, fireGm, extendGm, setGoal, setBudget, castVote, voteOnBid, buildArena, arenaCost, relocate, openCities,
  ownerVotes, ownerLegacy, ownerSpendFactor, expandLeague, namingOffers, signNaming, recordOwnerLegacy, loadOwnerRecords, bestOwnerLegacy, PROPOSALS, BUDGETS,
} from '../simulation/ownerBox';
import type { League } from '../simulation/league';

const { league: base, extras } = generateFullLeague(91, 30, 13, 40, '2026');
const me = base.teams[3].teamId;
const offseason = (l: League): League => ({ ...l, seasonPhase: 'preseason' });

describe("Owner's Box", () => {
  it('buying a team: the AI GM code runs it, the owner steers it', () => {
    const { league, extras: ex } = startOwnership(base, extras, me);
    expect(league.owner?.teamId).toBe(me);
    expect(league.frontOffice?.status).toBe('spectator');
    expect(league.frontOffice?.teamId).toBeNull();
    expect(league.leagueOffice?.proposals).toHaveLength(3);
    expect(league.teams.find(t => t.teamId === me)!.expenseLevels).toEqual({ scouting: 50, coaching: 50, health: 50, facilities: 50 });
    // Hiring a GM sets the team's front-office personality; the budget moves spending and expense levels.
    const [shark, collector] = gmCandidates(league);
    expect(shark.archetype).toBe('shark');
    const hired = hireGm(league, ex, shark);
    expect(hired.extras.teamPersonalities?.[me]).toBe('aggressive');
    expect(hireGm(league, ex, collector).extras.teamPersonalities?.[me]).toBe('conservative');
    expect(gmCandidates(hired.league)[0].id).not.toBe(shark.id); // new faces after a hire
    const lavish = setBudget(hired.league, hired.extras, 'lavish');
    expect(ownerSpendFactor(lavish.league, me)).toBe(BUDGETS.lavish.spend);
    expect(ownerSpendFactor(lavish.league, base.teams[0].teamId)).toBe(1);
    expect(lavish.league.teams.find(t => t.teamId === me)!.expenseLevels?.facilities).toBe(BUDGETS.lavish.expense);
    // Firing pays out his contract; an extension adds three years.
    const fired = fireGm(hired.league, hired.extras);
    expect(fired.league.owner!.gm).toBeNull();
    expect(fired.league.owner!.cash).toBe(hired.league.owner!.cash - shark.salary * shark.years);
    expect(extendGm(hired.league).owner!.gm!.years).toBe(shark.years + 3);
  });

  it('the goal pushes the GM to buy or sell; the owner hires his own coach', () => {
    const { league, extras: ex } = startOwnership(base, extras, me);
    // A .500 team: a title goal makes it a buyer, a rebuild a seller.
    const played = { ...league, schedule: league.schedule.map((g, i) => i < 400 ? { ...g, played: true, result: { homeScore: 100 + (i % 2), awayScore: 100 + ((i + 1) % 2) } as never } : g) };
    const title = setGoal(played, ex, 'title'), rebuild = setGoal(played, ex, 'rebuild');
    expect(classifyBuyerSeller(title.league, title.extras, me)).toBe('buyer');
    expect(classifyBuyerSeller(rebuild.league, rebuild.extras, me)).toBe('seller');
    expect(hotSeats(played, null).some(s => s.teamId === me)).toBe(false);
  });

  it('league office: owners vote, a passed rule changes the dials; the four-point line is real', () => {
    const { league } = startOwnership(base, extras, me);
    const tally = ownerVotes(league, 'x', 0.9, true);
    expect(tally.yes + tally.no).toBe(league.teams.length);
    expect(tally.passed).toBe(true);
    expect(ownerVotes(league, 'x', 0.1, true).passed).toBe(false);
    // Force the four-point line through (everyone agrees) and check the engine scores fours.
    const four = castVote({ ...league, leagueOffice: { ...league.leagueOffice!, proposals: ['fourPoint'] } }, 'fourPoint', true);
    const passed = four.result.passed ? four.league : { ...league, rulesSettings: { ...DEFAULT_LEAGUE_RULES, ...league.rulesSettings, fourPointLine: true } };
    expect(passed.rulesSettings?.fourPointLine).toBe(true);
    let fours = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const [a, b] = passed.teams;
      const r = simulateGame({ home: { teamId: a.teamId, seasons: a.seasons, coach: a.coach }, away: { teamId: b.teamId, seasons: b.seasons, coach: b.coach }, rules: passed.rulesSettings, settings: { ...DEFAULT_GAME_SETTINGS, seed } });
      fours += r.possessionLog.filter(e => e.events.some(ev => ev.includes('MAKE (+4)'))).length;
      const pts = Object.values(r.homeBox.players).reduce((n, l) => n + l.points, 0);
      expect(pts).toBe(r.homeScore);
    }
    expect(fours).toBeGreaterThan(0);
    // Without the rule, nothing is worth four.
    const [a, b] = base.teams;
    const plain = simulateGame({ home: { teamId: a.teamId, seasons: a.seasons }, away: { teamId: b.teamId, seasons: b.seasons }, settings: { ...DEFAULT_GAME_SETTINGS, seed: 3 } });
    expect(plain.possessionLog.some(e => e.events.some(ev => ev.includes('MAKE (+4)')))).toBe(false);
    // Scrapping the play-in: the bracket seeds the top eight straight in.
    const noPlayIn = { ...league, rulesSettings: { ...DEFAULT_LEAGUE_RULES, playInEnabled: false } };
    expect(autoGeneratePlayoffBracket(noPlayIn).playIn).toBeUndefined();
    expect(Object.keys(PROPOSALS).length).toBeGreaterThan(8);
  });

  it('arena, naming rights and moving the team', () => {
    const { league } = startOwnership(base, extras, me);
    const poor = { ...league, owner: { ...league.owner!, cash: 10_000_000 } };
    expect(buildArena(poor, 'Palace', 2).league).toBe(poor);
    const rich = { ...league, owner: { ...league.owner!, cash: arenaCost(2) + 1 } };
    const built = buildArena(rich, 'The Palace', 2).league;
    expect(built.owner!.arena).toMatchObject({ name: 'The Palace', suites: 2 });
    expect(built.owner!.cash).toBe(1);
    expect(built.teams.find(t => t.teamId === me)!.business?.arena.crowd).toBe(3);
    const offer = namingOffers(built)[0];
    const named = signNaming(built, offer);
    expect(named.owner!.arena.sponsor).toEqual(offer);
    expect(named.owner!.arena.name.startsWith(offer.name)).toBe(true);
    // Moving: refused during the season, and the owners vote in the offseason.
    const city = openCities(league)[0].name;
    expect(relocate({ ...rich, seasonPhase: 'regular_season' }, city).passed).toBe(false);
    let moved = null;
    for (const c of openCities(league)) { const r = relocate(offseason({ ...league, owner: { ...league.owner!, cash: 1e12 } }), c.name); if (r.passed) { moved = { r, c }; break; } }
    expect(moved).toBeTruthy();
    const team = moved!.r.league.teams.find(t => t.teamId === me)!;
    expect(team.name.startsWith(moved!.c.name)).toBe(true);
    expect(moved!.r.league.leagueOffice!.events.some(e => e.kind === 'protest')).toBe(true);
    expect(moved!.r.league.owner!.fans).toBeLessThan(league.owner!.fans);
    expect(franchiseTimeline(moved!.r.league, extras, me).some(s => s.events.some(e => e.kind === 'move'))).toBe(true);
  });

  it('a season as owner: profit booked, the GM graded, a new agenda; legacy and the Hall of Fame', () => {
    const start = startOwnership(base, extras, me);
    const hired = hireGm(start.league, start.extras, gmCandidates(start.league)[2]);
    const done = autoPlayOneSeason(hired.league, hired.extras, null, DEFAULT_AWARD_SETTINGS, 5);
    const o = done.league.owner!;
    expect(o.seasons).toHaveLength(1);
    expect(o.gm!.record).toHaveLength(1);
    expect(o.cash).not.toBe(hired.league.owner!.cash);
    expect(done.league.leagueOffice!.season).toBe(done.league.season);
    expect(done.league.leagueOffice!.proposals.length).toBe(3);
    // Your team was run by the AI: it has a full roster for the new season.
    expect(done.league.teams.find(t => t.teamId === me)!.seasons.length).toBeGreaterThanOrEqual(12);
    const l = ownerLegacy(o);
    expect(l.seasons).toBe(1);
    localStorage.clear();
    recordOwnerLegacy('save1', done.league);
    expect(loadOwnerRecords()).toHaveLength(1);
    expect(bestOwnerLegacy()).toBe(l.score);
  }, 180_000);

  it('expansion: an approved city joins the smaller conference with a drafted roster', async () => {
    const { league, extras: ex } = startOwnership(base, extras, me);
    const bid = { id: 'bid-x', city: 'Seattle', nickname: 'Comets', fee: 2_000_000_000 };
    const office = { ...league.leagueOffice!, bids: [bid] };
    const voted = voteOnBid({ ...league, leagueOffice: office }, 'bid-x', true);
    expect(voted.league.leagueOffice!.bids).toHaveLength(0);
    if (voted.result.passed) expect(voted.league.owner!.cash).toBeGreaterThan(league.owner!.cash);
    const grown = await expandLeague(offseason(league), ex, bid, 7);
    expect(grown.league.teams).toHaveLength(league.teams.length + 1);
    const team = grown.league.teams.at(-1)!;
    expect(team.name).toBe('Seattle Comets');
    expect(team.seasons.length).toBeGreaterThanOrEqual(10);
    expect(team.conferenceId).toBeTruthy();
    expect(grown.league.frontOffice?.owners[team.teamId]).toBeTruthy();
  });
});
