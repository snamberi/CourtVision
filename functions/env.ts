/*
 * Cloudflare Pages Functions (the Cloudflare twin of the Vercel Functions in api/). Each file under functions/api/
 * answers the same path (/api/sync, /api/pvp, /api/billing) with the same handler from server/; Cloudflare builds
 * them itself at deploy time. Settings come from the project's environment variables and secrets, passed in as env.
 */
export type Env = Record<string, string | undefined>;
export interface PagesContext { request: Request; env: Env }
