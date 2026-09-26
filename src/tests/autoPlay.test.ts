import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { autoPlayOneSeason } from '../simulation/autoPlay';
import { DEFAULT_AWARD_SETTINGS } from '../components/LeagueSettingsPage';

describe('autoPlayOneSeason', () => {
  it('plays a full season end-to-end: schedule finishes, season advances, and a fresh schedule opens', () => {
    const { league, extras } = generateFullLeague(11, 6, 10, 20, '2026');
    const controlledTeamId = league.teams[0].teamId;

    const result = autoPlayOneSeason(league, extras, controlledTeamId, DEFAULT_AWARD_SETTINGS, 42);

    // The season label actually moved forward.
    expect(result.league.season).not.toBe('2026');
    // A fresh schedule was opened for the new season (not left mid-season or empty).
    expect(result.league.schedule.length).toBeGreaterThan(0);
    expect(result.league.schedule.some((g) => !g.played)).toBe(true);
    // The controlled team still has a full, legal-sized roster after draft + free agency.
    const myTeam = result.league.teams.find((t) => t.teamId === controlledTeamId)!;
    expect(myTeam.seasons.length).toBeGreaterThanOrEqual(result.extras.capSettings.minRosterSize);
    // Free agency and the draft were properly closed out, not left open for the new season.
    expect(result.extras.freeAgencyOpen).toBe(false);
    expect(result.extras.draftDayOpen).toBe(false);
    // A champion was actually decided.
    expect(result.summary.championTeamName).not.toBeNull();
  });

  it('does not get stuck at the All-Star break', () => {
    const { league, extras } = generateFullLeague(12, 6, 10, 20, '2026');
    const result = autoPlayOneSeason(league, extras, null, DEFAULT_AWARD_SETTINGS, 7);
    // If it got stuck, the schedule from the ORIGINAL season would still have unplayed games and
    // no season transition would have happened.
    expect(result.league.season).not.toBe('2026');
  });
});
