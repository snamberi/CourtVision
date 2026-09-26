import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { generateDraftClass, pickDraftClassSize, draftProspect, waiveToFreeAgency, renamePlayer, finalizeDraftDay } from '../simulation/gm';
import { advanceToNextSeason } from '../simulation/seasonTransition';
import { collectPlayerIds, uniquePlayerId } from '../simulation/playerIds';
import { findDuplicatePlayerIds, repairDuplicatePlayerIds } from '../simulation/playerIntegrity';
import { RNG } from '../simulation/engine/rng';

function totalPlayers(league: ReturnType<typeof generateFullLeague>['league'], extras: ReturnType<typeof generateFullLeague>['extras']) {
  return league.teams.reduce((n, t) => n + t.seasons.length, 0) + extras.freeAgents.length + (league.retiredPlayers?.length ?? 0);
}

describe('player id uniqueness (players used to vanish when two shared a name)', () => {
  it('a generated league plus its first draft class never repeats a name', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const { league, extras } = generateFullLeague(seed, 30, 18, 82, '2026');
      expect(findDuplicatePlayerIds(league, extras)).toEqual([]);
      const rosterNames = new Set(league.teams.flatMap((t) => t.seasons.map((s) => s.playerId)));
      for (const p of extras.draftClass) expect(rosterNames.has(p.playerId)).toBe(false);
    }
  });

  it('draft classes generated against existing names never collide with them', () => {
    const { league, extras } = generateFullLeague(7, 30, 18, 82, '2026');
    const taken = collectPlayerIds(league, extras);
    for (let y = 0; y < 8; y++) {
      const cls = generateDraftClass(pickDraftClassSize(30, new RNG(y)), 500 + y, String(2027 + y), taken);
      for (const p of cls) {
        expect(taken.has(p.playerId)).toBe(false);
        taken.add(p.playerId);
      }
    }
  });

  it('uniquePlayerId hands out a fresh id every time', () => {
    const taken = new Set(['Marcus Boyd']);
    const a = uniquePlayerId('Marcus Boyd', taken);
    const b = uniquePlayerId('Marcus Boyd', taken);
    expect(new Set(['Marcus Boyd', a, b]).size).toBe(3);
  });

  it('ten simulated offseasons never create a duplicate id or lose a player', () => {
    let { league, extras } = generateFullLeague(21, 30, 15, 82, '2026');
    for (let year = 0; year < 10; year++) {
      const before = totalPlayers(league, extras) + extras.draftClass.length;
      const result = advanceToNextSeason(league, extras, 1000 + year);
      league = result.league;
      extras = result.extras;
      expect(findDuplicatePlayerIds(league, extras)).toEqual([]);
      // Everyone who was on a roster or in free agency last year is still somewhere: rostered, free agent, or retired.
      const after = totalPlayers(league, extras);
      expect(after).toBeGreaterThanOrEqual(before - extras.draftClass.length - result.summary.newDraftClassSize);
    }
  });

  it('drafting a prospect keeps every existing player and contract intact', () => {
    const { league, extras } = generateFullLeague(3, 30, 15, 82, '2026');
    const open = { ...extras, draftDayOpen: true };
    const target = open.draftClass[0];
    const teamId = league.teams[0].teamId;
    // Force the worst case: an existing player already has the prospect's exact name.
    const victimTeam = league.teams[1];
    const victim = victimTeam.seasons[0];
    const rigged = {
      league: { ...league, teams: league.teams.map((t) => (t.teamId === victimTeam.teamId ? { ...t, seasons: t.seasons.map((s) => (s.playerId === victim.playerId ? { ...s, playerId: target.playerId } : s)) } : t)) },
      extras: { ...open, contracts: { ...open.contracts, [target.playerId]: { ...open.contracts[victim.playerId], playerId: target.playerId, teamId: victimTeam.teamId } } },
    };
    const out = draftProspect(rigged.league, rigged.extras, target.playerId, teamId);
    expect(findDuplicatePlayerIds(out.league, out.extras)).toEqual([]);
    const drafted = out.league.teams.find((t) => t.teamId === teamId)!.seasons.find((s) => s.playerId !== target.playerId && s.playerId.startsWith(target.playerId));
    expect(drafted).toBeDefined();
    // The existing player's contract was not overwritten by the rookie's.
    expect(out.extras.contracts[target.playerId].teamId).toBe(victimTeam.teamId);
    expect(out.extras.contracts[drafted!.playerId].teamId).toBe(teamId);
  });

  it('undrafted prospects entering free agency cannot duplicate a rostered player', () => {
    const { league, extras } = generateFullLeague(4, 30, 15, 82, '2026');
    const dup = league.teams[0].seasons[0].playerId;
    const rigged = { ...extras, draftClass: extras.draftClass.map((p, i) => (i === 0 ? { ...p, playerId: dup, trueSeason: { ...p.trueSeason, playerId: dup } } : p)) };
    const out = finalizeDraftDay(league, rigged);
    expect(findDuplicatePlayerIds(out.league, out.extras)).toEqual([]);
  });

  it('waiving one of two formerly-identical players no longer takes the other with it', () => {
    const { league, extras } = generateFullLeague(9, 30, 15, 82, '2026');
    const a = league.teams[0].seasons[0];
    const b = league.teams[1].seasons[0];
    const corrupted = {
      ...league,
      teams: league.teams.map((t) => (t.teamId === league.teams[1].teamId ? { ...t, seasons: t.seasons.map((s) => (s.playerId === b.playerId ? { ...s, playerId: a.playerId } : s)) } : t)),
    };
    expect(findDuplicatePlayerIds(corrupted, extras)).toContain(a.playerId);

    const healed = repairDuplicatePlayerIds(corrupted, extras);
    expect(healed.repairs).toHaveLength(1);
    expect(findDuplicatePlayerIds(healed.league, healed.extras)).toEqual([]);
    // Nobody was deleted by the repair.
    const count = (l: typeof league) => l.teams.reduce((n, t) => n + t.seasons.length, 0);
    expect(count(healed.league)).toBe(count(corrupted));
    // Every rostered player has a contract pointing at their own team.
    for (const t of healed.league.teams) for (const s of t.seasons) expect(healed.extras.contracts[s.playerId]?.teamId).toBe(t.teamId);

    const waived = waiveToFreeAgency(healed.league, healed.extras, a.playerId, league.teams[0].teamId);
    const stillThere = waived.league.teams[1].seasons.length;
    expect(stillThere).toBe(healed.league.teams[1].seasons.length);
    expect(waived.extras.freeAgents.some((f) => f.playerId === a.playerId)).toBe(true);
  });

  it('repair returns the same objects when nothing is wrong', () => {
    const { league, extras } = generateFullLeague(5, 30, 15, 82, '2026');
    const out = repairDuplicatePlayerIds(league, extras);
    expect(out.repairs).toEqual([]);
    expect(out.league).toBe(league);
    expect(out.extras).toBe(extras);
  });

  it('renaming a player onto an existing name is refused instead of merging the two', () => {
    const { league, extras } = generateFullLeague(6, 30, 15, 82, '2026');
    const a = league.teams[0].seasons[0];
    const b = league.teams[1].seasons[0];
    const [first, ...rest] = b.playerId.split(' ');
    const out = renamePlayer(league, extras, a.playerId, first, rest.join(' '));
    expect(out.error).toBeTruthy();
    expect(out.newPlayerId).toBe(a.playerId);
    expect(out.league).toBe(league);
  });

  it('a successful rename follows the player into the watch list and trade block', () => {
    const { league, extras } = generateFullLeague(8, 30, 15, 82, '2026');
    const a = league.teams[0].seasons[0];
    const withLists = { ...extras, watchList: [a.playerId], tradeBlock: [a.playerId] };
    const out = renamePlayer(league, withLists, a.playerId, 'Brand', 'NewName');
    expect(out.error).toBeUndefined();
    expect(out.extras.watchList).toEqual(['Brand NewName']);
    expect(out.extras.tradeBlock).toEqual(['Brand NewName']);
  });
});
