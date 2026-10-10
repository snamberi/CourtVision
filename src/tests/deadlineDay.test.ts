import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason, type League } from '../simulation/league';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { executeTrade, isTradeDeadlinePassed, validateTrade, type GMLeagueExtras } from '../simulation/gm';
import {
  DEADLINE_HOURS, advanceDeadlineHour, daysToDeadline, deadlineRound, isDeadlineDayBlocking, isDeadlineDayDue, openDeadlineDay,
  runToDeadline, scheduleDeadlineDay, deadlineNews, rumorOutcome, deadlineCall, pruneOffers,
} from '../simulation/deadlineDay';
import { generateNewsFeed } from '../simulation/news';
import { autoPlayOneSeason } from '../simulation/autoPlay';
import { DEFAULT_AWARD_SETTINGS } from '../components/LeagueSettingsPage';

const { league: generated, extras } = generateFullLeague(71, 30, 13, 40, '2026');
// No All-Star break in the way: these tests are about the deadline.
const base: League = { ...generated, rulesSettings: { ...DEFAULT_LEAGUE_RULES, allStarEnabled: false } };
const me = base.teams[0].teamId;

/** The season played up to the morning of Deadline Day (a seed where your team is in the market: other GMs call). */
const morning = (() => simulateRemainingSeason(scheduleDeadlineDay(base, me), 6))();

function rosterIntegrity(league: League, ex: GMLeagueExtras) {
  const seen = new Map<string, string>();
  for (const t of league.teams) for (const s of t.seasons) {
    expect(seen.has(s.playerId)).toBe(false);
    seen.set(s.playerId, t.teamId);
    expect(s.teamId).toBe(t.teamId);
    if (ex.contracts[s.playerId]) expect(ex.contracts[s.playerId].teamId).toBe(t.teamId);
  }
}

