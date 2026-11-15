// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ account: { status: 'signedIn', userId: 'a' as string | null }, load: vi.fn() }));
vi.mock('../cloud/account', () => ({ cloudEnabled: true, useAccount: () => mocks.account }));
vi.mock('../cloud/notifications', async importOriginal => ({ ...await importOriginal<object>(), loadInbox: mocks.load }));
vi.mock('../cloud/boards', () => ({ friendActivity: vi.fn() }));
vi.mock('../cloud/social', () => ({ loadGifts: vi.fn() }));
vi.mock('../cloud/signIn', () => ({ openSignIn: vi.fn() }));
import { NotificationApp } from '../components/cloud/NotificationCentre';
const snapshot = { items: [{ id: 'gift:1', kind: 'gift', at: '2026-11-02T12:00:00Z', title: 'Gift from @friend', body: 'Enjoy!' }], errors: [] };
beforeEach(() => { localStorage.clear(); mocks.account = { status: 'signedIn', userId: 'a' }; mocks.load.mockReset().mockResolvedValue(snapshot); });
afterEach(cleanup);
it('shows unread badges, saves read status, and opens the gift destination', async () => {
  const go = vi.fn(); render(<NotificationApp onFriendList={go} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
  expect(screen.queryByText('Unread ·')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Open gifts' }));
  expect(go).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('discards an old account request after switching accounts', async () => {
  let resolveOld!: (value: typeof snapshot) => void;
  mocks.load.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue({ items: [], errors: [] });
  const view = render(<NotificationApp />);
  mocks.account = { status: 'signedIn', userId: 'b' };
  view.rerender(<NotificationApp />);
  resolveOld(snapshot);
  fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
  await waitFor(() => expect(screen.getByText(/No notifications yet/)).toBeTruthy());
  expect(screen.queryByText('Gift from @friend')).toBeNull();
});
it('shows a retryable failure instead of claiming the inbox is empty', async () => {
  mocks.load.mockResolvedValue({ items: [], errors: ['Gifts could not refresh.'] });
  render(<NotificationApp />);
  fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText(/No notifications yet/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
});
