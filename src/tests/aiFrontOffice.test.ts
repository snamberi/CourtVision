import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateFullRound, type League } from '../simulation/league';
import { runTradeMarketAI, runFreeAgencyAI, generateTradeOfferForControlledTeam, offerKey } from '../simulation/aiGM';
import { expectedGrowth } from '../simulation/growth';
import { computeTradeValue, type GMLeagueExtras } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import type { PlayerSeason } from '../simulation/types';

/** A copy of a player at a given rating (every attribute moved by the same amount), age and potential. */
function shaped(base: PlayerSeason, target: number, age: number, potential: number): PlayerSeason {
  const shift = (o: Record<string, number>, d: number) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.max(1, Math.min(99, v + d))]));
  let p = base;
  for (let i = 0; i < 12; i++) {
    const d = target - calculateOverall(p);
    if (Math.abs(d) < 1) break;
    p = { ...p, attributes: { ...p.attributes, offense: shift(p.attributes.offense as unknown as Record<string, number>, d) as never, defense: shift(p.attributes.defense as unknown as Record<string, number>, d) as never } };
  }
  return { ...p, age, development: { ...p.development, potential } };
}

describe('AI front offices', () => {
  const g = generateFullLeague(77, 30, 14, 82, '2026', { priorSeasons: false });
  const base = g.league.teams[0].seasons[0];

  it('values youth by the growth players really show: a bench kid is not worth a proven veteran', () => {
    const kid = shaped(base, 38, 20, 72), prospect = shaped(base, 55, 21, 72), vet = shaped(base, 70, 33, 70), done = shaped(base, 60, 28, 75);
    expect(expectedGrowth(kid)).toBeLessThan(expectedGrowth(prospect)); // he barely plays, so he barely grows
    expect(expectedGrowth(done)).toBe(0);
    expect(computeTradeValue(vet)).toBeGreaterThan(computeTradeValue(kid) + 15);
    expect(computeTradeValue(prospect)).toBeGreaterThan(calculateOverall(prospect));
  });

  it('AI trades make the buyer better today and never cost it one of its top five', () => {
    let league: League = { ...g.league, settings: { ...g.league.settings, injuriesEnabled: false } }, extras: GMLeagueExtras = g.extras;
    let trades = 0;
    const top = (l: League, id: string, n: number) => [...l.teams.find(t => t.teamId === id)!.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a)).slice(0, n);
    for (let day = 0; day < 18; day++) {
      league = simulateFullRound(league, day);
      const r = runTradeMarketAI(league, extras, null, 3000 + day, 3);
      for (const t of r.trades) {
        trades++;
        const age = (team: string, ids: string[]) => Math.max(...ids.map(id => league.teams.find(x => x.teamId === team)!.seasons.find(p => p.playerId === id)?.age ?? 0), 0);
        const buyer = age(t.teamBId, t.playersFromB) >= age(t.teamAId, t.playersFromA) ? t.teamAId : t.teamBId;
        const gave = buyer === t.teamAId ? t.playersFromA : t.playersFromB;
        const core = new Set(top(league, buyer, 5).map(p => p.playerId));
        expect(gave.some(id => core.has(id))).toBe(false);
        const sum = (ps: PlayerSeason[]) => ps.reduce((n, p) => n + calculateOverall(p), 0);
        expect(sum(top(r.league, buyer, 8))).toBeGreaterThan(sum(top(league, buyer, 8)));
      }
      league = r.league; extras = r.extras;
    }
    expect(trades).toBeGreaterThan(0);
  }, 300_000);

  it('free agency: thin rosters fill to 13, and teams with cap room add real depth', () => {
    const extras: GMLeagueExtras = { ...g.extras, freeAgencyOpen: true };
    const [me, thin, roomy] = g.league.teams;
    const trimmed = { ...thin, seasons: thin.seasons.slice(0, 10) };
    const pool = g.league.teams.slice(5, 9).flatMap(t => t.seasons.slice(0, 3)).map(p => ({ ...p, teamId: null }));
    const league: League = { ...g.league, teams: [me, trimmed, roomy] };
    const contracts = Object.fromEntries(Object.entries(extras.contracts).filter(([id]) => !pool.some(p => p.playerId === id)));
    // One signing per team per day, as in the 30-day window.
    let r: { league: League; extras: GMLeagueExtras; signings: { teamId: string; playerId: string }[] } = { league, extras: { ...extras, contracts, freeAgents: pool }, signings: [] };
    for (let day = 0; day < 6; day++) { const next = runFreeAgencyAI(r.league, r.extras, me.teamId, 5 + day, 40); r = { ...next, signings: [...r.signings, ...next.signings] }; }
    expect(r.league.teams.find(t => t.teamId === thin.teamId)!.seasons.length).toBeGreaterThanOrEqual(13);
    // Nobody takes a free agent who wouldn't crack a full roster's top ten.
    for (const s of r.signings.filter(x => x.teamId === roomy.teamId)) {
      const p = pool.find(x => x.playerId === s.playerId)!;
      const tenth = roomy.seasons.map(calculateOverall).sort((a, b) => b - a)[9];
      expect(calculateOverall(p)).toBeGreaterThan(tenth);
    }
  });

  it('a declined offer is not pitched again this season', () => {
    let league: League = g.league;
    for (let d = 0; d < 20; d++) league = simulateFullRound(league, d);
    const me = league.teams[0].teamId;
    let extras: GMLeagueExtras = g.extras;
    const keys: string[] = [];
    for (let i = 0; i < 40; i++) {
      const offer = generateTradeOfferForControlledTeam(league, extras, me, 50 + i);
      if (!offer) continue;
      const key = offerKey(league, offer);
      expect(keys).not.toContain(key);
      keys.push(key);
      extras = { ...extras, declinedOffers: [...(extras.declinedOffers ?? []), key] };
    }
    expect(keys.length).toBeGreaterThan(0);
  }, 120_000);
});

describe('pending offers', () => {
  it('an offer whose player has since moved is withdrawn on the next AI pass', async () => {
    const { runLeagueAIPass } = await import('../simulation/aiGM');
    const g = generateFullLeague(78, 8, 13, 20, '2026', { priorSeasons: false });
    const [me, them] = g.league.teams;
    const gone = { teamAId: me.teamId, teamBId: them.teamId, playersFromA: [me.seasons[0].playerId], playersFromB: ['Nobody Anymore'] };
    const live = { teamAId: me.teamId, teamBId: them.teamId, playersFromA: [me.seasons[1].playerId], playersFromB: [them.seasons[1].playerId] };
    const r = runLeagueAIPass(g.league, { ...g.extras, pendingTradeOffers: [gone, live] }, me.teamId, 3);
    expect(r.extras.pendingTradeOffers).toContainEqual(live);
    expect(r.extras.pendingTradeOffers).not.toContainEqual(gone);
  });
});
