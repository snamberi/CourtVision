// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const open = vi.fn(async () => null);
const custom = vi.fn(async () => ({ transactionId: 'txn_7' }));
const cancel = vi.fn(async () => null);
vi.mock('../cloud/account', () => ({
  useAccount: () => ({ status: 'signedIn', userId: 'u1', email: 'gm@x.com', profile: { username: 'Coach' } }),
  refreshProfile: async () => null, cloudEnabled: true, accessToken: () => 'tok',
}));
vi.mock('../cloud/signIn', () => ({ openSignIn: vi.fn() }));
vi.mock('../billing/billing', async () => {
  const real = await vi.importActual<typeof import('../billing/billing')>('../billing/billing');
  return { ...real, onSale: () => true, passesOnSale: () => true, openCheckout: open, customAmountCheckout: custom, cancelSubscription: cancel };
});
const { SupportShop } = await import('../components/shop/SupportShop');
const PRODUCT_NAMES = ['Supporter Pass', 'No-Ads Pass', 'Supporter Bundle', 'Visionary Supporter Bundle', 'Eternal Founder Bundle', 'Custom Support Bundle'];
const CUSTOM_CENTS = 750;
const TEN_DAYS_MS = 10 * 86_400_000;
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

describe('Support Shop', () => {
  it('says nobody has to buy anything, and lists all six products', () => {
    render(<SupportShop onExit={() => {}} onProfile={() => {}} />);
    expect(screen.getByRole('note').textContent).toContain('You never have to buy anything.');
    expect(PRODUCT_NAMES.filter(name => !screen.queryByRole('heading', { name }))).toEqual([]);
  });

  it('opens the Paddle checkout for the account, and a chosen amount through the server', async () => {
    render(<SupportShop onExit={() => {}} onProfile={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Buy · $9.99' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('bundleFounder', expect.objectContaining({ userId: 'u1', email: 'gm@x.com' })));
    fireEvent.change(screen.getByLabelText('Your own amount in US dollars'), { target: { value: '7.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Give $7.50' }));
    await waitFor(() => expect(custom).toHaveBeenCalledWith(CUSTOM_CENTS, 'tok'));
    await waitFor(() => expect(open).toHaveBeenLastCalledWith('bundleCustom', expect.objectContaining({ transactionId: 'txn_7' })));
  });

  it('a monthly pass can be cancelled in two taps', async () => {
    localStorage.setItem('cv-entitlements', JSON.stringify({ noAds: false, supporter: true, supporterUntil: new Date(Date.now() + TEN_DAYS_MS).toISOString(), supporterStatus: 'active' }));
    render(<SupportShop onExit={() => {}} onProfile={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel pass' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('supporter', 'tok'));
    expect(await screen.findByRole('heading', { name: 'Cancelled' })).toBeTruthy();
  });
});
