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
it('collapses quick jumps after selecting a section and tracks opened details', async () => {
  const view = render(<main><PageJumps /><h2>Collection</h2><h2>Shop</h2><details><summary>More</summary><h2>Hidden glossary</h2></details></main>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Shop' })).toBeTruthy());
  expect(screen.queryByRole('button', {name:'Hidden glossary'})).toBeNull();
  const toggle = screen.getByRole('button', {name:/Quick jumps/});
  fireEvent.click(toggle); expect(toggle.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(screen.getByRole('button', {name:'Shop'}));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  view.container.querySelector<HTMLDetailsElement>('main > details')!.open = true;
  await waitFor(() => expect(screen.getByRole('button', { name: 'Hidden glossary' })).toBeTruthy());
});
it('pinning and unpinning keeps the existing custom app order intact', () => {
  localStorage.setItem('cv-phone-pins', JSON.stringify(['settings']));
  const fn = vi.fn();
  render(<MenuPhone streak={{current:0,best:0}} onSettings={fn} onRelics={fn} />);
  expect(document.querySelector('.menu-phone-app')?.textContent).toContain('Settings');
  fireEvent.click(screen.getByRole('button', {name:'Rearrange'}));
  fireEvent.click(screen.getByRole('button', {name:'Unpin Settings'}));
  expect(document.querySelector('.menu-phone-app')?.textContent).not.toContain('Settings');
  fireEvent.click(screen.getByRole('button', {name:'Pin Settings'}));
  expect(document.querySelector('.menu-phone-app')?.textContent).toContain('Settings');
  expect(localStorage.getItem('cv-phone-order')).toBeNull();
});
it('opens CourtChat within the phone screen and returns to apps', () => {
  render(<MenuPhone streak={{ current: 0, best: 0 }} />);
  const chat = screen.getByRole('button', { name: 'CourtChat', hidden: true });
  fireEvent.click(chat);
  const app = screen.getByRole('region', { name: 'CourtChat' });
  expect(app.parentElement?.classList.contains('phone-app-viewport')).toBe(true);
  expect(screen.getByRole('button', { name: 'Back to phone apps' })).toBe(document.activeElement);
  fireEvent.click(screen.getByRole('button', { name: 'Back to phone apps' }));
  expect(screen.queryByRole('region', { name: 'CourtChat' })).toBeNull();
});
