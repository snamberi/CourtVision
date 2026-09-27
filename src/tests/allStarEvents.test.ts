import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { lockAllStarVoting } from '../simulation/allStarVoting';
import { simulateAllStarGame } from '../simulation/allStarGame';
import { computeSeasonAwards } from '../simulation/awards';
import { pickContestEntrants } from '../simulation/allStarGame';
import { startCaptainsDraft, draftAllStar, draftPool, onTheClock, autoDraft, runThreePointShow, threePointSummary, startDunkShow, playNextDunk, nextDunker, finishDunkShow, dunkSummary } from '../simulation/allStarEvents';
import type { League } from '../simulation/league';

let cached: League | null = null;
function atBreak(): League {
  if (cached) return cached;
  const g = generateFullLeague(611, 8, 12, 24, '2026', { priorSeasons: false });
  g.league.settings = { ...g.league.settings, injuriesEnabled: false };
  cached = lockAllStarVoting(simulateRemainingSeason(g.league, 611), 24, 1);
  return cached;
}
const teamOf = (l: League, id: string) => l.teams.find(t => t.seasons.some(p => p.playerId === id))!.teamId;

describe('All-Star captains draft', () => {
  it('lets you pick for a captain while the other captain answers, starters first', () => {
    let league = startCaptainsDraft(atBreak(), null);
    const rec = () => league.allStarWeekend!;
    const d0 = rec().draft!;
    expect(d0.userSide).toBe('A');
    expect(onTheClock(d0)).toBe('A');
    const selected = rec().voting!.selected!;
    const pool = draftPool(rec(), d0);
    expect(pool.every(s => s.starter)).toBe(true);
    // You pick the weakest starter left: the pick is honoured and the other captain answers once.
    const mine = pool[pool.length - 1].playerId;
    league = draftAllStar(league, mine);
    expect(rec().draft!.teamA).toContain(mine);
    expect(rec().draft!.picks).toHaveLength(2);
    expect(onTheClock(rec().draft!)).toBe('A');
    // Out of turn or already taken: nothing happens.
    expect(draftAllStar(league, mine)).toBe(league);
    league = autoDraft(league);
    const d = rec().draft!;
    expect(d.done).toBe(true);
    expect(new Set([...d.teamA, ...d.teamB]).size).toBe(selected.length);
    expect(Math.abs(d.teamA.length - d.teamB.length)).toBeLessThanOrEqual(1);
    // Every starter went before any reserve.
    const firstReserve = d.picks.findIndex(id => !selected.find(s => s.playerId === id)!.starter);
    const lastStarter = Math.max(...d.picks.map((id, i) => (selected.find(s => s.playerId === id)!.starter ? i : -1)));
    if (firstReserve >= 0) expect(lastStarter).toBeLessThan(firstReserve);
    const game = simulateAllStarGame(league, computeSeasonAwards(league), 5)!;
    expect(game.squadA.playerIds).toEqual(d.teamA);
    expect(game.squadA.name).toMatch(/^Team /);
  });

  it('gives you the captain on your own team', () => {
    const base = atBreak();
    const probe = startCaptainsDraft(base, null).allStarWeekend!.draft!;
    const league = startCaptainsDraft(base, teamOf(base, probe.captainB));
    const d = league.allStarWeekend!.draft!;
    if (teamOf(base, probe.captainA) !== teamOf(base, probe.captainB)) {
      expect(d.userSide).toBe('B');
      expect(d.picks).toHaveLength(1); // captain A has already made his first pick
    }
  });
});

describe('All-Star contests', () => {
  it('three-point contest: every ball recorded, the top three shoot a final, same result every time', () => {
    const league = atBreak();
    const shooters = pickContestEntrants(league, 8, p => p.attributes.offense.threePoint);
    const show = runThreePointShow(shooters, 42, { [shooters[0].playerId]: 4 });
    expect(show.first).toHaveLength(8);
    expect(show.final).toHaveLength(3);
    expect(show.first.every(r => r.balls.length === 25)).toBe(true);
    expect(show.first.find(r => r.shooter === shooters[0].playerId)!.moneyRack).toBe(4);
    // Score = one point per make, two for the money rack and each rack's last ball.
    for (const r of show.first) expect(r.score).toBe(r.balls.reduce((n, made, i) => n + (made ? (Math.floor(i / 5) === r.moneyRack || i % 5 === 4 ? 2 : 1) : 0), 0));
    expect(show.final.map(r => r.shooter)).toContain(show.winner);
    expect(runThreePointShow(shooters, 42, { [shooters[0].playerId]: 4 })).toEqual(show);
    expect(threePointSummary(show).winner).toBe(show.winner);
  });

  it('dunk contest: two dunks each, the best two in the final; your dunker goes as big as you say', () => {
    const league = atBreak();
    const dunkers = pickContestEntrants(league, 4, p => p.attributes.physical.vertical);
    const mine = new Set([dunkers[0].playerId]);
    let show = startDunkShow(dunkers);
    expect(nextDunker(show)).toBe(dunkers[0].playerId);
    show = playNextDunk(league, show, 9, 'signature', mine);
    expect(show.first[0].risk).toBe('signature');
    while (show.stage === 'first') show = playNextDunk(league, show, 9, 'safe', mine);
    expect(show.first).toHaveLength(8);
    expect(show.finalists).toHaveLength(2);
    show = finishDunkShow(league, show, 9);
    expect(show.stage).toBe('done');
    expect(show.final).toHaveLength(4);
    expect(show.finalists).toContain(show.winner);
    expect(dunkSummary(show).winner).toBe(show.winner);
    for (const d of [...show.first, ...show.final]) expect(d.made ? d.score >= 38 : d.score < 38).toBe(true);
  });
});