describe('Trade Deadline Day', () => {
  it('falls on the game day that takes the league past the deadline share', () => {
    const round = deadlineRound(base)!;
    expect(round).toBeGreaterThan(0);
    // Without a Deadline Day, trading is open until that day's games are played, then locked.
    const before = { ...base, schedule: base.schedule.map(g => ({ ...g, played: g.round < round })) };
    const after = { ...base, schedule: base.schedule.map(g => ({ ...g, played: g.round <= round })) };
    expect(isTradeDeadlinePassed(before)).toBe(false);
    expect(isTradeDeadlinePassed(after)).toBe(true);
  });

  it('is only scheduled when you run a team and the rule is on', () => {
    expect(scheduleDeadlineDay(base, null)).toBe(base);
    const off = { ...base, rulesSettings: { ...base.rulesSettings!, tradeDeadlineEnabled: false } };
    expect(scheduleDeadlineDay(off, me)).toBe(off);
    expect(deadlineRound(off)).toBeNull();
    const late = { ...base, schedule: base.schedule.map(g => ({ ...g, played: g.round <= deadlineRound(base)! })) };
    expect(isTradeDeadlinePassed({ ...late, rulesSettings: off.rulesSettings })).toBe(false); // no deadline at all
    const scheduled = scheduleDeadlineDay(base, me);
    expect(scheduled.deadlineDay).toMatchObject({ status: 'upcoming', round: deadlineRound(base), hour: 0 });
    expect(scheduleDeadlineDay(scheduled, me)).toBe(scheduled); // once per season
    expect(daysToDeadline(scheduled)).toBe(deadlineRound(base)); // rounds are numbered from 0
  });

  it('stops the season on the morning of the deadline', () => {
    expect(morning.schedule.find(g => !g.played)!.round).toBe(morning.deadlineDay!.round);
    expect(isDeadlineDayDue(morning)).toBe(true);
    expect(isDeadlineDayBlocking(morning)).toBe(true);
    expect(daysToDeadline(morning)).toBe(0);
    expect(isTradeDeadlinePassed(morning)).toBe(false);
  });

  it('runs a 9-to-3 clock: rumors, calls, AI deals, then trading locks', () => {
    const opened = openDeadlineDay(morning, extras, me, 11);
    const d = opened.league.deadlineDay!;
    expect(d.status).toBe('open');
    expect(d.rumors.length).toBeGreaterThan(3);
    expect(d.rumors.some(r => r.kind === 'shopping')).toBe(true);
    expect(d.rumors.some(r => r.kind === 'your_team')).toBe(true);
    // Still blocked while the day is under way; trading still open.
    expect(isDeadlineDayBlocking(opened.league)).toBe(true);
    expect(isTradeDeadlinePassed(opened.league)).toBe(false);

    let l = opened.league, ex = opened.extras;
    const hours: number[] = [];
    for (let h = 1; h <= DEADLINE_HOURS; h++) {
      const r = advanceDeadlineHour(l, ex, me, 11);
      l = r.league; ex = r.extras;
      hours.push(l.deadlineDay!.hour);
      for (const t of r.trades) {
        expect(t.hour).toBe(h);
        expect([t.teamAId, t.teamBId]).not.toContain(me); // AI deals never involve you
      }
    }
    expect(hours).toEqual([1, 2, 3, 4, 5, 6]);
    const closed = l.deadlineDay!;
    expect(closed.status).toBe('closed');
    expect(closed.trades.length).toBeGreaterThan(0);
    expect(closed.calls.length).toBeGreaterThan(0);
    expect(ex.pendingTradeOffers).toHaveLength(0); // unanswered calls expire
    expect(isTradeDeadlinePassed(l)).toBe(true);
    expect(isDeadlineDayBlocking(l)).toBe(false);
    rosterIntegrity(l, ex);
    // A hot rumor about a player who moved reads as having come true.
    const moved = closed.trades.flatMap(t => [...t.playersFromA, ...t.playersFromB]);
    for (const r of closed.rumors.filter(x => x.playerId && moved.includes(x.playerId))) expect(rumorOutcome(r, closed.trades, id => id)).toMatch(/^Dealt to/);

    // The season resumes and finishes.
    const done = simulateRemainingSeason(l, 5);
    expect(done.schedule.every(g => g.played)).toBe(true);

    // Every deal breaks in the news, and the recap follows.
    const news = generateNewsFeed(done, ex, 1000);
    expect(news.filter(n => n.id.includes(':deadline:') && n.id !== `${done.season}:deadline:recap`)).toHaveLength(closed.trades.length);
    expect(news.find(n => n.id.endsWith('deadline:recap'))?.headline).toMatch(/trade deadline has passed/);
    expect(deadlineNews(done)[0].headline).toMatch(/^(BLOCKBUSTER|DEADLINE DEAL): .+ send .+ to .+ for .+\.$/);
  });

  it('logs your own deals with the hour, and is deterministic', () => {
    const opened = openDeadlineDay(morning, extras, me, 3);
    const two = runToDeadline(opened.league, opened.extras, me, 3);
    const again = runToDeadline(openDeadlineDay(morning, extras, me, 3).league, opened.extras, me, 3);
    expect(two.league.deadlineDay).toEqual(again.league.deadlineDay);

    const noon = advanceDeadlineHour(advanceDeadlineHour(advanceDeadlineHour(opened.league, opened.extras, me, 3).league, opened.extras, me, 3).league, opened.extras, me, 3);
    // A call already waiting on your phone counts; otherwise ring around (a team with a pending offer doesn't call twice).
    const offer = noon.extras.pendingTradeOffers.find(o => validateTrade(noon.league, noon.extras, o).valid)
      ?? [1, 2, 3, 4, 5].map(seed => deadlineCall(noon.league, noon.extras, me, seed)).find(Boolean)!;
    expect(offer).toBeTruthy();
    expect(validateTrade(noon.league, noon.extras, offer).valid).toBe(true);
    const traded = executeTrade(noon.league, noon.extras, offer);
    const last = traded.league.deadlineDay!.trades.at(-1)!;
    expect(last.hour).toBe(3);
    expect([last.teamAId, last.teamBId]).toContain(me);
    // A second call asking for the same player drops off the phone once he has moved.
    const copy = { ...offer };
    const pruned = pruneOffers(traded.league, { ...traded.extras, pendingTradeOffers: [copy] });
    expect(pruned.pendingTradeOffers).toHaveLength(0);
    // After the deadline, trades are refused.
    const locked = runToDeadline(traded.league, traded.extras, me, 3);
    expect(validateTrade(locked.league, locked.extras, offer).valid).toBe(false);
  });

  it('Auto Play plays straight through a scheduled Deadline Day', () => {
    const result = autoPlayOneSeason(scheduleDeadlineDay(base, me), extras, me, DEFAULT_AWARD_SETTINGS, 9);
    expect(result.league.season).not.toBe(base.season);
    expect(result.league.franchiseHistory?.some(r => r.season === base.season)).toBe(true);
  });
});
