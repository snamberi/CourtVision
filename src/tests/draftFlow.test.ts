import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
import { draftOnePick, simEntireDraft } from '../simulation/aiGM';
import { swapDraftPicks, draftProspect } from '../simulation/gm';

function draftReadyLeague(seed: number) {
  const { league, extras } = generateFullLeague(seed, 8, 10, 12, '2026-27');
  const played = simulateRemainingSeason(league, seed);
  return beginNewSeasonRoster(played, extras, seed, { minGames: 1 });
}

describe('draftOnePick', () => {
  it('drafts the best-available prospect for whoever is on the clock and logs the pick', () => {
    const { league, extras } = draftReadyLeague(1);
    const result = draftOnePick(league, extras);
    expect(result.pick).not.toBeNull();
    expect(result.extras.draftPickIndex).toBe(1);
    expect(result.extras.draftPicksMade?.length).toBe(1);
    expect(result.extras.draftPicksMade?.[0].pickNumber).toBe(0);
    const draftedTeam = result.league.teams.find((t) => t.teamId === result.pick!.teamId)!;
    expect(draftedTeam.seasons.some((s) => s.playerId === result.pick!.playerId)).toBe(true);
  });

  it('returns a null pick once the draft class is exhausted', () => {
    let { league, extras } = draftReadyLeague(2);
    const classSize = extras.draftClass.length;
    for (let i = 0; i < classSize; i++) {
      const step = draftOnePick(league, extras);
      league = step.league; extras = step.extras;
    }
    const afterExhausted = draftOnePick(league, extras);
    expect(afterExhausted.pick).toBeNull();
  });
});

describe('simEntireDraft', () => {
  it('drafts exactly as many prospects as there are real picks (2 rounds), sending any leftover class to free agency', () => {
    const { league, extras } = draftReadyLeague(3);
    const classSize = extras.draftClass.length;
    const order = extras.draftOrder!;
    const expectedPicks = Math.min(classSize, order.length);
    const result = simEntireDraft(league, extras);
    expect(result.picks.length).toBe(expectedPicks);
    expect(result.extras.draftClass.length).toBe(0);
    expect(result.extras.draftPicksMade?.length).toBe(expectedPicks);
    expect(result.extras.draftDayOpen).toBe(false);
    if (classSize > order.length) {
      expect(result.extras.freeAgents.length - extras.freeAgents.length).toBe(classSize - order.length);
    }
  });
});

describe('swapDraftPicks', () => {
  it('swaps which teams own two specified pick numbers', () => {
    const { extras } = draftReadyLeague(4);
    const order = extras.draftOrder!;
    const teamAtPick0 = order[0];
    const teamAtPick5 = order[5];
    const swapped = swapDraftPicks(extras, 0, 5);
    expect(swapped.draftOrder![0]).toBe(teamAtPick5);
    expect(swapped.draftOrder![5]).toBe(teamAtPick0);
  });

  it('a swapped pick actually drafts for the new owner', () => {
    const { league, extras } = draftReadyLeague(5);
    const order = extras.draftOrder!;
    const originalOwner = order[0];
    const newOwner = order[3];
    const swapped = swapDraftPicks(extras, 0, 3);
    const prospect = swapped.draftClass[0];
    const { league: nextLeague } = draftProspect(league, swapped, prospect.playerId, newOwner);
    const newOwnerTeam = nextLeague.teams.find((t) => t.teamId === newOwner)!;
    const originalOwnerTeam = nextLeague.teams.find((t) => t.teamId === originalOwner)!;
    expect(newOwnerTeam.seasons.some((s) => s.playerId === prospect.playerId)).toBe(true);
    expect(originalOwnerTeam.seasons.some((s) => s.playerId === prospect.playerId)).toBe(false);
  });
});
