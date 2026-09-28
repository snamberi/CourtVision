/*
 * Supabase from a Vercel Function, over plain HTTP (no SDK in the bundle). The Vercel ↔ Supabase integration sets
 * SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (newer projects: SUPABASE_PUBLISHABLE_KEY and
 * SUPABASE_SECRET_KEY); all are read.
 */

export interface SupaEnv { url: string; serviceKey: string; publicKey: string }
type Env = Record<string, string | undefined>;
const pick = (env: Env, ...names: string[]) => names.map(n => env[n]).find(v => !!v);

export function supaEnv(env: Env = (globalThis as { process?: { env: Env } }).process?.env ?? {}): SupaEnv | null {
  const url = pick(env, 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = pick(env, 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
  const publicKey = pick(env, 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY') ?? serviceKey;
  return url && serviceKey && publicKey ? { url: url.replace(/\/$/, ''), serviceKey, publicKey } : null;
}

/** New-style keys (sb_…) go in the apikey header only; legacy JWT keys also as the bearer token. */
const keyHeaders = (key: string): Record<string, string> => (key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` });

export type Fetch = typeof fetch;

/** The signed-in user behind an access token, or null. */
export async function getUser(env: SupaEnv, token: string, f: Fetch = fetch): Promise<{ id: string; email?: string } | null> {
  const res = await f(`${env.url}/auth/v1/user`, { headers: { apikey: env.publicKey, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const u = await res.json() as { id?: string; email?: string };
  return u.id ? { id: u.id, email: u.email } : null;
}

/** A PostgREST call with the service key (row level security does not apply). */
export async function rest(env: SupaEnv, method: string, path: string, body?: unknown, prefer?: string, f: Fetch = fetch): Promise<unknown> {
  const res = await f(`${env.url}/rest/v1/${path}`, {
    method, headers: { ...keyHeaders(env.serviceKey), 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} ${path.split('?')[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** How many rows match a query (PostgREST's exact count, without the rows). */
export async function count(env: SupaEnv, path: string, f: Fetch = fetch): Promise<number> {
  const res = await f(`${env.url}/rest/v1/${path}${path.includes('?') ? '&' : '?'}limit=1`, { method: 'GET', headers: { ...keyHeaders(env.serviceKey), Prefer: 'count=exact' } });
  if (!res.ok) throw new Error(`count ${path.split('?')[0]}: ${res.status}`);
  const total = Number(res.headers.get('content-range')?.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

export const upsert =(env: SupaEnv, table: string, rows: Record<string, unknown>[], onConflict: string, f?: Fetch) =>
  rows.length ? rest(env, 'POST', `${table}?on_conflict=${onConflict}`, rows, 'resolution=merge-duplicates,return=minimal', f) : Promise.resolve(null);

export async function deleteUser(env: SupaEnv, id: string, f: Fetch = fetch): Promise<void> {
  const res = await f(`${env.url}/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', headers: keyHeaders(env.serviceKey) });
  if (!res.ok) throw new Error(`delete user: ${res.status}`);
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export const bearer = (req: Request) => req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
