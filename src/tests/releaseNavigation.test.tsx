// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MenuPhone } from '../components/MenuPhone';
import { PageJumps } from '../components/PageJumps';
vi.mock('../cloud/account', () => ({ cloudEnabled: false, useAccount: () => ({ status: 'signedOut' }), getAccount: () => ({ status: 'signedOut' }) }));
beforeEach(() => {
  cleanup(); localStorage.clear();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) });
  HTMLElement.prototype.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
it('keeps the selected phone page after opening an app and returning', () => {
  const fn = vi.fn();
  const phone = <MenuPhone streak={{ current: 0, best: 0 }} onClans={fn} onFriendList={fn} onCloset={fn} onBoards={fn} onFriends={fn} onProfile={fn} onRelics={fn} onShop={fn} onRoad={fn} onSettings={fn} onWhatsNew={fn} onAchievements={fn} />;
  const first = render(phone);
  fireEvent.click(screen.getByRole('button', { name: 'Apps page 4' }));
  expect(localStorage.getItem('cv-phone-page')).toBe('3');
  fireEvent.click(screen.getByRole('button', { name: 'Clans' }));
  expect(fn).toHaveBeenCalledOnce();
  first.unmount(); render(phone);
  expect(screen.getByRole('button', { name: 'Apps page 4' }).getAttribute('aria-current')).toBe('true');
  expect(screen.getByRole('button', { name: 'Clans' })).toBeTruthy();
});
it('section jumps follow the visible tab headings', async () => {
  const page = render(<main><PageJumps /><h2>Collection</h2><h2>Shop</h2></main>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Shop' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Shop' }));
  expect(document.activeElement?.textContent).toBe('Shop');
  page.rerender(<main><PageJumps /><h2>Pets</h2><h2>Abilities</h2></main>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Abilities' })).toBeTruthy());
});
