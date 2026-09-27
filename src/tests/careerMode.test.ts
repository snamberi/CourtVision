import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool } from '../hunt/cards';
import { top100, top100Rank, legacyScore, emptyResume } from '../career/legacy';
import { newWheel, spin, respin, move, take, landed, neighbour, mustTake, canSpin, isComplete, donor, RESPINS } from '../career/wheel';
import { CATEGORIES, categoryValues } from '../career/categories';
import { buildPlayer, startProgress, primeOverall, primeFromBuild, capFor, suggestPosition, type Prime } from '../career/create';
import { newCareerMeta, joinDraft, draftResult, landSeason, autopilotOffseason, findPlayer, uniqueName, freeAgentOffers, requestTrade, growth } from '../career/career';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { autoPlayToDraft, autoPlayFromDraft, autoPlayOneSeason } from '../simulation/autoPlay';
import { DEFAULT_AWARD_SETTINGS } from '../simulation/awards';
import { calculateOverall } from '../simulation/engine/overall';
import { RNG } from '../simulation/engine/rng';

type H = Awaited<ReturnType<typeof loadHistoryForTests>>;
const best = (h: H, name: string) => cardPool(h).cards.filter(c => c.name === name).sort((a, b) => b.ovr - a.ovr)[0];
const primeOf = (h: H, name: string) => Object.fromEntries(CATEGORIES.map(c => [c.id, categoryValues(donor(h, best(h, name).id), c.id)])) as Prime;

