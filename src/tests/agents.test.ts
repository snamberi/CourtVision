import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { agentFor, makeOffer, openNegotiation, storeNegotiation, walkAway, negotiationStories, offerValue } from '../simulation/agents';
import { signingDecision, signFreeAgentChecked } from '../simulation/freeAgentDecision';
import { calculateOverall } from '../simulation/engine/overall';
import type { PlayerSeason } from '../simulation/types';

const { league: base, extras: baseExtras } = generateFullLeague(12, 30, 13, 4, '2026');
const league = { ...base, seasonPhase: 'free_agency' as const };
const me = league.teams[29].teamId;
// Free agency open, room on the roster, plenty of cap room for the test.
const extras = { ...baseExtras, freeAgencyOpen: true, capSettings: { ...baseExtras.capSettings, salaryCap: 400_000_000, maxRosterSize: 20 } };
const pool = league.teams.slice(0, 28).flatMap(t => t.seasons);
const fa = (pred: (p: PlayerSeason) => boolean) => ({ ...pool.find(pred)!, teamId: null });
const withFa = (p: PlayerSeason) => ({ ...extras, freeAgents: [...extras.freeAgents, p] });

describe('contract talks with agents', () => {
  it('every player has a stable agent, and talks open with a demand at or above the league price', () => {
    const p = fa(s => calculateOverall(s) < 70);
    expect(agentFor(p)).toEqual(agentFor(p));
    const ex = withFa(p);
    const talks = openNegotiation(league, ex, p, me)!;
    const required = signingDecision(league, ex, p, me).required;
    expect(talks.demand.salary).toBeGreaterThanOrEqual(required);
    expect(talks.floor).toBeGreaterThanOrEqual(required);
    expect(talks.floor).toBeLessThanOrEqual(talks.demand.salary);
    expect(talks.log[0].from).toBe('agent');
  });

  it('meeting the ask signs him; lowballing loses patience until he walks and then refuses you', () => {
    const p = fa(s => calculateOverall(s) < 70);
    const ex = withFa(p);
    const talks = openNegotiation(league, ex, p, me)!;
    const required = signingDecision(league, ex, p, me).required;
    const yes = makeOffer(talks, talks.demand, required);
    expect(yes.outcome).toBe('agreed');
    const signed = signFreeAgentChecked(league, storeNegotiation(ex, yes.negotiation), p.playerId, me, yes.negotiation.deal!);
    expect(signed.decision.accepted).toBe(true);
    expect(signed.league.teams.find(t => t.teamId === me)!.seasons.some(s => s.playerId === p.playerId)).toBe(true);

    let n = talks;
    for (let i = 0; i < 6 && n.status === 'open'; i++) n = makeOffer(n, { salary: extras.capSettings.minSalary, years: 1, playerOption: false }, required).negotiation;
    expect(n.status).toBe('walked');
    const after = storeNegotiation(ex, n);
    expect(signingDecision(league, after, p, me).refuses).toBe(true);
    expect(signingDecision(league, after, p, league.teams[28].teamId).refuses).toBe(false); // other teams can still sign him
    expect(negotiationStories(league, after).some(s => s.headline.startsWith('Talks collapse'))).toBe(true);
  });

  it('a counter meets you partway, and settling near the floor closes the deal', () => {
    const p = fa(s => calculateOverall(s) < 72 && calculateOverall(s) > 55);
    const ex = withFa(p);
    const talks = openNegotiation(league, ex, p, me)!;
    const required = signingDecision(league, ex, p, me).required;
    expect(talks.demand.salary).toBeGreaterThan(talks.floor);
    const first = makeOffer(talks, { ...talks.demand, salary: talks.floor }, required);
    expect(['countered', 'agreed']).toContain(first.outcome);
    if (first.outcome === 'countered') {
      expect(first.negotiation.demand.salary).toBeLessThan(talks.demand.salary);
      expect(first.negotiation.demand.salary).toBeGreaterThanOrEqual(talks.floor);
    }
  });

  it('years and a missing option change what an offer is worth to the camp', () => {
    const p = fa(s => calculateOverall(s) < 70);
    const talks = openNegotiation(league, withFa(p), p, me)!;
    const right = offerValue(talks, talks.demand);
    const off = offerValue(talks, { ...talks.demand, years: talks.demand.years === 1 ? 3 : 1 });
    expect(off).toBeLessThan(right);
  });

  it('a hardball agent for a star in his prime issues a max-or-walk ultimatum', () => {
    const top = pool.map(s => ({ ...s, teamId: null })).filter(s => calculateOverall(s) >= 78 && s.age <= 31).sort((a, b) => calculateOverall(a) - calculateOverall(b))[0];
    expect(top).toBeTruthy();
    // Find a name for him that hashes to a hardball agency.
    let star = top;
    for (let i = 0; agentFor(star).style !== 'Hardball'; i++) star = { ...top, playerId: `${top.playerId} ${i}` };
    const ex = withFa(star);
    const talks = openNegotiation(league, ex, star, me)!;
    expect(talks).toBeTruthy();
    expect(talks.ultimatum).toBe(true);
    expect(talks.demand.salary).toBe(Math.round(extras.capSettings.salaryCap * extras.capSettings.maxSalaryPctOfCap / 50_000) * 50_000);
    const required = signingDecision(league, ex, star, me).required;
    expect(makeOffer(talks, { ...talks.demand, salary: talks.demand.salary - 1_000_000 }, required).outcome).toBe('walked');
    expect(makeOffer(talks, talks.demand, required).outcome).toBe('agreed');
    expect(negotiationStories(league, storeNegotiation(ex, talks)).some(s => s.headline.includes('a max deal or he walks'))).toBe(true);
  });

  it('ending talks yourself is final for this offseason', () => {
    const p = fa(s => calculateOverall(s) < 70);
    const ex = withFa(p);
    const ended = walkAway(openNegotiation(league, ex, p, me)!);
    expect(ended.status).toBe('walked');
  });
});
