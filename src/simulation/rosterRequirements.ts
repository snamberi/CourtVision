import type { League } from './league';
import type { SalaryCapSettings } from './gm';

/** One team that's outside the league's roster-size window. */
export interface RosterComplianceIssue {
  teamId: string;
  teamName: string;
  count: number;
  min: number;
  max: number;
  kind: 'under' | 'over';
}

/**
 * Every team currently below `minRosterSize` or above `maxRosterSize`. Used to gate season
 * simulation (a team that can't field a full roster, or is illegally overstuffed, shouldn't be
 * allowed to play games) and, separately, to block individual trades that would create the same
 * problem for either side (see `validateTrade` in gm.ts).
 */
export function rosterComplianceIssues(league: League, capSettings: SalaryCapSettings): RosterComplianceIssue[] {
  const issues: RosterComplianceIssue[] = [];
  for (const team of league.teams) {
    const count = team.seasons.length;
    if (count < capSettings.minRosterSize) {
      issues.push({ teamId: team.teamId, teamName: team.name, count, min: capSettings.minRosterSize, max: capSettings.maxRosterSize, kind: 'under' });
    } else if (count > capSettings.maxRosterSize) {
      issues.push({ teamId: team.teamId, teamName: team.name, count, min: capSettings.minRosterSize, max: capSettings.maxRosterSize, kind: 'over' });
    }
  }
  return issues;
}

export function isLeagueRosterCompliant(league: League, capSettings: SalaryCapSettings): boolean {
  return rosterComplianceIssues(league, capSettings).length === 0;
}

/** One line per issue, e.g. "Ironport Foundry has 10 players (minimum 12)." — used in blocking banners. */
export function describeRosterIssue(issue: RosterComplianceIssue): string {
  return issue.kind === 'under'
    ? `${issue.teamName} has ${issue.count} player${issue.count === 1 ? '' : 's'} (minimum ${issue.min}).`
    : `${issue.teamName} has ${issue.count} players (maximum ${issue.max}).`;
}
