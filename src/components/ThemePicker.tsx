import { useEffect, useRef, useState } from 'react';
import './themePicker.css';
import { Modal } from './Modal';
import { THEME_BY_ID, THEME_EVENT, readTheme, setTheme, applyTheme, themeLevel, themeTrophies, themeOpen, visibleThemes, type ThemeId, type ThemeSpec } from '../theme/themes';
import { totalTrophies } from '../profile/trophyRoad';
import { levelFor, totalXp, PROFILE_EVENT } from '../profile/profile';

/** The theme picked in this browser, following changes made anywhere (the picker, another tab). */
export function useTheme(): ThemeId {
  const [id, setId] = useState<ThemeId>(() => readTheme() ?? 'original');
  useEffect(() => {
    const sync = () => setId(readTheme() ?? 'original');
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(THEME_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return id;
}

/** The player's level (looks on the Level Road open with it). */
function useLevel(): number {
  const [level, setLevel] = useState(() => levelFor(totalXp()).level);
  useEffect(() => {
    const sync = () => setLevel(levelFor(totalXp()).level);
    window.addEventListener(PROFILE_EVENT, sync);
    return () => window.removeEventListener(PROFILE_EVENT, sync);
  }, []);
  return level;
}

/** A small Court Vision screen drawn in a theme's own colours and fonts, so every card previews its look. */
function Preview({ t }: { t: ThemeSpec }) {
  return <span className="theme-preview" data-theme-preview={t.id} aria-hidden="true">
    <span className="tp-top"><i />COURT VISION<span>01</span></span>
    <span className="tp-scene" />
    <span className="tp-stats"><span className="tp-row"><b>S. Curry</b><em>96</em></span>
      <span className="tp-row"><b>J. Brown</b><em>88</em></span></span>
    <span className="tp-btn">Play <span>→</span></span>
  </span>;
}

/** The looks as radio cards. Picking one applies it to the whole app straight away; road looks open with the level. */
export function ThemePicker({ value, onPick, level, trophies = totalTrophies(), themes = visibleThemes() }: { value: ThemeId; onPick: (id: ThemeId) => void; level: number; trophies?: number; themes?: ThemeSpec[] }) {
  // The previews use each theme's fonts; load them (small, bundled) so the cards look right.
  useEffect(() => { for (const t of themes) void t.loadFonts?.().catch(() => null); }, [themes]);
  return <div className="theme-picker" role="radiogroup" aria-label="App look">
    {themes.map(t => {
      const need = themeLevel(t.id), cups = themeTrophies(t.id), locked = !themeOpen(t.id, level, trophies), on = value === t.id;
      return <button key={t.id} type="button" role="radio" aria-checked={on} disabled={locked} title={t.blurb}
        className={`theme-card ${on ? 'selected' : ''} ${locked ? 'locked' : ''}`} onClick={() => onPick(t.id)}>
        <span className={`theme-preview-wrap ${on || locked ? 'tagged' : ''}`}><Preview t={t} />{on ? <i className="theme-tag on">In use</i> : locked ? <i className="theme-tag">{cups ? `${cups / 1000}K TROPHIES` : `LV ${need}`}</i> : null}</span>
        <span className="theme-card-head"><b>{t.name}</b></span>
        <span className="theme-card-blurb">{t.blurb}</span>
      </button>;
    })}
  </div>;
}

/** The profile's "App look" section: every look, the road ones locked until their level. */
export function ThemeSection() {
  const id = useTheme(), level = useLevel();
  const trophies = totalTrophies();
  const list = visibleThemes();
  const open = list.filter(t => themeOpen(t.id, level, trophies)).length;
  return <div className="profile-picker theme-section"><h3 className="hunt-subhead">App look <small>{open} of {list.length} unlocked</small></h3>
    <ThemePicker value={id} onPick={setTheme} level={level} trophies={trophies} />
    <p className="hint-text">Changes the scenery, panels, colours and type throughout every mode. Kept on this device. A new look unlocks every 25 levels on the Level Road, and the legendary looks unlock on the Trophy Road.</p>
  </div>;
}

/** First visit: pick a look before anything else (shown once; the original stays if you just continue). */
export function ThemeWelcome({ onDone }: { onDone: () => void }) {
  const [id, setId] = useState<ThemeId>(() => readTheme() ?? 'original');
  const level = useLevel();
  const keepRef = useRef<HTMLButtonElement>(null);
  const keep = () => { setTheme(id); onDone(); };
  useEffect(() => {
    keepRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') keep(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Try a look on the whole app while choosing; it is saved on "Play in this look".
  const pick = (next: ThemeId) => { setId(next); applyTheme(next); };
  // Only the looks open now; the road ones are a teaser line.
  const open = visibleThemes().filter(t => themeOpen(t.id, level, totalTrophies()));
  const later = visibleThemes().length - open.length;
  return <div className="share-modal theme-welcome" role="dialog" aria-modal="true" aria-labelledby="theme-welcome-title">
    <div className="share-box">
      <span className="pixel-eyebrow">WELCOME TO COURT VISION</span>
      <h2 id="theme-welcome-title">Pick your look</h2>
      <p className="hint-text">Tap one to try it on the whole game. You can change it any time in your Player Profile.</p>
      <ThemePicker value={id} onPick={pick} level={level} themes={open} />
      {later > 0 && <p className="hint-text">{later} more looks unlock on the Level Road and the Trophy Road as you play.</p>}
      <div className="contest-actions"><button ref={keepRef} className="primary" onClick={keep}>Play in this look</button></div>
    </div>
  </div>;
}

/** Whether the first-visit picker still has to be shown. */
export const needsThemeChoice = () => readTheme() === null;

/** The masthead's "Theme: <name>" chip: opens every look in a dialog. */
export function ThemeChip() {
  const id = useTheme();
  const [open, setOpen] = useState(false);
  const t = THEME_BY_ID.get(id) ?? THEME_BY_ID.get('original')!;
  return <>
    <button className="account-chip mh-theme" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Change theme: ${t.name}`} title={`Change theme: ${t.name}`}>
      <i className="mh-theme-dot" aria-hidden="true" /><span className="mh-theme-name">{t.name}</span>
    </button>
    {open && <Modal label="App look" onClose={() => setOpen(false)} className="theme-modal">
      <ThemeSection />
      <div className="theme-modal-actions"><button className="primary" onClick={() => setOpen(false)}>Done</button></div>
    </Modal>}
  </>;
}
