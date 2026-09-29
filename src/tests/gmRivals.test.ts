import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { ensureGmRivals, rivalRefuses, rivalAgenda, rivalNews, REFUSE_AT } from '../simulation/gmRivals';
import { executeTrade } from '../simulation/gm';
import { talksClosed } from '../simulation/tradeTalks';
import { calculateOverall } from '../simulation/engine/overall';

const { league: base, extras } = generateFullLeague(31, 10, 13, 20, '2026', { priorSeasons: false });
const me = base.teams[0].teamId;

describe('GM rivals', () => {
  it('names three rival GMs, one of each personality, and keeps them stable', () => {
    const l = ensureGmRivals(base, me);
    expect(l.gmRivals!.rivals.map(r => r.archetype)).toEqual(['shark', 'collector', 'oldschool']);
    expect(l.gmRivals!.rivals.every(r => r.teamId !== me && r.name.includes(' '))).toBe(true);
    expect(ensureGmRivals(l, me)).toBe(l);
    for (const r of l.gmRivals!.rivals) expect(rivalAgenda(l, extras, r).text.length).toBeGreaterThan(10);
  });
  it('remembers a lopsided trade: a grudge, a news line, and closed phones if it is bad enough', () => {
    let l = ensureGmRivals(base, me);
    const rival = l.gmRivals!.rivals[0];
    const mine = [...l.teams[0].seasons].sort((a, b) => calculateOverall(a) - calculateOverall(b))[0];
    const theirs = [...l.teams.find(t => t.teamId === rival.teamId)!.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
    const done = executeTrade(l, extras, { teamAId: me, teamBId: rival.teamId, playersFromA: [mine.playerId], playersFromB: [theirs.playerId] });
    l = done.league;
    const after = l.gmRivals!.rivals.find(r => r.teamId === rival.teamId)!;
    expect(after.relation).toBeLessThan(0);
    expect(after.memory).toHaveLength(1);
    expect(rivalNews(l)[0].headline).toContain(rival.name);
    const bitter = { ...l, gmRivals: { ...l.gmRivals!, rivals: l.gmRivals!.rivals.map(r => r.teamId === rival.teamId ? { ...r, relation: REFUSE_AT } : r) } };
    expect(rivalRefuses(bitter, rival.teamId)).toBe(true);
    expect(talksClosed(bitter, extras, rival.teamId)).toBe(true);
  });
});
