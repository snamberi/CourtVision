import { handle, upstash, type Redis } from './leaderboard';

/* The Vercel Function behind /api/leaderboard (bundled to api/leaderboard.js by scripts/build-api.mjs). */

const env = (name: string) => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[name];
function fromEnv(): Redis | null {
  const url = env('KV_REST_API_URL') ?? env('UPSTASH_REDIS_REST_URL'), token = env('KV_REST_API_TOKEN') ?? env('UPSTASH_REDIS_REST_TOKEN');
  return url && token ? upstash(url, token) : null;
}
export const GET = (request: Request) => handle(request, fromEnv());
export const POST = (request: Request) => handle(request, fromEnv());
