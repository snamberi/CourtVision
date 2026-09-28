import { handleBilling, billingEnv } from '../../server/billing';
import { supaEnv } from '../../server/supabase';
import type { PagesContext } from '../env';

/* /api/billing, the Lemon Squeezy webhook, on Cloudflare Pages (the Vercel version is server/api-billing.ts). */
export const onRequestPost = ({ request, env }: PagesContext) => handleBilling(request, supaEnv(env), billingEnv(env));
