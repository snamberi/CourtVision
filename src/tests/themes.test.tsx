// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { transform, cssFiles, readCss } from '../../scripts/theme-palette.mjs';
import { PALETTE } from '../theme/palette.gen';
import { THEMES, mapColor, parseHex, analyse, family, themeCss, applyTheme, readTheme, setTheme, THEME_KEY } from '../theme/themes';
import { ThemeWelcome, ThemeSection, needsThemeChoice } from '../components/ThemePicker';

/** WCAG contrast ratio of two opaque hex colours. */
function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = parseHex(h).slice(0, 3).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('every colour and font in the stylesheets is themeable', () => {
  it('no stylesheet has a colour or font the themes cannot reach, and the palette lists them all', () => {
    const all = new Set<string>();
    for (const file of cssFiles()) {
      const css = readCss(file);
      const { out, keys } = transform(css);
      expect(out, `${file} has literals left: run npm run theme:palette`).toBe(css);
      keys.forEach(k => all.add(k));
    }
    expect([...all].sort()).toEqual([...PALETTE]);
  });

  it('the codemod keeps the original look: a literal becomes a variable that falls back to itself', () => {
    const { out } = transform('.a { color: #FFF; box-shadow: 0 0 0 rgba(0, 0, 0, .5); font: 12px \'Oswald\', sans-serif; }\n.b:hover { background: var(--cv-x, #121926); }');
    expect(out).toContain('color: var(--c-fg-ffffff, #FFF)');
    expect(out).toContain('var(--c-shadow-00000080, rgba(0, 0, 0, .5))');
    expect(out).toContain("font: 12px var(--ff-display, 'Oswald', sans-serif)");
    expect(out).toContain('var(--cv-x, var(--c-bg-121926, #121926))');
    expect(transform(out).out).toBe(out); // a second run changes nothing
  });
});

describe('themes', () => {
  const core = { bg: 'bg-060a12', panel: 'bg-13213a', text: 'fg-f3f6fb', dim: 'fg-b6c4d6', court: 'fg-fff6e2', button: 'any-ff9a3a', buttonText: 'fg-211709', good: 'any-6fe39a', bad: 'any-ff7a70' };
  const m = (id: string, key: string) => { const t = THEMES.find(x => x.id === id)!; const i = key.indexOf('-'); return mapColor(t, key.slice(0, i) as never, key.slice(i + 1)); };

  it('the original theme maps nothing and adds no CSS', () => {
    expect(themeCss('original')).toBe('');
    for (const k of Object.values(core)) expect(m('original', k)).toBe(k.slice(k.indexOf('-') + 1));
  });

  for (const t of THEMES.filter(x => x.id !== 'original')) {
    it(`${t.name}: text is readable, buttons are readable, good and bad keep their colours`, () => {
      const c = Object.fromEntries(Object.entries(core).map(([k, v]) => [k, m(t.id, v)]));
      expect(contrast(c.text, c.panel)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.court, c.bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.dim, c.panel)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.buttonText, c.button)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.button, c.bg)).toBeGreaterThanOrEqual(3);
      expect(family(analyse(parseHex(c.bad)).h)).toBe('red');
      expect(c.good).not.toBe(c.bad);
      // Every palette colour gets a value, and alpha is kept.
      const css = themeCss(t.id);
      for (const k of PALETTE) expect(css).toContain(`--c-${k}:`);
      expect(m(t.id, 'shadow-00000080').length).toBe(9);
    });
  }
});

describe('picking a look', () => {
  beforeEach(() => { localStorage.clear(); applyTheme('original'); });
  afterEach(() => { cleanup(); applyTheme('original'); });

  it('first visit: nothing picked yet; trying a look applies it, and "Play in this look" keeps it', () => {
    expect(needsThemeChoice()).toBe(true);
    let done = false;
    render(<ThemeWelcome onDone={() => { done = true; }} />);
    fireEvent.click(screen.getByRole('radio', { name: /Stat Terminal/ }));
    expect(document.documentElement.dataset.cvTheme).toBe('terminal');
    expect(document.getElementById('cv-theme')?.textContent).toContain('--c-bg-13213a:');
    expect(readTheme()).toBeNull(); // only tried so far
    fireEvent.click(screen.getByRole('button', { name: 'Play in this look' }));
    expect(done).toBe(true);
    expect(readTheme()).toBe('terminal');
    expect(needsThemeChoice()).toBe(false);
  });

  it('continuing without trying anything keeps the original (and does not ask again)', () => {
    render(<ThemeWelcome onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play in this look' }));
    expect(localStorage.getItem(THEME_KEY)).toBe('original');
    expect(document.documentElement.dataset.cvTheme).toBeUndefined();
  });

  it('the profile section switches looks and shows which is in use', () => {
    render(<ThemeSection />);
    expect(screen.getByRole('radio', { name: /Court Vision/ }).getAttribute('aria-checked')).toBe('true');
    act(() => { fireEvent.click(screen.getByRole('radio', { name: /Cartridge/ })); });
    expect(document.documentElement.dataset.cvTheme).toBe('cartridge');
    expect(screen.getByRole('radio', { name: /Cartridge/ }).getAttribute('aria-checked')).toBe('true');
    act(() => setTheme('original'));
    expect(document.documentElement.dataset.cvTheme).toBeUndefined();
    expect(document.getElementById('cv-theme')).toBeNull();
  });
});
