import { handleSocial } from '../../server/social';
import { supaEnv } from '../../server/supabase';
import type { PagesContext } from '../env';

/* /api/social on Cloudflare Pages (the Vercel version is server/api-social.ts). */
export const onRequestPost = ({ request, env }: PagesContext) => handleSocial(request, supaEnv(env));
