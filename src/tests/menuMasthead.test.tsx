// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MenuMasthead } from '../components/MenuMasthead';
import { MenuPhone } from '../components/MenuPhone';

// Keep account/network state out of these tests.
vi.mock('../components/cloud/AccountButton', () => ({ AccountButton: ({ onProfile, boards, signedInChip }: { onProfile?: () => void; boards?: boolean; signedInChip?: boolean }) => <>{boards !== false && <button>Leaderboards</button>}<button onClick={onProfile} data-chip={String(signedInChip)}>Sign in</button></> }));
vi.mock('../components/UserAvatar', () => ({ MyAvatar: () => <i /> }));
afterEach(cleanup);

describe('menu header', () => {
  it('holds only sign in, Install app, Settings and Discord', () => {
    const settings = vi.fn();
    render(<MenuMasthead onSettings={settings} onCommunity={() => {}} onProfile={() => {}} />);
    const header = screen.getByRole('banner');
    const labels = [...header.querySelectorAll('button, a')].map(e => e.getAttribute('aria-label') ?? e.textContent?.trim());
    expect(labels).toHaveLength(4);
    expect(labels).toContain('Sign in');
    expect(labels).toContain('Install app');
    expect(labels).toContain('Settings');
    expect(labels.some(l => /discord/i.test(l ?? ''))).toBe(true);
    expect(screen.queryByText('Leaderboards')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(settings).toHaveBeenCalledOnce();
    // Settings is just the gear; once signed in, the @name button stays off the header (the phone has the profile).
    expect(screen.getByRole('button', { name: 'Settings' }).textContent).toBe('');
    expect(screen.getByText('Sign in').getAttribute('data-chip')).toBe('false');
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

  it('the Streak app opens your streak and every reward', () => {
    const profile = vi.fn();
    render(<MenuPhone onProfile={profile} streak={{ current: 6, best: 9 }} />);
    fireEvent.click(screen.getByRole('button', { name: /Daily streak/ }));
    const dialog = screen.getByRole('dialog', { name: 'Your daily streak' });
    expect(dialog.textContent).toContain('6 days');
    expect(dialog.textContent).toContain('best 9 days');
    expect(dialog.querySelectorAll('.streak-rewards li')).toHaveLength(5);
    expect(dialog.querySelectorAll('.streak-rewards li.got')).toHaveLength(2); // days 3 and 7
    expect(dialog.textContent).toContain('Next: day 14');
    fireEvent.click(screen.getByRole('button', { name: 'Your profile' }));
    expect(profile).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
