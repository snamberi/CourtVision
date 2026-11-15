// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const signInWith = vi.fn(async () => {});
vi.mock('../cloud/account', async () => {
  const real = await vi.importActual<typeof import('../cloud/account')>('../cloud/account');
  return { ...real, cloudEnabled: () => true, signInWith: (...a: unknown[]) => signInWith(...(a as [])), useAccount: () => ({ status: 'signedOut', userId: null, email: null, provider: null, profile: null }) };
});
vi.mock('../cloud/signIn', async () => {
  const real = await vi.importActual<typeof import('../cloud/signIn')>('../cloud/signIn');
  return { ...real, useSignInOpen: () => true };
});
import { CloudRoot, AGE_OK_KEY } from '../components/cloud/CloudRoot';

beforeEach(() => { localStorage.clear(); signInWith.mockClear(); });
afterEach(cleanup);

describe('accounts are 13 and up', () => {
  it('keeps the sign-in buttons off until the visitor confirms they are 13 or older, then remembers it', () => {
    render(<CloudRoot />);
    const discord = screen.getByRole('button', { name: /Continue with Discord/ }) as HTMLButtonElement;
    expect(discord.disabled).toBe(true);
    fireEvent.click(discord);
    expect(signInWith).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: /13 or older/ }));
    expect(discord.disabled).toBe(false);
    expect(localStorage.getItem(AGE_OK_KEY)).toBe('1');
    fireEvent.click(discord);
    expect(signInWith).toHaveBeenCalledWith('discord');
  });
});
