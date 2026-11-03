import { expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAuthCallback, exchangeAuthCallback } from '../cloud/authCallback';

it('keeps the flow ID for exchange while removing callback secrets and preserving the route', async () => {
  const callback = readAuthCallback('https://courtvisiongame.com/?code=single-use&sb_flow_id=flow123&campaign=test#/career');
  expect(callback.cleanUrl).toBe('/?campaign=test#/career');
  const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
  const client = { auth: { exchangeCodeForSession } } as unknown as SupabaseClient;
  await exchangeAuthCallback(client, callback.code!, callback.flowId);
  expect(exchangeCodeForSession).toHaveBeenCalledWith('single-use', { flowId: 'flow123' });
});
it('supports older redirects without a flow ID', async () => {
  const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
  await exchangeAuthCallback({ auth: { exchangeCodeForSession } } as unknown as SupabaseClient, 'old-code', null);
  expect(exchangeCodeForSession).toHaveBeenCalledWith('old-code', undefined);
});
it('preserves the original network error instead of retrying with a removed verifier', async () => {
  const exchangeCodeForSession = vi.fn().mockResolvedValueOnce({ error: { message: 'Failed to fetch' } }).mockResolvedValue({ error: { message: 'PKCE verifier missing' } });
  expect(await exchangeAuthCallback({ auth: { exchangeCodeForSession } } as unknown as SupabaseClient, 'code', null)).toBe('Failed to fetch');
  expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
});
it('captures provider errors and removes their query fields', () => {
  expect(readAuthCallback('https://courtvisiongame.com/?error=access_denied&error_description=Cancelled&error_code=403#home')).toMatchObject({ failed: 'Cancelled', cleanUrl: '/#home' });
});
