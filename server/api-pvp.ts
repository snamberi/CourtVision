import { handlePvp } from './pvp';
import { supaEnv } from './supabase';

/* The Vercel Function behind /api/pvp (bundled to api/pvp.js by scripts/build-api.mjs). */
export const POST = (request: Request) => handlePvp(request, supaEnv());
