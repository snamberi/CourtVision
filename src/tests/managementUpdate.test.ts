import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { manageCoachRosters, normalizeRosterRules } from '../simulation/coachRosters';
import { simulateNextGame } from '../simulation/league';
import { currentDraftOrder, generateDraftClass, validateTrade, executeTrade, computeDraftPickValue, rookieContract, DEFAULT_CAP_SETTINGS } from '../simulation/gm';
import { draftOnePick } from '../simulation/aiGM';
import { rankedProspects, prospectComparison } from '../simulation/draftScouting';
import { NORMAL_BADGES } from '../simulation/badges';
import { resolveEffectivePlayer } from '../simulation/engine/effective';
import { ARCHETYPES } from '../simulation/archetypes';
import { computeSeasonAwards } from '../simulation/awards';
import { getPlayerAwardsHistory } from '../simulation/leagueAnalytics';
import { emptySeasonStatTotals } from '../simulation/types';
import { createSave, updateSave, getSave, renameSave, listSaves, deleteSave } from '../storage/saves';

const fixture = () => generateFullLeague(841, 4, 12, 6, '2026', { priorSeasons: false });
function draftFixture(n = 4) {
  const state = generateFullLeague(841, n, 12, 6, '2026', { priorSeasons: false });
  state.league.seasonPhase = 'draft';
  state.extras.draftDayOpen = true;
  state.extras.draftPickIndex = 0;
  state.extras.draftPicksMade = [];
  const ids = state.league.teams.map(t => t.teamId);
  state.extras.draftOrder = [...ids, ...ids];
  state.extras.draftClass = generateDraftClass(n * 2 + 7, 19, '2026');
  return state;
}

describe('coach roster management', () => {
  it('fills and trims every team, preserving people, contracts and transaction history', () => {
    const state = fixture();
    state.extras.freeAgents = generateDraftClass(12, 927, '2026').map(p => p.trueSeason);
    const [a, b] = state.league.teams;
    const departing = b.seasons.slice(5);
    a.seasons.push(...departing.map(p => ({ ...p, teamId: a.teamId })));
    b.seasons = b.seasons.slice(0, 5);
    const idsBefore = [...state.league.teams.flatMap(t => t.seasons), ...state.extras.freeAgents].map(p => p.playerId).sort();
    const result = manageCoachRosters(state.league, state.extras);
    expect(result.league.teams[0].seasons).toHaveLength(18);
    expect(result.league.teams[1].seasons).toHaveLength(10);
    expect([...result.league.teams.flatMap(t => t.seasons), ...result.extras.freeAgents].map(p => p.playerId).sort()).toEqual(idsBefore);
    expect(result.extras.freeAgencyOpen).toBe(state.extras.freeAgencyOpen);
    for (const move of result.moves) {
      const p = result.league.teams.flatMap(t => t.seasons).find(p => p.playerId === move.playerId) ?? result.extras.freeAgents.find(p => p.playerId === move.playerId)!;
      expect(p.history?.some(h => h.type === move.kind)).toBe(true);
      if (move.kind === 'signed') expect(result.extras.contracts[move.playerId].teamId).toBe(move.teamId);
    }
    expect(manageCoachRosters(result.league, result.extras).moves).toEqual([]);
  });
  it.each(['draft', 'resign_waive', 'free_agency', 'preseason', 'playoffs', 'awards_recap', 'all_star'] as const)('leaves %s rosters alone', phase => {
    const { league, extras } = fixture(); league.seasonPhase = phase; league.teams[0].seasons = [];
    const result = manageCoachRosters(league, extras);
    expect(result.league).toBe(league); expect(result.extras).toBe(extras);
  });
  it('blocks only a regular-season game when a legal roster cannot be formed', () => {
    const state = fixture(); state.league.teams[0].seasons = state.league.teams[0].seasons.slice(0, 9);
    state.extras.freeAgents = []; state.league.settings.injuriesEnabled = false;
    const { league, extras } = normalizeRosterRules(state.league, state.extras);
    expect(manageCoachRosters(league, extras).moves).toHaveLength(0);
    expect(simulateNextGame(league)).toBe(league);
    expect(simulateNextGame({ ...league, seasonPhase: 'preseason' }).schedule[0].played).toBe(true);
  });
  it('honors a hard cap instead of silently signing unaffordable contracts', () => {
    const state = fixture(); state.league.teams[0].seasons = [];
    state.extras.capSettings = { ...DEFAULT_CAP_SETTINGS, hardCapEnabled: true, salaryCap: 1 };
    expect(manageCoachRosters(state.league, state.extras).league.teams[0].seasons).toHaveLength(0);
  });
});

