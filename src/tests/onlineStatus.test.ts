import { describe, it, expect } from 'vitest';
import { statusSteps } from '../cloud/onlineStatus';
import { healthReport } from '../../server/health';

const res = (status: number, body = '') => new Response(body, { status });

describe('online status check', () => {
  it('points at the build variables first when the game was built without them', () => {
    const steps = statusSteps({ url: null, hasKey: false }, 'no-api', null);
    expect(steps[0]).toMatchObject({ id: 'build', state: 'fail' });
    expect(steps[0].fix).toContain('SUPABASE_URL and SUPABASE_ANON_KEY');
    expect(steps.find(s => s.id === 'api')?.state).toBe('fail');
    expect(steps.some(s => s.id === 'auth')).toBe(false);
  });
  it('names the missing runtime secret and a missing schema', () => {
    const steps = statusSteps({ url: 'https://x.supabase.co', hasKey: true }, { runtime: { url: true, publicKey: true, serviceKey: false }, supabase: 'no-config' }, true);
    expect(steps.find(s => s.id === 'runtime')?.fix).toContain('SUPABASE_SERVICE_ROLE_KEY');
    const noSchema = statusSteps({ url: 'https://x.supabase.co', hasKey: true }, { runtime: { url: true, publicKey: true, serviceKey: true }, supabase: 'no-schema' }, true);
    expect(noSchema.find(s => s.id === 'database')?.fix).toContain('schema.sql');
    const ok = statusSteps({ url: 'https://x.supabase.co', hasKey: true }, { runtime: { url: true, publicKey: true, serviceKey: true }, supabase: 'ok' }, true);
    expect(ok.every(s => s.state === 'ok')).toBe(true);
  });
});

describe('/api/health', () => {
  const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'secret-value' };
  it('reports settings as yes/no only and never echoes a value', async () => {
    const r = await healthReport(env, (async () => res(200, '[]')) as typeof fetch);
    expect(r).toEqual({ runtime: { url: true, publicKey: true, serviceKey: true }, supabase: 'ok' });
    expect(JSON.stringify(await healthReport({}, (async () => res(200)) as typeof fetch))).not.toContain('secret');
  });
  it('tells a missing schema from a wrong key', async () => {
    expect((await healthReport(env, (async () => res(404, '{"code":"PGRST205"}')) as typeof fetch)).supabase).toBe('no-schema');
    expect((await healthReport(env, (async () => res(401, 'Invalid API key')) as typeof fetch)).supabase).toBe('unreachable');
    expect((await healthReport({ SUPABASE_URL: 'u' }, (async () => res(200)) as typeof fetch)).supabase).toBe('no-config');
  });
});
