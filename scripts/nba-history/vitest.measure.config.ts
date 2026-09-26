import { defineConfig } from 'vitest/config';

/** Runs the build-time measurement scripts in this folder: `npx vitest run -c scripts/nba-history/vitest.measure.config.ts` */
export default defineConfig({ test: { environment: 'node', include: ['scripts/nba-history/*.measure.ts'], testTimeout: 300_000 } });