describe('two-round draft and trading', () => {
  it.each([4, 6, 30])('makes exactly two rounds for %i teams; the last manual pick closes the draft', n => {
    let { league, extras } = draftFixture(n);
    // Imported third-round rows never create more picks.
    extras.draftOrder!.push(...league.teams.map(t => t.teamId));
    expect(currentDraftOrder(league, extras)).toHaveLength(n * 2);
    const beforeFA = extras.freeAgents.length;
    for (let i = 0; i < n * 2; i++) { const next = draftOnePick(league, extras); league = next.league; extras = next.extras; }
    expect(extras.draftPicksMade).toHaveLength(n * 2);
    expect(extras.draftDayOpen).toBe(false);
    expect(extras.freeAgents).toHaveLength(beforeFA + 7);
    expect(extras.draftClass).toHaveLength(0);
    expect(league.teams.flatMap(t => t.seasons).every(p => (p.draftRound ?? 0) <= 2)).toBe(true);
  });
  it('rejects a late pick for the top pick; accepts a balanced package and transfers every asset once', () => {
    const { league, extras } = draftFixture();
    const [a, b] = league.teams;
    extras.capSettings.enforceCapOnTrades = false;
    const poor = { teamAId: b.teamId, teamBId: a.teamId, playersFromA: [], playersFromB: [], currentPicksFromA: [5], currentPicksFromB: [0] };
    expect(validateTrade(league, extras, poor).valid).toBe(false);
    expect(validateTrade(league, extras, poor).reasons.join(' ')).not.toContain('Package values:');
    const balanced = { ...poor, currentPicksFromA: [1, 5], playersFromA: [b.seasons[0].playerId] };
    // Match quality deterministically while retaining a real player and two pick assets. Value grows steeply with
    // quality, so the #1 pick needs a solid starter (about 76 Overall) on top of the two lesser picks.
    for (const group of [b.seasons[0].attributes.offense, b.seasons[0].attributes.defense, b.seasons[0].attributes.mental]) for (const key of Object.keys(group)) (group as unknown as Record<string, number>)[key] = 74;
    b.seasons[0].development.potential = 74;
    expect(validateTrade(league, extras, balanced).reasons).toEqual([]);
    const result = executeTrade(league, extras, balanced);
    expect(result.extras.draftOrder).toHaveLength(8);
    expect(result.extras.draftOrder?.[0]).toBe(b.teamId);
    expect(result.extras.draftOrder?.[1]).toBe(a.teamId);
    expect(result.extras.draftOrder?.[5]).toBe(a.teamId);
    expect(result.league.teams[0].seasons.some(p => p.playerId === balanced.playersFromA[0])).toBe(true);
    expect(result.extras.contracts[balanced.playersFromA[0]].teamId).toBe(a.teamId);
    expect(validateTrade(result.league, result.extras, balanced).valid).toBe(false);
  });
  it('refuses duplicate, stale, self and empty packages without changing ownership', () => {
    const { league, extras } = draftFixture(); const [a, b] = league.teams;
    const base = { teamAId: a.teamId, teamBId: b.teamId, playersFromA: [], playersFromB: [], currentPicksFromA: [0], currentPicksFromB: [1] };
    for (const p of [{ ...base, currentPicksFromA: [0, 0] }, { ...base, teamBId: a.teamId }, { ...base, currentPicksFromA: [] }]) {
      expect(validateTrade(league, extras, p).valid).toBe(false);
      expect(executeTrade(league, extras, p).extras).toBe(extras);
    }
    expect(validateTrade(league, { ...extras, draftPickIndex: 1 }, base).valid).toBe(false);
    expect(computeDraftPickValue(0, extras.draftOrder!, league)).toBe(computeDraftPickValue(0, [...extras.draftOrder!].reverse(), league));
  });
  it('updates the three-player shortlist and compares seven categories', () => {
    const { league, extras } = draftFixture();
    const top = rankedProspects(extras.draftClass).slice(0, 3);
    expect(Object.keys(prospectComparison(top[0].trueSeason))).toEqual(['Shooting', 'Height', 'Finishing', 'Playmaking', 'Defense', 'Rebounding', 'Athleticism']);
    const next = draftOnePick(league, { ...extras, draftClass: [top[0]] });
    expect(rankedProspects(next.extras.draftClass).some(p => p.playerId === top[0].playerId)).toBe(false);
  });
  it('scales rookie salary and term by the slot, with a minimum-salary floor', () => {
    expect(rookieContract(0, 30, DEFAULT_CAP_SETTINGS).annualSalary).toBeGreaterThan(rookieContract(29, 30, DEFAULT_CAP_SETTINGS).annualSalary);
    expect(rookieContract(30, 30, DEFAULT_CAP_SETTINGS).yearsRemaining).toBe(2);
    expect(rookieContract(59, 30, DEFAULT_CAP_SETTINGS).annualSalary).toBeGreaterThanOrEqual(DEFAULT_CAP_SETTINGS.minSalary);
  });
});

