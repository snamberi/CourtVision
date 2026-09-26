import { generateNormalBadges } from './badges';
import { RNG } from './engine/rng';
import { makeDefaultSeason } from './presets/samplePlayers';
import type { League, LeagueTeam } from './league';
import { generateSeasonSchedule, defaultCoachTendencies, assignConferencesAndDivisions, assignMarketSizes } from './league';
import { generateCoachIdentity } from './coaching';
import { seasonStartDate } from './calendar';
import type { GMLeagueExtras, Contract } from './gm';
import { DEFAULT_CAP_SETTINGS, DEFAULT_TRADE_SETTINGS, DEFAULT_GM_FLAGS, generateDraftClass, pickDraftClassSize, generateFutureDraftPicks } from './gm';
import { assignGMPersonalities } from './aiGM';
import type { PlayerSeason } from './types';
import { DEFAULT_GAME_SETTINGS } from './types';
import { generatePlayerOrigin, type PlayerOrigin } from './names';
import { pickArchetype } from './archetypes';
import { compressElitePotential, syncPotential } from './engine/potential';
import { calculateOverall } from './engine/overall';
import { generatePriorSeasons } from './seasonZero';

/**
 * Fictional city/mascot combinations for a full 30-team generated league.
 * Deliberately original names, not stand-ins for any real organization.
 */
const CITY_MASCOTS: [string, string][] = [
  ['Ironport', 'Foundry'], ['Cascade', 'Timberwolves'], ['Prairie City', 'Bison'], ['Redstone', 'Vipers'],
  ['Bay Harbor', 'Tide'], ['Sable Ridge', 'Ravens'], ['Golden Flats', 'Miners'], ['Sunspire', 'Comets'],
  ['Granite Bay', 'Kings'], ['River City', 'Embers'], ['North Point', 'Wolves'], ['Cobalt', 'Lynx'],
  ['Amber Hills', 'Foxes'], ['Silver Creek', 'Hawks'], ['Marble Falls', 'Titans'], ['Copper Basin', 'Rattlers'],
  ['Emerald Coast', 'Marlins'], ['Frostwind', 'Yetis'], ['Highland Park', 'Stags'], ['Cinder Bluff', 'Phoenixes'],
  ['Pinegrove', 'Loggers'], ['Vantage', 'Sentinels'], ['Salt Flats', 'Scorpions'], ['Lakeshore', 'Herons'],
  ['Thornfield', 'Wardens'], ['Ashcroft', 'Falcons'], ['Meridian', 'Halos'], ['Westgate', 'Mustangs'],
  ['Obsidian', 'Panthers'], ['Harborlight', 'Mariners'],
];

function jitter(rng: RNG, base: number, spread: number): number {
  return Math.max(15, Math.min(99, Math.round(base + (rng.next() * 2 - 1) * spread)));
}

/** Applies a group multiplier around the player's caliber, with a little per-attribute noise. */
function attr(rng: RNG, caliber: number, groupMult: number, spread = 7): number {
  const target = caliber * groupMult;
  return Math.max(15, Math.min(99, Math.round(target + (rng.next() * 2 - 1) * spread)));
}

/**
 * Builds one procedurally generated player from a real archetype ("Two-Way Star", "Rim Protector",
 * "3&D Wing", ...). Every attribute is derived from the archetype's group multipliers applied to the
 * player's own caliber, so a defensive specialist really is weak offensively, a sharpshooter really
 * can't defend, and no two builds feel interchangeable. Identity (nationality, college, draft slot)
 * is generated alongside so players arrive as people, not stat blocks.
 */
