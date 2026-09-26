import { TeamLink } from './TeamLink';
import { useState } from 'react';
import type { FranchiseHistoryRecord, LeagueTeam } from '../simulation/league';
import { LOGO_STYLES, resolveTeamIdentity, type TeamIdentity } from '../simulation/teamIdentity';
import { TeamLogo } from './TeamLogo';
import { PlayerAvatar } from './PlayerAvatar';
export function TeamIdentityPanel({ team, history = [], currentChampion, currentSeason, onChange }: {
  team: LeagueTeam; history?: FranchiseHistoryRecord[]; currentChampion?: string | null; currentSeason?: string;
  onChange?: (identity: TeamIdentity) => void;
}) {
  const identity = resolveTeamIdentity(team);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(identity);
  const years = [...new Set([...history.filter(h => h.championTeamId === team.teamId).map(h => h.season),
    ...(currentChampion === team.teamId && currentSeason ? [currentSeason] : [])])];
  const preview = { ...team, identity: draft };
  return <section className="team-identity" aria-label={`${team.name} identity`}>
    <div className="team-identity-heading"><TeamLogo team={team} /><div><span className="pixel-eyebrow">FRANCHISE IDENTITY</span><h3><TeamLink name={team.name} /></h3><p>{identity.abbreviation} · {years.length} championship{years.length === 1 ? '' : 's'}</p></div>
      {onChange && <button onClick={() => { setDraft(identity); setEditing(!editing); }}>{editing ? 'Close Editor' : 'Edit Team Identity'}</button>}
    </div>
    {editing && onChange && <form className="identity-editor" onSubmit={e => { e.preventDefault(); onChange(resolveTeamIdentity(preview)); setEditing(false); }}>
      <div className="identity-preview" style={{ background: draft.courtApron }}><TeamLogo team={preview} size={100} /><PlayerAvatar playerId={team.seasons[0]?.playerId ?? team.name} primaryColor={draft.primary} secondaryColor={draft.secondary} jerseyStyle={draft.jerseyStyle} jerseyNumber={team.seasons[0]?.jerseyNumber ?? 30} size={80} /><div className="identity-court-preview" style={{ background: draft.courtPaint }}>HOME COURT</div></div>
      <div className="identity-fields">
        <label>Abbreviation<input aria-label="Team abbreviation" value={draft.abbreviation} maxLength={4} required pattern="[A-Za-z0-9]{1,4}" onChange={e => setDraft({ ...draft, abbreviation: e.target.value.toUpperCase() })} /></label>
        <label>Logo<select aria-label="Logo" value={draft.logo} onChange={e => setDraft({ ...draft, logo: e.target.value as TeamIdentity['logo'] })}>{LOGO_STYLES.map(logo => <option key={logo}>{logo}</option>)}</select></label>
        <label>Jersey design<select aria-label="Jersey design" value={draft.jerseyStyle} onChange={e => setDraft({ ...draft, jerseyStyle: e.target.value as TeamIdentity['jerseyStyle'] })}><option value="classic">Classic</option><option value="stripe">Chest stripe</option><option value="split">Split color</option></select></label>
        {(['primary', 'secondary', 'courtPaint', 'courtApron'] as const).map((key, i) => <label key={key}>{['Jersey primary', 'Jersey trim', 'Court paint', 'Court border'][i]}<input aria-label={['Jersey primary', 'Jersey trim', 'Court paint', 'Court border'][i]} type="color" value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
        <button className="primary" type="submit">Save Team Identity</button><button type="button" onClick={() => setDraft(resolveTeamIdentity({ ...team, identity: undefined }))}>Use Original Design</button>
      </div>
    </form>}
    <div className="franchise-rafters" aria-label="Franchise banners">
      {years.map(year => <div className="franchise-banner championship-banner" key={year}><strong>CHAMPIONS</strong><b>{year}</b><span>{identity.abbreviation}</span></div>)}
      {(team.retiredJerseys ?? []).map(j => <div className="franchise-banner" key={`jersey-${j.number}`}><span>RETIRED</span><b>#{j.number}</b><strong>{j.playerId}</strong><small>{j.season}</small></div>)}
      {!years.length && !team.retiredJerseys?.length && <p className="hint-text">The rafters are waiting. Championships and retired numbers will appear here.</p>}
    </div>
  </section>;
}
