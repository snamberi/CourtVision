import { useMemo } from 'react';
import type { League } from '../simulation/league';
import { computeTeamStats } from '../simulation/teamStats';

const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const OFFENSE: Record<string, string> = { balanced: 'Balanced offense', 'pace-space': 'Pace and space', 'pick-roll': 'Pick-and-roll', post: 'Post-up offense', motion: 'Motion offense', isolation: 'Isolation' };
const DEFENSE: Record<string, string> = { man: 'Man defense', switch: 'Switch everything', zone: 'Zone', pressure: 'Full-court pressure', drop: 'Drop coverage' };

/** The coach's identity on the dashboard: his playbook in plain words, and whether the team actually plays that way. */
export function CoachIdentityCard({ league, teamId, onCoaching }: { league: League; teamId: string; onCoaching?: () => void }) {
  const view = useMemo(() => {
    const team = league.teams.find(t => t.teamId === teamId);
    if (!team?.coach) return null;
    const c = team.coach;
    const tags = [
      c.paceTendency >= 65 ? 'Run-and-gun' : c.paceTendency <= 35 ? 'Grind it out' : 'Steady pace',
      c.threePointFrequency >= 65 ? 'Lets it fly from three' : c.threePointFrequency <= 35 ? 'Lives in the paint' : 'Inside-out',
      c.defensiveAggression >= 65 ? 'Aggressive defense' : 'Disciplined defense',
      c.starUsage >= 65 ? 'Rides his stars' : c.benchUsage >= 60 ? 'Trusts the bench' : 'Shares the load',
    ];
    const rows = computeTeamStats(league).filter(r => r.gamesPlayed > 0);
    const rank = (key: 'pace' | 'tpmPg' | 'drtg', asc = false) => {
      const sorted = [...rows].sort((a, b) => (asc ? a[key] - b[key] : b[key] - a[key]));
      const i = sorted.findIndex(r => r.teamId === teamId);
      return i < 0 ? null : i + 1;
    };
    return { coach: c, tags, pace: rank('pace'), threes: rank('tpmPg'), defense: rank('drtg', true), teams: rows.length };
  }, [league, teamId]);
  if (!view) return null;
  const { coach: c } = view;
  return <section className="coach-identity" aria-label="Coach identity">
    <span className="pixel-eyebrow">COACH IDENTITY</span>
    <p className="coach-identity-system"><b>{OFFENSE[c.offensiveSystem ?? 'balanced']}</b> · <b>{DEFENSE[c.defensiveScheme ?? 'man']}</b></p>
    <ul className="coach-identity-tags">{view.tags.map(t => <li key={t}>{t}</li>)}</ul>
    {view.teams > 0 && view.pace && <p className="hint-text">On the floor: {ord(view.pace)} in pace, {ord(view.threes!)} in threes made, {ord(view.defense!)} in defense (of {view.teams}).</p>}
    {onCoaching && <button className="link-button" onClick={onCoaching}>Change the playbook</button>}
  </section>;
}
