// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, act, within } from '@testing-library/react';
import { useState, StrictMode } from 'react';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { TradePage } from '../components/TradePage';
import { PlayerProfile } from '../components/PlayerProfile';
import { FullPlayerEditor } from '../components/FullPlayerEditor';
import { AdBanner } from '../components/AdBanner';
import { AD_CONFIG } from '../ads/adConfig';
import { saveConsent, resetConsent } from '../consent/consent';
import { unloadAdsense, ADSENSE_SRC } from '../ads/adsense';

afterEach(() => { cleanup(); unloadAdsense(); delete window.adsbygoogle; vi.restoreAllMocks(); });
const fixture = () => generateFullLeague(453, 4, 12, 6, '2026', { priorSeasons: false });

describe('player presentation and trading privacy', () => {
  it('keeps badges in one place and puts source information in a small tooltip tag', () => {
    const { league, extras } = fixture(); const p = { ...league.teams[0].seasons[0], badges: [] };
    const { container } = render(<PlayerProfile season={p} teamName="Test Team" sandboxMode={false} onChange={() => {}} league={league} extras={extras} />);
    expect(container.querySelector('.profile-quickstats-grid')?.textContent).not.toMatch(/badge/i);
    expect(screen.getByText('No badges equipped.')).toBeTruthy();
    expect(screen.queryByText(/Data source:/)).toBeNull();
    expect(screen.getByText('Generated').getAttribute('title')).toContain('not an official');
  });
  it('locks every badge control outside sandbox and unlocks it when sandbox is enabled', () => {
    const { league } = fixture(); const p = league.teams[0].seasons[0]; const change = vi.fn();
    const view = render(<FullPlayerEditor season={p} sandboxMode={false} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: /Badges/ }));
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(27);
    expect(boxes.every(e => (e as HTMLInputElement).disabled)).toBe(true);
    fireEvent.click(boxes[0]); expect(change).not.toHaveBeenCalled();
    view.rerender(<FullPlayerEditor season={p} sandboxMode={true} onChange={change} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); expect(change).toHaveBeenCalledOnce();
  });
  it('hides numerical trade values by default and reveals them only after enabling the setting', () => {
    const { league, extras } = fixture();
    function View() { const [e, setE] = useState(extras); return <TradePage league={league} extras={e} controlledTeamId={league.teams[0].teamId} onChange={(_, next) => setE(next)} />; }
    const { container } = render(<View />);
    expect(container.textContent).not.toMatch(/their view:|\(val |value \d/);
    expect(screen.queryByText('Force Through (Sandbox)')).toBeNull();
    fireEvent.click(screen.getByLabelText('Show trade values across the league'));
    expect(screen.getAllByText(/their view:/).length).toBeGreaterThan(0);
    const firstColumn = container.querySelector('.trade-columns')! as HTMLElement;
    expect(within(firstColumn).getAllByText(/value \d/).length).toBeGreaterThan(0);
  });
});

describe('ad lifecycle', () => {
  // These cases switch consent on and off, which is the in-app banner mode.
  const shippedCmp = AD_CONFIG.googleCmp;
  beforeEach(() => { AD_CONFIG.googleCmp = false; localStorage.clear(); resetConsent(); unloadAdsense(); vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800); });
  afterEach(() => { AD_CONFIG.googleCmp = shippedCmp; });
  it('waits for the script and a measurable slot, then submits each slot once under Strict Mode', async () => {
    act(() => saveConsent(true));
    const push = vi.fn(); window.adsbygoogle = { push } as unknown as unknown[];
    render(<StrictMode><AdBanner slot="top" /></StrictMode>);
    expect(push).not.toHaveBeenCalled();
    const script = document.querySelector(`script[src^="${ADSENSE_SRC}"]`)!;
    await act(async () => { script.dispatchEvent(new Event('load')); });
    expect(push).toHaveBeenCalledOnce();
    fireEvent(window, new Event('resize')); expect(push).toHaveBeenCalledOnce();
    act(() => saveConsent(false));
    expect(document.querySelector('ins.adsbygoogle')).toBeNull();
  });
  it('falls back cleanly when the ad script is blocked', async () => {
    act(() => saveConsent(true)); render(<AdBanner slot="top" />);
    const script = document.querySelector(`script[src^="${ADSENSE_SRC}"]`)!;
    await act(async () => { script.dispatchEvent(new Event('error')); });
    expect(document.querySelector('ins.adsbygoogle')).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Advertisement' })).toBeTruthy();
  });
  it('keeps a submitted unit mounted while a slow ad response is pending', async () => {
    vi.useFakeTimers();
    try {
      act(() => saveConsent(true)); render(<AdBanner slot="top" />);
      const script = document.querySelector(`script[src^="${ADSENSE_SRC}"]`)!;
      await act(async () => { script.dispatchEvent(new Event('load')); });
      const unit = document.querySelector('ins.adsbygoogle') as HTMLElement;
      await act(async () => { vi.advanceTimersByTime(25000); });
      expect(document.querySelector('ins.adsbygoogle')).toBe(unit);
      await act(async () => { unit.dataset.adStatus = 'filled'; });
      expect(document.querySelector('ins.adsbygoogle')).toBe(unit);
    } finally { vi.useRealTimers(); }
  });
  it('recognizes a publisher script already loaded outside the React component', async () => {
    const script = document.createElement('script'); script.src = ADSENSE_SRC + '?client=ca-pub-4282337217431581'; document.head.appendChild(script);
    const push = vi.fn(); window.adsbygoogle = Object.assign([], { loaded: true, push });
    act(() => saveConsent(true));
    render(<AdBanner slot="top" />);
    await act(async () => {});
    expect(push).toHaveBeenCalledOnce();
    expect(document.querySelectorAll(`script[src^="${ADSENSE_SRC}"]`)).toHaveLength(1);
  });
  it('removes an unfilled unit without removing React-owned elements behind React', async () => {
    act(() => saveConsent(true)); render(<AdBanner slot="top" />);
    const script = document.querySelector(`script[src^="${ADSENSE_SRC}"]`)!;
    await act(async () => { script.dispatchEvent(new Event('load')); });
    await act(async () => { (document.querySelector('ins.adsbygoogle') as HTMLElement).dataset.adStatus = 'unfilled'; });
    expect(document.querySelector('ins.adsbygoogle')).toBeNull();
    act(() => saveConsent(false));
  });
});
