// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { analyticsPath, parseRoute, routeHash } from '../navigation/routes';
import { useGameHistory } from '../navigation/useGameHistory';

afterEach(cleanup);
function Harness({ restore = async () => {} }: { restore?: (hash: string) => Promise<void> }) {
  const [route, setRoute] = useState('#/menu');
  const state = useGameHistory(route, async (hash, isCurrent) => {
    await restore(hash);
    if (isCurrent()) setRoute(parseRoute(hash) ? hash : '#/menu');
  }, () => setRoute('#/menu'));
  return <><output>{state.restoring ? 'loading' : state.showPrivacy ? 'privacy' : route}</output>
    <button onClick={() => setRoute('#/league/a/dashboard')}>Dashboard</button>
    <button onClick={() => setRoute('#/league/a/coaching')}>Coaching</button>
    <a href="#/privacy">Privacy</a><button onClick={state.closePrivacy}>Close privacy</button></>;
}

describe('saved league navigation', () => {
  it('round trips player IDs and settings; rejects malformed and unknown destinations', () => {
    const route = { saveId: 'save/a', tab: 'editor' as const, player: 'name & / ?' };
    expect(parseRoute(routeHash(route))).toEqual(route);
    expect(parseRoute(routeHash({ saveId: 'a', tab: 'leagueSettings', sub: 'rules' }))?.sub).toBe('rules');
    expect(parseRoute('#/league/%EA/editor')).toBeNull();
    expect(parseRoute('#/league/a/unknown')).toBeNull();
  });
  it('redacts saved league and player identifiers from analytics', () => {
    expect(analyticsPath('#/league/private-save/editor?player=Private+Name')).toBe('/game/editor');
    expect(analyticsPath('#/privacy')).toBe('/privacy');
  });
  it('restores a deep link without adding a duplicate history entry', async () => {
    history.replaceState(null, '', '#/league/a/leagueSettings?sub=rules');
    const length = history.length;
    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('leagueSettings?sub=rules'));
    expect(history.length).toBe(length);
  });
  it('Back and Forward restore the previous game page', async () => {
    history.replaceState(null, '', '#/menu');
    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('#/menu'));
    fireEvent.click(screen.getByText('Dashboard'));
    await waitFor(() => expect(location.hash).toBe('#/league/a/dashboard'));
    fireEvent.click(screen.getByText('Coaching'));
    await waitFor(() => expect(location.hash).toBe('#/league/a/coaching'));
    act(() => history.back());
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('#/league/a/dashboard'));
    act(() => history.forward());
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('#/league/a/coaching'));
  });
  it('ignores an outdated save load when a second navigation occurs', async () => {
    history.replaceState(null, '', '#/league/slow/dashboard');
    let finish!: () => void;
    const slow = new Promise<void>(resolve => { finish = resolve; });
    render(<Harness restore={async hash => { if (hash.includes('/slow/')) await slow; }} />);
    act(() => { history.pushState(null, '', '#/league/fast/coaching'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('#/league/fast/coaching'));
    await act(async () => { finish(); await slow; });
    expect(screen.getByRole('status').textContent).toBe('#/league/fast/coaching');
  });
  it('closes a privacy deep link to its underlying saved page', async () => {
    history.replaceState({ cvRoute: '#/league/a/coaching' }, '', '#/privacy');
    render(<Harness />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('privacy'));
    fireEvent.click(screen.getByText('Close privacy'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('#/league/a/coaching'));
  });
  it('recovers from an unavailable saved league without an unhandled rejection', async () => {
    history.replaceState(null, '', '#/league/missing/dashboard');
    render(<Harness restore={vi.fn().mockRejectedValue(new Error('Unavailable'))} />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('#/menu'));
    await waitFor(() => expect(location.hash).toBe('#/menu'));
  });
});