export function generatePlayer(
  id: string,
  season: string,
  teamId: string | null,
  age: number,
  archetypeSeed: number,
  rng: RNG,
  opts: { caliber?: number; origin?: PlayerOrigin; prospect?: boolean } = {},
): PlayerSeason {
  const s = makeDefaultSeason(id, season, teamId, age);
  const arch = pickArchetype(((archetypeSeed % 1000) / 1000 + rng.next()) % 1);
  const g = arch.groups;

  // Caliber is the player's general level before the archetype shapes it. Most of the league sits in
  // the 45-65 band with a thin tail of genuine stars, which is what makes stars feel scarce.
  // Most of the league clusters around a replacement-level core, with a deliberately thin upper tail so
  // genuine stars stay scarce — roughly 1-in-12 players rolls into star territory.
  const starRoll = rng.next();
  const starBonus = starRoll > 0.97 ? 22 + rng.next() * 12   // franchise player
    : starRoll > 0.92 ? 14 + rng.next() * 8                  // all-star
    : starRoll > 0.80 ? 7 + rng.next() * 6                   // quality starter
    : 0;
  // Young players are still raw: the same talent shows up a few points lower at 19 than at 25.
  // Draft prospects are rarer still at the top end, so each class adds a star or two, not a dozen.
  const rawness = Math.max(0, 24 - age) * 2.2;
  const caliber = opts.caliber ?? Math.max(30, Math.min(97, Math.round(
    52 + (rng.next() + rng.next() + rng.next() - 1.5) * 14 + starBonus * (opts.prospect ? 0.6 : 1) - rawness,
  )));

  const o = s.attributes.offense;
  o.closeShot = attr(rng, caliber, g.finishing);
  o.drivingLayup = attr(rng, caliber, g.finishing);
  o.drivingDunk = attr(rng, caliber, g.finishing * (g.athleticism > 1.1 ? 1.08 : 1));
  o.standingDunk = attr(rng, caliber, g.finishing * (g.size > 1.1 ? 1.1 : 0.9));
  o.finishing = attr(rng, caliber, g.finishing);
  o.touch = attr(rng, caliber, (g.finishing + g.midrange) / 2);
  o.postHook = attr(rng, caliber, g.postGame);
  o.postFade = attr(rng, caliber, g.postGame);
  o.postControl = attr(rng, caliber, g.postGame);
  o.midrange = attr(rng, caliber, g.midrange);
  o.longMidrange = attr(rng, caliber, g.midrange);
  o.threePoint = attr(rng, caliber, g.threePoint);
  o.corner3 = attr(rng, caliber, g.threePoint);
  o.aboveBreak3 = attr(rng, caliber, g.threePoint);
  o.pullUp3 = attr(rng, caliber, g.threePoint * (g.handling > 1.05 ? 1.05 : 0.9));
  o.catchAndShoot = attr(rng, caliber, g.offBall * g.threePoint);
  o.freeThrow = attr(rng, caliber, g.freeThrow);
  o.ballHandling = attr(rng, caliber, g.handling);
  o.ballSecurity = attr(rng, caliber, g.handling);
  o.speedWithBall = attr(rng, caliber, (g.handling + g.athleticism) / 2);
  o.passing = attr(rng, caliber, g.passing);
  o.passingAccuracy = attr(rng, caliber, g.passing);
  o.passingIQ = attr(rng, caliber, g.passing);
  o.offensiveIQ = attr(rng, caliber, g.offBall);
  o.shotIQ = attr(rng, caliber, g.offBall);
  o.decisionMaking = attr(rng, caliber, (g.passing + g.offBall) / 2);
  o.offensiveConsistency = attr(rng, caliber, 1, 10);
  o.offensiveRebounding = attr(rng, caliber, g.rebounding * 0.9);

  const d = s.attributes.defense;
  d.perimeterDefense = attr(rng, caliber, g.perimeterD);
  d.interiorDefense = attr(rng, caliber, g.interiorD);
  d.defensiveIQ = attr(rng, caliber, g.defensiveIQ);
  d.helpDefense = attr(rng, caliber, g.defensiveIQ);
  d.pickAndRollDefense = attr(rng, caliber, (g.defensiveIQ + g.perimeterD) / 2);
  d.closeout = attr(rng, caliber, g.perimeterD);
  d.contest = attr(rng, caliber, (g.perimeterD + g.interiorD) / 2);
  d.steal = attr(rng, caliber, g.steals);
  d.stealIQ = attr(rng, caliber, (g.steals + g.defensiveIQ) / 2);
  d.onBallSteal = attr(rng, caliber, g.steals);
  d.passingLaneSteal = attr(rng, caliber, (g.steals + g.defensiveIQ) / 2);
  d.block = attr(rng, caliber, g.blocks);
  d.blockIQ = attr(rng, caliber, (g.blocks + g.defensiveIQ) / 2);
  d.blockTiming = attr(rng, caliber, g.blocks);
  d.rimProtection = attr(rng, caliber, (g.blocks + g.interiorD) / 2);
  d.defensiveRebounding = attr(rng, caliber, g.rebounding);
  d.defensiveConsistency = attr(rng, caliber, 1, 10);
  d.defensiveAwareness = attr(rng, caliber, g.defensiveIQ);
  d.defensiveDiscipline = attr(rng, caliber, g.defensiveIQ);

  const ph = s.attributes.physical;
  ph.heightInches = Math.round(Math.max(69, Math.min(88, 72 + g.size * 6 + (rng.next() * 2 - 1) * 2.5)));
  ph.weightLbs = Math.round(150 + (ph.heightInches - 69) * 9 + g.strength * 18 + (rng.next() * 2 - 1) * 12);
  ph.standingReachInches = Math.round(ph.heightInches * 1.32 + rng.next() * 3);
  ph.balance = attr(rng, caliber, 1, 12);
  ph.wingspanInches = Math.round(ph.heightInches + 1 + rng.next() * 5);
  ph.speed = attr(rng, caliber, g.athleticism);
  ph.acceleration = attr(rng, caliber, g.athleticism);
  ph.agility = attr(rng, caliber, g.athleticism);
  ph.vertical = attr(rng, caliber, g.athleticism);
  ph.strength = attr(rng, caliber, g.strength);
  ph.stamina = attr(rng, caliber, 1, 10);
  ph.durability = attr(rng, caliber, 1, 14);

  const m = s.attributes.mental;
  for (const k of Object.keys(m) as (keyof typeof m)[]) m[k] = attr(rng, caliber, 1, 13);
  m.basketballIQ = attr(rng, caliber, (g.defensiveIQ + g.offBall) / 2);

  s.positions = { ...arch.positions };
  s.tendencies.ballDominance = jitter(rng, arch.ballDominance, 12);
  s.ballHandlerPriority = jitter(rng, arch.ballHandlerPriority, 12);
  for (const [role, value] of Object.entries(arch.roleHints)) {
    if (role in s.tendencies.role) (s.tendencies.role as unknown as Record<string, number>)[role] = jitter(rng, value as number, 10);
  }

  // Identity
  s.archetype = arch.key;
  s.archetypeLabel = arch.label;
  if (opts.origin) {
    s.nationality = opts.origin.nationality;
    s.college = opts.origin.college ?? undefined;
  }
  s.jerseyNumber = rng.nextInt(100);

  // Younger players have more room left; older ones are closer to what they already are. Potential is
  // measured on the same scale as Overall, true stars are rare (see compressElitePotential), and anyone
  // already in or past their prime is exactly what they are today (potential = overall).
  s.development.peakAge = 25 + rng.nextInt(3); // prime begins 25-27
  s.development.primeLengthYears = 3 + rng.nextInt(3); // and lasts 3-5 years, so decline typically starts ~29-32
  const overallNow = calculateOverall(s);
  const yearsToPeak = Math.max(0, s.development.peakAge - age);
  const projected = overallNow + yearsToPeak * (1 + rng.next() * 2) + (rng.next() * 2 - 1) * 3;
  s.development.potential = Math.max(overallNow, Math.min(99, Math.round(compressElitePotential(projected))));
  s.development.declineRate = Math.round(40 + rng.next() * 80); // some fall off a cliff, some age gracefully
  s.minutes = { mode: 'AI', target: arch.minutesBand[0] + rng.nextInt(arch.minutesBand[1] - arch.minutesBand[0] + 1) };

  s.badges = generateNormalBadges(s, rng);
  return syncPotential(s);
}

