import { useEffect, useRef, useState, type ReactNode } from 'react';
import { unseenReleases } from '../content/whatsNew';
import { PixelIcon } from './PixelIcon';
import { MyAvatar } from './UserAvatar';
import { StreakDialog } from './StreakDialog';
import { totalXp, levelFor, equipped, PROFILE_EVENT, type PhoneId } from '../profile/profile';
import { loadRelics, RELICS_EVENT, RELICS_FOCUS_KEY, SHOP_SEEN_KEY } from '../relics/relics';

/*
 * The menu phone: a small pixel phone in the bottom-left corner of the main menu with its apps (Leaderboards,
 * Friends, your Profile, your daily Streak, Court Vision on TikTok and Instagram, the Relic Vault and its Shop,
 * Settings, What's New, Achievements and the Season Pass). Apps sit six to a page (two columns, three rows); swipe,
 * drag or tap the dots for the next page. Hold an app to rearrange them (drag one onto another, or tap two to swap).
 * On smaller screens it sits in the page.
 */
const ORDER_KEY = 'cv-phone-order';
const HINT_KEY = 'cv-phone-hint';
const today = () => new Date().toISOString().slice(0, 10);
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
const savedOrder = (): string[] => { try { const v = JSON.parse(read(ORDER_KEY) ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; } };
const PER_PAGE = 6;


export const SOCIALS = {
  tiktok: 'https://www.tiktok.com/@courtvision.game',
  instagram: 'https://www.instagram.com/courtvision.game/',
} as const;

/** The TikTok note and the Instagram camera, drawn in pixels (16x16). */
const TikTokGlyph = () => <svg viewBox="0 0 16 16" width="20" height="20" shapeRendering="crispEdges" aria-hidden="true">
  <path fill="#25f4ee" d="M7 2h2v9h-1v2H5v-1H4v-2h1V9h3V2z" transform="translate(-1 1)" />
  <path fill="#fe2c55" d="M7 2h2v9h-1v2H5v-1H4v-2h1V9h3V2z" transform="translate(1 0)" />
  <path fill="#fff" d="M7 2h2v1h1v1h2v2h-3v5H8v2H5v-1H4v-2h1V9h2V2z" />
</svg>;
const InstagramGlyph = () => <svg viewBox="0 0 16 16" width="20" height="20" shapeRendering="crispEdges" aria-hidden="true">
  <path fill="#fff" d="M4 2h8v1h1v1h1v8h-1v1h-1v1H4v-1H3v-1H2V4h1V3h1zm0 2v8h8V4zm4 1h1v1h1v1h1v2h-1v1H9v1H7v-1H6V9H5V7h1V6h1V5zm0 2v2h1V7zm3-3h1v1h-1z" />
</svg>;

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export function MenuPhone({ onBoards, onFriends, onProfile, onRelics, onSettings, onWhatsNew, onAchievements, onSeasonPass, streak }: {
  onBoards?: () => void; onFriends?: () => void; onProfile?: () => void; onRelics?: () => void;
  onSettings?: () => void; onWhatsNew?: () => void; onAchievements?: () => void; onSeasonPass?: () => void;
  streak: { current: number; best: number };
}) {
  const [time, setTime] = useState(clock);
  useEffect(() => { const t = window.setInterval(() => setTime(clock()), 30_000); return () => window.clearInterval(t); }, []);
  // Your level and the phone look you picked (Profile → Menu phone), kept up to date.
  const [state, setState] = useState(() => ({ level: levelFor(totalXp()).level, skin: phoneLook() }));
  useEffect(() => {
    const sync = () => setState({ level: levelFor(totalXp()).level, skin: phoneLook() });
    window.addEventListener(PROFILE_EVENT, sync); window.addEventListener('courtvision:progress', sync);
    return () => { window.removeEventListener(PROFILE_EVENT, sync); window.removeEventListener('courtvision:progress', sync); };
  }, []);
  const { level, skin } = state;
  const [streakOpen, setStreakOpen] = useState(false);
  const days = streak.current;
  // Spins waiting and coins, for the Relics and Shop badges.
  const [relics, setRelics] = useState(() => { const r = loadRelics(); return { spins: r.spins, coins: r.coins }; });
  useEffect(() => {
    const sync = () => { const r = loadRelics(); setRelics({ spins: r.spins, coins: r.coins }); };
    window.addEventListener(RELICS_EVENT, sync); return () => window.removeEventListener(RELICS_EVENT, sync);
  }, []);
  // Notification dots: a new shop today, an update not read yet.
  const [shopNew] = useState(() => read(SHOP_SEEN_KEY) !== today());
  const [newsNew] = useState(() => { try { return unseenReleases().length > 0; } catch { return false; } });
  const openShop = () => { try { sessionStorage.setItem(RELICS_FOCUS_KEY, 'shop'); } catch { /* storage blocked */ } onRelics?.(); };
  const dot = <i className="app-dot" aria-hidden="true" />;

  type App = { key: string; node: ReactNode };
  const all: App[] = ([
    onBoards && { key: 'boards', node: <button className="menu-phone-app" onClick={onBoards}><span className="app-tile boards"><PixelIcon name="trophy" size={20} /></span><small>Boards</small></button> },
    onFriends && { key: 'friends', node: <button className="menu-phone-app" onClick={onFriends}><span className="app-tile friends"><PixelIcon name="team" size={20} /></span><small>Friends</small></button> },
    onProfile && { key: 'profile', node: <button className="menu-phone-app" onClick={onProfile} aria-label={`Profile, level ${level}`}><span className="app-tile profile"><MyAvatar size={26} mode="portrait" animate={false} title="" /><em>{level}</em></span><small>Profile</small></button> },
    { key: 'streak', node: <button className="menu-phone-app" onClick={() => setStreakOpen(true)} aria-haspopup="dialog" aria-label={`Daily streak: ${days} day${days === 1 ? '' : 's'}, best ${streak.best}`} title={`Daily streak: ${days} day${days === 1 ? '' : 's'} in a row (best ${streak.best})`}>
      <span className="app-tile streak"><PixelIcon name="flame" size={18} /><em>{days}</em></span><small>{days === 1 ? '1 day' : `${days} days`}</small>
    </button> },
    { key: 'tiktok', node: <a className="menu-phone-app" href={SOCIALS.tiktok} target="_blank" rel="noopener noreferrer" aria-label="Court Vision on TikTok (opens a new tab)"><span className="app-tile tiktok"><TikTokGlyph /></span><small>TikTok</small></a> },
    { key: 'instagram', node: <a className="menu-phone-app" href={SOCIALS.instagram} target="_blank" rel="noopener noreferrer" aria-label="Court Vision on Instagram (opens a new tab)"><span className="app-tile instagram"><InstagramGlyph /></span><small>Instagram</small></a> },
    onRelics && { key: 'relics', node: <button className="menu-phone-app" onClick={onRelics} aria-label={`Relic Vault${relics.spins ? `, ${relics.spins} spin${relics.spins === 1 ? '' : 's'} waiting` : ''}`}><span className="app-tile relics"><PixelIcon name="crown" size={20} />{relics.spins > 0 && <em className="app-badge">{relics.spins}</em>}</span><small>Relics</small></button> },
    onRelics && { key: 'shop', node: <button className="menu-phone-app" onClick={openShop} aria-label={`Relic Shop, ${relics.coins} coins${shopNew ? ', new relics today' : ''}`}><span className="app-tile shop"><PixelIcon name="star" size={20} /><em>{relics.coins >= 1000 ? `${Math.floor(relics.coins / 1000)}k` : relics.coins}</em>{shopNew && dot}</span><small>Shop</small></button> },
    onSettings && { key: 'settings', node: <button className="menu-phone-app" onClick={onSettings}><span className="app-tile settings"><PixelIcon name="gear" size={20} /></span><small>Settings</small></button> },
    onWhatsNew && { key: 'news', node: <button className="menu-phone-app" onClick={onWhatsNew} aria-label={`What's new${newsNew ? ' (unread)' : ''}`}><span className="app-tile news"><PixelIcon name="list" size={20} />{newsNew && dot}</span><small>What's new</small></button> },
    onAchievements && { key: 'achievements', node: <button className="menu-phone-app" onClick={onAchievements}><span className="app-tile achievements"><PixelIcon name="check" size={20} /></span><small>Achievements</small></button> },
    onSeasonPass && { key: 'pass', node: <button className="menu-phone-app" onClick={onSeasonPass}><span className="app-tile pass"><PixelIcon name="calendar" size={20} /></span><small>Season Pass</small></button> },
  ] as (App | false | undefined)[]).filter((x): x is App => !!x);

  // Your order (saved), then any app it doesn't know yet.
  const [order, setOrder] = useState<string[]>(savedOrder);
  const keys = all.map(a => a.key);
  const sorted = [...order.filter(k => keys.includes(k)), ...keys.filter(k => !order.includes(k))];
  const byKey = new Map(all.map(a => [a.key, a.node]));
  const swap = (a: string, b: string) => {
    if (a === b) return;
    const next = [...sorted]; const i = next.indexOf(a), j = next.indexOf(b);
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next); write(ORDER_KEY, JSON.stringify(next));
  };
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const hold = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const appDrag = useRef<string | null>(null);

  const pages: string[][] = [];
  for (let i = 0; i < sorted.length; i += PER_PAGE) pages.push(sorted.slice(i, i + PER_PAGE));

  // Swiping: touch and trackpads scroll the pager natively (it snaps to pages); a mouse can drag it.
  const pager = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const goTo = (i: number) => { const el = pager.current; if (!el) return; const n = Math.max(0, Math.min(pages.length - 1, i)); el.scrollTo({ left: n * el.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); setPage(n); };
  const onScroll = () => { const el = pager.current; if (el && el.clientWidth) setPage(Math.round(el.scrollLeft / el.clientWidth)); window.clearTimeout(hold.current); };
  // The first time: a small nudge so you know there's another page.
  const [hint] = useState(() => !read(HINT_KEY));
  useEffect(() => { if (hint && pages.length > 1) write(HINT_KEY, '1'); }, [hint, pages.length]);

  const appKey = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.('[data-app]')?.getAttribute('data-app') ?? null;
  return <aside className={`menu-phone phone-skin-${skin} ${editing ? 'editing' : ''}`} aria-label="Your phone">
    <div className="menu-phone-body">
      {skin !== 'classic' && <span className="phone-case-detail" aria-hidden="true" />}
      <div className="menu-phone-status" aria-hidden="true"><span>{time}</span><i className="menu-phone-notch" /><span className="menu-phone-icons"><i className="sig" /><i className="bat" /></span></div>
      <div className={`menu-phone-pages ${hint && pages.length > 1 ? 'hint' : ''}`} ref={pager} onScroll={onScroll} role="group" aria-roledescription="carousel" aria-label="Apps"
        onPointerDown={e => {
          held.current = false;
          if (e.pointerType === 'mouse' && !editing) drag.current = { x: e.clientX, moved: false };
          if (editing) appDrag.current = appKey(e.target);
          else if (appKey(e.target)) { window.clearTimeout(hold.current); hold.current = window.setTimeout(() => { held.current = true; drag.current = null; setEditing(true); }, 550); }
        }}
        onPointerMove={e => { if (drag.current && Math.abs(e.clientX - drag.current.x) > 8) { drag.current.moved = true; window.clearTimeout(hold.current); } }}
        onPointerUp={e => {
          window.clearTimeout(hold.current);
          if (editing && appDrag.current) {
            const over = appKey(document.elementFromPoint(e.clientX, e.clientY));
            if (over && over !== appDrag.current) { swap(appDrag.current, over); setPicked(null); held.current = true; }
            appDrag.current = null;
          }
          const d = drag.current; if (d?.moved) { const dx = e.clientX - d.x; if (Math.abs(dx) > 30) goTo(page + (dx < 0 ? 1 : -1)); }
          window.setTimeout(() => { drag.current = null; }, 0);
        }}
        onPointerCancel={() => { window.clearTimeout(hold.current); appDrag.current = null; }}
        onContextMenu={e => { if (appKey(e.target)) e.preventDefault(); }}
        onClickCapture={e => {
          if (drag.current?.moved || held.current) { e.preventDefault(); e.stopPropagation(); held.current = false; return; }
          if (!editing) return;
          // Rearranging: tap one app, then another, to swap them.
          e.preventDefault(); e.stopPropagation();
          const k = appKey(e.target); if (!k) return;
          if (!picked) setPicked(k); else { swap(picked, k); setPicked(null); }
        }}
        onKeyDown={e => { if (e.key === 'ArrowRight') goTo(page + 1); else if (e.key === 'ArrowLeft') goTo(page - 1); else if (e.key === 'Escape' && editing) { setEditing(false); setPicked(null); } }}>
        {pages.map((p, i) => <div key={i} className="menu-phone-apps" role="group" aria-roledescription="page" aria-label={`Page ${i + 1} of ${pages.length}`} aria-hidden={i !== page || undefined}>
          {p.map(k => <div key={k} data-app={k} className={`menu-phone-slot ${picked === k ? 'picked' : ''}`}>{byKey.get(k)}</div>)}
        </div>)}
      </div>
      {pages.length > 1 && <div className="menu-phone-dots">{pages.map((_, i) => <button key={i} type="button" className={i === page ? 'on' : ''} aria-label={`Apps page ${i + 1}`} aria-current={i === page || undefined} onClick={() => goTo(i)} />)}</div>}
      {editing ? <div className="menu-phone-edit"><small>{picked ? 'Now tap where it goes' : 'Drag an app onto another, or tap two to swap'}</small><button type="button" onClick={() => { setEditing(false); setPicked(null); }}>Done</button></div>
        : <button type="button" className="menu-phone-arrange link-button" onClick={() => setEditing(true)}>Rearrange</button>}
      <i className="menu-phone-home" aria-hidden="true" />
    </div>
    {streakOpen && <StreakDialog streak={streak} onClose={() => setStreakOpen(false)} onProfile={onProfile} />}
  </aside>;
}

const phoneLook = (): PhoneId => { try { return equipped().phone; } catch { return 'classic'; } };
