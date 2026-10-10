import { useEffect, useMemo, useState } from 'react';
import type { NbaHistory } from '../history/nbaHistoryData';
import { huntTeams, teamLabel } from '../hunt/teams';
import { cardPool } from '../hunt/cards';
import { FAMOUS, destinationTeams, defaultReplacement } from '../history/timeMachine';

export interface TimeMachinePick { from: string; label: string; year: number; replace: string; replaceName: string }

const seasonName = (y: number) => `${y}–${String(y + 1).slice(2)}`;
const YEARS = Array.from({ length: 2025 - 1946 + 1 }, (_, i) => 2025 - i);
const DECADES = [1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

/** Time Machine setup: the team that travels (famous picks or any team-season), the season it lands in, and whose place it takes. */
export function TimeMachinePicker({ onChange }: { onChange: (p: TimeMachinePick | null) => void }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('GSW@2016');
  const [decade, setDecade] = useState(2010);
  const [year, setYear] = useState(1985);
  const [replace, setReplace] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import('../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);
  const teams = useMemo(() => (h ? huntTeams(h) : []), [h]);
  const team = teams.find(t => t.id === from) ?? null;
  const famous = useMemo(() => FAMOUS.map(id => teams.find(t => t.id === id)).filter(Boolean), [teams]);
  const inDecade = useMemo(() => teams.filter(t => t.end - 1 >= decade && t.end - 1 < decade + 10).sort((a, b) => b.strength - a.strength), [teams, decade]);
  const dest = useMemo(() => (h ? destinationTeams(h, year) : []), [h, year]);
  const auto = h && team ? defaultReplacement(h, team, year) : null;
  const chosen = replace && dest.some(d => d.abbr === replace) ? replace : auto ?? dest[0]?.abbr ?? null;
  const chosenName = dest.find(d => d.abbr === chosen)?.name ?? '';
  useEffect(() => {
    onChange(team && chosen ? { from: team.id, label: teamLabel(team), year, replace: chosen, replaceName: chosenName } : null);
  }, [team, chosen, chosenName, year]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <p className="hint-text">Could not load the NBA history data: {error}</p>;
  if (!h) return <p className="hint-text">Loading NBA history…</p>;
  const pool = cardPool(h);
  return <div>
    <div className="create-field"><span>Bring this team</span>
      <div className="tm-famous" role="radiogroup" aria-label="Famous teams">{famous.map(t => t && <button key={t.id} role="radio" aria-checked={from === t.id} className={from === t.id ? 'selected' : ''} onClick={() => setFrom(t.id)}>{t.end - 1}-{String(t.end).slice(2)} {t.abbr}{t.champion ? ' 🏆' : ''}</button>)}</div>
    </div>
    <div className="create-fields">
      <label className="create-field"><span>Or any team: decade</span>
        <select className="year-input" value={decade} onChange={e => setDecade(Number(e.target.value))}>{DECADES.map(d => <option key={d} value={d}>{d}s</option>)}</select></label>
      <label className="create-field"><span>Team</span>
        <select className="year-input" value={inDecade.some(t => t.id === from) ? from : ''} onChange={e => e.target.value && setFrom(e.target.value)}>
          <option value="">Choose a team…</option>
          {inDecade.map(t => <option key={t.id} value={t.id}>{teamLabel(t)} ({t.w}-{t.l}{t.champion ? ', champions' : ''})</option>)}
        </select></label>
      <label className="create-field"><span>Travel to the season</span>
        <select className="year-input" value={year} onChange={e => { setYear(Number(e.target.value)); setReplace(null); }}>{YEARS.map(y => <option key={y} value={y}>{seasonName(y)}</option>)}</select></label>
      <label className="create-field"><span>Taking the place of</span>
        <select className="year-input" value={chosen ?? ''} onChange={e => setReplace(e.target.value)}>{dest.map(d => <option key={d.abbr} value={d.abbr}>{d.name}{d.abbr === auto ? ' (same franchise)' : ''}</option>)}</select>
        <small>{auto ? 'Their own franchise existed that season.' : 'Their franchise did not exist yet: pick whose place they take (they keep their own name).'}</small></label>
    </div>
    {team && <div className="tm-preview">
      <b>{teamLabel(team)}</b> ({team.w}-{team.l}{team.champion ? ', champions' : ''}) arrive in the <b>{seasonName(year)}</b> NBA in place of the {chosenName}. Their players come exactly as they were that season; everyone else is real NBA history from {seasonName(year)}.
      <ol>{team.roster.map(id => { const c = pool.byId.get(id); return c && <li key={id}>{c.name} <small>{c.pos} · {c.ovr}</small></li>; })}</ol>
    </div>}
  </div>;
}