describe('Career Mode', () => {
  it('the all-time Top 100: the anchors, and where a legacy lands', async () => {
    const h = await loadHistoryForTests();
    const list = top100(h);
    expect(list).toHaveLength(100);
    expect(list.every(e => e.idx != null)).toBe(true);
    expect(list[0].name).toBe('LeBron James');
    expect(list[3].name).toBe('Tim Duncan');
    expect(list[6].name).toBe('Stephen Curry');
    expect(list[11].name).toBe('Kobe Bryant');
    // LeBron's resume is the best on the list.
    expect(Math.max(...list.map(e => e.score))).toBe(list[0].score);
    expect(top100Rank(list, 10_000)).toBe(1);
    expect(top100Rank(list, 0)).toBeNull();
    expect(legacyScore(emptyResume())).toBe(0);
  }, 120_000);

  it('the wheel: take exact ratings, move left/right once each, two respins, one triple spin', async () => {
    const h = await loadHistoryForTests();
    let s = spin(h, newWheel(42));
    expect(mustTake(s)).toBe(true);
    expect(canSpin(s)).toBe(false);
    // Move right lands on the neighbour, once.
    const right = neighbour(s.current![0], 'right');
    s = move(s, 'right');
    expect(landed(s.current![0])).toBe(right);
    expect(move(s, 'right')).toBe(s);
    // Respins: two, and only before taking.
    for (let i = 0; i < RESPINS; i++) s = respin(h, s);
    expect(s.respins).toBe(0);
    expect(respin(h, s)).toBe(s);
    const id = landed(s.current![0]);
    s = take(h, s, 0, 'threePoint');
    expect(s.picks.threePoint!.values).toEqual(categoryValues(donor(h, id), 'threePoint'));
    expect(take(h, s, 0, 'size')).toBe(s); // one category per wheel
    // Triple spin: take from all three, then it is gone.
    s = spin(h, s, true);
    expect(s.current).toHaveLength(3);
    expect(s.triple).toBe(false);
    s = take(h, s, 0, 'size'); s = take(h, s, 2, 'body');
    expect(s.picks.size && s.picks.body).toBeTruthy();
    expect(canSpin(s)).toBe(true);
    expect(spin(h, s, true)).toBe(s);
    while (!isComplete(s)) { s = spin(h, s); s = take(h, s, 0, CATEGORIES.find(c => !s.picks[c.id])!.id); }
    expect(s.current).toBeNull();
    // Curry's three is Curry's three.
    const curry = donor(h, best(h, 'Stephen Curry').id);
    expect(curry.attributes.offense.threePoint).toBeGreaterThanOrEqual(95);
  }, 120_000);

  it('the player: his picks are his prime; rookies start below it; MyPlayer respects height', async () => {
    const h = await loadHistoryForTests();
    const prime = primeOf(h, 'Tim Duncan');
    expect(suggestPosition(prime)).toMatch(/PF|C/);
    const rookie = buildPlayer({ name: 'Rook', pos: 'PF', jersey: 21 }, prime, startProgress(), 'balanced', '2026', 19, 1);
    expect(rookie.attributes.physical.heightInches).toBe(prime.size['physical.heightInches']);
    expect(calculateOverall(rookie)).toBeLessThan(primeOverall(prime, 'balanced', 'PF'));
    expect(rookie.development.potential).toBeGreaterThanOrEqual(primeOverall(prime, 'balanced', 'PF') - 1);
    expect(capFor('playmaking', 86)).toBeLessThan(capFor('playmaking', 74));
    expect(capFor('interiorD', 86)).toBeGreaterThan(capFor('interiorD', 74));
    const built = primeFromBuild({ heightIn: 86, weightLbs: 260, wingspanIn: 90, ratings: { body: 70, athleticism: 70, finishing: 70, midRange: 70, threePoint: 70, playmaking: 99, perimeterD: 60, interiorD: 80, iq: 70 } }, 3);
    expect(Math.max(...Object.values(built.playmaking))).toBeLessThanOrEqual(capFor('playmaking', 86) + 3);
    // Young players grow, old ones decline; training helps both.
    const rng = () => new RNG(1);
    expect(growth('finishing', 20, false, rng())).toBeGreaterThan(0.1);
    expect(growth('athleticism', 34, false, rng())).toBeLessThan(0);
    expect(growth('finishing', 20, true, rng())).toBeGreaterThan(growth('finishing', 20, false, rng()));
  }, 120_000);

  it('a whole career on autopilot: drafted, seasons recorded, never retired by the league, retires by 40', async () => {
    const h = await loadHistoryForTests();
    const prime = primeOf(h, 'Kobe Bryant');
    let { league, extras } = generateFullLeague(21, 6, 10, 12, '2026');
    let half = autoPlayToDraft(league, extras, null, DEFAULT_AWARD_SETTINGS, 1);
    league = half.league; extras = half.extras;
    const name = uniqueName(league, extras, 'Career Test');
    let meta = newCareerMeta('t', 5, 'wheel', { name, pos: 'SG', jersey: 8 }, prime, 'balanced', name, league.season!, startProgress());
    ({ league, extras } = joinDraft(league, extras, meta));
    expect(extras.draftClass[0].playerId).toBe(name);
    let full = autoPlayFromDraft(league, extras, null, 2, half.partial);
    league = full.league; extras = full.extras;
    meta = { ...meta, draft: draftResult(league, meta, full.draftPicks) };
    expect(meta.draft!.pick).toBe(1);
    expect(findPlayer(league, extras, name)!.player.careerPlayer).toBe(true);
    for (let y = 0; y < 25 && meta.status === 'active'; y++) {
      half = autoPlayToDraft(league, extras, null, DEFAULT_AWARD_SETTINGS, 100 + y);
      const landed = landSeason(meta, half.league, half.extras, half.partial.season);
      expect(landed.year).not.toBeNull();
      const auto = autopilotOffseason(landed.meta, landed.league, landed.extras, h);
      meta = auto.meta;
      if (meta.status !== 'active') break;
      expect(findPlayer(auto.league, auto.extras, name)).not.toBeNull(); // the league never retires him
      full = autoPlayFromDraft(auto.league, auto.extras, null, 200 + y, half.partial);
      league = full.league; extras = full.extras;
    }
    expect(meta.status).toBe('retired');
    expect(meta.years.length).toBeGreaterThanOrEqual(10);
    expect(meta.retired!.age).toBeLessThanOrEqual(40);
    expect(meta.years[0].age).toBe(19);
    // A Kobe-built player peaks well above his rookie level.
    expect(Math.max(...meta.years.map(y => y.overall))).toBeGreaterThan(meta.years[0].overall + 5);
    expect(meta.retired!.legacy).toBeGreaterThan(0);
    expect(meta.years.reduce((n, y) => n + y.stats.gamesPlayed, 0)).toBeGreaterThan(50);
  }, 600_000);

  it('free agency offers and a trade request move him', async () => {
    const h = await loadHistoryForTests();
    const prime = primeOf(h, 'Paul Pierce');
    let { league, extras } = generateFullLeague(33, 6, 10, 12, '2026');
    const r = autoPlayOneSeason(league, extras, null, DEFAULT_AWARD_SETTINGS, 3);
    league = r.league; extras = r.extras;
    const name = uniqueName(league, extras, 'Trade Test');
    const meta = newCareerMeta('x', 9, 'myplayer', { name, pos: 'SF', jersey: 34 }, prime, 'ready', name, league.season!, startProgress());
    const p = { ...buildPlayer({ name, pos: 'SF', jersey: 34 }, prime, startProgress(), 'ready', league.season!, 24, 9), careerPlayer: true };
    // As a free agent he gets offers from different teams.
    const fa = { ...extras, freeAgents: [...extras.freeAgents, p] };
    const offers = freeAgentOffers(league, fa, meta);
    expect(new Set(offers.map(o => o.teamId)).size).toBe(offers.length);
    // On a team, a trade request sends him somewhere else.
    const team = league.teams[0];
    const onTeam = { ...league, teams: league.teams.map(t => (t.teamId === team.teamId ? { ...t, seasons: [...t.seasons, { ...p, teamId: team.teamId }] } : t)) };
    const traded = requestTrade(onTeam, extras, meta, 'anywhere');
    expect(findPlayer(traded.league, traded.extras, name)!.teamId).not.toBe(team.teamId);
  }, 300_000);
});
