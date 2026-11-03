import type { SupabaseClient } from '@supabase/supabase-js';

/** Capture the flow identifier before removing sensitive callback parameters. */
export function readAuthCallback(href: string) {
  const url = new URL(href);
  const code = url.searchParams.get('code');
  const flowId = url.searchParams.get('sb_flow_id');
  const failed = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  for (const key of ['code', 'sb_flow_id', 'error', 'error_description', 'error_code']) url.searchParams.delete(key);
  return { code, flowId, failed, cleanUrl: url.pathname + url.search + url.hash };
}

/** Codes are single-use. The SDK clears the verifier on failure, so do not retry it. */
export async function exchangeAuthCallback(client: Pick<SupabaseClient, 'auth'>, code: string, flowId: string | null): Promise<string | null> {
  const { error } = await client.auth.exchangeCodeForSession(code, flowId !== null ? { flowId } : undefined);
  return error?.message ?? null;
}
