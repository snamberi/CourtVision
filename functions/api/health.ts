import { handleHealth } from '../../server/health';
import type { PagesContext } from '../env';

/* /api/health on Cloudflare Pages: which online settings are present (yes/no only) and whether Supabase answers. */
export const onRequestGet = ({ env }: PagesContext) => handleHealth(env);
