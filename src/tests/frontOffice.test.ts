import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason, type League } from '../simulation/league';
import { generateConferencePlayoffBracket, simulateFullPlayoffs } from '../simulation/playoffs';
import { beginNewSeasonRoster, finalizeNewSeasonSchedule } from '../simulation/seasonTransition';
import { computeFinalsMVP } from '../simulation/awards';
import type { GMLeagueExtras } from '../simulation/gm';
import { generateNewsFeed } from '../simulation/news';
import {
  ACHIEVEMENTS, acceptJobOffer, becomeSpectator, ensureFrontOffice, generateGoals, goalProgress, makeOwner, projectedSecurity, strengthRank,
} from '../simulation/frontOffice';

function playSeason(league: League, extras: GMLeagueExtras, seed: number) {
  const played = simulateRemainingSeason(league, seed);
  const finished = simulateFullPlayoffs(generateConferencePlayoffBracket(played), played, seed + 1);
  const finals = finished.bracket.rounds.at(-1)![0];
  const champion = finished.league.teams.find(t => t.teamId === finished.bracket.championTeamId)!;
  return beginNewSeasonRoster({ ...finished.league, playoffBracket: finished.bracket }, extras, seed + 2, { minGames: 5 },
    { teamId: champion.teamId, teamName: champion.name, fmvp: computeFinalsMVP(finals, finished.league) });
}