export interface GeneratedLeague {
  league: League;
  extras: GMLeagueExtras;
}

/**
 * Backfills a plausible historical draft record for a player who's already on a roster when a fresh
 * league is generated (they were never actually run through this session's draft flow). About 15% of
 * players go "Undrafted", matching how real rosters have a real share of undrafted contributors; the
 * rest get a year/round/pick that roughly tracks their overall (stars skew toward earlier picks, with
 * real noise so it's not a rigid one-to-one mapping).
 */
function applyHistoricalDraftInfo(player: PlayerSeason, seasonLabel: string, teamId: string, rng: RNG): PlayerSeason {
  if (rng.next() < 0.15) {
    return { ...player, draftYear: null, draftRound: null, draftPick: null, draftTeamId: null };
  }
  const startYear = parseInt(seasonLabel.slice(0, 4), 10);
  const draftAge = 19 + rng.nextInt(4); // most players enter around 19-22
  const yearsIn = Math.max(0, player.age - draftAge);
  const draftYear = Number.isNaN(startYear) ? null : `${startYear - yearsIn}-${String((startYear - yearsIn + 1) % 100).padStart(2, '0')}`;

  const overall = calculateOverall(player);
  // Better players skew toward earlier picks on average, but the noise is wide enough that plenty of
  // late picks turned into good players and plenty of lottery picks busted — same as real drafts.
  const expectedRank = Math.max(1, Math.min(60, Math.round(60 - (overall - 40) * 1.1)));
  const pick = Math.max(1, Math.min(60, Math.round(expectedRank + (rng.next() - 0.5) * 40)));
  const round = pick <= 30 ? 1 : 2;
  const draftTeamId = rng.next() < 0.8 ? teamId : null; // most stayed with the team that drafted them; some moved on before we ever see them

  return { ...player, draftYear, draftRound: round, draftPick: pick, draftTeamId };
}

