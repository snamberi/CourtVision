import { handleBilling, billingEnv } from './billing';
import { supaEnv } from './supabase';

/* The Vercel Function behind /api/billing, the Lemon Squeezy webhook (bundled to api/billing.js by scripts/build-api.mjs). */
export const POST = (request: Request) => handleBilling(request, supaEnv(), billingEnv());
