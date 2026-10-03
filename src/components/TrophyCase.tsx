import { useEffect, useMemo, useState } from 'react';
import { readRecordBook } from '../retention/recordBook';
import { HIGH_LABEL, type HighCat } from '../hunt/statLines';
import { loadRecords } from '../hunt/storage';
import { loadPerfectRecords } from '../perfect/storage';
import { readFavorites, REAL_FRANCHISES } from '../profile/favorites';
import { xpParts, totalXp, levelFor, localName, equipped, PROFILE_EVENT, TITLES } from '../profile/profile';
import { unlockContext, earnedExtraTitles } from '../profile/cosmetics';
import { readStreak } from '../retention/streak';
import { PixelIcon } from './PixelIcon';

/*
 * The trophy case (#10): a shelf of up to six things you're proud of (titles, records, big runs), arranged by you;
 * and the profile card (#11): your level, favourites, best runs and shelf as one shareable image.
 */

export const TROPHY_CASE_KEY = 'cv-trophy-case';
export const SHELF_SIZE = 6;
export interface Trophy { id: string; kind: 'title' | 'record' | 'run'; label: string; detail: string }

/** Everything that can go on the shelf. */
export function trophyOptions(): Trophy[] {
  const out: Trophy[] = [];
  const hunt = loadRecords(), p820 = loadPerfectRecords(), book = readRecordBook(), streak = readStreak();
  if (hunt.wins) out.push({ id: 'run:hunt', kind: 'run', label: `${hunt.wins} League Hunt win${hunt.wins === 1 ? '' : 's'}`, detail: `${hunt.runs} runs` });
  if (p820.titles) out.push({ id: 'run:perfect', kind: 'run', label: `${p820.titles} 82-0 title${p820.titles === 1 ? '' : 's'}`, detail: p820.perfectSeasons ? `${p820.perfectSeasons} perfect season${p820.perfectSeasons === 1 ? '' : 's'}` : `best ${p820.bestWins} wins` });
  if (streak.best >= 3) out.push({ id: 'run:streak', kind: 'run', label: `${streak.best}-day streak`, detail: 'best daily streak' });
  for (const [cat, h] of Object.entries(book.highs) as [HighCat, NonNullable<(typeof book.highs)[HighCat]>][]) out.push({ id: `record:${cat}`, kind: 'record', label: `${h.v} ${HIGH_LABEL[cat].toLowerCase()}`, detail: `${h.name} vs ${h.vs}` });
  for (const [i, f] of book.finals.slice(-3).entries()) out.push({ id: `record:fmvp:${i}`, kind: 'record', label: `Finals MVP: ${f.name}`, detail: `${f.record} · ${Math.round(f.pts / Math.max(1, f.g))} ppg` });
  const level = levelFor(totalXp()).level;
  const titles = [...TITLES.filter(t => t.level <= level).map(t => t.name), ...earnedExtraTitles(unlockContext(level))];
  for (const t of [...new Set(titles)].slice(-24).reverse()) out.push({ id: `title:${t}`, kind: 'title', label: t, detail: 'title' });
  return out;
}
const readShelf = (): string[] => { try { const v = JSON.parse(localStorage.getItem(TROPHY_CASE_KEY) ?? '[]') as unknown; return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, SHELF_SIZE) : []; } catch { return []; } };
const writeShelf = (ids: string[]) => { try { localStorage.setItem(TROPHY_CASE_KEY, JSON.stringify(ids.slice(0, SHELF_SIZE))); } catch { /* storage blocked */ } };
const ICON: Record<Trophy['kind'], string> = { title: 'crown', record: 'chart', run: 'trophy' };

