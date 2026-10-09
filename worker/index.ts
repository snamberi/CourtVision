import { handleSync } from '../server/sync';
import { handlePvp } from '../server/pvp';
import { handleBilling, billingEnv } from '../server/billing';
import { supaEnv, json } from '../server/supabase';
import { handleHealth } from '../server/health';
import { BUILD_ENV, BUILD_INFO } from './buildEnv.generated';

/*
 * Court Vision as a Cloudflare Worker (wrangler.jsonc): the built game is served as static assets, and this script
 * answers only /api/* (run_worker_first), with the same handlers as the Vercel and Pages functions. Settings come from
 * the Worker's Variables and Secrets, or else from the Build variables copied in at build time (scripts/worker-build-env.mjs).
 */
interface Env { ASSETS: { fetch(request: Request): Promise<Response> }; [name: string]: unknown }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const vars = { ...BUILD_ENV, ...Object.fromEntries(Object.entries(env).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].trim() !== '')) };
    const method = request.method;
    if (pathname === '/api/sync' && (method === 'POST' || method === 'DELETE')) return handleSync(request, supaEnv(vars));
    if (pathname === '/api/pvp' && method === 'POST') return handlePvp(request, supaEnv(vars));
    if (pathname === '/api/billing' && method === 'POST') return handleBilling(request, supaEnv(vars), billingEnv(vars));
    if (pathname === '/api/health' && method === 'GET') return handleHealth(vars);
    // Which build this Worker is: compare it with the cv-build line in the page to tell whether an address serves it.
    if (pathname === '/api/version' && method === 'GET') return new Response(JSON.stringify({ worker: 'courtvision', ...BUILD_INFO, host: new URL(request.url).host }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    if (pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
    return env.ASSETS.fetch(request);
  },
};