export function generateFullLeague(
  seed = 1, teamCount = 30, rosterSize = 18, gamesPerTeam = 82, seasonLabel = '2026',
  /** Set `priorSeasons: false` to skip the synthetic "season zero" history and start every player with a blank career. */
  opts: { priorSeasons?: boolean } = {},
): GeneratedLeague {
  const rng = new RNG(seed);
  const teams: LeagueTeam[] = [];
  const contracts: Record<string, Contract> = {};
  const usedNames = new Set<string>();
  const usedCoachNames = new Set<string>();

  for (let t = 0; t < teamCount; t++) {
    const [city, mascot] = CITY_MASCOTS[t % CITY_MASCOTS.length];
    const teamId = `GEN${t.toString().padStart(2, '0')}`;
    const name = `${city} ${mascot}`;
    const seasons: PlayerSeason[] = [];

    for (let p = 0; p < rosterSize; p++) {
      const age = 19 + rng.nextInt(17); // 19-35
      const origin = generatePlayerOrigin(rng, usedNames);
      const player = generatePlayer(origin.name, seasonLabel, teamId, age, p, rng, { origin });
      seasons.push(applyHistoricalDraftInfo(player, seasonLabel, teamId, rng));
    }

    // Salaries are assigned by roster rank (best player down to last), not raw overall alone, so a
    // freshly generated team's total payroll lands comfortably under the cap on average - like a real
    // team that has actually built a roster - rather than randomly blowing past it before the user even
    // makes a move. Each rank gets a smaller share than the one above it (a real "star to scrub" curve),
    // scaled so the whole roster targets ~88% of the cap, then jittered +/-10% per player.
    const ranked = [...seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a));
    const weights = ranked.map((_, i) => Math.pow(0.80, i));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const targetTotal = DEFAULT_CAP_SETTINGS.salaryCap * 0.88;
    const MIN_SALARY = 1_200_000;
    ranked.forEach((s, i) => {
      const rawShare = (weights[i] / weightSum) * targetTotal;
      const jittered = rawShare * (0.9 + rng.next() * 0.2);
      contracts[s.playerId] = {
        playerId: s.playerId, teamId,
        annualSalary: Math.max(MIN_SALARY, Math.round(jittered)),
        yearsRemaining: 1 + rng.nextInt(4),
        playerOption: rng.next() < 0.1,
        teamOption: rng.next() < 0.15,
      };
    });

    teams.push({ teamId, name, seasons, coach: { ...defaultCoachTendencies(), paceTendency: jitter(rng, 50, 20) }, chemistry: jitter(rng, 65, 20), coachIdentity: generateCoachIdentity(rng, seasonLabel, usedCoachNames), expenseLevels: { scouting: jitter(rng, 50, 25), coaching: jitter(rng, 50, 25), health: jitter(rng, 50, 25), facilities: jitter(rng, 50, 25) } });
  }

  // "Season zero": give players who've plausibly already played a few seasons a synthetic stat history, so
  // a brand-new league doesn't open with every career table blank. Uses its own RNG stream (derived from the
  // seed) so it never shifts anything else the generator rolls, and stays reproducible per seed.
  if (opts.priorSeasons !== false) {
    const historyRng = new RNG(seed + 31_337);
    const allTeamIds = teams.map((t) => t.teamId);
    for (const team of teams) {
      team.seasons = team.seasons.map((p) => {
        const history = generatePriorSeasons(p, seasonLabel, gamesPerTeam, allTeamIds, historyRng);
        return history.length > 0 ? { ...p, careerHistory: history } : p;
      });
    }
  }

  const teamsWithConferences = assignMarketSizes(assignConferencesAndDivisions(teams), rng);
  const schedule = generateSeasonSchedule(teamsWithConferences.map((t) => t.teamId), gamesPerTeam);
  const league: League = {
    teams: teamsWithConferences, schedule, settings: { ...DEFAULT_GAME_SETTINGS }, season: seasonLabel,
    calendarDate: seasonStartDate(seasonLabel), calendarRound: -1,
  };
  const extras: GMLeagueExtras = {
    contracts,
    freeAgents: [],
    capSettings: { ...DEFAULT_CAP_SETTINGS },
    draftClass: generateDraftClass(pickDraftClassSize(teamCount, rng), seed + 9999, `${parseInt(seasonLabel) + 1}`, usedNames),
    tradeSettings: { ...DEFAULT_TRADE_SETTINGS },
    ...DEFAULT_GM_FLAGS,
    freeAgencyOpen: true,
    teamPersonalities: assignGMPersonalities(teams.map((t) => t.teamId), seed + 42424),
    futurePicks: generateFutureDraftPicks(teamsWithConferences.map((t) => t.teamId), parseInt(seasonLabel.slice(0, 4), 10) + 1),
  };

  return { league, extras };
}
