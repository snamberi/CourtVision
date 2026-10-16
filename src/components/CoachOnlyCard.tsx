import type { League } from '../simulation/league';

/** League Settings: switch the league to coach-only (the AI runs your front office). */
export function CoachOnlyCard({ league, onChange }: { league: League; onChange: (update: (l: League) => League) => void }) {
  const on = !!league.settings.coachOnly;
  return (
    <section className="settings-card">
      <h4>Coach only</h4>
      <label className="trade-value-toggle">
        <input type="checkbox" checked={on} onChange={e => onChange(l => ({ ...l, settings: { ...l.settings, coachOnly: e.target.checked } }))} /> Let the front office run itself
      </label>
      <p className="hint-text">{on
        ? 'On: your team\'s trades, signings, draft picks and re-signings are made by the AI front office, like any other team. You set rotations, coach games from the sideline and give the halftime speech. Trade and free-agency pages are hidden.'
        : 'Off: you make every roster move yourself.'}</p>
    </section>
  );
}
