import { handleSocial } from './social';
import { supaEnv } from './supabase';

/* The Vercel Function behind /api/social (bundled to api/social.js by scripts/build-api.mjs). */
export const POST = (request: Request) => handleSocial(request, supaEnv());
