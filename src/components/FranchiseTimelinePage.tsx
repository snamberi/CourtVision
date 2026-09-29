import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { franchiseTimeline, EVENT_ICON, type TimelineSeason } from '../simulation/timeline';
import { resolveTeamIdentity } from '../simulation/teamIdentity';
import { formatSeasonYear } from '../simulation/calendar';
import { TeamLogo } from './TeamLogo';
import { PlayerNameTag } from './PlayerAvatar';

/** Draws the whole timeline as one tall image (a row per season), for sharing. */
async function timelineImage(teamName: string, primary: string, seasons: TimelineSeason[]): Promise<Blob | null> {
  const W = 1080, head = 150, rowH = (s: TimelineSeason) => 70 + Math.min(4, s.events.length) * 26;
  const H = head + seasons.reduce((n, s) => n + rowH(s), 0) + 60;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  if (!x) return null;
  x.fillStyle = '#0b1018'; x.fillRect(0, 0, W, H);
  x.fillStyle = primary; x.fillRect(0, 0, W, 10);
  x.fillStyle = '#f47b20'; x.font = "bold 18px 'Press Start 2P', monospace"; x.fillText('FRANCHISE TIMELINE', 48, 60);
  x.fillStyle = '#f4f0e6'; x.font = "bold 44px 'Oswald', sans-serif"; x.fillText(teamName.toUpperCase(), 48, 118);
  let y = head;
  for (const s of seasons) {
    const h = rowH(s);
    x.fillStyle = s.champion ? '#3a2f10' : '#121926'; x.fillRect(40, y, W - 80, h - 10);
    x.fillStyle = s.champion ? '#ffd166' : primary; x.fillRect(40, y, 8, h - 10);
    x.fillStyle = '#ffd166'; x.font = "bold 26px 'Oswald', sans-serif"; x.fillText(formatSeasonYear(s.season), 68, y + 38);
    x.fillStyle = '#f4f0e6'; x.fillText(`${s.wins}-${s.losses}`, 300, y + 38);
    x.fillStyle = s.champion ? '#ffd166' : '#94a0b2'; x.font = "bold 20px 'Oswald', sans-serif"; x.fillText(s.champion ? 'CHAMPIONS' : s.finish.toUpperCase(), 440, y + 38);
    x.fillStyle = '#c9ced8'; x.font = "18px 'Inter', sans-serif";
    s.events.slice(0, 4).forEach((e, i) => x.fillText(`${EVENT_ICON[e.kind]}  ${e.text}`, 68, y + 70 + i * 26));
    y += h;
  }
  x.fillStyle = '#94a0b2'; x.font = "16px 'Inter', sans-serif"; x.fillText('Court Vision', 48, H - 24);
  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}

