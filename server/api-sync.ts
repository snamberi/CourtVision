import { handleSync } from './sync';
import { supaEnv } from './supabase';

/* The Vercel Function behind /api/sync (bundled to api/sync.js by scripts/build-api.mjs). */
export const POST = (request: Request) => handleSync(request, supaEnv());
export const DELETE = (request: Request) => handleSync(request, supaEnv());
