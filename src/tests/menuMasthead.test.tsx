// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MenuMasthead } from '../components/MenuMasthead';
import { MenuPhone } from '../components/MenuPhone';
import { levelFor } from '../profile/profile';
import { loadRelics } from '../relics/relics';

// Keep account/network state out of these tests.
vi.mock('../components/cloud/AccountButton', () => ({ AccountButton: ({ onProfile, boards, signedInChip }: { onProfile?: () => void; boards?: boolean; signedInChip?: boolean }) => <>{boards !== false && <button>Leaderboards</button>}<button onClick={onProfile} data-chip={String(signedInChip)}>Sign in</button></> }));
vi.mock('../components/UserAvatar', () => ({ MyAvatar: () => <i /> }));
afterEach(cleanup);

describe('menu header', () => {
  it('shows the current profile and wallet and opens the corresponding destinations', () => {
    const profile = vi.fn(), shop = vi.fn(), phone = vi.fn();
    const wallet = { ...loadRelics(), coins: 142, gems: 19, gemLedger: { earned: 19 } };
    render(<MenuMasthead xp={720} wallet={wallet} onShop={shop} onPhone={phone} onBoards={() => {}}
      onFriends={() => {}} onFriendList={() => {}} onProfile={profile} />);
    expect(screen.getByRole('link', { name: 'CourtVision home' }).getAttribute('href')).toBe('#/menu');
    fireEvent.click(screen.getByRole('button', { name: new RegExp('Profile for .+, level ' + levelFor(720).level) }));
    fireEvent.click(screen.getByRole('button', { name: '142 coins, open shop' }));
    fireEvent.click(screen.getByRole('button', { name: '19 gems, open shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open menu phone' }));
    expect(profile).toHaveBeenCalledOnce();
    expect(shop).toHaveBeenCalledTimes(2);
    expect(phone).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' }).getAttribute('data-chip')).toBe('false');
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
