// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MenuMasthead } from '../components/MenuMasthead';

// Keep account/network state out of the responsive disclosure interaction.
vi.mock('../components/ProfilePanel', () => ({ ProfileChip: ({ onOpen }: { onOpen: () => void }) => <button onClick={onOpen}>Profile</button> }));
vi.mock('../components/cloud/AccountButton', () => ({ AccountButton: ({ onCommunity }: { onCommunity: () => void }) => <button onClick={onCommunity}>Leaderboards</button> }));
vi.mock('../components/ThemePicker', () => ({ ThemeChip: () => <button>Change theme</button> }));
afterEach(cleanup);

describe('compact masthead actions', () => {
  it('closes on Escape, restores focus, and dismisses on outside clicks', () => {
    render(<MenuMasthead streak={{ current: 2, best: 4 }} onSettings={() => {}} />);
    const toggle = screen.getByRole('button', { name: 'Account and community' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
    fireEvent.click(toggle);
    fireEvent.pointerDown(document.body);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps navigation callbacks working and closes after choosing an action', () => {
    const profile = vi.fn(), community = vi.fn(), settings = vi.fn();
    render(<MenuMasthead streak={{ current: 1, best: 1 }} onProfile={profile} onCommunity={community} onSettings={settings} />);
    const toggle = screen.getByRole('button', { name: 'Account and community' });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(profile).toHaveBeenCalledOnce();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Leaderboards' }));
    expect(community).toHaveBeenCalledOnce();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(settings).toHaveBeenCalledOnce();
  });
});
