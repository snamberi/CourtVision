import { useEffect, useRef, useState } from 'react';
import './themePicker.css';
import { THEMES, THEME_EVENT, readTheme, setTheme, applyTheme, type ThemeId, type ThemeSpec } from '../theme/themes';

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

/** A small Court Vision screen drawn in a theme's own colours and fonts, so every card previews its look. */
function Preview({ t }: { t: ThemeSpec }) {
  const p = t.preview;
  return <span className="theme-preview" aria-hidden="true" style={{ background: p.bg, color: p.text, borderColor: p.line, fontFamily: p.body }}>
    <span className="tp-top" style={{ fontFamily: p.display }}><span>Court Vision</span><i style={{ borderColor: p.line, color: p.dim }}>0-0</i></span>
    <span className="tp-row" style={{ background: p.panel, borderColor: p.line }}><b>Stephen Curry</b><em style={{ color: p.hi }}>96</em></span>
    <span className="tp-row" style={{ background: p.panel, borderColor: p.line }}><b style={{ color: p.dim }}>Jaylen Brown</b><em>88</em></span>
    <span className="tp-btn" style={{ background: p.accent, color: p.onAccent, fontFamily: p.display }}>Play</span>
  </span>;
}

/** The five looks as radio cards. Picking one applies it to the whole app straight away. */
export function ThemePicker({ value, onPick }: { value: ThemeId; onPick: (id: ThemeId) => void }) {
  // The previews use each theme's fonts; load them all (small, bundled) so the cards look right.
  useEffect(() => { for (const t of THEMES) void t.loadFonts?.().catch(() => null); }, []);
  return <div className="theme-picker" role="radiogroup" aria-label="App look">
    {THEMES.map(t => <button key={t.id} type="button" role="radio" aria-checked={value === t.id} className={`theme-card ${value === t.id ? 'selected' : ''}`} onClick={() => onPick(t.id)}>
      <Preview t={t} />
      <b>{t.name}{value === t.id && <small> · in use</small>}</b>
      <span>{t.blurb}</span>
    </button>)}
  </div>;
}

/** The profile's "App look" section. */
export function ThemeSection() {
  const id = useTheme();
  return <div className="profile-picker theme-section"><h3 className="hunt-subhead">App look</h3>
    <ThemePicker value={id} onPick={setTheme} />
    <p className="hint-text">Changes the colours and fonts everywhere, in every mode. Kept on this device.</p>
  </div>;
}

/** First visit: pick a look before anything else (shown once; the original stays if you just continue). */
export function ThemeWelcome({ onDone }: { onDone: () => void }) {
  const [id, setId] = useState<ThemeId>(() => readTheme() ?? 'original');
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
  return <div className="share-modal theme-welcome" role="dialog" aria-modal="true" aria-labelledby="theme-welcome-title">
    <div className="share-box">
      <span className="pixel-eyebrow">WELCOME TO COURT VISION</span>
      <h2 id="theme-welcome-title">Pick your look</h2>
      <p className="hint-text">Tap one to try it on the whole game. You can change it any time in your Player Profile.</p>
      <ThemePicker value={id} onPick={pick} />
      <div className="contest-actions"><button ref={keepRef} className="primary" onClick={keep}>Play in this look</button></div>
    </div>
  </div>;
}

/** Whether the first-visit picker still has to be shown. */
export const needsThemeChoice = () => readTheme() === null;
