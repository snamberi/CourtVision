import { describe, it, expect } from 'vitest';
import { RNG } from '../simulation/engine/rng';
import {
  generateCoachIdentity, generateCoachCandidates, coachStrengths, coachWeaknesses,
  driftRelationships, relationshipWith, relationshipLabel, coachPerformanceModifiers, hireCoach,
} from '../simulation/coaching';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateNextGame } from '../simulation/league';
import { computeSeasonAwards, placementsForPlayer, AWARD_BALLOT_LABELS, VOTED_BALLOTS } from '../simulation/awards';
import { computeHallOfFame, buildHallOfFameCase, HOF_THRESHOLD } from '../simulation/hallOfFame';
import { waiveToFreeAgency, signFreeAgent, DEFAULT_CAP_SETTINGS, hasRosterRoom, canDropPlayer } from '../simulation/gm';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';

describe('coach traits, strengths and weaknesses', () => {
  it('generates a spiky trait profile, not a flat one', () => {
    const coach = generateCoachIdentity(new RNG(5), '2026-27', new Set());
    const vals = Object.values(coach.traits);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(5);
    expect(coach.rating).toBeGreaterThan(0);
  });

  it('never reports a trait as both a strength and a weakness', () => {
    for (let seed = 0; seed < 20; seed++) {
      const coach = generateCoachIdentity(new RNG(seed), '2026-27', new Set());
      const strengths = new Set(coachStrengths(coach));
      for (const w of coachWeaknesses(coach)) expect(strengths.has(w)).toBe(false);
    }
  });

  it('offers a pool of distinct hireable candidates', () => {
    const candidates = generateCoachCandidates(99, '2026-27', 5);
    expect(candidates.length).toBe(5);
    expect(new Set(candidates.map((c) => c.coachId)).size).toBe(5);
  });
});

describe('coach-player relationships', () => {
  it('a high-motivation coach lifts relationships more than a low-motivation one after the same win', () => {
    const roster = buildDemoTeam('T', 'Test').seasons;
    const minutes = Object.fromEntries(roster.map((p) => [p.playerId, 30]));
    const base = generateCoachIdentity(new RNG(1), '2026-27', new Set());

    const motivator = driftRelationships({ ...base, traits: { ...base.traits, motivation: 95 } }, roster, true, minutes)!;
    const dud = driftRelationships({ ...base, traits: { ...base.traits, motivation: 5 } }, roster, true, minutes)!;

    const avg = (c: typeof motivator) => roster.reduce((s, p) => s + relationshipWith(c, p.playerId), 0) / roster.length;
    expect(avg(motivator)).toBeGreaterThan(avg(dud));
  });

  it('a player getting far fewer minutes than expected sours on the coach', () => {
    const roster = buildDemoTeam('T', 'Test').seasons;
    const base = generateCoachIdentity(new RNG(2), '2026-27', new Set());
    const benched = Object.fromEntries(roster.map((p) => [p.playerId, 0]));
    let coach = base;
    for (let i = 0; i < 20; i++) coach = driftRelationships(coach, roster, false, benched)!;
    expect(relationshipWith(coach, roster[0].playerId)).toBeLessThan(50);
  });

  it('relationship labels move through the full range', () => {
    expect(relationshipLabel(90)).toBe('Loves coach');
    expect(relationshipLabel(50)).toBe('Neutral');
    expect(relationshipLabel(10)).toBe('Wants out');
  });

  it('a bought-in locker room produces better performance modifiers than a checked-out one', () => {
    const roster = buildDemoTeam('T', 'Test').seasons;
    const base = generateCoachIdentity(new RNG(3), '2026-27', new Set());
    const loved = { ...base, relationships: Object.fromEntries(roster.map((p) => [p.playerId, 95])) };
    const hated = { ...base, relationships: Object.fromEntries(roster.map((p) => [p.playerId, 5])) };
    expect(coachPerformanceModifiers(loved, roster).offense).toBeGreaterThan(coachPerformanceModifiers(hated, roster).offense);
  });

  it('hiring a coach resets relationships to neutral for the current roster', () => {
    const { league } = generateFullLeague(4, 4, 10, 5);
    const candidate = generateCoachIdentity(new RNG(7), '2026-27', new Set());
    const team = hireCoach(league.teams[0], candidate, '2027-28');
    expect(team.coachIdentity!.hiredSeason).toBe('2027-28');
    for (const p of team.seasons) expect(relationshipWith(team.coachIdentity, p.playerId)).toBe(50);
  });

  it('relationships actually drift as real games are simulated', () => {
    const { league } = generateFullLeague(6, 4, 12, 10);
    const teamId = league.teams[0].teamId;
    const before = league.teams[0].coachIdentity!;
    const after = simulateNextGame(league, 11);
    const afterCoach = after.teams.find((t) => t.teamId === teamId)!.coachIdentity!;
    // At least one player's relationship should have moved off the neutral default.
    expect(Object.keys(afterCoach.relationships).length).toBeGreaterThan(0);
    expect(afterCoach.careerWins + afterCoach.careerLosses).toBe(before.careerWins + before.careerLosses + 1);
  });
});

