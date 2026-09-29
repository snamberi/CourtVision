import { cloudBuild, cloudPublicKey } from './account';

/*
 * The Online status check: goes through everything accounts and leaderboards need on this site, in order, and says
 * which step is missing. The site owner sets the values in Cloudflare and Supabase; nothing secret is shown here.
 */

export type StepState = 'ok' | 'fail' | 'unknown';
export interface Step { id: 'build' | 'api' | 'runtime' | 'database' | 'auth'; label: string; state: StepState; fix?: string }

interface Health { runtime: { url: boolean; publicKey: boolean; serviceKey: boolean }; supabase: 'ok' | 'no-config' | 'unreachable' | 'no-schema'; detail?: string }

/** Turns what the build has and what /api/health and Supabase said into the checklist. Pure, for tests. */
export function statusSteps(build: { url: string | null; hasKey: boolean }, health: Health | 'no-api' | null, authOk: boolean | null): Step[] {
  const steps: Step[] = [];
  const built = !!build.url && build.hasKey;
  steps.push({ id: 'build', label: 'The game was built with the Supabase address and public key', state: built ? 'ok' : 'fail',
    fix: built ? undefined : `Cloudflare → Workers & Pages → courtvision → Settings → Builds → Build variables and secrets: add ${!build.url ? 'SUPABASE_URL' : ''}${!build.url && !build.hasKey ? ' and ' : ''}${!build.hasKey ? 'SUPABASE_ANON_KEY' : ''}, then Retry build. They are baked in when the game is built, so the Variables on the running Worker alone are not enough.` });
  steps.push({ id: 'api', label: 'The site answers /api (the Worker script is deployed)', state: health === 'no-api' ? 'fail' : health ? 'ok' : 'unknown',
    fix: health === 'no-api' ? 'The deploy command must be "npx wrangler deploy" (it deploys worker/index.ts with the game). Check Settings → Builds and redeploy.' : undefined });
  if (health && health !== 'no-api') {
    const missing = [!health.runtime.url && 'SUPABASE_URL', !health.runtime.publicKey && 'SUPABASE_ANON_KEY', !health.runtime.serviceKey && 'SUPABASE_SERVICE_ROLE_KEY (as a Secret)'].filter(Boolean);
    steps.push({ id: 'runtime', label: 'The running site has its Supabase settings (for cloud saves and PvP)', state: missing.length ? 'fail' : 'ok',
      fix: missing.length ? `Cloudflare → courtvision → Settings → Variables and Secrets: add ${missing.join(', ')}. No rebuild needed.` : undefined });
    steps.push({ id: 'database', label: 'Supabase answers and the tables exist', state: health.supabase === 'ok' ? 'ok' : health.supabase === 'no-config' ? 'unknown' : 'fail',
      fix: health.supabase === 'no-schema' ? 'Supabase → SQL Editor: paste all of supabase/schema.sql from the repository and Run.'
        : health.supabase === 'unreachable' ? `Supabase did not accept the address or key${health.detail ? ` (${health.detail.slice(0, 80)})` : ''}. Copy SUPABASE_URL and the keys again from Supabase → Project Settings → API. A paused free project must be restored in Supabase first.` : undefined });
  }
  if (built) steps.push({ id: 'auth', label: 'This browser can reach Supabase sign-in', state: authOk == null ? 'unknown' : authOk ? 'ok' : 'fail',
    fix: authOk === false ? 'Supabase did not accept this build\'s public key, or did not answer. Copy the anon (public) key again from Supabase → Project Settings → API into the Build variable SUPABASE_ANON_KEY and Retry build. If the project is paused (free projects pause after a week without use), restore it in the Supabase dashboard.' : undefined });
  return steps;
}

/** Runs the whole check from this browser. */
export async function checkOnline(): Promise<Step[]> {
  let health: Health | 'no-api' | null = null;
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    health = r.ok && (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Health : 'no-api';
  } catch { health = 'no-api'; }
  let authOk: boolean | null = null;
  if (cloudBuild.url) {
    try { const r = await fetch(`${cloudBuild.url.replace(/\/$/, '')}/auth/v1/settings`, { headers: cloudPublicKey ? { apikey: cloudPublicKey } : {} }); authOk = r.ok; } catch { authOk = false; }
  }
  return statusSteps(cloudBuild, health, authOk);
}

/** The addresses Supabase must allow for sign-in to come back to this site (Authentication → URL Configuration). */
export const redirectHelp = () => `Supabase → Authentication → URL Configuration: set Site URL to ${location.origin} and add ${location.origin}/** to Redirect URLs (keep www.${location.hostname.replace(/^www\./, '')} too if you use it).`;
