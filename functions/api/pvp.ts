import { handlePvp } from '../../server/pvp';
import { supaEnv } from '../../server/supabase';
import type { PagesContext } from '../env';

/* /api/pvp on Cloudflare Pages (the Vercel version is server/api-pvp.ts). */
export const onRequestPost = ({ request, env }: PagesContext) => handlePvp(request, supaEnv(env));