/** A team's history as a scrollable pixel timeline: banners, big trades, retired jerseys, playoff runs, the arena. */
export function FranchiseTimelinePage({ league, extras, controlledTeamId, onSelectPlayer }: { league: League; extras: GMLeagueExtras; controlledTeamId: string | null; onSelectPlayer: (id: string) => void }) {
  const [teamId, setTeamId] = useState(controlledTeamId ?? league.teams[0]?.teamId ?? '');
  const team = league.teams.find(t => t.teamId === teamId);
  const seasons = useMemo(() => franchiseTimeline(league, extras, teamId), [league, extras, teamId]);
  const [sel, setSel] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const picked = seasons.find(s => s.season === sel) ?? seasons[seasons.length - 1];
  if (!team) return <p className="empty-state">No team to show.</p>;
  const id = resolveTeamIdentity(team);
  const titles = seasons.filter(s => s.champion);
  const share = async () => {
    const blob = await timelineImage(team.name, id.primary, seasons);
    if (!blob) { setStatus('Could not draw the image in this browser.'); return; }
    const { shareImage } = await import('../share/shareCard');
    try { const r = await shareImage(blob, `${team.name.replace(/\W+/g, '-')}-timeline.png`, `${team.name}: the franchise timeline · Court Vision`, 'share'); setStatus(r === 'shared' ? 'Shared!' : 'Saved.'); }
    catch { setStatus('Sharing was cancelled.'); }
  };
  return <div className="timeline-page" style={{ ['--tl1' as string]: id.primary, ['--tl2' as string]: id.secondary }}>
    <div className="season-feature-header"><div><span className="pixel-eyebrow">FRANCHISE TIMELINE</span>
      <h2 className="timeline-title"><TeamLogo team={team} size={40} /> {team.name}</h2>
      <p>{seasons.length} season{seasons.length === 1 ? '' : 's'} · {titles.length} title{titles.length === 1 ? '' : 's'}{titles.length ? ` (${titles.map(t => formatSeasonYear(t.season)).join(', ')})` : ''}</p></div>
      <div className="timeline-actions"><label>Team<select value={teamId} onChange={e => { setTeamId(e.target.value); setSel(null); }}>{league.teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select></label>
        <button onClick={() => void share()}>Share as image</button>{status && <small role="status">{status}</small>}</div></div>
    {titles.length > 0 && <div className="timeline-rafters" aria-label="Banners">{titles.map(t => <span key={t.season} className="timeline-banner"><b>CHAMPIONS</b><small>{formatSeasonYear(t.season)}</small></span>)}
      {(team.retiredJerseys ?? []).map(j => <span key={j.number} className="timeline-banner timeline-jersey"><b>#{j.number}</b><small>{j.playerId.split(' ').slice(-1)[0]}</small></span>)}</div>}
    <ol className="timeline-rail">{seasons.map(s => <li key={s.season}><button className={`timeline-stop${s.champion ? ' champ' : ''}${s === picked ? ' active' : ''}${s.current ? ' current' : ''}`} onClick={() => setSel(s.season)} aria-pressed={s === picked}>
      <b>{formatSeasonYear(s.season)}</b><span className="timeline-record">{s.wins}-{s.losses}</span><small>{s.champion ? 'CHAMPIONS' : s.finish}</small>
      <span className="timeline-icons">{s.events.slice(0, 5).map((e, i) => <i key={i} className={`tl-${e.kind}`} title={e.text}>{EVENT_ICON[e.kind]}</i>)}</span></button></li>)}</ol>
    {picked && <section className="timeline-detail">
      <h3>{formatSeasonYear(picked.season)} · {picked.wins}-{picked.losses} · {picked.champion ? 'Champions' : picked.finish}</h3>
      {picked.events.length > 0 ? <ul className="timeline-events">{picked.events.map((e, i) => <li key={i} className={`tl-${e.kind}`}><i>{EVENT_ICON[e.kind]}</i>{e.text}</li>)}</ul> : <p className="hint-text">A quiet season: no banners, big trades or awards.</p>}
      {picked.summary ? <div className="feature-table-scroll"><table className="db-table"><thead><tr><th className="col-name">Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>GP</th><th>PTS</th><th>REB</th><th>AST</th><th>WS</th></tr></thead>
        <tbody>{picked.summary.roster.map(r => <tr key={r.playerId}><td className="col-name"><button className="prospect-name" onClick={() => onSelectPlayer(r.playerId)}><PlayerNameTag playerId={r.playerId} teamId={teamId} size={22} /></button></td>
          <td>{r.position}</td><td>{r.age}</td><td>{r.overall}</td><td>{r.gp}</td><td>{r.pts.toFixed(1)}</td><td>{r.reb.toFixed(1)}</td><td>{r.ast.toFixed(1)}</td><td>{r.ws.toFixed(1)}</td></tr>)}</tbody></table></div>
        : <p className="hint-text">The season in progress: its box scores are in the Schedule and Game pages until it is archived here.</p>}
      {picked.summary && <p className="hint-text">Box scores are kept for the current season only; archived seasons keep the roster, records, awards and playoff series.</p>}
    </section>}
  </div>;
}
