import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { buildHistoricalLeague } from '../history/historicalLeague';
import { autoPlayOneSeason } from '../simulation/autoPlay';
import { DEFAULT_AWARD_SETTINGS } from '../simulation/awards';
import { initializeCoaching } from '../simulation/staffManagement';
import type { League } from '../simulation/league';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { manageCoachRosters } from '../simulation/coachRosters';
import { calculateOverall } from '../simulation/engine/overall';

describe('coach roster trims never try to cut a stuck player', () => {
  it('an over-full roster whose least valuable player is stuck is trimmed from everyone else (it used to spin forever)', () => {
    const g = generateFullLeague(12, 4, 18, 10, '2026');
    const [mine, theirs] = g.league.teams;
    const worst = [...theirs.seasons].sort((a, b) => calculateOverall(a) - calculateOverall(b))[0];
    const stuck = { ...worst, playerId: 'Stuck Bench', teamId: mine.teamId, stick: { teamId: mine.teamId }, attributes: structuredClone(worst.attributes) };
    // Make him clearly the least valuable on the roster.
    for (const k of Object.keys(stuck.attributes.offense)) (stuck.attributes.offense as unknown as Record<string, number>)[k] = 25;
    const league = { ...g.league, seasonPhase: 'regular_season' as const, teams: g.league.teams.map(t => t.teamId === mine.teamId ? { ...t, seasons: [...t.seasons, stuck] } : t) };
    const extras = { ...g.extras, capSettings: { ...g.extras.capSettings, maxRosterSize: 18 } };
    const r = manageCoachRosters(league, extras);
    const team = r.league.teams.find(t => t.teamId === mine.teamId)!;
    expect(team.seasons.length).toBe(18);
    expect(team.seasons.some(p => p.playerId === 'Stuck Bench')).toBe(true);
  });
});

describe('Auto Play with stuck players in a historical league', () => {
  for (const forceRosters of [true, false]) {
    it(`plays on with a player stuck to a team and one stuck to a player (historical rosters ${forceRosters ? 'on' : 'off'})`, async () => {
      const h = await loadHistoryForTests();
      const start = h.manifest.coverage.seasons[1] - 6;
      const built = buildHistoricalLeague(h, start, { realDevelopment: true, forceRosters, difficulty: 'normal', seed: 4 });
      const me = built.league.teams[0].teamId, other = built.league.teams[1].teamId;
      // Stick the other team's best player to my team, and my second-best to him.
      const star = built.league.teams[1].seasons[0], buddy = built.league.teams[0].seasons[1];
      let league: League = initializeCoaching({ ...built.league, settings: { ...built.league.settings, sandboxMode: true }, teams: built.league.teams.map(t => ({ ...t, seasons: t.seasons.map(p =>
        p.playerId === star.playerId ? { ...p, stick: { teamId: me } } : p.playerId === buddy.playerId ? { ...p, stick: { withPlayerId: star.playerId } } : p) })) }, me);
      let extras = built.extras;
      for (let s = 0; s < 2; s++) {
        const r = autoPlayOneSeason(league, extras, me, DEFAULT_AWARD_SETTINGS, 50 + s);
        league = r.league; extras = r.extras;
        const mine = league.teams.find(t => t.teamId === me)!;
        expect(mine.seasons.some(p => p.playerId === star.playerId)).toBe(true);
        expect(mine.seasons.some(p => p.playerId === buddy.playerId)).toBe(true);
      }
      expect(league.teams.find(t => t.teamId === other)).toBeTruthy();
    }, 600_000);
  }
});
