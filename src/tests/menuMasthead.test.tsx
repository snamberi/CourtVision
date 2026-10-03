// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MenuMasthead } from '../components/MenuMasthead';
import { MenuPhone } from '../components/MenuPhone';

// Keep account/network state out of these tests.
vi.mock('../components/cloud/AccountButton', () => ({ AccountButton: ({ onProfile, boards }: { onProfile?: () => void; boards?: boolean }) => <>{boards !== false && <button>Leaderboards</button>}<button onClick={onProfile}>Sign in</button></> }));
vi.mock('../components/UserAvatar', () => ({ MyAvatar: () => <i /> }));
afterEach(cleanup);

describe('menu header', () => {
  it('holds only sign in, Settings and Discord', () => {
    const settings = vi.fn();
    render(<MenuMasthead onSettings={settings} onCommunity={() => {}} onProfile={() => {}} />);
    const header = screen.getByRole('banner');
    const labels = [...header.querySelectorAll('button, a')].map(e => e.getAttribute('aria-label') ?? e.textContent?.trim());
    expect(labels).toHaveLength(3);
    expect(labels).toContain('Sign in');
    expect(labels).toContain('Settings');
    expect(labels.some(l => /discord/i.test(l ?? ''))).toBe(true);
    expect(screen.queryByText('Leaderboards')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(settings).toHaveBeenCalledOnce();
  });
});

describe('menu phone', () => {
  it('opens the boards, friends and profile, and shows the streak', () => {
    const boards = vi.fn(), friends = vi.fn(), profile = vi.fn();
    render(<MenuPhone onBoards={boards} onFriends={friends} onProfile={profile} streak={{ current: 6, best: 9 }} />);
    fireEvent.click(screen.getByRole('button', { name: /Boards/ }));
    fireEvent.click(screen.getByRole('button', { name: /Friends/ }));
    fireEvent.click(screen.getByRole('button', { name: /Profile, level/ }));
    expect(boards).toHaveBeenCalledOnce();
    expect(friends).toHaveBeenCalledOnce();
    expect(profile).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Daily streak: 6 days, best 9' })).toBeTruthy();
  });
});