describe('badges, player builds and awards', () => {
  it('generates 0–3 distinct normal badges, with every count represented', () => {
    const { league, extras } = generateFullLeague(845, 30, 18, 6, '2026', { priorSeasons: false });
    const people = [...league.teams.flatMap(t => t.seasons), ...extras.freeAgents];
    expect(new Set(people.map(p => p.badges.length))).toEqual(new Set([0, 1, 2, 3]));
    for (const p of people) { expect(new Set(p.badges).size).toBe(p.badges.length); expect(p.badges.every(id => NORMAL_BADGES.some(b => b.id === id))).toBe(true); }
    expect(NORMAL_BADGES.length).toBe(27);
    for (const key of ['deepRangeCreator', 'pointCenter', 'switchBig', 'postTechnician', 'movementSniper', 'defensivePlaymaker']) expect(ARCHETYPES.some(a => a.key === key)).toBe(true);
  });
  it('does not stack duplicate badges or activate experimental effects outside sandbox', () => {
    const p = fixture().league.teams[0].seasons[0];
    const normal = resolveEffectivePlayer({ ...p, badges: ['deep_range'] });
    expect(resolveEffectivePlayer({ ...p, badges: ['deep_range', 'deep_range', 'clutch_god', 'perfect_shooter'] })).toEqual(normal);
    expect(resolveEffectivePlayer({ ...p, badges: ['clutch_god'] }, [], true).attributes.mental.clutch).toBe(p.attributes.mental.clutch + 100);
  });
  it('exempts an injured absence from relationship loss in the actual game flow', () => {
    const { league } = fixture(); const game = league.schedule[0]; const team = league.teams.find(t => t.teamId === game.homeTeamId)!; const p = team.seasons[0];
    league.settings.injuriesEnabled = false;
    league.injuries = { [p.playerId]: { playerId: p.playerId, teamId: team.teamId, gamesRemaining: 4, severity: 'minor', totalGames: 4 } } as typeof league.injuries;
    team.coachIdentity!.relationships[p.playerId] = 75;
    const after = simulateNextGame(league, 7);
    expect(after.teams.find(t => t.teamId === team.teamId)?.coachIdentity?.relationships[p.playerId]).toBe(75);
  });
  it('awards real production, excludes non-playing rookies and keeps honors in career history', () => {
    const { league } = fixture(); const p = league.teams[0].seasons[0];
    p.seasonStats = { ...emptySeasonStatTotals(), gamesPlayed: 10, minutes: 350, points: 250, tpm: 30, tpa: 65, ftm: 40, ast: 80, tov: 12, stl: 16, blk: 15 };
    p.careerHistory = []; p.age = 24; p.draftYear = league.season;
    const awards = computeSeasonAwards(league, { minGames: 1 });
    for (const key of ['sharpshooter', 'floorGeneral', 'paintScorer', 'ironMan', 'rookieDefender'] as const) expect(awards[key]?.playerId).toBe(p.playerId);
    league.franchiseHistory = [{ season: '2026', championTeamId: null, championTeamName: null, mvpPlayerId: null, mvpTeamName: null, dpoyPlayerId: null, royPlayerId: null, fmvpPlayerId: null, fullAwards: awards }];
    expect(getPlayerAwardsHistory(league, p.playerId).map(a => a.label)).toContain('Sharpshooter of the Year');
  });
});

it('serializes rapid saves, preserves a concurrent rename, and does not resurrect a deleted slot', async () => {
  const { league, extras } = fixture(); const id = await createSave('Original', league, extras, null);
  const writes = Array.from({ length: 10 }, (_, i) => updateSave(id, { ...league, season: `${2030 + i}` }, { ...extras, tradeSettings: { ...extras.tradeSettings, showValues: true } }, null));
  await Promise.all([...writes, renameSave(id, 'Renamed')]);
  expect((await getSave(id))?.league.season).toBe('2039');
  expect((await getSave(id))?.extras.tradeSettings.showValues).toBe(true);
  expect((await listSaves()).find(s => s.id === id)?.name).toBe('Renamed');
  await deleteSave(id); await updateSave(id, league, extras, null); expect(await getSave(id)).toBeNull();
});
