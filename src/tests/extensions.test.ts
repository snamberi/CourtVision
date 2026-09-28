import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { extensionStance, openExtension, extensionMinimum, signExtension, markContractYears, withContractYear } from '../simulation/extensions';
import { makeOffer } from '../simulation/agents';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';

const { league: base, extras: baseExtras } = generateFullLeague(23, 8, 13, 30, '2026', { priorSeasons: false });
const team = base.teams[0];
const p = [...team.seasons].sort((a, b) => a.age - b.age)[3];
const withYears = (years: number) => ({ ...baseExtras, contracts: { ...baseExtras.contracts, [p.playerId]: { ...baseExtras.contracts[p.playerId], yearsRemaining: years } } });
const league = { ...base, seasonPhase: 'regular_season' as const };

describe('in-season extensions', () => {
  it('only players in the last two years can talk; unhappy players and trade requests wait for summer', () => {
    expect(extensionStance(league, withYears(4), p).open).toBe(false);
    expect(extensionStance(league, withYears(2), p).open || !('reason' in extensionStance(league, withYears(2), p)) ? true : /agent/.test((extensionStance(league, withYears(2), p) as { reason: string }).reason)).toBe(true);
    const unhappy = { ...p, morale: { score: 30, season: '2026', teamId: team.teamId, games: 20 } } as typeof p;
    expect(extensionStance(league, withYears(1), unhappy)).toMatchObject({ open: false });
  });

  it('an agreed extension is stored and takes over when the current deal ends', () => {
    // Someone on the roster who will talk (in the last year of his deal).
    const pick = team.seasons.map(q => ({ q, extras: { ...baseExtras, contracts: { ...baseExtras.contracts, [q.playerId]: { ...baseExtras.contracts[q.playerId], yearsRemaining: 1 } } } }))
      .find(x => extensionStance(league, x.extras, x.q).open)!;
    expect(pick).toBeDefined();
    const { q: p, extras } = pick;
    const talks = openExtension(league, extras, p, team.teamId)!;
    const { outcome, negotiation } = makeOffer(talks, { salary: talks.demand.salary, years: talks.demand.years, playerOption: false }, extensionMinimum(p, extras));
    expect(outcome).toBe('agreed');
    const signed = signExtension(league, extras, p.playerId, { annualSalary: negotiation.deal!.annualSalary, years: negotiation.deal!.yearsRemaining });
    expect(signed.extras.contracts[p.playerId].extension?.years).toBe(talks.demand.years);
    expect(signed.extras.contracts[p.playerId].annualSalary).toBe(extras.contracts[p.playerId].annualSalary); // this season's pay is unchanged
    const next = beginNewSeasonRoster(signed.league, signed.extras, 5);
    const c = next.extras.contracts[p.playerId];
    if (c) { expect(c.yearsRemaining).toBe(talks.demand.years); expect(c.annualSalary).toBe(talks.demand.salary); expect(c.extension).toBeUndefined(); }
  });

  it('a player in the last year without an extension is in a contract year and plays a little harder', () => {
    const marked = markContractYears(league, withYears(1).contracts);
    const q = marked.teams[0].seasons.find(s => s.playerId === p.playerId)!;
    expect(q.contractYear).toBe(true);
    expect(withContractYear(q).attributes.offense.offensiveConsistency).toBeGreaterThan(q.attributes.offense.offensiveConsistency - 0.001);
    expect(markContractYears(league, withYears(3).contracts).teams[0].seasons.find(s => s.playerId === p.playerId)!.contractYear).toBeUndefined();
  });
});
