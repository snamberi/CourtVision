import { useEffect, useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import { computeStandings } from '../simulation/league';
import { awardOptions, computeSeasonAwards } from '../simulation/awards';
import { resolveTeamIdentity } from '../simulation/teamIdentity';

export function SeasonRecap50({ league, teamId }: { league: League; teamId: string }) {
  const [season, setSeason] = useState(league.franchiseHistory?.at(-1)?.season ?? league.season ?? '');
  const [headline, setHeadline] = useState(''), [image, setImage] = useState(''), [status, setStatus] = useState('');
  const recap = useMemo(() => {
    const record = league.franchiseHistory?.find(r => r.season === season), team = league.teams.find(t => t.teamId === teamId);
    const archived = record?.teamSeasons?.find(t => t.teamId === teamId), current = !record && season === league.season ? computeStandings(league).find(t => t.teamId === teamId) : null;
    const roster = archived?.roster.map(p => ({ ...p, pts: p.pts * p.gp })) ?? team?.seasons.map(p => ({ playerId: p.playerId, pts: p.seasonStats?.points ?? 0, gp: p.seasonStats?.gamesPlayed ?? 0 })) ?? [];
    const scorer = roster.filter(p => p.gp > 0).slice().sort((a, b) => b.pts / b.gp - a.pts / a.gp)[0];
    const awards = record?.fullAwards ?? (season === league.season ? computeSeasonAwards(league, awardOptions(league.awardSettings)) : null);
    const games = season === league.season ? league.schedule.filter(g => g.played && g.result && [g.homeTeamId, g.awayTeamId].includes(teamId)) : [];
    const best = games.flatMap(g => Object.values((g.homeTeamId === teamId ? g.result!.homeBox : g.result!.awayBox).players).map(p => ({ ...p, gameId: g.id }))).sort((a, b) => b.points - a.points)[0];
    return { team, title: team?.name ?? teamId, wins: archived?.wins ?? current?.wins ?? 0, losses: archived?.losses ?? current?.losses ?? 0,
      finish: archived?.playoffFinish ?? (league.playoffBracket?.championTeamId === teamId ? 'Champion' : 'Season in progress'),
      mvp: awards?.mvp?.playerId ?? 'Not awarded', scorer, best, colors: team ? resolveTeamIdentity(team) : null };
  }, [league, teamId, season]);
  useEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 675; const c = canvas.getContext('2d'); if (!c) return;
    c.fillStyle = '#0b1420'; c.fillRect(0, 0, 1200, 675); const gradient = c.createLinearGradient(0, 0, 1200, 675); gradient.addColorStop(0, recap.colors?.primary ?? '#224a74'); gradient.addColorStop(1, '#0b1420'); c.fillStyle = gradient; c.fillRect(0, 0, 1200, 675);
    c.strokeStyle = '#ffffff18'; c.lineWidth = 3; c.strokeRect(35, 35, 1130, 605); c.beginPath(); c.arc(1090, 330, 250, 0, Math.PI * 2); c.stroke();
    const text = (value: string, x: number, y: number, size: number, color = '#fff', max = 1050) => { c.fillStyle = color; c.font = `700 ${size}px system-ui,sans-serif`; while (c.measureText(value).width > max && size > 16) c.font = `700 ${--size}px system-ui,sans-serif`; c.fillText(value, x, y); };
    text(`COURTVISION  /  ${season} SEASON`, 70, 90, 25, '#c6d7e9'); text(recap.title.toUpperCase(), 70, 155, 49);
    text(headline.trim() || (recap.finish === 'Champion' ? 'A SEASON TO REMEMBER.' : 'EVERY SEASON HAS A STORY.'), 70, 218, 32, '#edc66b');
    text(`${recap.wins}–${recap.losses}`, 70, 365, 120); text(recap.finish.toUpperCase(), 520, 342, 32, '#e3edf6', 600);
    c.fillStyle = '#ffffff33'; c.fillRect(70, 410, 1060, 2);
    text('LEAGUE MVP', 70, 465, 20, '#a4bed5'); text(recap.mvp, 70, 505, 29, '#fff', 490);
    text('LEADING SCORER', 660, 465, 20, '#a4bed5'); text(recap.scorer ? `${recap.scorer.playerId} · ${(recap.scorer.pts / recap.scorer.gp).toFixed(1)} PPG` : 'No games recorded', 660, 505, 29, '#fff', 470);
    text(recap.best ? `BIG NIGHT: ${recap.best.playerId} — ${recap.best.points} PTS` : `YOUR LEAGUE. YOUR LEGACY.`, 70, 575, 25, '#edc66b');
    text('courtvisiongame.com', 70, 630, 20, '#c6d7e9'); setImage(canvas.toDataURL('image/png'));
  }, [recap, season, headline]);
  return <section><h4>Share your season</h4><div className="studio-toolbar"><label>Season <select value={season} onChange={e => setSeason(e.target.value)}>{[...new Set([league.season ?? '', ...(league.franchiseHistory ?? []).map(r => r.season)])].map(y => <option key={y}>{y}</option>)}</select></label><label>Headline <input value={headline} maxLength={80} onChange={e => setHeadline(e.target.value)} placeholder="Choose your headline" /></label></div>{image && <img className="recap50-preview" src={image} alt={`${season} season recap for ${recap.title}`} />}<div className="studio-toolbar"><button disabled={!image} onClick={() => { const a = document.createElement('a'); a.href = image; a.download = `CourtVision-${season}-recap.png`; a.click(); }}>Download PNG</button><button disabled={!image} onClick={async () => { try { const blob = await (await fetch(image)).blob(); const file = new File([blob], 'CourtVision-season.png', { type: 'image/png' }); if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${recap.title} · ${season}` }); else setStatus('Download the PNG to share it in your favorite app.'); } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setStatus('Sharing is unavailable. Download the PNG instead.'); } }}>Share card</button></div>{status && <p role="status">{status}</p>}</section>;
}
