import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds } from '../simulation/league';
import { collectLockerEvents, answerLocker, lockerState, LOCKER_EVERY } from '../simulation/lockerRoom';

const { league: base } = generateFullLeague(42, 8, 13, 40, '2026', { priorSeasons: false });

describe('locker room', () => {
  it('a moment every couple of weeks, and the choice changes the players', () => {
    const me = base.teams[0].teamId;
    let l = simulateRounds(base, LOCKER_EVERY + 2, 3);
    l = collectLockerEvents(l, me);
    const st = lockerState(l);
    expect(st.pending.length).toBeGreaterThan(0);
    const ev = st.pending[0];
    const choice = ev.choices.find(c => Object.keys(c.bumps).length)!;
    const [pid, bumps] = Object.entries(choice.bumps)[0];
    const before = l.teams[0].seasons.find(p => p.playerId === pid)!;
    const r = answerLocker(l, ev.id, choice.id);
    const after = r.league.teams[0].seasons.find(p => p.playerId === pid)!;
    const [g, k, n] = bumps[0];
    const was = (before.attributes[g] as unknown as Record<string, number>)[k], now = (after.attributes[g] as unknown as Record<string, number>)[k];
    expect(now - was).toBe(Math.max(1, Math.min(99, was + n)) - was);
    expect(lockerState(r.league).pending.find(e => e.id === ev.id)).toBeUndefined();
    expect(lockerState(r.league).log.at(-1)!.id).toBe(ev.id);
    // Asking again right away adds nothing new.
    expect(lockerState(collectLockerEvents(r.league, me)).pending.some(e => e.id === ev.id)).toBe(false);
  });
  it('a long injury gets a check-in, and pushing it shortens the recovery', () => {
    const me = base.teams[0].teamId, pid = base.teams[0].seasons[0].playerId;
    const hurt = { ...base, injuries: { [pid]: { playerId: pid, teamId: me, severity: 'severe' as const, gamesRemaining: 10, totalGames: 20 } } };
    const l = collectLockerEvents(hurt, me);
    const ev = lockerState(l).pending.find(e => e.kind === 'rehab')!;
    expect(ev).toBeTruthy();
    const pushed = answerLocker(l, ev.id, 'push').league;
    expect(pushed.injuries![pid].gamesRemaining).toBe(6);
    // Healthy again: the comeback.
    const back = collectLockerEvents({ ...pushed, injuries: {} }, me);
    expect(lockerState(back).pending.some(e => e.kind === 'comeback')).toBe(true);
  });
});
