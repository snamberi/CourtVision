import { handleSync } from '../../server/sync';
import { supaEnv } from '../../server/supabase';
import type { PagesContext } from '../env';

/* /api/sync on Cloudflare Pages (the Vercel version is server/api-sync.ts). */
export const onRequestPost = ({ request, env }: PagesContext) => handleSync(request, supaEnv(env));
export const onRequestDelete = ({ request, env }: PagesContext) => handleSync(request, supaEnv(env));
