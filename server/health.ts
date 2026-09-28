import { supaEnv, json, type Fetch } from './supabase';

/*
 * /api/health: which online settings this deployment has, and whether Supabase answers. It reports only yes/no for
 * each setting, never a value, so it is safe to open in a browser. The game's "Online status" check reads it.
 */
type Env = Record<string, string | undefined>;
const has = (env: Env, ...names: string[]) => names.some(n => !!env[n]);

export interface HealthReport {
  runtime: { url: boolean; publicKey: boolean; serviceKey: boolean };
  /** 'ok', 'no-config' (settings missing), 'unreachable' (the address or key is wrong), or 'no-schema' (supabase/schema.sql not run). */
  supabase: 'ok' | 'no-config' | 'unreachable' | 'no-schema';
  detail?: string;
}

export async function healthReport(env: Env, f: Fetch = fetch): Promise<HealthReport> {
  const runtime = {
    url: has(env, 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL'),
    publicKey: has(env, 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'),
    serviceKey: has(env, 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
  };
  const s = supaEnv(env);
  if (!s) return { runtime, supabase: 'no-config' };
  const key: Record<string, string> = s.serviceKey.startsWith('sb_') ? { apikey: s.serviceKey } : { apikey: s.serviceKey, Authorization: `Bearer ${s.serviceKey}` };
  try {
    const res = await f(`${s.url}/rest/v1/profiles?select=id&limit=1`, { headers: key });
    if (res.ok) return { runtime, supabase: 'ok' };
    const text = (await res.text()).slice(0, 160);
    if (res.status === 404 || /does not exist|PGRST205|42P01/.test(text)) return { runtime, supabase: 'no-schema', detail: text };
    return { runtime, supabase: 'unreachable', detail: `${res.status} ${text}` };
  } catch (e) {
    return { runtime, supabase: 'unreachable', detail: e instanceof Error ? e.message : String(e) };
  }
}

export const handleHealth = async (env: Env, f: Fetch = fetch) => json(await healthReport(env, f));