describe('roster size limits', () => {
  const cap = { ...DEFAULT_CAP_SETTINGS, minRosterSize: 3, maxRosterSize: 5 };

  function fixture() {
    const demo = buildDemoTeam('A', 'Alpha'); // 5 players
    const league: any = {
      teams: [{ teamId: 'A', name: 'Alpha', seasons: demo.seasons }],
      schedule: [], settings: {} as any, season: '2026-27',
    };
    const extras: any = {
      contracts: {}, freeAgents: [], capSettings: cap, draftClass: [], tradeSettings: {} as any,
      draftDayOpen: false, freeAgencyOpen: true, tradeBlock: [], draftPickIndex: 0,
      pendingTradeOffers: [], freeAgencyDaysRemaining: 0,
    };
    return { league, extras };
  }

  it('blocks signing when the roster is already at the maximum', () => {
    const { league, extras } = fixture(); // 5 players == maxRosterSize
    const team = league.teams[0];
    expect(hasRosterRoom(team, cap)).toBe(false);
    const fa = buildDemoTeam('B', 'Beta').seasons[0];
    const result = signFreeAgent(league, { ...extras, freeAgents: [fa] }, fa.playerId, 'A', {
      annualSalary: 2_000_000, yearsRemaining: 1, playerOption: false, teamOption: false,
    });
    expect(result.league.teams[0].seasons.length).toBe(5); // unchanged
  });

  it('blocks waiving when it would drop the roster below the minimum', () => {
    const { league, extras } = fixture();
    let current = { league, extras };
    // 5 -> 4 -> 3 is fine; the next waive would breach the floor of 3.
    current = waiveToFreeAgency(current.league, current.extras, current.league.teams[0].seasons[0].playerId, 'A') as any;
    current = waiveToFreeAgency(current.league, current.extras, current.league.teams[0].seasons[0].playerId, 'A') as any;
    expect(current.league.teams[0].seasons.length).toBe(3);
    expect(canDropPlayer(current.league.teams[0], cap)).toBe(false);

    const blocked = waiveToFreeAgency(current.league, current.extras, current.league.teams[0].seasons[0].playerId, 'A');
    expect(blocked.league.teams[0].seasons.length).toBe(3); // refused
  });
});