export function TrophyCase() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const b = () => setTick(t => t + 1); window.addEventListener(PROFILE_EVENT, b); return () => window.removeEventListener(PROFILE_EVENT, b); }, []);
  const options = useMemo(() => trophyOptions(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const [shelf, setShelf] = useState(readShelf);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const byId = new Map(options.map(o => [o.id, o]));
  // An empty shelf shows your best things until you arrange it.
  const shown = (shelf.length ? shelf : options.slice(0, SHELF_SIZE).map(o => o.id)).map(id => byId.get(id)).filter((x): x is Trophy => !!x);
  const toggle = (id: string) => { const next = shelf.includes(id) ? shelf.filter(x => x !== id) : shelf.length < SHELF_SIZE ? [...shelf, id] : shelf; setShelf(next); writeShelf(next); };
  const share = async () => {
    setStatus('Drawing your card…');
    try {
      const blob = await profileCardImage(shown);
      if (!blob) { setStatus('This browser could not draw the card.'); return; }
      const { shareImage } = await import('../share/shareCard');
      const r = await shareImage(blob, 'courtvision-profile.png', `${localName()} on Court Vision`, typeof navigator.share === 'function' ? 'share' : 'download');
      setStatus(r === 'shared' ? 'Shared!' : r === 'copied' ? 'Card copied.' : 'Card saved.');
    } catch { setStatus('Sharing was cancelled.'); }
  };
  return <section className="locker-bay trophy-case" aria-label="Trophy case">
    <h2><PixelIcon name="trophy" size={18} /> Trophy case</h2>
    {shown.length ? <ul className="trophy-shelf">{shown.map(t => <li key={t.id} className={`trophy-${t.kind}`}><PixelIcon name={ICON[t.kind]} size={22} /><b>{t.label}</b><small>{t.detail}</small></li>)}</ul>
      : <p className="hint-text">Win things and they show up here: League Hunt wins, 82-0 titles, records, titles.</p>}
    <div className="trophy-actions">
      {options.length > 0 && <button onClick={() => setEditing(e => !e)}>{editing ? 'Done' : 'Arrange the shelf'}</button>}
      <button className="primary" onClick={() => void share()}>Share my profile card</button>
      {status && <span className="hint-text" role="status">{status}</span>}
    </div>
    {editing && <div className="trophy-pick"><p className="hint-text">Pick up to {SHELF_SIZE} ({shelf.length}/{SHELF_SIZE}).</p>
      <ul>{options.map(o => <li key={o.id}><label><input type="checkbox" checked={shelf.includes(o.id)} disabled={!shelf.includes(o.id) && shelf.length >= SHELF_SIZE} onChange={() => toggle(o.id)} /> <b>{o.label}</b> <small>{o.detail}</small></label></li>)}</ul></div>}
  </section>;
}

/** The profile card: 1080 x 1350, your level, title, favourites, best runs and shelf. */
async function profileCardImage(shelf: Trophy[]): Promise<Blob | null> {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); if (!x) return null;
  const xp = totalXp(), lv = levelFor(xp), eq = equipped(lv.level), fav = readFavorites(), parts = xpParts();
  x.fillStyle = '#0b1018'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#f47b20'; x.fillRect(0, 0, W, 14);
  x.fillStyle = '#f47b20'; x.font = "bold 22px 'Press Start 2P', monospace"; x.fillText('COURT VISION · PROFILE', 60, 90);
  x.fillStyle = '#f4f0e6'; x.font = "bold 76px 'Oswald', sans-serif"; x.fillText(localName().toUpperCase().slice(0, 18), 60, 190);
  x.fillStyle = '#ffd166'; x.font = "bold 34px 'Oswald', sans-serif"; x.fillText(eq.title, 60, 240);
  x.fillStyle = '#94a0b2'; x.font = "28px 'Inter', sans-serif"; x.fillText(`Level ${lv.level} · ${xp.toLocaleString()} XP`, 60, 290);
  let y = 370;
  const row = (label: string, value: string) => { x.fillStyle = '#94a0b2'; x.font = "24px 'Inter', sans-serif"; x.fillText(label, 60, y); x.fillStyle = '#f4f0e6'; x.font = "bold 34px 'Oswald', sans-serif"; x.fillText(value, 360, y); y += 60; };
  if (fav.team) row('Favourite team', REAL_FRANCHISES.find(t => t.id === fav.team)?.city ?? fav.team);
  if (fav.playerName) row('Favourite player', fav.playerName);
  for (const p of parts.filter(p => p.xp > 0).sort((a, b) => b.xp - a.xp).slice(0, 4)) row(p.label, p.detail.slice(0, 40));
  y += 20;
  x.fillStyle = '#f47b20'; x.font = "bold 20px 'Press Start 2P', monospace"; x.fillText('TROPHY CASE', 60, y); y += 30;
  shelf.slice(0, SHELF_SIZE).forEach((t, i) => {
    const cx = 60 + (i % 2) * 490, cy = y + Math.floor(i / 2) * 150;
    x.fillStyle = '#121926'; x.fillRect(cx, cy, 470, 130);
    x.fillStyle = t.kind === 'title' ? '#ffd166' : t.kind === 'record' ? '#4da3ff' : '#55c878'; x.fillRect(cx, cy, 8, 130);
    x.fillStyle = '#f4f0e6'; x.font = "bold 32px 'Oswald', sans-serif"; x.fillText(t.label.slice(0, 26), cx + 28, cy + 58);
    x.fillStyle = '#94a0b2'; x.font = "22px 'Inter', sans-serif"; x.fillText(t.detail.slice(0, 36), cx + 28, cy + 98);
  });
  x.fillStyle = '#94a0b2'; x.font = "22px 'Inter', sans-serif"; x.fillText('courtvisiongame.com', 60, H - 50);
  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}
