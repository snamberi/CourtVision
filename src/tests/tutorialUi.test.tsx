// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';
import { FirstSeasonChecklist } from '../components/tutorial/FirstSeasonChecklist';
import { CoachGuide } from '../components/tutorial/CoachGuide';
import { SeasonRoadMap } from '../components/tutorial/SeasonRoadMap';
import { FEATURES, type FeatureStatus } from '../tutorial/unlocks';
import { LESSONS, type LessonStatus } from '../tutorial/lessons';
import type { RoadMap } from '../tutorial/roadmap';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const base = { onNavigateLeagueSettings: () => {}, collapsed: false, hasControlledTeam: true, seasonPhase: 'regular_season' as const };
const lockedAll: FeatureStatus[] = FEATURES.map((feature) => ({ feature, unlocked: false, when: 'after 5 games', progress: '0 / 5 games' }));

describe('Simple menu', () => {
  it('shows five places to go, the locked tools, and opens a hub on its first page', () => {
    const onNavigate = vi.fn();
    render(<Sidebar {...base} tab="dashboard" onNavigate={onNavigate} navMode="simple" onNavModeChange={() => {}} lockedFeatures={lockedAll} onUnlockAll={() => {}} />);
    const nav = screen.getByRole('navigation', { name: 'Game navigation' });
    for (const label of ['Home', 'My Team', 'Front Office', 'League', 'History', 'Settings & tools']) expect(within(nav).getByRole('button', { name: label })).toBeTruthy();
    // Home is open, with its pages listed.
    expect(within(nav).getByRole('button', { name: 'News' })).toBeTruthy();
    // Locked tools are not in the menu, but are listed with when they open.
    expect(within(nav).queryByRole('button', { name: 'Trade' })).toBeNull();
    expect(within(nav).queryByRole('button', { name: 'Finances' })).toBeNull();
    const unlocks = within(nav).getByRole('region', { name: 'Unlocks as you play' });
    expect(within(unlocks).getByText('Trades & free agents')).toBeTruthy();
    fireEvent.click(within(nav).getByRole('button', { name: 'My Team' }));
    expect(onNavigate).toHaveBeenLastCalledWith('yourTeam');
    fireEvent.click(within(nav).getByRole('button', { name: 'League' }));
    expect(onNavigate).toHaveBeenLastCalledWith('standings');
  });

  it('tags a newly unlocked page NEW and offers the Full menu', () => {
    const onMode = vi.fn();
    render(<Sidebar {...base} tab="trade" onNavigate={() => {}} navMode="simple" onNavModeChange={onMode} lockedFeatures={lockedAll.slice(1)} newTabs={new Set(['trade'])} />);
    const trade = screen.getByRole('button', { name: 'Trade' });
    expect(trade.getAttribute('aria-current')).toBe('page');
    expect(within(trade).getByText('NEW')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show all tools' }));
    expect(onMode).toHaveBeenCalledWith('full');
    fireEvent.click(screen.getByRole('radio', { name: 'Full' }));
    expect(onMode).toHaveBeenLastCalledWith('full');
  });

  it('keeps the Full menu as it was', () => {
    render(<Sidebar {...base} tab="dashboard" onNavigate={() => {}} />);
    for (const title of ['League', 'Team', 'Front Office', 'Stats', 'Sandbox', 'Settings']) expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Trade' })).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Menu size' })).toBeNull();
  });
});

describe('first-season checklist', () => {
  it('counts done lessons, highlights the next one, and only offers Go where it can go', () => {
    const statuses: LessonStatus[] = LESSONS.map((lesson, i) => ({ lesson, done: i < 2, ...(lesson.id === 'trade' ? { lockedUntil: 'Unlocks after 5 games' } : {}) }));
    const onGo = vi.fn();
    render(<FirstSeasonChecklist statuses={statuses} onGo={onGo} onHide={() => {}} />);
    expect(screen.getByText('2 / 8')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Lessons done' }).getAttribute('aria-valuenow')).toBe('2');
    expect(screen.getByText('Press Play, then 1 Game or Watch Next Game.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go: Look for a trade' })).toBeNull();
    expect(screen.getByText('Unlocks after 5 games')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Go: Play your first game' }));
    expect(onGo).toHaveBeenCalledWith(LESSONS[2]);
  });
});

describe('coach guide', () => {
  it('spotlights its target and moves through the steps', () => {
    vi.useFakeTimers();
    const target = document.createElement('button');
    target.className = 'play-button-fixed';
    target.getBoundingClientRect = () => ({ top: 600, left: 900, width: 180, height: 50, bottom: 650, right: 1080, x: 900, y: 600, toJSON: () => ({}) });
    target.scrollIntoView = () => {};
    document.body.appendChild(target);
    const onNext = vi.fn();
    const onSkip = vi.fn();
    render(<CoachGuide step={{ id: 'play', title: 'The Play button', body: 'This is how time moves.', targets: ['.play-button-fixed'] }} index={1} total={8} onBack={() => {}} onNext={onNext} nextLabel="Next: Home" onSkip={onSkip} />);
    const dialog = screen.getByRole('dialog', { name: 'The Play button' });
    expect(within(dialog).getByText('2 / 8')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(500); });
    const spotlight = document.querySelector('.coach-spotlight') as HTMLElement;
    expect(spotlight).toBeTruthy();
    expect(spotlight.style.top).toBe('594px');
    expect(spotlight.style.width).toBe('192px');
    // jsdom's window is 768 px tall and the target sits low, so the card goes just above it.
    expect(dialog.classList.contains('beside-target')).toBe(true);
    expect(parseFloat(dialog.style.top)).toBeLessThan(594);
    fireEvent.click(screen.getByRole('button', { name: 'Next: Home' }));
    expect(onNext).toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalled();
    target.remove();
  });

  it('dims the page and still shows the card when its target is not on screen', () => {
    vi.useFakeTimers();
    render(<CoachGuide step={{ id: 'x', title: 'Welcome', body: 'Hello.', targets: ['[data-tour="missing"]'] }} onNext={() => {}} nextLabel="Got it" />);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(document.querySelector('.coach-dim')).toBeTruthy();
    expect(document.querySelector('.coach-spotlight')).toBeNull();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
  });
});

describe('season road map', () => {
  it('reads out where the season is and what to do now', () => {
    const map: RoadMap = {
      stops: [
        { id: 'preseason', label: 'Preseason', status: 'done' },
        { id: 'regular', label: 'Regular season', status: 'current', note: '10 / 82 games' },
        { id: 'allStar', label: 'All-Star', status: 'next', note: 'in 36 games' },
      ],
      fill: 0.3,
      now: { title: 'Regular season', points: ['Play games.'], actions: [{ label: 'Check my rotation', tab: 'yourTeam' }] },
      next: { title: 'All-Star weekend', text: 'In 36 games.' },
    };
    const onGo = vi.fn();
    render(<SeasonRoadMap map={map} eyebrow="2026-27 · Regular Season" onGo={onGo} />);
    const current = screen.getByText('Regular season', { selector: '.road-stop-label' }).closest('li')!;
    expect(current.getAttribute('aria-current')).toBe('step');
    expect(within(current).getByText('10 / 82 games')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check my rotation' }));
    expect(onGo).toHaveBeenCalledWith('yourTeam');
  });
});