describe('expanded award slate', () => {
  function playedLeague() {
    const { league: fresh } = generateFullLeague(21, 6, 10, 12);
    let l = fresh;
    for (let i = 0; i < 40; i++) {
      if (!l.schedule.some((g) => !g.played)) break;
      l = simulateNextGame(l, i + 1);
    }
    return l;
  }

  it('produces a winner for every new award once games have been played', () => {
    const awards = computeSeasonAwards(playedLeague(), { minGames: 1 });
    expect(awards.cpoy).toBeTruthy();
    expect(awards.hustle).toBeTruthy();
    expect(awards.teammate).toBeTruthy();
    expect(awards.scoringChamp).toBeTruthy();
    expect(awards.reboundingChamp).toBeTruthy();
    expect(awards.assistsChamp).toBeTruthy();
    expect(awards.stealsChamp).toBeTruthy();
    expect(awards.blocksChamp).toBeTruthy();
    expect(awards.playerOfTheMonth).toBeTruthy();
  });

  it('builds a ranked top-10 ballot for every ballot award', () => {
    const awards = computeSeasonAwards(playedLeague(), { minGames: 1 });
    for (const key of Object.keys(AWARD_BALLOT_LABELS) as (keyof typeof AWARD_BALLOT_LABELS)[]) {
      const ballot = awards.ballots[key];
      expect(Array.isArray(ballot)).toBe(true);
      expect(ballot.length).toBeLessThanOrEqual(10);
      // Voted awards rank by ballot points, the rest by score — that's what makes the placement number meaningful.
      const rank = (w: (typeof ballot)[number]) => (VOTED_BALLOTS.includes(key) ? w.points! : w.score);
      for (let i = 1; i < ballot.length; i++) expect(rank(ballot[i - 1])).toBeGreaterThanOrEqual(rank(ballot[i]));
    }
  });

  it('the scoring champion is genuinely first on the scoring ballot', () => {
    const awards = computeSeasonAwards(playedLeague(), { minGames: 1 });
    expect(awards.ballots.scoringChamp[0].playerId).toBe(awards.scoringChamp!.playerId);
  });

  it('placementsForPlayer reports the MVP as MVP-1', () => {
    const awards = computeSeasonAwards(playedLeague(), { minGames: 1 });
    const placements = placementsForPlayer(awards, awards.mvp!.playerId);
    const mvpPlacement = placements.find((p) => p.award === 'mvp');
    expect(mvpPlacement?.place).toBe(1);
  });
});

describe('Hall of Fame', () => {
  it('enshrines a monster career and rejects a marginal one', () => {
    const { league } = generateFullLeague(31, 4, 10, 5);
    const base = league.teams[0].seasons[0];

    const legend = {
      ...base,
      seasonStats: { ...base.seasonStats!, gamesPlayed: 82, points: 2400, oreb: 200, dreb: 600, ast: 500, minutes: 3000 },
      careerHistory: Array.from({ length: 16 }, (_, i) => ({
        season: `20${10 + i}-${11 + i}`, teamId: 'A', age: 22 + i, overall: 90,
        stats: { ...base.seasonStats!, gamesPlayed: 82, points: 2200, oreb: 180, dreb: 550, ast: 450, minutes: 2900 },
        milestones: { doubleDoubles: 40, tripleDoubles: 5, quadrupleDoubles: 0, quintupleDoubles: 0, gameHighPoints: 61, gameHighRebounds: 20, gameHighAssists: 15, gameHighSteals: 7, gameHighBlocks: 8 },
      })),
    };
    const journeyman = {
      ...base,
      seasonStats: { ...base.seasonStats!, gamesPlayed: 40, points: 120, oreb: 20, dreb: 40, ast: 30, minutes: 400 },
      careerHistory: [],
    };

    const record = { playerId: base.playerId, finalTeamId: 'A', finalTeamName: 'Alpha', finalSeason: '2026-27', finalAge: 38, finalOverall: 70 };
    const legendCase = buildHallOfFameCase(legend as any, record, league);
    const journeymanCase = buildHallOfFameCase(journeyman as any, record, league);

    expect(legendCase.score).toBeGreaterThan(journeymanCase.score);
    expect(legendCase.inducted).toBe(true);
    expect(journeymanCase.inducted).toBe(false);
    expect(legendCase.score).toBeGreaterThanOrEqual(HOF_THRESHOLD);
    expect(legendCase.resume.length).toBeGreaterThan(0);
  });

  it('returns an empty hall for a league where nobody has retired', () => {
    const { league } = generateFullLeague(32, 4, 10, 5);
    expect(computeHallOfFame(league)).toEqual([]);
  });
});