describe('front office', () => {
  const { league: base, extras } = generateFullLeague(71, 30, 13, 20, '2026');
  const userTeam = base.teams[5].teamId;

  it('gives every team a deterministic owner and the user two or three goals', () => {
    const league = ensureFrontOffice(base, userTeam);
    const fo = league.frontOffice!;
    expect(Object.keys(fo.owners)).toHaveLength(30);
    expect(fo.owners[userTeam].style).toBe(makeOwner(userTeam).style);
    expect(new Set(Object.values(fo.owners).map(o => o.name)).size).toBe(30); // unique names
    expect(fo.status).toBe('employed');
    expect(fo.goals.length).toBeGreaterThanOrEqual(2);
    expect(fo.goals.length).toBeLessThanOrEqual(3);
    expect(fo.goalsSeason).toBe(league.season);
    expect(generateGoals(league, userTeam)).toEqual(generateGoals(league, userTeam));
    // Idempotent: a second pass changes nothing.
    expect(ensureFrontOffice(league, userTeam)).toBe(league);
    for (const g of fo.goals) expect(['met', 'on_track', 'at_risk', 'off_track', 'missed']).toContain(goalProgress(league, extras, userTeam, g).status);
    expect(projectedSecurity(league, extras)).toBeGreaterThanOrEqual(0);
  });

  it('asks contenders for titles and rebuilders for development', () => {
    const league = ensureFrontOffice(base, userTeam);
    const ranked = league.teams.map(t => t.teamId).sort((a, b) => strengthRank(league, a) - strengthRank(league, b));
    const best = generateGoals(league, ranked[0]).map(g => g.kind);
    const worst = generateGoals(league, ranked.at(-1)!).map(g => g.kind);
    expect(best.some(k => k === 'title' || k === 'finals')).toBe(true);
    expect(worst).toContain('develop');
  });

  it('spectator leagues get owners but no goals or reviews', () => {
    const league = ensureFrontOffice(base, null);
    expect(league.frontOffice!.status).toBe('spectator');
    expect(league.frontOffice!.goals).toEqual([]);
    const next = playSeason(league, extras, 11);
    expect(next.summary.ownerReview).toBeNull();
    expect(next.league.frontOffice!.status).toBe('spectator');
  });

  it('reviews the season, records the career and sets new goals when the next season starts', () => {
    const league = ensureFrontOffice(base, userTeam);
    const next = playSeason(league, extras, 21);
    const review = next.summary.ownerReview!;
    expect(review.teamId).toBe(userTeam);
    expect(review.season).toBe('2026');
    expect(review.goals.length).toBeGreaterThanOrEqual(2);
    expect(['extended', 'retained', 'warned']).toContain(review.outcome); // never fired after a first season
    const fo = next.league.frontOffice!;
    expect(fo.reviews).toHaveLength(1);
    expect(fo.seasonsWithTeam).toBe(1);
    expect(fo.achievements.first_season?.season).toBe('2026');
    expect(next.summary.newAchievements).toContain('first_season');
    expect(fo.goals).toEqual([]);
    const started = finalizeNewSeasonSchedule(next.league);
    expect(started.frontOffice!.goalsSeason).toBe(started.season);
    expect(started.frontOffice!.goals.length).toBeGreaterThan(0);
  });

  it('fires a GM on the hot seat after a bad season, offers other jobs, and hires on acceptance', () => {
    const league = ensureFrontOffice(base, userTeam);
    // A GM already on the brink, with an owner who wants a title from a roster that cannot deliver one.
    const doomed: League = { ...league, frontOffice: { ...league.frontOffice!, security: 10, warned: true, seasonsWithTeam: 2,
      goals: [{ id: 'x', kind: 'title', label: 'Win it all', target: 0, weight: 3 }, { id: 'y', kind: 'wins', label: 'Win 20', target: 20, weight: 2 }], goalsSeason: league.season } };
    const next = playSeason(doomed, extras, 31);
    if (next.summary.ownerReview!.finish === 'Champion') return; // a title always saves the job
    expect(next.summary.ownerReview!.outcome).toBe('fired');
    const fo = next.league.frontOffice!;
    expect(fo.status).toBe('unemployed');
    expect(fo.teamId).toBeNull();
    expect(next.league.coachingUserTeamId).toBeNull();
    expect(fo.achievements.pink_slip).toBeDefined();
    expect(fo.offers.length).toBeGreaterThan(0);
    expect(fo.offers.every(o => o.teamId !== userTeam)).toBe(true);
    expect(generateNewsFeed(next.league, next.extras, 500).some(n => n.id.includes('fo:fired'))).toBe(true);

    const hired = acceptJobOffer(next.league, fo.offers[0].teamId);
    expect(hired.frontOffice!.status).toBe('employed');
    expect(hired.frontOffice!.teamId).toBe(fo.offers[0].teamId);
    expect(hired.coachingUserTeamId).toBe(fo.offers[0].teamId);
    expect(hired.frontOffice!.seasonsWithTeam).toBe(0);
    expect(hired.frontOffice!.achievements.second_chance).toBeDefined();
    // Offers arrive during the offseason; once a season is running, taking a job sets goals immediately.
    const midSeason = acceptJobOffer({ ...next.league, seasonPhase: 'regular_season' }, fo.offers[0].teamId);
    expect(midSeason.frontOffice!.goals.length).toBeGreaterThan(0);

    const watching = becomeSpectator(next.league);
    expect(watching.frontOffice!.status).toBe('spectator');
    expect(watching.frontOffice!.offers).toEqual([]);
  });

  it('never fires in Sandbox mode or with firing turned off', () => {
    const league = ensureFrontOffice(base, userTeam);
    const doomed = (l: League): League => ({ ...l, frontOffice: { ...l.frontOffice!, security: 5, warned: true, seasonsWithTeam: 3,
      goals: [{ id: 'x', kind: 'title', label: 'Win it all', target: 0, weight: 3 }], goalsSeason: l.season } });
    const sandbox = playSeason(doomed({ ...league, settings: { ...league.settings, sandboxMode: true } }), extras, 41);
    expect(sandbox.summary.ownerReview!.outcome).not.toBe('fired');
    const off = playSeason(doomed({ ...league, frontOffice: { ...league.frontOffice!, firingEnabled: false } }), extras, 41);
    expect(off.summary.ownerReview!.outcome).not.toBe('fired');
  });

  it('follows a team switch made outside the front office and keeps achievements', () => {
    const league = ensureFrontOffice(base, userTeam);
    const other = base.teams[9].teamId;
    const moved = ensureFrontOffice({ ...league, frontOffice: { ...league.frontOffice!, achievements: { title: { season: '2025' } } } }, other);
    expect(moved.frontOffice!.teamId).toBe(other);
    expect(moved.frontOffice!.achievements.title).toBeDefined();
  });

  it('defines unique achievement ids', () => {
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
  });
});
